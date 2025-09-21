#!/usr/bin/env python3
"""
Quick Authentication Test for Tab Emoji Removal Feature Testing
Tests the specific credentials requested: test@example.com / password123
"""

import requests
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

# Get backend URL from environment
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'http://localhost:8001')
API_BASE = f"{BACKEND_URL}/api"

print(f"🔍 Quick Authentication Test")
print(f"Backend URL: {API_BASE}")
print("=" * 60)

def test_specific_credentials():
    """Test the exact credentials requested in the review"""
    session = requests.Session()
    
    # Test credentials from review request
    test_user = {
        "email": "test@example.com",
        "password": "password123",
        "first_name": "Test",
        "last_name": "User", 
        "nickname": "TestUser"
    }
    
    login_data = {
        "email": "test@example.com",
        "password": "password123"
    }
    
    print("1. Testing User Registration...")
    try:
        response = session.post(f"{API_BASE}/auth/register", json=test_user)
        print(f"   Registration Status: {response.status_code}")
        
        if response.status_code == 200:
            token_data = response.json()
            print(f"   ✅ Registration successful - Token received")
            print(f"   Token: {token_data['access_token'][:50]}...")
        elif response.status_code == 400:
            print(f"   ⚠️  User already exists (expected if run before)")
            print(f"   Response: {response.text}")
        else:
            print(f"   ❌ Registration failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ Registration error: {str(e)}")
        return False
    
    print("\n2. Testing User Login...")
    try:
        response = session.post(f"{API_BASE}/auth/login", json=login_data)
        print(f"   Login Status: {response.status_code}")
        
        if response.status_code == 200:
            token_data = response.json()
            print(f"   ✅ Login successful - JWT token received")
            print(f"   Token: {token_data['access_token'][:50]}...")
            
            # Test protected endpoint
            print("\n3. Testing Protected Endpoint Access...")
            headers = {"Authorization": f"Bearer {token_data['access_token']}"}
            response = session.get(f"{API_BASE}/auth/me", headers=headers)
            print(f"   Profile Status: {response.status_code}")
            
            if response.status_code == 200:
                user_data = response.json()
                print(f"   ✅ Protected endpoint access successful")
                print(f"   User Email: {user_data.get('email')}")
                print(f"   User Nickname: {user_data.get('nickname')}")
                print(f"   User ID: {user_data.get('id')}")
                return True
            else:
                print(f"   ❌ Protected endpoint failed: {response.text}")
                return False
                
        else:
            print(f"   ❌ Login failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ Login error: {str(e)}")
        return False

def test_basic_api_endpoints():
    """Test basic API endpoints are responding"""
    session = requests.Session()
    
    print("\n4. Testing Basic API Endpoints...")
    
    # Test rooms endpoint (should require auth)
    try:
        response = session.get(f"{API_BASE}/rooms")
        print(f"   Rooms endpoint (no auth): {response.status_code} (expected 403)")
        
        if response.status_code == 403:
            print(f"   ✅ Rooms endpoint properly protected")
        else:
            print(f"   ⚠️  Unexpected response: {response.status_code}")
            
    except Exception as e:
        print(f"   ❌ Rooms endpoint error: {str(e)}")
        return False
    
    return True

def check_backend_services():
    """Check if backend services are running"""
    print("\n5. Checking Backend Service Status...")
    
    try:
        # Simple health check - try to reach the API
        response = requests.get(f"{API_BASE}/auth/login", timeout=5)
        print(f"   Backend reachable: {response.status_code}")
        
        if response.status_code in [405, 422]:  # Method not allowed or validation error is expected for GET on login
            print(f"   ✅ Backend service is running and responding")
            return True
        else:
            print(f"   ⚠️  Unexpected response but service is reachable")
            return True
            
    except requests.exceptions.Timeout:
        print(f"   ❌ Backend service timeout - may be down")
        return False
    except requests.exceptions.ConnectionError:
        print(f"   ❌ Backend service connection error - may be down")
        return False
    except Exception as e:
        print(f"   ❌ Backend service error: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 Starting Quick Authentication Test for Frontend Testing Preparation")
    print()
    
    # Run all tests
    auth_success = test_specific_credentials()
    api_success = test_basic_api_endpoints()
    service_success = check_backend_services()
    
    print("\n" + "=" * 60)
    print("📋 QUICK TEST SUMMARY:")
    print(f"   Authentication Flow: {'✅ WORKING' if auth_success else '❌ FAILED'}")
    print(f"   Basic API Endpoints: {'✅ WORKING' if api_success else '❌ FAILED'}")
    print(f"   Backend Services: {'✅ RUNNING' if service_success else '❌ DOWN'}")
    
    if auth_success and api_success and service_success:
        print("\n🎉 RESULT: Backend is ready for frontend testing!")
        print("   You can proceed with frontend authentication testing.")
    else:
        print("\n⚠️  RESULT: Backend has issues that need to be resolved.")
        print("   Please check the failed components before frontend testing.")