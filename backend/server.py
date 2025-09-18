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
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    language: Optional[str] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class User(BaseModel):
    id: str
    email: str
    name: str
    avatar_url: Optional[str] = None
    language: Optional[str] = 'en'
    is_active: bool = True
    created_at: datetime

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
        "name": user_data.name,
        "hashed_password": hashed_password,
        "avatar_url": None,
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
            user_name=msg["user_name"],
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
        "user_name": current_user.name,
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
        user_name=current_user.name,
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
                "user_name": user["name"],
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
                "user_name": user["name"],
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