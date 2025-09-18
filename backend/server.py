from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
import os
import logging
import json
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30 * 24  # 30 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Create the main app
app = FastAPI(title="ChatRooms API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: str):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append(websocket)

    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.active_connections:
            self.active_connections[room_id].remove(websocket)
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast_to_room(self, message: dict, room_id: str):
        if room_id in self.active_connections:
            message_str = json.dumps(message)
            for connection in self.active_connections[room_id]:
                try:
                    await connection.send_text(message_str)
                except:
                    pass

manager = ConnectionManager()

# Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    nickname: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    language: Optional[str] = None
    avatar_url: Optional[str] = None

class NicknameChangeRequest(BaseModel):
    new_nickname: str
    reason: str

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class User(BaseModel):
    id: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None
    language: Optional[str] = 'en'
    is_active: bool = True
    created_at: datetime

class FriendRequest(BaseModel):
    friend_user_id: str

class PrivateMessageCreate(BaseModel):
    content: str
    recipient_id: str

class Friend(BaseModel):
    id: str
    user_id: str
    friend_user_id: str
    friend_nickname: str
    friend_first_name: str
    friend_last_name: str
    friend_avatar_url: Optional[str] = None
    created_at: datetime
    last_message: Optional[str] = None
    last_message_time: Optional[datetime] = None
    unread_count: int = 0

class PrivateMessage(BaseModel):
    id: str
    sender_id: str
    recipient_id: str
    content: str
    sender_nickname: str
    sender_avatar_url: Optional[str] = None
    created_at: datetime
    is_read: bool = False

class NicknameRequest(BaseModel):
    id: str
    user_id: str
    current_nickname: str
    new_nickname: str
    reason: str
    status: str  # pending, approved, rejected
    created_at: datetime
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None
    admin_comment: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str

class RoomCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_private: bool = False

class Room(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    is_private: bool = False
    created_by: str
    created_at: datetime
    member_count: int = 0

class MessageCreate(BaseModel):
    content: str

class MessageCreateForRoom(BaseModel):
    content: str
    room_id: str

class Message(BaseModel):
    id: str
    content: str
    room_id: str
    user_id: str
    user_name: str
    user_avatar: Optional[str] = None
    created_at: datetime

# Utility functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"id": user_id})
    if user is None:
        raise credentials_exception
    return User(**user)

# Authentication routes
@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    # Validate email - let Pydantic handle basic validation, we just check existence
    email = user_data.email
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = str(uuid.uuid4())
    hashed_password = get_password_hash(user_data.password)
    
    user_doc = {
        "id": user_id,
        "email": email,
        "first_name": user_data.first_name,
        "last_name": user_data.last_name,
        "nickname": user_data.nickname,
        "hashed_password": hashed_password,
        "avatar_url": None,
        "language": "en",  # Default language
        "is_active": True,
        "created_at": datetime.utcnow()
    }
    
    await db.users.insert_one(user_doc)
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user_id}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@api_router.post("/auth/login", response_model=Token)
async def login(user_data: UserLogin):
    user = await db.users.find_one({"email": user_data.email})
    if not user or not verify_password(user_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["id"]}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.put("/auth/profile", response_model=User)
async def update_profile(user_updates: UserUpdate, current_user: User = Depends(get_current_user)):
    update_data = {}
    if user_updates.first_name is not None:
        update_data["first_name"] = user_updates.first_name
    if user_updates.last_name is not None:
        update_data["last_name"] = user_updates.last_name
    if user_updates.language is not None:
        update_data["language"] = user_updates.language
    if user_updates.avatar_url is not None:
        update_data["avatar_url"] = user_updates.avatar_url
    
    if update_data:
        await db.users.update_one(
            {"id": current_user.id},
            {"$set": update_data}
        )
        
        # Get updated user
        updated_user = await db.users.find_one({"id": current_user.id})
        return User(**updated_user)
    
    return current_user

@api_router.post("/auth/nickname-request")
async def request_nickname_change(request_data: NicknameChangeRequest, current_user: User = Depends(get_current_user)):
    # Check if nickname is already taken
    existing_user = await db.users.find_one({"nickname": request_data.new_nickname})
    if existing_user and existing_user["id"] != current_user.id:
        raise HTTPException(status_code=400, detail="Nickname already taken")
    
    # Check if user already has a pending request
    existing_request = await db.nickname_requests.find_one({
        "user_id": current_user.id,
        "status": "pending"
    })
    if existing_request:
        raise HTTPException(status_code=400, detail="You already have a pending nickname change request")
    
    # Create nickname change request
    request_id = str(uuid.uuid4())
    request_doc = {
        "id": request_id,
        "user_id": current_user.id,
        "current_nickname": current_user.nickname,
        "new_nickname": request_data.new_nickname,
        "reason": request_data.reason,
        "status": "pending",
        "created_at": datetime.utcnow(),
        "reviewed_at": None,
        "reviewed_by": None,
        "admin_comment": None
    }
    
    await db.nickname_requests.insert_one(request_doc)
    
    return {"message": "Nickname change request submitted successfully", "request_id": request_id}

@api_router.get("/auth/nickname-requests")
async def get_user_nickname_requests(current_user: User = Depends(get_current_user)):
    requests = await db.nickname_requests.find({"user_id": current_user.id}).sort("created_at", -1).to_list(10)
    
    request_list = []
    for req in requests:
        request_list.append(NicknameRequest(**req))
    
    return request_list

# Admin endpoints for nickname management (simplified - in production you'd want proper admin auth)
@api_router.get("/admin/nickname-requests")
async def get_all_nickname_requests(current_user: User = Depends(get_current_user)):
    # In production, add proper admin role check here
    requests = await db.nickname_requests.find({"status": "pending"}).sort("created_at", 1).to_list(50)
    
    request_list = []
    for req in requests:
        # Get user info
        user = await db.users.find_one({"id": req["user_id"]})
        request_with_user = {**req}
        if user:
            request_with_user["user_email"] = user["email"]
            request_with_user["user_full_name"] = f"{user['first_name']} {user['last_name']}"
        
        request_list.append(request_with_user)
    
    return request_list

@api_router.post("/admin/nickname-requests/{request_id}/approve")
async def approve_nickname_request(request_id: str, admin_comment: str = "", current_user: User = Depends(get_current_user)):
    # In production, add proper admin role check here
    
    # Get the request
    request_doc = await db.nickname_requests.find_one({"id": request_id})
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if request_doc["status"] != "pending":
        raise HTTPException(status_code=400, detail="Request already processed")
    
    # Update user's nickname
    await db.users.update_one(
        {"id": request_doc["user_id"]},
        {"$set": {"nickname": request_doc["new_nickname"]}}
    )
    
    # Update request status
    await db.nickname_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "approved",
            "reviewed_at": datetime.utcnow(),
            "reviewed_by": current_user.id,
            "admin_comment": admin_comment
        }}
    )
    
    return {"message": "Nickname change request approved"}

