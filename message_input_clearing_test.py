#!/usr/bin/env python3
"""
Focused Test for Message Input Clearing Fix
Tests the specific HTTP message sending endpoint to verify it returns proper responses
so the frontend can clear the input field after successful message sending.
"""

import requests
import json
import time
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

# Get backend URL from environment
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'http://localhost:8001')
API_BASE = f"{BACKEND_URL}/api"

print(f"Testing Message Input Clearing Fix at: {API_BASE}")
print("=" * 60)

class MessageInputClearingTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.room_id = None
        
    def log_test(self, test_name, status, details=""):
        """Log test results"""
        status_symbol = "✅" if status else "❌"
        print(f"{status_symbol} {test_name}")
        if details:
            print(f"   Details: {details}")
        return status
    
    def setup_test_environment(self):
        """Setup user and room for testing"""
        print("\n=== Setting up test environment ===")
        
        # Create test user
        timestamp = str(int(time.time()))
        test_user = {
            "email": f"inputtest.{timestamp}@example.com",
            "password": "TestPass123!",
            "first_name": "Input",
            "last_name": "Tester",
            "nickname": f"inputtester_{timestamp}"
        }
        
        try:
            # Register user
            response = self.session.post(f"{API_BASE}/auth/register", json=test_user)
            if not self.log_test("User Registration", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            token_data = response.json()
            self.auth_token = token_data['access_token']
            
            # Create test room
            room_data = {
                "name": "Input Clearing Test Room",
                "description": "Room for testing message input clearing",
                "is_private": False
            }
            
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            response = self.session.post(f"{API_BASE}/rooms", json=room_data, headers=headers)
            if not self.log_test("Room Creation", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            room_response = response.json()
            self.room_id = room_response['id']
            
            self.log_test("Test Environment Setup", True, "User and room created successfully")
            return True
            
        except Exception as e:
            return self.log_test("Test Environment Setup", False, f"Exception: {str(e)}")
    
    def test_message_sending_response(self):
        """Test the specific HTTP message sending endpoint response"""
        print("\n=== Testing HTTP Message Sending Response ===")
        
        if not self.auth_token or not self.room_id:
            return self.log_test("Message Sending Response", False, "Test environment not set up")
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        try:
            # Test 1: Send message and verify HTTP 200 response
            test_message = {
                "content": "Test message for input clearing verification"
            }
            
            response = self.session.post(f"{API_BASE}/rooms/{self.room_id}/messages", 
                                       json=test_message, headers=headers)
            
            if not self.log_test("HTTP 200 Status", response.status_code == 200,
                               f"Status: {response.status_code}, Response: {response.text[:200]}"):
                return False
            
            # Test 2: Verify response contains message data
            try:
                message_data = response.json()
            except json.JSONDecodeError:
                return self.log_test("JSON Response", False, "Response is not valid JSON")
            
            if not self.log_test("Response is JSON", True, "Response successfully parsed as JSON"):
                return False
            
            # Test 3: Verify response structure for frontend input clearing
            required_fields = ['id', 'content', 'room_id', 'user_id', 'user_name', 'created_at']
            for field in required_fields:
                if field not in message_data:
                    return self.log_test(f"Response Field: {field}", False, f"Missing field: {field}")
                else:
                    self.log_test(f"Response Field: {field}", True, f"Value: {message_data[field]}")
            
            # Test 4: Verify message content matches what was sent
            if message_data.get('content') != test_message['content']:
                return self.log_test("Message Content Match", False, 
                                   f"Expected: {test_message['content']}, Got: {message_data.get('content')}")
            else:
                self.log_test("Message Content Match", True, "Content matches sent message")
            
            # Test 5: Verify user_name is populated (critical for the fix)
            user_name = message_data.get('user_name')
            if not user_name:
                return self.log_test("User Name Population", False, "user_name is null or empty")
            else:
                self.log_test("User Name Population", True, f"user_name: {user_name}")
            
            # Test 6: Verify message is retrievable (persistence check)
            response = self.session.get(f"{API_BASE}/rooms/{self.room_id}/messages", headers=headers)
            if not self.log_test("Message Persistence", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            messages = response.json()
            found_message = False
            for msg in messages:
                if msg.get('content') == test_message['content']:
                    found_message = True
                    break
            
            if not found_message:
                return self.log_test("Message in List", False, "Sent message not found in message list")
            else:
                self.log_test("Message in List", True, "Message successfully stored and retrievable")
            
            return True
            
        except Exception as e:
            return self.log_test("Message Sending Response", False, f"Exception: {str(e)}")
    
    def test_multiple_message_scenarios(self):
        """Test multiple message sending scenarios"""
        print("\n=== Testing Multiple Message Scenarios ===")
        
        if not self.auth_token or not self.room_id:
            return self.log_test("Multiple Message Scenarios", False, "Test environment not set up")
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        try:
            # Test different message types
            test_messages = [
                {"content": "Short message"},
                {"content": "This is a longer message to test if the API handles different message lengths properly and still returns the correct response for input clearing."},
                {"content": "Message with special characters: !@#$%^&*()_+-=[]{}|;':\",./<>?"},
                {"content": "Message with emojis: 😀 🎉 ✅ ❌ 🚀"},
                {"content": "Message\nwith\nnewlines"}
            ]
            
            all_successful = True
            
            for i, test_message in enumerate(test_messages, 1):
                response = self.session.post(f"{API_BASE}/rooms/{self.room_id}/messages", 
                                           json=test_message, headers=headers)
                
                success = response.status_code == 200
                if success:
                    try:
                        message_data = response.json()
                        # Verify essential fields for input clearing
                        success = (
                            'id' in message_data and
                            'content' in message_data and
                            'user_name' in message_data and
                            message_data['content'] == test_message['content']
                        )
                    except:
                        success = False
                
                test_name = f"Message Scenario {i}"
                if not self.log_test(test_name, success, 
                                   f"Status: {response.status_code}, Content: {test_message['content'][:50]}..."):
                    all_successful = False
            
            return self.log_test("Multiple Message Scenarios", all_successful, 
                               "All message scenarios tested")
            
        except Exception as e:
            return self.log_test("Multiple Message Scenarios", False, f"Exception: {str(e)}")
    
    def test_error_scenarios(self):
        """Test error scenarios to ensure proper error responses"""
        print("\n=== Testing Error Scenarios ===")
        
        if not self.auth_token:
            return self.log_test("Error Scenarios", False, "Test environment not set up")
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        try:
            # Test 1: Send message to non-existent room
            test_message = {"content": "Message to non-existent room"}
            response = self.session.post(f"{API_BASE}/rooms/non-existent-room-id/messages", 
                                       json=test_message, headers=headers)
            
            if not self.log_test("Non-existent Room Error", response.status_code == 404,
                               f"Status: {response.status_code}"):
                return False
            
            # Test 2: Send message without authentication
            response = self.session.post(f"{API_BASE}/rooms/{self.room_id}/messages", 
                                       json=test_message)
            
            if not self.log_test("Unauthorized Access Error", response.status_code == 403,
                               f"Status: {response.status_code}"):
                return False
            
            # Test 3: Send empty message
            empty_message = {"content": ""}
            response = self.session.post(f"{API_BASE}/rooms/{self.room_id}/messages", 
                                       json=empty_message, headers=headers)
            
            # This might be allowed or not - let's check what happens
            empty_allowed = response.status_code == 200
            self.log_test("Empty Message Handling", True, 
                         f"Status: {response.status_code} - {'Allowed' if empty_allowed else 'Rejected'}")
            
            return True
            
        except Exception as e:
            return self.log_test("Error Scenarios", False, f"Exception: {str(e)}")
    
    def run_focused_test(self):
        """Run the focused test for message input clearing fix"""
        print("🎯 FOCUSED TEST: Message Input Clearing Fix")
        print("Testing HTTP message sending endpoint for proper responses")
        print("=" * 60)
        
        # Setup
        if not self.setup_test_environment():
            print("❌ Failed to set up test environment")
            return False
        
        # Main test
        success = self.test_message_sending_response()
        
        # Additional scenarios
        self.test_multiple_message_scenarios()
        self.test_error_scenarios()
        
        print("\n" + "=" * 60)
        print("📊 FOCUSED TEST SUMMARY")
        print("=" * 60)
        
        if success:
            print("✅ HTTP MESSAGE SENDING API - WORKING CORRECTLY")
            print("✅ Returns HTTP 200 status for successful messages")
            print("✅ Response contains proper message data structure")
            print("✅ user_name field is correctly populated")
            print("✅ Message content matches what was sent")
            print("✅ Messages are properly persisted and retrievable")
            print("\n🎉 FRONTEND INPUT CLEARING SHOULD WORK PROPERLY!")
            print("   The backend API returns successful responses that allow")
            print("   the frontend to clear the input field after sending.")
        else:
            print("❌ HTTP MESSAGE SENDING API - HAS ISSUES")
            print("   The backend API is not returning proper responses")
            print("   This will prevent the frontend from clearing input fields")
        
        return success

def main():
    """Main test execution"""
    tester = MessageInputClearingTester()
    return tester.run_focused_test()

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)