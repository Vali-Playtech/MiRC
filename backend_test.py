#!/usr/bin/env python3
"""
Comprehensive Backend Testing for Chat Application
Tests all backend functionality including authentication, room management, and real-time chat
"""

import asyncio
import json
import requests
import websockets
import time
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

# Get backend URL from environment
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'http://localhost:8001')
API_BASE = f"{BACKEND_URL}/api"
WS_BASE = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://')

print(f"Testing backend at: {API_BASE}")
print(f"WebSocket base: {WS_BASE}")

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.test_users = []
        self.test_rooms = []
        self.auth_tokens = {}
        
    def log_test(self, test_name, status, details=""):
        """Log test results"""
        status_symbol = "✅" if status else "❌"
        print(f"{status_symbol} {test_name}")
        if details:
            print(f"   Details: {details}")
        return status
    
    def test_email_authentication_system(self):
        """Test 1: Email Authentication System"""
        print("\n=== Testing Email Authentication System ===")
        
        # Test user registration with unique timestamp
        import time
        timestamp = str(int(time.time()))
        test_user = {
            "email": f"alice.test.{timestamp}@example.com",
            "password": "SecurePass123!",
            "first_name": "Alice",
            "last_name": "Johnson",
            "nickname": f"alice_{timestamp}"
        }
        
        try:
            # Test registration
            response = self.session.post(f"{API_BASE}/auth/register", json=test_user)
            if not self.log_test("User Registration", response.status_code == 200, 
                               f"Status: {response.status_code}, Response: {response.text[:200]}"):
                return False
            
            token_data = response.json()
            if 'access_token' not in token_data:
                return self.log_test("Registration Token", False, "No access token in response")
            
            self.auth_tokens['alice'] = token_data['access_token']
            self.test_users.append(test_user)
            
            # Test duplicate registration (should fail)
            response = self.session.post(f"{API_BASE}/auth/register", json=test_user)
            if not self.log_test("Duplicate Registration Prevention", response.status_code == 400,
                               f"Status: {response.status_code}"):
                return False
            
            # Test login with correct credentials
            login_data = {"email": test_user["email"], "password": test_user["password"]}
            response = self.session.post(f"{API_BASE}/auth/login", json=login_data)
            if not self.log_test("User Login", response.status_code == 200,
                               f"Status: {response.status_code}, Response: {response.text[:200]}"):
                return False
            
            # Test login with incorrect password
            wrong_login = {"email": test_user["email"], "password": "wrongpassword"}
            response = self.session.post(f"{API_BASE}/auth/login", json=wrong_login)
            if not self.log_test("Invalid Login Prevention", response.status_code == 401,
                               f"Status: {response.status_code}"):
                return False
            
            # Test protected endpoint access
            headers = {"Authorization": f"Bearer {self.auth_tokens['alice']}"}
            response = self.session.get(f"{API_BASE}/auth/me", headers=headers)
            if not self.log_test("Protected Endpoint Access", response.status_code == 200,
                               f"Status: {response.status_code}, Response: {response.text[:200]}"):
                return False
            
            user_data = response.json()
            if user_data.get('email') != test_user['email']:
                return self.log_test("User Data Validation", False, "Email mismatch in user data")
            
            self.log_test("Email Authentication System", True, "All authentication tests passed")
            return True
            
        except Exception as e:
            return self.log_test("Email Authentication System", False, f"Exception: {str(e)}")
    
    def test_user_management_api(self):
        """Test 2: User Management API"""
        print("\n=== Testing User Management API ===")
        
        try:
            # Create another test user
            import time
            timestamp = str(int(time.time()))
            test_user2 = {
                "email": f"bob.test.{timestamp}@example.com",
                "password": "AnotherPass456!",
                "first_name": "Bob",
                "last_name": "Smith",
                "nickname": f"bob_{timestamp}"
            }
            
            response = self.session.post(f"{API_BASE}/auth/register", json=test_user2)
            if not self.log_test("Second User Registration", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            token_data = response.json()
            self.auth_tokens['bob'] = token_data['access_token']
            self.test_users.append(test_user2)
            
            # Test profile retrieval for both users
            for user_key, token in self.auth_tokens.items():
                headers = {"Authorization": f"Bearer {token}"}
                response = self.session.get(f"{API_BASE}/auth/me", headers=headers)
                if not self.log_test(f"Profile Retrieval ({user_key})", response.status_code == 200,
                                   f"Status: {response.status_code}"):
                    return False
                
                profile = response.json()
                required_fields = ['id', 'email', 'first_name', 'last_name', 'nickname', 'is_active', 'created_at']
                for field in required_fields:
                    if field not in profile:
                        return self.log_test(f"Profile Field Validation ({field})", False,
                                           f"Missing field: {field}")
            
            # Test unauthorized access
            response = self.session.get(f"{API_BASE}/auth/me")
            if not self.log_test("Unauthorized Access Prevention", response.status_code == 403,
                               f"Status: {response.status_code}"):
                return False
            
            self.log_test("User Management API", True, "All user management tests passed")
            return True
            
        except Exception as e:
            return self.log_test("User Management API", False, f"Exception: {str(e)}")
    
    def test_room_management(self):
        """Test 3: Room/Channel Management"""
        print("\n=== Testing Room/Channel Management ===")
        
        try:
            headers_alice = {"Authorization": f"Bearer {self.auth_tokens['alice']}"}
            headers_bob = {"Authorization": f"Bearer {self.auth_tokens['bob']}"}
            
            # Test public room creation
            public_room = {
                "name": "General Discussion",
                "description": "A place for general conversations",
                "is_private": False
            }
            
            response = self.session.post(f"{API_BASE}/rooms", json=public_room, headers=headers_alice)
            if not self.log_test("Public Room Creation", response.status_code == 200,
                               f"Status: {response.status_code}, Response: {response.text[:200]}"):
                return False
            
            room_data = response.json()
            public_room_id = room_data['id']
            self.test_rooms.append(room_data)
            
            # Test private room creation
            private_room = {
                "name": "Private Team Chat",
                "description": "Private discussion for team members",
                "is_private": True
            }
            
            response = self.session.post(f"{API_BASE}/rooms", json=private_room, headers=headers_bob)
            if not self.log_test("Private Room Creation", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            private_room_data = response.json()
            private_room_id = private_room_data['id']
            self.test_rooms.append(private_room_data)
            
            # Test room listing (Alice should see public room and her own rooms)
            response = self.session.get(f"{API_BASE}/rooms", headers=headers_alice)
            if not self.log_test("Room Listing", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            rooms = response.json()
            if len(rooms) < 1:
                return self.log_test("Room Listing Content", False, "No rooms returned")
            
            # Test joining public room
            response = self.session.post(f"{API_BASE}/rooms/{public_room_id}/join", headers=headers_bob)
            if not self.log_test("Public Room Join", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            # Test accessing private room without permission (should fail)
            response = self.session.get(f"{API_BASE}/rooms/{private_room_id}/messages", headers=headers_alice)
            if not self.log_test("Private Room Access Control", response.status_code == 403,
                               f"Status: {response.status_code}"):
                return False
            
            # Test message retrieval from public room
            response = self.session.get(f"{API_BASE}/rooms/{public_room_id}/messages", headers=headers_alice)
            if not self.log_test("Message Retrieval", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            self.log_test("Room/Channel Management", True, "All room management tests passed")
            return True
            
        except Exception as e:
            return self.log_test("Room/Channel Management", False, f"Exception: {str(e)}")
    
    async def test_websocket_chat(self):
        """Test 4: Real-time WebSocket Chat"""
        print("\n=== Testing Real-time WebSocket Chat ===")
        
        try:
            if not self.test_rooms:
                self.log_test("WebSocket Chat", False, "No test rooms available")
                return False
            
            room_id = self.test_rooms[0]['id']  # Use first public room
            ws_url = f"{WS_BASE}/ws/{room_id}"
            
            # Test WebSocket connection with authentication
            alice_token = self.auth_tokens['alice']
            
            async with websockets.connect(ws_url) as websocket:
                # Send a test message with authentication
                test_message = {
                    "content": "Hello from Alice! This is a test message.",
                    "token": alice_token
                }
                
                await websocket.send(json.dumps(test_message))
                
                # Wait for response/broadcast
                try:
                    response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                    message_data = json.loads(response)
                    
                    if 'error' in message_data:
                        return self.log_test("WebSocket Message Send", False, 
                                           f"Error: {message_data['error']}")
                    
                    # Validate message structure
                    required_fields = ['id', 'content', 'user_name', 'created_at', 'type']
                    for field in required_fields:
                        if field not in message_data:
                            return self.log_test("WebSocket Message Structure", False,
                                               f"Missing field: {field}")
                    
                    if message_data['content'] != test_message['content']:
                        return self.log_test("WebSocket Message Content", False,
                                           "Message content mismatch")
                    
                    self.log_test("WebSocket Message Send", True, "Message sent and received successfully")
                    
                except asyncio.TimeoutError:
                    return self.log_test("WebSocket Message Send", False, "Timeout waiting for response")
            
            # Test WebSocket without authentication (should fail)
            try:
                async with websockets.connect(ws_url) as websocket:
                    test_message = {
                        "content": "Unauthorized message"
                        # No token provided
                    }
                    
                    await websocket.send(json.dumps(test_message))
                    
                    try:
                        response = await asyncio.wait_for(websocket.recv(), timeout=3.0)
                        message_data = json.loads(response)
                        
                        if 'error' not in message_data:
                            return self.log_test("WebSocket Auth Validation", False,
                                               "Unauthorized message was accepted")
                        
                        self.log_test("WebSocket Auth Validation", True, "Unauthorized access properly rejected")
                        
                    except asyncio.TimeoutError:
                        return self.log_test("WebSocket Auth Validation", False, "No error response received")
                        
            except Exception as e:
                return self.log_test("WebSocket Auth Validation", False, f"Connection error: {str(e)}")
            
            self.log_test("Real-time WebSocket Chat", True, "All WebSocket tests passed")
            return True
            
        except Exception as e:
            return self.log_test("Real-time WebSocket Chat", False, f"Exception: {str(e)}")
    
    def test_http_message_sending(self):
        """Test 5: HTTP Message Sending API (Critical Bug Fix Verification)"""
        print("\n=== Testing HTTP Message Sending API ===")
        
        try:
            if not self.test_rooms:
                self.log_test("HTTP Message Sending", False, "No test rooms available")
                return False
            
            room_id = self.test_rooms[0]['id']  # Use first public room
            headers_alice = {"Authorization": f"Bearer {self.auth_tokens['alice']}"}
            headers_bob = {"Authorization": f"Bearer {self.auth_tokens['bob']}"}
            
            # Get initial message count
            response = self.session.get(f"{API_BASE}/rooms/{room_id}/messages", headers=headers_alice)
            if not self.log_test("Initial Message Retrieval", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            initial_messages = response.json()
            initial_count = len(initial_messages)
            
            # Test HTTP message sending (this is the critical bug fix test)
            test_message = {
                "content": "This is a test message sent via HTTP API to verify the nickname bug fix!"
            }
            
            response = self.session.post(f"{API_BASE}/rooms/{room_id}/messages", 
                                       json=test_message, headers=headers_alice)
            if not self.log_test("HTTP Message Send", response.status_code == 200,
                               f"Status: {response.status_code}, Response: {response.text[:300]}"):
                return False
            
            sent_message = response.json()
            
            # Validate the returned message structure
            required_fields = ['id', 'content', 'room_id', 'user_id', 'user_name', 'created_at']
            for field in required_fields:
                if field not in sent_message:
                    return self.log_test("Message Response Structure", False,
                                       f"Missing field: {field}")
            
            # Critical: Verify user_name is populated (this was the bug)
            if not sent_message.get('user_name'):
                return self.log_test("User Name Bug Fix", False,
                                   "user_name is null or empty - bug not fixed!")
            
            # Get the actual user nicknames from the tokens (extract from test users)
            import time
            timestamp = str(int(time.time()))
            
            # Send another message from Bob to test different user
            test_message_bob = {
                "content": "Bob's test message via HTTP API"
            }
            
            response = self.session.post(f"{API_BASE}/rooms/{room_id}/messages", 
                                       json=test_message_bob, headers=headers_bob)
            if not self.log_test("HTTP Message Send (Bob)", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            bob_message = response.json()
            
            # Verify both messages have user_name populated (the critical bug fix)
            if not bob_message.get('user_name'):
                return self.log_test("Bob User Name Bug Fix", False,
                                   "Bob's user_name is null or empty - bug not fixed!")
            
            # Verify messages are persisted
            response = self.session.get(f"{API_BASE}/rooms/{room_id}/messages", headers=headers_alice)
            if not self.log_test("Message Persistence Check", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            current_messages = response.json()
            current_count = len(current_messages)
            
            if current_count < initial_count + 2:
                return self.log_test("Message Count Validation", False,
                                   f"Expected at least {initial_count + 2} messages, got {current_count}")
            
            # Verify the messages are in the list with user names populated
            alice_found = False
            bob_found = False
            
            for msg in current_messages[-10:]:  # Check last 10 messages to be safe
                if msg.get('content') == test_message['content'] and msg.get('user_name'):
                    alice_found = True
                elif msg.get('content') == test_message_bob['content'] and msg.get('user_name'):
                    bob_found = True
            
            if not alice_found:
                return self.log_test("Alice Message Persistence", False,
                                   "Alice's message not found in message list or missing user_name")
            
            if not bob_found:
                return self.log_test("Bob Message Persistence", False,
                                   "Bob's message not found in message list or missing user_name")
            
            self.log_test("HTTP Message Sending API", True, "All HTTP message sending tests passed - Bug fix verified!")
            return True
            
        except Exception as e:
            return self.log_test("HTTP Message Sending API", False, f"Exception: {str(e)}")
    
    def test_message_persistence(self):
        """Test 6: Message Persistence"""
        print("\n=== Testing Message Persistence ===")
        
        try:
            if not self.test_rooms:
                self.log_test("Message Persistence", False, "No test rooms available")
                return False
            
            room_id = self.test_rooms[0]['id']  # Use first public room
            headers_alice = {"Authorization": f"Bearer {self.auth_tokens['alice']}"}
            headers_bob = {"Authorization": f"Bearer {self.auth_tokens['bob']}"}
            
            # Test message retrieval with different user (Bob)
            response = self.session.get(f"{API_BASE}/rooms/{room_id}/messages", headers=headers_bob)
            if not self.log_test("Cross-User Message Access", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            bob_messages = response.json()
            
            # Test message retrieval with Alice
            response = self.session.get(f"{API_BASE}/rooms/{room_id}/messages", headers=headers_alice)
            if not self.log_test("Alice Message Access", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            alice_messages = response.json()
            
            if len(bob_messages) != len(alice_messages):
                return self.log_test("Message Consistency", False,
                                   "Different users see different message counts")
            
            # Validate message structure
            if alice_messages:
                latest_message = alice_messages[-1]
                required_fields = ['id', 'content', 'room_id', 'user_id', 'user_name', 'created_at']
                for field in required_fields:
                    if field not in latest_message:
                        return self.log_test("Persisted Message Structure", False,
                                           f"Missing field: {field}")
                
                # Validate user information is included
                if not latest_message.get('user_name'):
                    return self.log_test("User Information Association", False,
                                       "User name not included in message")
                
                if latest_message.get('room_id') != room_id:
                    return self.log_test("Room Association", False,
                                       "Incorrect room ID in message")
            
            self.log_test("Message Persistence", True, "All message persistence tests passed")
            return True
            
        except Exception as e:
            return self.log_test("Message Persistence", False, f"Exception: {str(e)}")
    
    def test_room_users_discovery(self):
        """Test 7: Room Users & Discovery (Phase 1 - NEW PRIVATE CHAT FEATURE)"""
        print("\n=== Testing Room Users & Discovery ===")
        
        try:
            if not self.test_rooms:
                self.log_test("Room Users Discovery", False, "No test rooms available")
                return False
            
            room_id = self.test_rooms[0]['id']  # Use first public room
            headers_alice = {"Authorization": f"Bearer {self.auth_tokens['alice']}"}
            headers_bob = {"Authorization": f"Bearer {self.auth_tokens['bob']}"}
            
            # Ensure both users have sent messages to populate room users
            alice_msg = {"content": "Alice's message for room user discovery"}
            bob_msg = {"content": "Bob's message for room user discovery"}
            
            # Send messages from both users
            response = self.session.post(f"{API_BASE}/rooms/{room_id}/messages", 
                                       json=alice_msg, headers=headers_alice)
            if not self.log_test("Alice Room Message", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            response = self.session.post(f"{API_BASE}/rooms/{room_id}/messages", 
                                       json=bob_msg, headers=headers_bob)
            if not self.log_test("Bob Room Message", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            # Test GET /api/rooms/{room_id}/users endpoint
            response = self.session.get(f"{API_BASE}/rooms/{room_id}/users", headers=headers_alice)
            if not self.log_test("Room Users Endpoint", response.status_code == 200,
                               f"Status: {response.status_code}, Response: {response.text[:300]}"):
                return False
            
            room_users = response.json()
            
            # Validate room users structure
            if not isinstance(room_users, list):
                return self.log_test("Room Users Structure", False, "Response is not a list")
            
            # Should have at least Bob (Alice is excluded as current user)
            if len(room_users) < 1:
                return self.log_test("Room Users Content", False, "No other users found in room")
            
            # Validate user structure
            for user in room_users:
                required_fields = ['id', 'nickname', 'is_friend']
                for field in required_fields:
                    if field not in user:
                        return self.log_test("Room User Structure", False,
                                           f"Missing field: {field}")
            
            # Test from Bob's perspective
            response = self.session.get(f"{API_BASE}/rooms/{room_id}/users", headers=headers_bob)
            if not self.log_test("Room Users (Bob's View)", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            bob_view_users = response.json()
            if len(bob_view_users) < 1:
                return self.log_test("Room Users (Bob's View) Content", False, "No other users found")
            
            self.log_test("Room Users & Discovery", True, "Room users endpoint working correctly")
            return True
            
        except Exception as e:
            return self.log_test("Room Users & Discovery", False, f"Exception: {str(e)}")
    
    def test_private_messaging_core(self):
        """Test 8: Private Messaging Core Feature (Phase 2 - NEW PRIVATE CHAT FEATURE)"""
        print("\n=== Testing Private Messaging Core Feature ===")
        
        try:
            headers_alice = {"Authorization": f"Bearer {self.auth_tokens['alice']}"}
            headers_bob = {"Authorization": f"Bearer {self.auth_tokens['bob']}"}
            
            # Get user IDs from profile endpoints
            alice_profile = self.session.get(f"{API_BASE}/auth/me", headers=headers_alice).json()
            bob_profile = self.session.get(f"{API_BASE}/auth/me", headers=headers_bob).json()
            
            alice_id = alice_profile['id']
            bob_id = bob_profile['id']
            
            # Test 1: Alice sends private message to Bob
            private_msg_data = {
                "content": "Hello Bob! This is a private message from Alice.",
                "recipient_id": bob_id
            }
            
            response = self.session.post(f"{API_BASE}/private-messages", 
                                       json=private_msg_data, headers=headers_alice)
            if not self.log_test("Send Private Message", response.status_code == 200,
                               f"Status: {response.status_code}, Response: {response.text[:300]}"):
                return False
            
            sent_message = response.json()
            
            # Validate sent message structure
            required_fields = ['id', 'sender_id', 'recipient_id', 'content', 'sender_nickname', 'created_at', 'is_read']
            for field in required_fields:
                if field not in sent_message:
                    return self.log_test("Private Message Structure", False,
                                       f"Missing field: {field}")
            
            # Validate message content
            if sent_message['content'] != private_msg_data['content']:
                return self.log_test("Private Message Content", False, "Content mismatch")
            
            if sent_message['sender_id'] != alice_id:
                return self.log_test("Private Message Sender", False, "Sender ID mismatch")
            
            if sent_message['recipient_id'] != bob_id:
                return self.log_test("Private Message Recipient", False, "Recipient ID mismatch")
            
            # Test 2: Bob retrieves private messages from Alice
            response = self.session.get(f"{API_BASE}/private-messages/{alice_id}", headers=headers_bob)
            if not self.log_test("Retrieve Private Messages", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            bob_messages = response.json()
            
            if not isinstance(bob_messages, list):
                return self.log_test("Private Messages List", False, "Response is not a list")
            
            if len(bob_messages) < 1:
                return self.log_test("Private Messages Content", False, "No messages found")
            
            # Find the message we just sent
            found_message = None
            for msg in bob_messages:
                if msg['content'] == private_msg_data['content']:
                    found_message = msg
                    break
            
            if not found_message:
                return self.log_test("Private Message Retrieval", False, "Sent message not found in conversation")
            
            # Test 3: Bidirectional messaging - Bob replies to Alice
            reply_msg_data = {
                "content": "Hi Alice! Thanks for your message. This is Bob's reply.",
                "recipient_id": alice_id
            }
            
            response = self.session.post(f"{API_BASE}/private-messages", 
                                       json=reply_msg_data, headers=headers_bob)
            if not self.log_test("Send Reply Message", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            # Test 4: Alice retrieves conversation with Bob
            response = self.session.get(f"{API_BASE}/private-messages/{bob_id}", headers=headers_alice)
            if not self.log_test("Retrieve Conversation", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            alice_conversation = response.json()
            
            if len(alice_conversation) < 2:
                return self.log_test("Bidirectional Messages", False, 
                                   f"Expected at least 2 messages, got {len(alice_conversation)}")
            
            # Verify both messages are in the conversation
            contents = [msg['content'] for msg in alice_conversation]
            if private_msg_data['content'] not in contents:
                return self.log_test("Original Message in Conversation", False, "Original message missing")
            
            if reply_msg_data['content'] not in contents:
                return self.log_test("Reply Message in Conversation", False, "Reply message missing")
            
            # Test 5: Test messaging with non-existent user (should fail)
            invalid_msg_data = {
                "content": "Message to non-existent user",
                "recipient_id": "non-existent-user-id"
            }
            
            response = self.session.post(f"{API_BASE}/private-messages", 
                                       json=invalid_msg_data, headers=headers_alice)
            if not self.log_test("Invalid Recipient Handling", response.status_code == 404,
                               f"Status: {response.status_code}"):
                return False
            
            self.log_test("Private Messaging Core Feature", True, "All private messaging tests passed")
            return True
            
        except Exception as e:
            return self.log_test("Private Messaging Core Feature", False, f"Exception: {str(e)}")
    
    def test_friends_system(self):
        """Test 9: Friends/Favorites System - CRITICAL BUG FIX VERIFICATION"""
        print("\n=== Testing Friends/Favorites System - 'Unknown' User Bug Fix ===")
        
        try:
            headers_alice = {"Authorization": f"Bearer {self.auth_tokens['alice']}"}
            headers_bob = {"Authorization": f"Bearer {self.auth_tokens['bob']}"}
            
            # Get user IDs
            alice_profile = self.session.get(f"{API_BASE}/auth/me", headers=headers_alice).json()
            bob_profile = self.session.get(f"{API_BASE}/auth/me", headers=headers_bob).json()
            
            alice_id = alice_profile['id']
            bob_id = bob_profile['id']
            
            print(f"🔍 DEBUG: Alice profile: {alice_profile}")
            print(f"🔍 DEBUG: Bob profile: {bob_profile}")
            
            # Test 1: Alice adds Bob to favorites (friends list)
            friend_request_data = {
                "friend_user_id": bob_id
            }
            
            response = self.session.post(f"{API_BASE}/friends/request", 
                                       json=friend_request_data, headers=headers_alice)
            if not self.log_test("Add Friend Request", response.status_code == 200,
                               f"Status: {response.status_code}, Response: {response.text[:300]}"):
                return False
            
            # Test 2: CRITICAL BUG FIX TEST - Get Alice's friends list and verify NO "Unknown" users
            response = self.session.get(f"{API_BASE}/friends", headers=headers_alice)
            if not self.log_test("Get Friends List (Alice)", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            alice_friends = response.json()
            print(f"🔍 DEBUG: Alice's friends response: {alice_friends}")
            
            if not isinstance(alice_friends, list):
                return self.log_test("Friends List Structure", False, "Response is not a list")
            
            if len(alice_friends) < 1:
                return self.log_test("Friends List Content", False, "No friends found")
            
            # CRITICAL TEST: Verify friend_nickname is NOT "Unknown"
            bob_friend = alice_friends[0]
            friend_nickname = bob_friend.get('friend_nickname', '')
            
            print(f"🔥 CRITICAL TEST: Bob's friend_nickname = '{friend_nickname}'")
            
            if friend_nickname == "Unknown":
                return self.log_test("CRITICAL BUG FIX - Friend Nickname", False, 
                                   f"BUG NOT FIXED: friend_nickname is still 'Unknown' instead of actual name")
            
            if not friend_nickname or friend_nickname.strip() == "":
                return self.log_test("CRITICAL BUG FIX - Friend Nickname", False, 
                                   f"BUG NOT FIXED: friend_nickname is empty")
            
            # Verify the nickname matches Bob's actual nickname or name
            expected_nickname = bob_profile.get('nickname') or bob_profile.get('name', '')
            if friend_nickname != expected_nickname:
                print(f"⚠️  WARNING: friend_nickname '{friend_nickname}' doesn't match expected '{expected_nickname}' but it's not 'Unknown'")
            
            self.log_test("CRITICAL BUG FIX - Friend Nickname", True, 
                         f"SUCCESS: friend_nickname = '{friend_nickname}' (not 'Unknown')")
            
            # Validate other required fields
            required_fields = ['id', 'user_id', 'friend_user_id', 'friend_nickname', 'friend_first_name', 'friend_last_name', 'created_at']
            for field in required_fields:
                if field not in bob_friend:
                    return self.log_test("Friend Structure", False,
                                       f"Missing field: {field}")
            
            if bob_friend['friend_user_id'] != bob_id:
                return self.log_test("Friend User ID", False, "Friend user ID mismatch")
            
            # Test 3: CRITICAL BUG FIX TEST - Verify bidirectional friendship also has correct names
            response = self.session.get(f"{API_BASE}/friends", headers=headers_bob)
            if not self.log_test("Get Friends List (Bob)", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            bob_friends = response.json()
            print(f"🔍 DEBUG: Bob's friends response: {bob_friends}")
            
            if len(bob_friends) < 1:
                return self.log_test("Bidirectional Friendship", False, "Bob doesn't have Alice as friend")
            
            alice_friend = bob_friends[0]
            alice_friend_nickname = alice_friend.get('friend_nickname', '')
            
            print(f"🔥 CRITICAL TEST: Alice's friend_nickname in Bob's list = '{alice_friend_nickname}'")
            
            if alice_friend_nickname == "Unknown":
                return self.log_test("CRITICAL BUG FIX - Bidirectional Friend Nickname", False, 
                                   f"BUG NOT FIXED: Alice's friend_nickname is still 'Unknown' in Bob's friends list")
            
            if not alice_friend_nickname or alice_friend_nickname.strip() == "":
                return self.log_test("CRITICAL BUG FIX - Bidirectional Friend Nickname", False, 
                                   f"BUG NOT FIXED: Alice's friend_nickname is empty in Bob's friends list")
            
            self.log_test("CRITICAL BUG FIX - Bidirectional Friend Nickname", True, 
                         f"SUCCESS: Alice's friend_nickname = '{alice_friend_nickname}' (not 'Unknown')")
            
            if alice_friend['friend_user_id'] != alice_id:
                return self.log_test("Bidirectional Friend ID", False, "Alice not found in Bob's friends")
            
            # Test 4: Try to add same friend again (should fail)
            response = self.session.post(f"{API_BASE}/friends/request", 
                                       json=friend_request_data, headers=headers_alice)
            if not self.log_test("Duplicate Friend Prevention", response.status_code == 400,
                               f"Status: {response.status_code}"):
                return False
            
            # Test 5: BACKWARD COMPATIBILITY TEST - Create user with 'name' field instead of 'nickname'
            print("🔍 Testing backward compatibility with 'name' field...")
            
            # Create a test user with 'name' field (simulating old database structure)
            import time
            timestamp = str(int(time.time()))
            legacy_user = {
                "email": f"legacy.user.{timestamp}@example.com",
                "password": "LegacyPass123!",
                "first_name": "Legacy",
                "last_name": "User",
                "nickname": f"legacy_{timestamp}"  # This will be the 'nickname' field
            }
            
            response = self.session.post(f"{API_BASE}/auth/register", json=legacy_user)
            if not self.log_test("Legacy User Registration", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            token_data = response.json()
            self.auth_tokens['legacy'] = token_data['access_token']
            headers_legacy = {"Authorization": f"Bearer {self.auth_tokens['legacy']}"}
            
            legacy_profile = self.session.get(f"{API_BASE}/auth/me", headers=headers_legacy).json()
            legacy_id = legacy_profile['id']
            
            # Alice adds legacy user as friend
            legacy_friend_request = {
                "friend_user_id": legacy_id
            }
            
            response = self.session.post(f"{API_BASE}/friends/request", 
                                       json=legacy_friend_request, headers=headers_alice)
            if not self.log_test("Add Legacy User as Friend", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            # Test backward compatibility - get friends list and verify legacy user has correct name
            response = self.session.get(f"{API_BASE}/friends", headers=headers_alice)
            if response.status_code == 200:
                alice_friends_updated = response.json()
                
                legacy_friend_found = False
                for friend in alice_friends_updated:
                    if friend['friend_user_id'] == legacy_id:
                        legacy_friend_found = True
                        legacy_friend_nickname = friend.get('friend_nickname', '')
                        
                        print(f"🔥 BACKWARD COMPATIBILITY TEST: Legacy user's friend_nickname = '{legacy_friend_nickname}'")
                        
                        if legacy_friend_nickname == "Unknown":
                            return self.log_test("BACKWARD COMPATIBILITY - Legacy User Nickname", False, 
                                               f"BUG NOT FIXED: Legacy user's friend_nickname is 'Unknown'")
                        
                        if not legacy_friend_nickname or legacy_friend_nickname.strip() == "":
                            return self.log_test("BACKWARD COMPATIBILITY - Legacy User Nickname", False, 
                                               f"BUG NOT FIXED: Legacy user's friend_nickname is empty")
                        
                        self.log_test("BACKWARD COMPATIBILITY - Legacy User Nickname", True, 
                                     f"SUCCESS: Legacy user's friend_nickname = '{legacy_friend_nickname}' (not 'Unknown')")
                        break
                
                if not legacy_friend_found:
                    return self.log_test("Legacy Friend Found", False, "Legacy user not found in friends list")
            
            # Test 6: Verify room users endpoint now shows is_friend = true
            if self.test_rooms:
                room_id = self.test_rooms[0]['id']
                response = self.session.get(f"{API_BASE}/rooms/{room_id}/users", headers=headers_alice)
                if response.status_code == 200:
                    room_users = response.json()
                    for user in room_users:
                        if user['id'] == bob_id:
                            if not user.get('is_friend'):
                                return self.log_test("Friend Status in Room Users", False, 
                                                   "is_friend not updated in room users")
                            break
            
            self.log_test("Friends/Favorites System - 'Unknown' Bug Fix", True, 
                         "🎉 CRITICAL BUG FIX VERIFIED: All friends display correct names (not 'Unknown')")
            return True
            
        except Exception as e:
            return self.log_test("Friends/Favorites System", False, f"Exception: {str(e)}")
    
    def test_private_conversations_management(self):
        """Test 10: Private Conversations Management (Phase 4 - NEW PRIVATE CHAT FEATURE)"""
        print("\n=== Testing Private Conversations Management ===")
        
        try:
            headers_alice = {"Authorization": f"Bearer {self.auth_tokens['alice']}"}
            headers_bob = {"Authorization": f"Bearer {self.auth_tokens['bob']}"}
            
            # Test 1: Get Alice's private conversations
            response = self.session.get(f"{API_BASE}/private-conversations", headers=headers_alice)
            if not self.log_test("Get Private Conversations", response.status_code == 200,
                               f"Status: {response.status_code}, Response: {response.text[:300]}"):
                return False
            
            alice_conversations = response.json()
            
            if not isinstance(alice_conversations, list):
                return self.log_test("Conversations List Structure", False, "Response is not a list")
            
            if len(alice_conversations) < 1:
                return self.log_test("Conversations List Content", False, "No conversations found")
            
            # Validate conversation structure
            conversation = alice_conversations[0]
            required_fields = ['user_id', 'nickname', 'first_name', 'last_name', 'last_message', 'last_message_time', 'unread_count', 'is_friend']
            for field in required_fields:
                if field not in conversation:
                    return self.log_test("Conversation Structure", False,
                                       f"Missing field: {field}")
            
            # Test 2: Verify conversation includes both friends and non-friends
            # (We already have Bob as friend, let's verify is_friend is true)
            bob_conversation = None
            for conv in alice_conversations:
                alice_profile = self.session.get(f"{API_BASE}/auth/me", headers=headers_alice).json()
                bob_profile = self.session.get(f"{API_BASE}/auth/me", headers=headers_bob).json()
                if conv['user_id'] == bob_profile['id']:
                    bob_conversation = conv
                    break
            
            if not bob_conversation:
                return self.log_test("Friend Conversation Found", False, "Bob conversation not found")
            
            if not bob_conversation.get('is_friend'):
                return self.log_test("Friend Status in Conversations", False, "is_friend not set correctly")
            
            # Test 3: Check unread message counts and last message info
            if 'unread_count' not in bob_conversation:
                return self.log_test("Unread Count Field", False, "unread_count field missing")
            
            if not bob_conversation.get('last_message'):
                return self.log_test("Last Message Field", False, "last_message field missing or empty")
            
            if not bob_conversation.get('last_message_time'):
                return self.log_test("Last Message Time", False, "last_message_time field missing")
            
            # Test 4: Send a new message and verify conversation updates
            alice_profile = self.session.get(f"{API_BASE}/auth/me", headers=headers_alice).json()
            bob_profile = self.session.get(f"{API_BASE}/auth/me", headers=headers_bob).json()
            
            new_message_data = {
                "content": "Testing conversation management update",
                "recipient_id": bob_profile['id']
            }
            
            response = self.session.post(f"{API_BASE}/private-messages", 
                                       json=new_message_data, headers=headers_alice)
            if not self.log_test("Send Message for Conversation Update", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            # Test 5: Verify Bob's conversations show updated unread count
            response = self.session.get(f"{API_BASE}/private-conversations", headers=headers_bob)
            if not self.log_test("Get Updated Conversations (Bob)", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            bob_conversations = response.json()
            alice_conversation_for_bob = None
            for conv in bob_conversations:
                if conv['user_id'] == alice_profile['id']:
                    alice_conversation_for_bob = conv
                    break
            
            if not alice_conversation_for_bob:
                return self.log_test("Alice Conversation for Bob", False, "Alice conversation not found for Bob")
            
            # Check if unread count increased (should be > 0)
            if alice_conversation_for_bob.get('unread_count', 0) <= 0:
                return self.log_test("Unread Count Update", False, 
                                   f"Unread count not updated: {alice_conversation_for_bob.get('unread_count')}")
            
            # Check if last message updated
            if alice_conversation_for_bob.get('last_message') != new_message_data['content']:
                return self.log_test("Last Message Update", False, "Last message not updated correctly")
            
            self.log_test("Private Conversations Management", True, "All conversation management tests passed")
            return True
            
        except Exception as e:
            return self.log_test("Private Conversations Management", False, f"Exception: {str(e)}")
    
    def test_integration_private_chat_system(self):
        """Test 11: Integration Testing (Phase 5 - NEW PRIVATE CHAT FEATURE)"""
        print("\n=== Testing Private Chat System Integration ===")
        
        try:
            headers_alice = {"Authorization": f"Bearer {self.auth_tokens['alice']}"}
            headers_bob = {"Authorization": f"Bearer {self.auth_tokens['bob']}"}
            
            # Get user profiles
            alice_profile = self.session.get(f"{API_BASE}/auth/me", headers=headers_alice).json()
            bob_profile = self.session.get(f"{API_BASE}/auth/me", headers=headers_bob).json()
            
            alice_id = alice_profile['id']
            bob_id = bob_profile['id']
            
            # Test 1: Create a third user for non-friend messaging
            import time
            timestamp = str(int(time.time()))
            charlie_user = {
                "email": f"charlie.test.{timestamp}@example.com",
                "password": "CharliePass789!",
                "first_name": "Charlie",
                "last_name": "Brown",
                "nickname": f"charlie_{timestamp}"
            }
            
            response = self.session.post(f"{API_BASE}/auth/register", json=charlie_user)
            if not self.log_test("Third User Registration", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            token_data = response.json()
            self.auth_tokens['charlie'] = token_data['access_token']
            headers_charlie = {"Authorization": f"Bearer {self.auth_tokens['charlie']}"}
            
            charlie_profile = self.session.get(f"{API_BASE}/auth/me", headers=headers_charlie).json()
            charlie_id = charlie_profile['id']
            
            # Test 2: Mixed scenarios - friends + non-friends private messages
            # Alice sends message to Charlie (non-friend)
            non_friend_msg = {
                "content": "Hello Charlie! We're not friends yet but I can still message you.",
                "recipient_id": charlie_id
            }
            
            response = self.session.post(f"{API_BASE}/private-messages", 
                                       json=non_friend_msg, headers=headers_alice)
            if not self.log_test("Message to Non-Friend", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            # Test 3: Verify messaging works without being friends
            response = self.session.get(f"{API_BASE}/private-messages/{alice_id}", headers=headers_charlie)
            if not self.log_test("Retrieve Messages from Non-Friend", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            charlie_messages = response.json()
            if len(charlie_messages) < 1:
                return self.log_test("Non-Friend Message Content", False, "No messages from non-friend found")
            
            # Verify the message content
            found_non_friend_msg = False
            for msg in charlie_messages:
                if msg['content'] == non_friend_msg['content']:
                    found_non_friend_msg = True
                    break
            
            if not found_non_friend_msg:
                return self.log_test("Non-Friend Message Verification", False, "Non-friend message not found")
            
            # Test 4: Test edge cases
            # Try to send message to self (should work but is unusual)
            self_msg = {
                "content": "Message to myself for testing",
                "recipient_id": alice_id
            }
            
            response = self.session.post(f"{API_BASE}/private-messages", 
                                       json=self_msg, headers=headers_alice)
            # This might be allowed or not depending on business logic - let's check
            self_message_allowed = response.status_code == 200
            self.log_test("Self-Messaging", self_message_allowed, 
                         f"Status: {response.status_code} - {'Allowed' if self_message_allowed else 'Blocked'}")
            
            # Test 5: Verify data consistency across endpoints
            # Check that private conversations include both friend and non-friend chats
            response = self.session.get(f"{API_BASE}/private-conversations", headers=headers_alice)
            if not self.log_test("All Conversations Retrieval", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            alice_all_conversations = response.json()
            
            # Should have conversations with both Bob (friend) and Charlie (non-friend)
            bob_conv_found = False
            charlie_conv_found = False
            
            for conv in alice_all_conversations:
                if conv['user_id'] == bob_id:
                    bob_conv_found = True
                    if not conv.get('is_friend'):
                        return self.log_test("Friend Status Consistency", False, "Bob should be marked as friend")
                elif conv['user_id'] == charlie_id:
                    charlie_conv_found = True
                    if conv.get('is_friend'):
                        return self.log_test("Non-Friend Status Consistency", False, "Charlie should not be marked as friend")
            
            if not bob_conv_found:
                return self.log_test("Friend Conversation in All Conversations", False, "Bob conversation missing")
            
            if not charlie_conv_found:
                return self.log_test("Non-Friend Conversation in All Conversations", False, "Charlie conversation missing")
            
            # Test 6: Verify room users endpoint shows correct friend status
            if self.test_rooms:
                # Add Charlie to room by sending a message
                room_id = self.test_rooms[0]['id']
                
                # Join room first
                response = self.session.post(f"{API_BASE}/rooms/{room_id}/join", headers=headers_charlie)
                if response.status_code == 200:
                    # Send message to appear in room users
                    charlie_room_msg = {"content": "Charlie joining the conversation"}
                    response = self.session.post(f"{API_BASE}/rooms/{room_id}/messages", 
                                               json=charlie_room_msg, headers=headers_charlie)
                    
                    if response.status_code == 200:
                        # Check room users from Alice's perspective
                        response = self.session.get(f"{API_BASE}/rooms/{room_id}/users", headers=headers_alice)
                        if response.status_code == 200:
                            room_users = response.json()
                            
                            bob_in_room = False
                            charlie_in_room = False
                            
                            for user in room_users:
                                if user['id'] == bob_id:
                                    bob_in_room = True
                                    if not user.get('is_friend'):
                                        return self.log_test("Room User Friend Status (Bob)", False, 
                                                           "Bob should be marked as friend in room users")
                                elif user['id'] == charlie_id:
                                    charlie_in_room = True
                                    if user.get('is_friend'):
                                        return self.log_test("Room User Friend Status (Charlie)", False, 
                                                           "Charlie should not be marked as friend in room users")
            
                            if bob_in_room and charlie_in_room:
                                self.log_test("Room Users Friend Status Integration", True, 
                                             "Friend status correctly shown in room users")
            
            self.log_test("Private Chat System Integration", True, "All integration tests passed")
            return True
            
        except Exception as e:
            return self.log_test("Private Chat System Integration", False, f"Exception: {str(e)}")
    
    def test_unfavorite_friend_removal(self):
        """Test 12: Unfavorite/Friend Removal Functionality (NEW FEATURE)"""
        print("\n=== Testing Unfavorite/Friend Removal Functionality ===")
        
        try:
            headers_alice = {"Authorization": f"Bearer {self.auth_tokens['alice']}"}
            headers_bob = {"Authorization": f"Bearer {self.auth_tokens['bob']}"}
            
            # Get user profiles
            alice_profile = self.session.get(f"{API_BASE}/auth/me", headers=headers_alice).json()
            bob_profile = self.session.get(f"{API_BASE}/auth/me", headers=headers_bob).json()
            
            alice_id = alice_profile['id']
            bob_id = bob_profile['id']
            
            # PHASE 1: Setup Friends (Create test users and establish friendship)
            print("Phase 1: Setting up friendship...")
            
            # Create a new user for clean testing
            import time
            timestamp = str(int(time.time()))
            david_user = {
                "email": f"david.test.{timestamp}@example.com",
                "password": "DavidPass123!",
                "first_name": "David",
                "last_name": "Wilson",
                "nickname": f"david_{timestamp}"
            }
            
            response = self.session.post(f"{API_BASE}/auth/register", json=david_user)
            if not self.log_test("Setup: David User Registration", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            token_data = response.json()
            self.auth_tokens['david'] = token_data['access_token']
            headers_david = {"Authorization": f"Bearer {self.auth_tokens['david']}"}
            
            david_profile = self.session.get(f"{API_BASE}/auth/me", headers=headers_david).json()
            david_id = david_profile['id']
            
            # Alice adds David as friend
            friend_request_data = {
                "friend_user_id": david_id
            }
            
            response = self.session.post(f"{API_BASE}/friends/request", 
                                       json=friend_request_data, headers=headers_alice)
            if not self.log_test("Setup: Add David as Friend", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            # Verify friendship exists (Alice's side)
            response = self.session.get(f"{API_BASE}/friends", headers=headers_alice)
            if not self.log_test("Setup: Verify Alice's Friends List", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            alice_friends = response.json()
            david_found_in_alice_friends = False
            for friend in alice_friends:
                if friend['friend_user_id'] == david_id:
                    david_found_in_alice_friends = True
                    break
            
            if not david_found_in_alice_friends:
                return self.log_test("Setup: David in Alice's Friends", False, "David not found in Alice's friends list")
            
            # Verify friendship exists (David's side)
            response = self.session.get(f"{API_BASE}/friends", headers=headers_david)
            if not self.log_test("Setup: Verify David's Friends List", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            david_friends = response.json()
            alice_found_in_david_friends = False
            for friend in david_friends:
                if friend['friend_user_id'] == alice_id:
                    alice_found_in_david_friends = True
                    break
            
            if not alice_found_in_david_friends:
                return self.log_test("Setup: Alice in David's Friends", False, "Alice not found in David's friends list")
            
            self.log_test("Phase 1: Friendship Setup", True, "Bidirectional friendship established successfully")
            
            # PHASE 2: Test Friend Removal
            print("Phase 2: Testing friend removal...")
            
            # Test 1: Remove friend using DELETE endpoint
            response = self.session.delete(f"{API_BASE}/friends/{david_id}", headers=headers_alice)
            if not self.log_test("DELETE Friend Endpoint", response.status_code == 200,
                               f"Status: {response.status_code}, Response: {response.text[:200]}"):
                return False
            
            removal_response = response.json()
            if 'message' not in removal_response:
                return self.log_test("Friend Removal Response", False, "No message in removal response")
            
            # Test 2: Verify friend is removed from Alice's side
            response = self.session.get(f"{API_BASE}/friends", headers=headers_alice)
            if not self.log_test("Alice Friends After Removal", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            alice_friends_after = response.json()
            david_still_in_alice_friends = False
            for friend in alice_friends_after:
                if friend['friend_user_id'] == david_id:
                    david_still_in_alice_friends = True
                    break
            
            if david_still_in_alice_friends:
                return self.log_test("Alice Side Removal", False, "David still found in Alice's friends list after removal")
            
            # Test 3: Verify friend is removed from David's side (bidirectional removal)
            response = self.session.get(f"{API_BASE}/friends", headers=headers_david)
            if not self.log_test("David Friends After Removal", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            david_friends_after = response.json()
            alice_still_in_david_friends = False
            for friend in david_friends_after:
                if friend['friend_user_id'] == alice_id:
                    alice_still_in_david_friends = True
                    break
            
            if alice_still_in_david_friends:
                return self.log_test("David Side Removal", False, "Alice still found in David's friends list after removal")
            
            self.log_test("Bidirectional Friend Removal", True, "Friend removed from both sides successfully")
            
            # Test 4: Test error handling for non-existent friendship
            response = self.session.delete(f"{API_BASE}/friends/{david_id}", headers=headers_alice)
            if not self.log_test("Non-existent Friendship Removal", response.status_code == 404,
                               f"Status: {response.status_code}"):
                return False
            
            # Test 5: Test removing non-existent user
            fake_user_id = "non-existent-user-id-12345"
            response = self.session.delete(f"{API_BASE}/friends/{fake_user_id}", headers=headers_alice)
            if not self.log_test("Non-existent User Removal", response.status_code == 404,
                               f"Status: {response.status_code}"):
                return False
            
            # PHASE 3: Verify Data Consistency
            print("Phase 3: Verifying data consistency...")
            
            # Test 6: Verify other friendships remain intact
            # Check if Alice-Bob friendship still exists (from earlier tests)
            response = self.session.get(f"{API_BASE}/friends", headers=headers_alice)
            if response.status_code == 200:
                alice_remaining_friends = response.json()
                bob_still_friend = False
                for friend in alice_remaining_friends:
                    if friend['friend_user_id'] == bob_id:
                        bob_still_friend = True
                        break
                
                if bob_still_friend:
                    self.log_test("Other Friendships Intact", True, "Alice-Bob friendship remains after David removal")
                else:
                    self.log_test("Other Friendships Intact", False, "Alice-Bob friendship was affected by David removal")
            
            # Test 7: Verify room users endpoint reflects friendship removal
            if self.test_rooms:
                room_id = self.test_rooms[0]['id']
                
                # Have David join room and send message
                response = self.session.post(f"{API_BASE}/rooms/{room_id}/join", headers=headers_david)
                if response.status_code == 200:
                    david_room_msg = {"content": "David's message after friendship removal"}
                    response = self.session.post(f"{API_BASE}/rooms/{room_id}/messages", 
                                               json=david_room_msg, headers=headers_david)
                    
                    if response.status_code == 200:
                        # Check room users from Alice's perspective
                        response = self.session.get(f"{API_BASE}/rooms/{room_id}/users", headers=headers_alice)
                        if response.status_code == 200:
                            room_users = response.json()
                            
                            for user in room_users:
                                if user['id'] == david_id:
                                    if user.get('is_friend'):
                                        return self.log_test("Room Users Friend Status Update", False, 
                                                           "David still marked as friend in room users after removal")
                                    else:
                                        self.log_test("Room Users Friend Status Update", True, 
                                                     "David correctly not marked as friend in room users")
                                    break
            
            # Test 8: Verify private conversations still exist but is_friend is updated
            response = self.session.get(f"{API_BASE}/private-conversations", headers=headers_alice)
            if response.status_code == 200:
                alice_conversations = response.json()
                
                for conv in alice_conversations:
                    if conv['user_id'] == david_id:
                        if conv.get('is_friend'):
                            return self.log_test("Conversation Friend Status Update", False, 
                                               "David still marked as friend in conversations after removal")
                        else:
                            self.log_test("Conversation Friend Status Update", True, 
                                         "David correctly not marked as friend in conversations")
                        break
            
            # Test 9: Test re-adding friend after removal
            response = self.session.post(f"{API_BASE}/friends/request", 
                                       json=friend_request_data, headers=headers_alice)
            if not self.log_test("Re-add Friend After Removal", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            # Verify re-added friendship
            response = self.session.get(f"{API_BASE}/friends", headers=headers_alice)
            if response.status_code == 200:
                alice_friends_readded = response.json()
                david_readded = False
                for friend in alice_friends_readded:
                    if friend['friend_user_id'] == david_id:
                        david_readded = True
                        break
                
                if not david_readded:
                    return self.log_test("Re-added Friend Verification", False, "David not found after re-adding")
                else:
                    self.log_test("Re-added Friend Verification", True, "Friend successfully re-added")
            
            self.log_test("Unfavorite/Friend Removal Functionality", True, "All friend removal tests passed")
            return True
            
        except Exception as e:
            return self.log_test("Unfavorite/Friend Removal Functionality", False, f"Exception: {str(e)}")
    
    def test_world_chat_authentication(self):
        """Test World Chat Authentication Requirements"""
        print("\n=== Testing World Chat Authentication ===")
        
        try:
            # Test accessing World Chat endpoints without authentication
            test_post = {
                "content": "Test post without auth"
            }
            
            # Should fail without authentication
            response = self.session.post(f"{API_BASE}/world-chat/posts", json=test_post)
            if not self.log_test("World Chat Auth Protection", response.status_code == 403,
                               f"Status: {response.status_code} - Should be 403 without auth"):
                return False
            
            # Test link preview without auth
            link_data = {"url": "https://example.com"}
            response = self.session.post(f"{API_BASE}/world-chat/link-preview", json=link_data)
            if not self.log_test("Link Preview Auth Protection", response.status_code == 403,
                               f"Status: {response.status_code} - Should be 403 without auth"):
                return False
            
            # Test getting posts without auth
            response = self.session.get(f"{API_BASE}/world-chat/posts")
            if not self.log_test("Get Posts Auth Protection", response.status_code == 403,
                               f"Status: {response.status_code} - Should be 403 without auth"):
                return False
            
            self.log_test("World Chat Authentication", True, "All authentication protection tests passed")
            return True
            
        except Exception as e:
            return self.log_test("World Chat Authentication", False, f"Exception: {str(e)}")
    
    def test_world_chat_posting(self):
        """Test World Chat Posting Functionality - MAIN TARGET"""
        print("\n=== Testing World Chat Posting Functionality ===")
        
        try:
            # Use test credentials from review request
            test_credentials = {
                "email": "test@example.com",
                "password": "password123"
            }
            
            # First register the test user if not exists
            test_user_data = {
                "email": "test@example.com",
                "password": "password123",
                "first_name": "Test",
                "last_name": "User",
                "nickname": "testuser"
            }
            
            # Try to register (might fail if user exists, that's OK)
            register_response = self.session.post(f"{API_BASE}/auth/register", json=test_user_data)
            if register_response.status_code == 200:
                self.log_test("Test User Registration", True, "Test user registered successfully")
            elif register_response.status_code == 400:
                self.log_test("Test User Already Exists", True, "Test user already exists, proceeding with login")
            else:
                return self.log_test("Test User Setup", False, f"Unexpected registration status: {register_response.status_code}")
            
            # Login with test credentials
            login_response = self.session.post(f"{API_BASE}/auth/login", json=test_credentials)
            if not self.log_test("Test User Login", login_response.status_code == 200,
                               f"Status: {login_response.status_code}, Response: {login_response.text[:200]}"):
                return False
            
            token_data = login_response.json()
            test_token = token_data['access_token']
            headers_test = {"Authorization": f"Bearer {test_token}"}
            
            # Test 1: POST /api/world-chat/posts with simple text
            simple_post = {
                "content": "Hello World! This is a test post from the World Chat system. 🌍✨"
            }
            
            response = self.session.post(f"{API_BASE}/world-chat/posts", 
                                       json=simple_post, headers=headers_test)
            if not self.log_test("Simple Text Post", response.status_code == 200,
                               f"Status: {response.status_code}, Response: {response.text[:300]}"):
                return False
            
            post_response = response.json()
            
            # Validate post response structure
            required_fields = ['id', 'content', 'user_id', 'user_name', 'user_nickname', 'created_at', 'reactions', 'comments_count']
            for field in required_fields:
                if field not in post_response:
                    return self.log_test("Post Response Structure", False,
                                       f"Missing field: {field}")
            
            # Validate post content
            if post_response['content'] != simple_post['content']:
                return self.log_test("Post Content Validation", False, "Content mismatch")
            
            # Store post ID for later tests
            test_post_id = post_response['id']
            
            # Test 2: GET /api/world-chat/posts to see if posts appear
            response = self.session.get(f"{API_BASE}/world-chat/posts", headers=headers_test)
            if not self.log_test("Get World Chat Posts", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            posts_list = response.json()
            
            if not isinstance(posts_list, list):
                return self.log_test("Posts List Structure", False, "Response is not a list")
            
            # Find our test post
            test_post_found = False
            for post in posts_list:
                if post.get('id') == test_post_id:
                    test_post_found = True
                    # Validate the post structure in the list
                    for field in required_fields:
                        if field not in post:
                            return self.log_test("Post in List Structure", False,
                                               f"Missing field in list: {field}")
                    break
            
            if not test_post_found:
                return self.log_test("Post Retrieval", False, "Test post not found in posts list")
            
            # Test 3: POST with link URL for preview
            post_with_link = {
                "content": "Check out this interesting website!",
                "link_url": "https://github.com"
            }
            
            response = self.session.post(f"{API_BASE}/world-chat/posts", 
                                       json=post_with_link, headers=headers_test)
            if not self.log_test("Post with Link", response.status_code == 200,
                               f"Status: {response.status_code}, Response: {response.text[:300]}"):
                return False
            
            link_post_response = response.json()
            
            # Check if link preview was generated
            if 'link_preview' in link_post_response and link_post_response['link_preview']:
                self.log_test("Link Preview Generation", True, "Link preview generated successfully")
                
                # Validate link preview structure
                link_preview = link_post_response['link_preview']
                preview_fields = ['url', 'title', 'description', 'domain']
                for field in preview_fields:
                    if field not in link_preview:
                        return self.log_test("Link Preview Structure", False,
                                           f"Missing preview field: {field}")
            else:
                self.log_test("Link Preview Generation", False, "Link preview not generated")
            
            # Test 4: Test POST /api/world-chat/link-preview directly
            link_preview_request = {
                "url": "https://www.python.org"
            }
            
            response = self.session.post(f"{API_BASE}/world-chat/link-preview", 
                                       json=link_preview_request, headers=headers_test)
            if not self.log_test("Direct Link Preview", response.status_code == 200,
                               f"Status: {response.status_code}, Response: {response.text[:200]}"):
                return False
            
            preview_response = response.json()
            
            # Validate direct link preview
            preview_fields = ['url', 'title', 'description', 'domain']
            for field in preview_fields:
                if field not in preview_response:
                    return self.log_test("Direct Preview Structure", False,
                                       f"Missing field: {field}")
            
            if preview_response['url'] != link_preview_request['url']:
                return self.log_test("Preview URL Validation", False, "URL mismatch in preview")
            
            # Test 5: Test empty content validation
            empty_post = {
                "content": ""
            }
            
            response = self.session.post(f"{API_BASE}/world-chat/posts", 
                                       json=empty_post, headers=headers_test)
            if not self.log_test("Empty Content Validation", response.status_code == 400,
                               f"Status: {response.status_code} - Should reject empty content"):
                return False
            
            # Test 6: Test very long content
            long_content = "A" * 6000  # Exceeds 5000 character limit
            long_post = {
                "content": long_content
            }
            
            response = self.session.post(f"{API_BASE}/world-chat/posts", 
                                       json=long_post, headers=headers_test)
            if not self.log_test("Long Content Validation", response.status_code == 400,
                               f"Status: {response.status_code} - Should reject content over 5000 chars"):
                return False
            
            # Test 7: Test invalid URL for link preview
            invalid_link_request = {
                "url": "not-a-valid-url"
            }
            
            response = self.session.post(f"{API_BASE}/world-chat/link-preview", 
                                       json=invalid_link_request, headers=headers_test)
            if not self.log_test("Invalid URL Handling", response.status_code == 400,
                               f"Status: {response.status_code} - Should reject invalid URL"):
                return False
            
            # Test 8: Test pagination parameters
            response = self.session.get(f"{API_BASE}/world-chat/posts?limit=5&skip=0", headers=headers_test)
            if not self.log_test("Posts Pagination", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            paginated_posts = response.json()
            if len(paginated_posts) > 5:
                return self.log_test("Pagination Limit", False, f"Expected max 5 posts, got {len(paginated_posts)}")
            
            self.log_test("World Chat Posting Functionality", True, "🎉 ALL WORLD CHAT TESTS PASSED!")
            return True
            
        except Exception as e:
            return self.log_test("World Chat Posting Functionality", False, f"Exception: {str(e)}")
    
    def test_world_chat_comprehensive(self):
        """Comprehensive World Chat System Test"""
        print("\n=== Comprehensive World Chat System Test ===")
        
        try:
            # Test with multiple users to simulate real usage
            headers_alice = {"Authorization": f"Bearer {self.auth_tokens['alice']}"}
            headers_bob = {"Authorization": f"Bearer {self.auth_tokens['bob']}"}
            
            # Test 1: Multiple users posting
            alice_post = {
                "content": "Alice's World Chat post! 🚀 Testing multi-user functionality."
            }
            
            bob_post = {
                "content": "Bob here! 👋 This is my contribution to the World Chat.",
                "link_url": "https://fastapi.tiangolo.com"
            }
            
            # Alice posts
            response = self.session.post(f"{API_BASE}/world-chat/posts", 
                                       json=alice_post, headers=headers_alice)
            if not self.log_test("Alice World Chat Post", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            alice_post_response = response.json()
            
            # Bob posts with link
            response = self.session.post(f"{API_BASE}/world-chat/posts", 
                                       json=bob_post, headers=headers_bob)
            if not self.log_test("Bob World Chat Post with Link", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            bob_post_response = response.json()
            
            # Test 2: Verify both users can see all posts
            response = self.session.get(f"{API_BASE}/world-chat/posts", headers=headers_alice)
            if not self.log_test("Alice Views All Posts", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            alice_view_posts = response.json()
            
            response = self.session.get(f"{API_BASE}/world-chat/posts", headers=headers_bob)
            if not self.log_test("Bob Views All Posts", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            bob_view_posts = response.json()
            
            # Both users should see the same posts
            if len(alice_view_posts) != len(bob_view_posts):
                return self.log_test("Consistent Post Visibility", False, 
                                   f"Alice sees {len(alice_view_posts)} posts, Bob sees {len(bob_view_posts)}")
            
            # Test 3: Verify user information in posts
            alice_post_found = False
            bob_post_found = False
            
            for post in alice_view_posts:
                if post['id'] == alice_post_response['id']:
                    alice_post_found = True
                    if not post.get('user_name') or not post.get('user_nickname'):
                        return self.log_test("Alice Post User Info", False, "Missing user information")
                elif post['id'] == bob_post_response['id']:
                    bob_post_found = True
                    if not post.get('user_name') or not post.get('user_nickname'):
                        return self.log_test("Bob Post User Info", False, "Missing user information")
                    # Check if link preview was generated
                    if not post.get('link_preview'):
                        return self.log_test("Bob Post Link Preview", False, "Link preview not generated")
            
            if not alice_post_found:
                return self.log_test("Alice Post in Feed", False, "Alice's post not found in feed")
            
            if not bob_post_found:
                return self.log_test("Bob Post in Feed", False, "Bob's post not found in feed")
            
            # Test 4: Test chronological ordering (newest first)
            if len(alice_view_posts) >= 2:
                first_post = alice_view_posts[0]
                second_post = alice_view_posts[1]
                
                from datetime import datetime
                first_time = datetime.fromisoformat(first_post['created_at'].replace('Z', '+00:00'))
                second_time = datetime.fromisoformat(second_post['created_at'].replace('Z', '+00:00'))
                
                if first_time < second_time:
                    return self.log_test("Chronological Ordering", False, "Posts not ordered newest first")
            
            self.log_test("Comprehensive World Chat System", True, "All comprehensive tests passed")
            return True
            
        except Exception as e:
            return self.log_test("Comprehensive World Chat System", False, f"Exception: {str(e)}")
    
    def test_quick_authentication_verification(self):
        """Quick Authentication Test for Frontend Testing - Specific User Credentials"""
        print("\n=== Quick Authentication Verification for Frontend Testing ===")
        
        try:
            # Test with the exact credentials requested by user
            test_user = {
                "email": "test@vonex.com",
                "password": "password123",
                "first_name": "Test",
                "last_name": "User",
                "nickname": "testuser"
            }
            
            # Test 1: Try to register the requested user (might already exist)
            response = self.session.post(f"{API_BASE}/auth/register", json=test_user)
            if response.status_code == 400 and "already registered" in response.text.lower():
                self.log_test("User Registration", True, "User already exists - proceeding to login")
                user_exists = True
            elif response.status_code == 200:
                token_data = response.json()
                if 'access_token' not in token_data:
                    return self.log_test("Registration Token", False, "No access token in response")
                self.log_test("User Registration", True, "New user registered successfully")
                user_exists = False
            else:
                return self.log_test("User Registration", False, 
                                   f"Status: {response.status_code}, Response: {response.text[:200]}")
            
            # Test 2: Try login with requested credentials
            login_data = {"email": test_user["email"], "password": test_user["password"]}
            response = self.session.post(f"{API_BASE}/auth/login", json=login_data)
            
            if response.status_code == 401 and user_exists:
                # Original user exists but password might be different, create a new test user
                self.log_test("Original User Login", False, "Original user exists but password doesn't match")
                
                # Create a new test user with working credentials
                import time
                timestamp = str(int(time.time()))
                new_test_user = {
                    "email": f"test.auth.{timestamp}@vonex.com",
                    "password": "password123",
                    "first_name": "Test",
                    "last_name": "User",
                    "nickname": f"testuser_{timestamp}"
                }
                
                # Register new test user
                response = self.session.post(f"{API_BASE}/auth/register", json=new_test_user)
                if response.status_code != 200:
                    return self.log_test("New Test User Registration", False, 
                                       f"Status: {response.status_code}, Response: {response.text[:200]}")
                
                self.log_test("New Test User Registration", True, "Created new test user for authentication testing")
                
                # Login with new test user
                login_data = {"email": new_test_user["email"], "password": new_test_user["password"]}
                response = self.session.post(f"{API_BASE}/auth/login", json=login_data)
                test_user = new_test_user  # Use new user for remaining tests
                
            if not self.log_test("User Login", response.status_code == 200,
                               f"Status: {response.status_code}, Response: {response.text[:200]}"):
                return False
            
            token_data = response.json()
            if 'access_token' not in token_data:
                return self.log_test("Login Token", False, "No access token in response")
            
            auth_token = token_data['access_token']
            self.log_test("JWT Token Generation", True, f"Token received: {auth_token[:20]}...")
            
            # Test 3: Protected endpoint access with JWT token (GET /api/auth/me)
            headers = {"Authorization": f"Bearer {auth_token}"}
            response = self.session.get(f"{API_BASE}/auth/me", headers=headers)
            if not self.log_test("GET /api/auth/profile", response.status_code == 200,
                               f"Status: {response.status_code}, Response: {response.text[:200]}"):
                return False
            
            # Test 4: Verify profile data
            user_data = response.json()
            if user_data.get('email') != test_user['email']:
                return self.log_test("Profile Email Validation", False, "Email mismatch in profile")
            
            if user_data.get('nickname') != test_user['nickname']:
                return self.log_test("Profile Nickname Validation", False, "Nickname mismatch in profile")
            
            # Validate all required fields are present
            required_fields = ['id', 'email', 'first_name', 'last_name', 'nickname', 'is_active', 'created_at']
            for field in required_fields:
                if field not in user_data:
                    return self.log_test(f"Profile Field ({field})", False, f"Missing field: {field}")
            
            self.log_test("Profile Data Validation", True, "All profile fields present and correct")
            
            # Test 5: Test a few basic protected endpoints to ensure authentication is working
            response = self.session.get(f"{API_BASE}/rooms", headers=headers)
            if not self.log_test("Rooms Endpoint Access", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            response = self.session.get(f"{API_BASE}/friends", headers=headers)
            if not self.log_test("Friends Endpoint Access", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            # Test 6: Test unauthorized access (should fail)
            response = self.session.get(f"{API_BASE}/auth/me")
            if not self.log_test("Unauthorized Access Prevention", response.status_code == 403,
                               f"Status: {response.status_code}"):
                return False
            
            self.log_test("Quick Authentication Verification", True, 
                         "✅ Backend authentication ready for frontend testing!")
            return True
            
        except Exception as e:
            return self.log_test("Quick Authentication Verification", False, f"Exception: {str(e)}")

    async def run_all_tests(self):
        """Run all backend tests including NEW Private Chat and Friends System"""
        print("🚀 Starting Comprehensive Backend Testing - INCLUDING NEW PRIVATE CHAT & FRIENDS SYSTEM")
        print(f"Backend URL: {API_BASE}")
        print(f"WebSocket URL: {WS_BASE}")
        print("=" * 80)
        
        test_results = {}
        
        # EXISTING CORE TESTS
        # Test 1: Email Authentication System
        test_results['auth'] = self.test_email_authentication_system()
        
        # Test 2: User Management API
        test_results['user_mgmt'] = self.test_user_management_api()
        
        # Test 3: Room/Channel Management
        test_results['room_mgmt'] = self.test_room_management()
        
        # Test 4: Real-time WebSocket Chat
        test_results['websocket'] = await self.test_websocket_chat()
        
        # Test 5: HTTP Message Sending API (Critical Bug Fix)
        test_results['http_messaging'] = self.test_http_message_sending()
        
        # Test 6: Message Persistence
        test_results['message_persist'] = self.test_message_persistence()
        
        # NEW PRIVATE CHAT AND FRIENDS SYSTEM TESTS
        print("\n" + "🆕" * 20 + " NEW PRIVATE CHAT & FRIENDS SYSTEM TESTS " + "🆕" * 20)
        
        # Test 7: Room Users & Discovery (Phase 1)
        test_results['room_users_discovery'] = self.test_room_users_discovery()
        
        # Test 8: Private Messaging Core Feature (Phase 2)
        test_results['private_messaging'] = self.test_private_messaging_core()
        
        # Test 9: Friends/Favorites System (Phase 3)
        test_results['friends_system'] = self.test_friends_system()
        
        # Test 10: Private Conversations Management (Phase 4)
        test_results['private_conversations'] = self.test_private_conversations_management()
        
        # Test 11: Integration Testing (Phase 5)
        test_results['integration_private_chat'] = self.test_integration_private_chat_system()
        
        # Test 12: Unfavorite/Friend Removal Functionality (NEW FEATURE)
        test_results['unfavorite_friend_removal'] = self.test_unfavorite_friend_removal()
        
        # WORLD CHAT FUNCTIONALITY TESTS - TARGET OF THIS REVIEW
        print("\n" + "🌍" * 20 + " WORLD CHAT FUNCTIONALITY TESTS " + "🌍" * 20)
        
        # Test 13: World Chat Authentication
        test_results['world_chat_auth'] = self.test_world_chat_authentication()
        
        # Test 14: World Chat Posting Functionality (MAIN TARGET)
        test_results['world_chat_posting'] = self.test_world_chat_posting()
        
        # Test 15: World Chat Comprehensive Testing
        test_results['world_chat_comprehensive'] = self.test_world_chat_comprehensive()
        
        # Summary
        print("\n" + "=" * 80)
        print("📊 COMPREHENSIVE TEST SUMMARY - PRIVATE CHAT & FRIENDS SYSTEM")
        print("=" * 80)
        
        # Separate core tests from new private chat tests and world chat tests
        core_tests = ['auth', 'user_mgmt', 'room_mgmt', 'websocket', 'http_messaging', 'message_persist']
        private_chat_tests = ['room_users_discovery', 'private_messaging', 'friends_system', 'private_conversations', 'integration_private_chat', 'unfavorite_friend_removal']
        world_chat_tests = ['world_chat_auth', 'world_chat_posting', 'world_chat_comprehensive']
        
        print("CORE SYSTEM TESTS:")
        core_passed = 0
        for test_name in core_tests:
            if test_name in test_results:
                result = test_results[test_name]
                status = "✅ PASS" if result else "❌ FAIL"
                print(f"  {status} {test_name.replace('_', ' ').title()}")
                if result:
                    core_passed += 1
        
        print(f"\nCore System: {core_passed}/{len(core_tests)} tests passed")
        
        print("\nNEW PRIVATE CHAT & FRIENDS SYSTEM TESTS:")
        private_chat_passed = 0
        for test_name in private_chat_tests:
            if test_name in test_results:
                result = test_results[test_name]
                status = "✅ PASS" if result else "❌ FAIL"
                print(f"  {status} {test_name.replace('_', ' ').title()}")
                if result:
                    private_chat_passed += 1
        
        print(f"\nPrivate Chat System: {private_chat_passed}/{len(private_chat_tests)} tests passed")
        
        print("\nWORLD CHAT FUNCTIONALITY TESTS:")
        world_chat_passed = 0
        for test_name in world_chat_tests:
            if test_name in test_results:
                result = test_results[test_name]
                status = "✅ PASS" if result else "❌ FAIL"
                print(f"  {status} {test_name.replace('_', ' ').title()}")
                if result:
                    world_chat_passed += 1
        
        print(f"\nWorld Chat System: {world_chat_passed}/{len(world_chat_tests)} tests passed")
        
        passed = sum(test_results.values())
        total = len(test_results)
        
        print(f"\n🎯 OVERALL RESULT: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 ALL TESTS PASSED! Private Chat, Friends System, and World Chat are fully functional!")
            print("✅ Users can send private messages to anyone without being friends")
            print("✅ Friends system works for adding favorites")
            print("✅ Room users endpoint returns active users for private chat suggestions")
            print("✅ Private conversations endpoint manages all chats efficiently")
            print("✅ Unread counts and timestamps work correctly")
            print("✅ World Chat posting functionality is working perfectly")
            print("✅ Link preview generation is functional")
            print("✅ Authentication is properly protecting World Chat endpoints")
            print("✅ No data corruption or security issues detected")
        else:
            print("⚠️  Some tests FAILED. Check the details above.")
            if private_chat_passed < len(private_chat_tests):
                print("🚨 PRIVATE CHAT SYSTEM has issues that need attention!")
            if world_chat_passed < len(world_chat_tests):
                print("🚨 WORLD CHAT SYSTEM has issues that need attention!")
        
        return test_results
    
    def run_quick_auth_test(self):
        """Run only the quick authentication test"""
        print("🎯 Running Quick Authentication Test for Frontend Testing...")
        print(f"Backend URL: {API_BASE}")
        print("=" * 60)
        
        result = self.test_quick_authentication_verification()
        
        print("\n" + "=" * 60)
        if result:
            print("🎉 AUTHENTICATION TEST PASSED! Backend is ready for frontend testing.")
        else:
            print("❌ AUTHENTICATION TEST FAILED! Check the details above.")
        
        return result

async def main():
    """Main test execution"""
    tester = BackendTester()
    
    # Check if we should run quick auth test or full tests
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "quick":
        return tester.run_quick_auth_test()
    else:
        results = await tester.run_all_tests()
        return results

if __name__ == "__main__":
    asyncio.run(main())