# Friends endpoints
@api_router.post("/friends/request")
async def send_friend_request(request_data: FriendRequest, current_user: User = Depends(get_current_user)):
    # Check if friend exists
    friend_user = await db.users.find_one({"id": request_data.friend_user_id})
    if not friend_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if already friends
    existing_friendship = await db.friends.find_one({
        "$or": [
            {"user_id": current_user.id, "friend_user_id": request_data.friend_user_id},
            {"user_id": request_data.friend_user_id, "friend_user_id": current_user.id}
        ]
    })
    if existing_friendship:
        raise HTTPException(status_code=400, detail="Already friends")
    
    # Create friendship (auto-accept for now, can add approval later)
    friendship_id = str(uuid.uuid4())
    friendship_doc = {
        "id": friendship_id,
        "user_id": current_user.id,
        "friend_user_id": request_data.friend_user_id,
        "friend_nickname": friend_user.get("nickname", "Unknown"),
        "friend_first_name": friend_user.get("first_name", ""),
        "friend_last_name": friend_user.get("last_name", ""),
        "friend_avatar_url": friend_user.get("avatar_url"),
        "created_at": datetime.utcnow(),
        "last_message": None,
        "last_message_time": None,
        "unread_count": 0
    }
    await db.friends.insert_one(friendship_doc)
    
    # Create reverse friendship
    reverse_friendship_id = str(uuid.uuid4())
    reverse_friendship_doc = {
        "id": reverse_friendship_id,
        "user_id": request_data.friend_user_id,
        "friend_user_id": current_user.id,
        "friend_nickname": current_user.nickname or "Unknown",
        "friend_first_name": current_user.first_name or "",
        "friend_last_name": current_user.last_name or "",
        "friend_avatar_url": current_user.avatar_url,
        "created_at": datetime.utcnow(),
        "last_message": None,
        "last_message_time": None,
        "unread_count": 0
    }
    await db.friends.insert_one(reverse_friendship_doc)
    
    return {"message": "Friend added successfully"}

