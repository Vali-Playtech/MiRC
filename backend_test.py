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
        
        # Test user registration
        test_user = {
            "email": "alice.johnson@example.com",
            "password": "SecurePass123!",
            "first_name": "Alice",
            "last_name": "Johnson",
            "nickname": "alice_j"
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
            test_user2 = {
                "email": "bob.smith@example.com",
                "password": "AnotherPass456!",
                "first_name": "Bob",
                "last_name": "Smith",
                "nickname": "bob_s"
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
    
    def test_message_persistence(self):
        """Test 5: Message Persistence"""
        print("\n=== Testing Message Persistence ===")
        
        try:
            if not self.test_rooms:
                self.log_test("Message Persistence", False, "No test rooms available")
                return False
            
            room_id = self.test_rooms[0]['id']  # Use first public room
            headers_alice = {"Authorization": f"Bearer {self.auth_tokens['alice']}"}
            
            # Get initial message count
            response = self.session.get(f"{API_BASE}/rooms/{room_id}/messages", headers=headers_alice)
            if not self.log_test("Message Retrieval", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            initial_messages = response.json()
            initial_count = len(initial_messages)
            
            # Send a message via WebSocket (this should persist)
            # Note: We already sent a message in the WebSocket test, so check if it's persisted
            
            # Get messages again to verify persistence
            response = self.session.get(f"{API_BASE}/rooms/{room_id}/messages", headers=headers_alice)
            if not self.log_test("Message Persistence Check", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            current_messages = response.json()
            current_count = len(current_messages)
            
            if current_count <= initial_count:
                return self.log_test("Message Persistence Validation", False,
                                   f"Message count did not increase: {initial_count} -> {current_count}")
            
            # Validate message structure
            if current_messages:
                latest_message = current_messages[-1]
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
            
            # Test message retrieval with different user (Bob)
            headers_bob = {"Authorization": f"Bearer {self.auth_tokens['bob']}"}
            response = self.session.get(f"{API_BASE}/rooms/{room_id}/messages", headers=headers_bob)
            if not self.log_test("Cross-User Message Access", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            bob_messages = response.json()
            if len(bob_messages) != current_count:
                return self.log_test("Message Consistency", False,
                                   "Different users see different message counts")
            
            self.log_test("Message Persistence", True, "All message persistence tests passed")
            return True
            
        except Exception as e:
            return self.log_test("Message Persistence", False, f"Exception: {str(e)}")
    
    async def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Comprehensive Backend Testing")
        print(f"Backend URL: {API_BASE}")
        print(f"WebSocket URL: {WS_BASE}")
        print("=" * 60)
        
        test_results = {}
        
        # Test 1: Email Authentication System
        test_results['auth'] = self.test_email_authentication_system()
        
        # Test 2: User Management API
        test_results['user_mgmt'] = self.test_user_management_api()
        
        # Test 3: Room/Channel Management
        test_results['room_mgmt'] = self.test_room_management()
        
        # Test 4: Real-time WebSocket Chat
        test_results['websocket'] = await self.test_websocket_chat()
        
        # Test 5: Message Persistence
        test_results['message_persist'] = self.test_message_persistence()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(test_results.values())
        total = len(test_results)
        
        for test_name, result in test_results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{status} {test_name.replace('_', ' ').title()}")
        
        print(f"\nOverall Result: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All backend tests PASSED! Backend is working correctly.")
        else:
            print("⚠️  Some backend tests FAILED. Check the details above.")
        
        return test_results

async def main():
    """Main test execution"""
    tester = BackendTester()
    results = await tester.run_all_tests()
    return results

if __name__ == "__main__":
    asyncio.run(main())