@api_router.get("/friends", response_model=List[Friend])
async def get_friends(current_user: User = Depends(get_current_user)):
    friends = await db.friends.find({"user_id": current_user.id}).sort("last_message_time", -1).to_list(50)
    
    friend_list = []
    for friend in friends:
        friend_list.append(Friend(**friend))
    
    return friend_list

@api_router.post("/private-messages", response_model=PrivateMessage)
async def send_private_message(message_data: PrivateMessageCreate, current_user: User = Depends(get_current_user)):
    # Check if recipient exists
    recipient = await db.users.find_one({"id": message_data.recipient_id})
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    # Create message
    message_id = str(uuid.uuid4())
    message_doc = {
        "id": message_id,
        "sender_id": current_user.id,
        "recipient_id": message_data.recipient_id,
        "content": message_data.content,
        "sender_nickname": current_user.nickname or "Unknown",
        "sender_avatar_url": current_user.avatar_url,
        "created_at": datetime.utcnow(),
        "is_read": False
    }
    
    await db.private_messages.insert_one(message_doc)
    
    # Update friendship last message if they are friends
    friendship = await db.friends.find_one({
        "user_id": current_user.id,
        "friend_user_id": message_data.recipient_id
    })
    if friendship:
        await db.friends.update_one(
            {"user_id": current_user.id, "friend_user_id": message_data.recipient_id},
            {"$set": {
                "last_message": message_data.content,
                "last_message_time": datetime.utcnow()
            }}
        )
        
        # Update recipient's friendship unread count and last message
        await db.friends.update_one(
            {"user_id": message_data.recipient_id, "friend_user_id": current_user.id},
            {"$set": {
                "last_message": message_data.content,
                "last_message_time": datetime.utcnow()
            }, "$inc": {"unread_count": 1}}
        )
    
    return PrivateMessage(**message_doc)

@api_router.get("/private-messages/{user_id}", response_model=List[PrivateMessage])
async def get_private_messages(user_id: str, current_user: User = Depends(get_current_user)):
    # Check if other user exists
    other_user = await db.users.find_one({"id": user_id})
    if not other_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get messages between current user and specified user
    messages = await db.private_messages.find({
        "$or": [
            {"sender_id": current_user.id, "recipient_id": user_id},
            {"sender_id": user_id, "recipient_id": current_user.id}
        ]
    }).sort("created_at", -1).limit(50).to_list(50)
    
    messages.reverse()  # Show oldest first
    
    # Mark messages as read
    await db.private_messages.update_many(
        {"sender_id": user_id, "recipient_id": current_user.id, "is_read": False},
        {"$set": {"is_read": True}}
    )
    
    # Reset unread count if they are friends
    friendship = await db.friends.find_one({
        "user_id": current_user.id,
        "friend_user_id": user_id
    })
    if friendship:
        await db.friends.update_one(
            {"user_id": current_user.id, "friend_user_id": user_id},
            {"$set": {"unread_count": 0}}
        )
    
    message_list = []
    for msg in messages:
        message_list.append(PrivateMessage(**msg))
    
    return message_list

# Get users in same room for friend suggestions
@api_router.get("/rooms/{room_id}/users")
async def get_room_users(room_id: str, current_user: User = Depends(get_current_user)):
    # Check if user has access to room
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if room["is_private"] and current_user.id not in room.get("members", []):
        raise HTTPException(status_code=403, detail="Access denied to private room")
    
    # Get recent messages to find active users
    recent_messages = await db.messages.find({"room_id": room_id}).sort("created_at", -1).limit(20).to_list(20)
    
    user_ids = set()
    users_info = []
    
    for msg in recent_messages:
        if msg["user_id"] != current_user.id and msg["user_id"] not in user_ids:
            user_ids.add(msg["user_id"])
            
            # Check if already friends
            existing_friendship = await db.friends.find_one({
                "user_id": current_user.id,
                "friend_user_id": msg["user_id"]
            })
            
            users_info.append({
                "id": msg["user_id"],
                "nickname": msg["user_name"],
                "avatar_url": msg.get("user_avatar"),
                "is_friend": existing_friendship is not None
            })
    
    return users_info

@api_router.get("/private-conversations")
async def get_private_conversations(current_user: User = Depends(get_current_user)):
    # Get all private messages where current user is involved
    messages = await db.private_messages.aggregate([
        {
            "$match": {
                "$or": [
                    {"sender_id": current_user.id},
                    {"recipient_id": current_user.id}
                ]
            }
        },
        {
            "$sort": {"created_at": -1}
        },
        {
            "$group": {
                "_id": {
                    "$cond": [
                        {"$eq": ["$sender_id", current_user.id]},
                        "$recipient_id",
                        "$sender_id"
                    ]
                },
                "last_message": {"$first": "$content"},
                "last_message_time": {"$first": "$created_at"},
                "unread_count": {
                    "$sum": {
                        "$cond": [
                            {"$and": [
                                {"$eq": ["$recipient_id", current_user.id]},
                                {"$eq": ["$is_read", False]}
                            ]},
                            1,
                            0
                        ]
                    }
                }
            }
        }
    ]).to_list(50)
    
    conversations = []
    for msg in messages:
        other_user_id = msg["_id"]
        # Get user info
        other_user = await db.users.find_one({"id": other_user_id})
        if other_user:
            # Check if they are friends
            is_friend = await db.friends.find_one({
                "user_id": current_user.id,
                "friend_user_id": other_user_id
            }) is not None
            
            conversations.append({
                "user_id": other_user_id,
                "nickname": other_user.get("nickname", "Unknown"),
                "first_name": other_user.get("first_name", ""),
                "last_name": other_user.get("last_name", ""),
                "avatar_url": other_user.get("avatar_url"),
                "last_message": msg["last_message"],
                "last_message_time": msg["last_message_time"],
                "unread_count": msg["unread_count"],
                "is_friend": is_friend
            })
    
    return conversations

@api_router.post("/auth/change-password")
async def change_password(password_data: PasswordChange, current_user: User = Depends(get_current_user)):
    # Get user with password
    user_doc = await db.users.find_one({"id": current_user.id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify current password
    if not verify_password(password_data.current_password, user_doc["hashed_password"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Hash new password
    new_hashed_password = get_password_hash(password_data.new_password)
    
    # Update password
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"hashed_password": new_hashed_password}}
    )
    
    return {"message": "Password changed successfully"}

# Room routes
@api_router.post("/rooms", response_model=Room)
async def create_room(room_data: RoomCreate, current_user: User = Depends(get_current_user)):
    room_id = str(uuid.uuid4())
    
    room_doc = {
        "id": room_id,
        "name": room_data.name,
        "description": room_data.description,
        "is_private": room_data.is_private,
        "created_by": current_user.id,
        "created_at": datetime.utcnow(),
        "members": [current_user.id]
    }
    
    await db.rooms.insert_one(room_doc)
    
    # Get member count
    member_count = len(room_doc["members"])
    
    return Room(
        id=room_id,
        name=room_data.name,
        description=room_data.description,
        is_private=room_data.is_private,
        created_by=current_user.id,
        created_at=room_doc["created_at"],
        member_count=member_count
    )

@api_router.get("/rooms", response_model=List[Room])
async def get_rooms(current_user: User = Depends(get_current_user)):
    # Get public rooms and rooms user is member of
    rooms = await db.rooms.find({
        "$or": [
            {"is_private": False},
            {"members": current_user.id}
        ]
    }).to_list(100)
    
    room_list = []
    for room in rooms:
        member_count = len(room.get("members", []))
        room_list.append(Room(
            id=room["id"],
            name=room["name"],
            description=room.get("description"),
            is_private=room["is_private"],
            created_by=room["created_by"],
            created_at=room["created_at"],
            member_count=member_count
        ))
    
    return room_list

@api_router.post("/rooms/{room_id}/join")
async def join_room(room_id: str, current_user: User = Depends(get_current_user)):
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if current_user.id not in room.get("members", []):
        await db.rooms.update_one(
            {"id": room_id},
            {"$addToSet": {"members": current_user.id}}
        )
    
    return {"message": "Successfully joined room"}

@api_router.get("/rooms/{room_id}/messages", response_model=List[Message])
async def get_room_messages(room_id: str, current_user: User = Depends(get_current_user)):
    # Check if user has access to room
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if room["is_private"] and current_user.id not in room.get("members", []):
        raise HTTPException(status_code=403, detail="Access denied to private room")
    
    # Get messages
    messages = await db.messages.find({"room_id": room_id}).sort("created_at", -1).limit(50).to_list(50)
    messages.reverse()  # Show oldest first
    
    message_list = []
    for msg in messages:
        message_list.append(Message(
            id=msg["id"],
            content=msg["content"],
            room_id=msg["room_id"],
            user_id=msg["user_id"],
            user_name=msg.get("user_name") or "Unknown User",
            user_avatar=msg.get("user_avatar"),
            created_at=msg["created_at"]
        ))
    
    return message_list

@api_router.post("/rooms/{room_id}/messages", response_model=Message)
async def send_message_http(room_id: str, message_data: MessageCreate, current_user: User = Depends(get_current_user)):
    # Check if user has access to room
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if room["is_private"] and current_user.id not in room.get("members", []):
        raise HTTPException(status_code=403, detail="Access denied to private room")
    
    # Create message
    message_id = str(uuid.uuid4())
    message_doc = {
        "id": message_id,
        "content": message_data.content,
        "room_id": room_id,
        "user_id": current_user.id,
        "user_name": current_user.nickname,
        "user_avatar": current_user.avatar_url,
        "created_at": datetime.utcnow()
    }
    
    # Save to database
    await db.messages.insert_one(message_doc)
    
    # Return the message
    return Message(
        id=message_id,
        content=message_data.content,
        room_id=room_id,
        user_id=current_user.id,
        user_name=current_user.nickname,  # Use nickname instead of name
        user_avatar=current_user.avatar_url,
        created_at=message_doc["created_at"]
    )

# WebSocket for real-time chat
@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await manager.connect(websocket, room_id)
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            # Verify token
            try:
                token = message_data.get("token")
                if not token:
                    await websocket.send_text(json.dumps({"error": "No token provided"}))
                    continue
                
                payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                user_id = payload.get("sub")
                if not user_id:
                    await websocket.send_text(json.dumps({"error": "Invalid token"}))
                    continue
                
                user = await db.users.find_one({"id": user_id})
                if not user:
                    await websocket.send_text(json.dumps({"error": "User not found"}))
                    continue
                
            except JWTError:
                await websocket.send_text(json.dumps({"error": "Invalid token"}))
                continue
            
            # Check room access
            room = await db.rooms.find_one({"id": room_id})
            if not room:
                await websocket.send_text(json.dumps({"error": "Room not found"}))
                continue
            
            if room["is_private"] and user_id not in room.get("members", []):
                await websocket.send_text(json.dumps({"error": "Access denied"}))
                continue
            
            # Save message to database
            message_id = str(uuid.uuid4())
            message_doc = {
                "id": message_id,
                "content": message_data["content"],
                "room_id": room_id,
                "user_id": user_id,
                "user_name": user["nickname"],  # Use nickname instead of name
                "user_avatar": user.get("avatar_url"),
                "created_at": datetime.utcnow()
            }
            
            await db.messages.insert_one(message_doc)
            
            # Broadcast message to room
            broadcast_data = {
                "id": message_id,
                "content": message_data["content"],
                "room_id": room_id,
                "user_id": user_id,
                "user_name": user["nickname"],  # Use nickname instead of name
                "user_avatar": user.get("avatar_url"),
                "created_at": message_doc["created_at"].isoformat(),
                "type": "message"
            }
            
            await manager.broadcast_to_room(broadcast_data, room_id)
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id)

# Include the router in the main app
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()