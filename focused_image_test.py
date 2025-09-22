#!/usr/bin/env python3
"""
Focused Image Upload and Posting Test for Review Request
Tests the exact end-to-end flow requested in the review
"""

import requests
import io
from PIL import Image
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

# Get backend URL from environment
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'http://localhost:8001')
API_BASE = f"{BACKEND_URL}/api"

print(f"Testing backend at: {API_BASE}")

class FocusedImageTester:
    def __init__(self):
        self.session = requests.Session()
        
    def log_test(self, test_name, status, details=""):
        """Log test results"""
        status_symbol = "✅" if status else "❌"
        print(f"{status_symbol} {test_name}")
        if details:
            print(f"   Details: {details}")
        return status
    
    def test_end_to_end_image_flow(self):
        """Test the complete end-to-end image upload and posting flow"""
        print("\n=== FOCUSED IMAGE UPLOAD AND POSTING TEST ===")
        print("Testing exact flow from review request:")
        print("1. POST /api/world-chat/upload-image with real image")
        print("2. Get uploaded image ID")
        print("3. Create post with image using POST /api/world-chat/posts")
        print("4. Verify post contains image with thumbnail_url")
        print("5. Test GET /api/world-chat/posts to see post with image")
        print("6. Verify image serving endpoint")
        
        try:
            # Step 1: Authenticate with exact credentials from review request
            test_credentials = {
                "email": "test@example.com",
                "password": "password123"
            }
            
            # Try login first, register if needed
            response = self.session.post(f"{API_BASE}/auth/login", json=test_credentials)
            if response.status_code != 200:
                # Register user
                register_data = {
                    "email": test_credentials["email"],
                    "password": test_credentials["password"],
                    "first_name": "Test",
                    "last_name": "User",
                    "nickname": "testuser"
                }
                
                response = self.session.post(f"{API_BASE}/auth/register", json=register_data)
                if not self.log_test("User Registration", response.status_code == 200,
                                   f"Status: {response.status_code}"):
                    return False
                
                # Login after registration
                response = self.session.post(f"{API_BASE}/auth/login", json=test_credentials)
                if not self.log_test("User Login", response.status_code == 200,
                                   f"Status: {response.status_code}"):
                    return False
            else:
                self.log_test("User Login", True, "Existing user logged in successfully")
            
            token_data = response.json()
            headers = {"Authorization": f"Bearer {token_data['access_token']}"}
            
            # Step 2: Create a realistic test image (not just a colored square)
            print("\n🖼️  Creating realistic test image...")
            
            # Create a more realistic test image with some pattern
            test_image = Image.new('RGB', (800, 600), color='white')
            # Add some colored rectangles to make it more realistic
            from PIL import ImageDraw
            draw = ImageDraw.Draw(test_image)
            draw.rectangle([50, 50, 350, 250], fill='red', outline='black', width=2)
            draw.rectangle([400, 100, 700, 400], fill='blue', outline='black', width=2)
            draw.rectangle([150, 300, 550, 500], fill='green', outline='black', width=2)
            
            img_buffer = io.BytesIO()
            test_image.save(img_buffer, format='JPEG', quality=90)
            img_buffer.seek(0)
            
            # Step 3: Upload image via POST /api/world-chat/upload-image
            print("\n📤 Step 1: Testing POST /api/world-chat/upload-image...")
            
            files = {
                'file': ('test_realistic_image.jpg', img_buffer, 'image/jpeg')
            }
            
            response = self.session.post(f"{API_BASE}/world-chat/upload-image", 
                                       files=files, headers=headers)
            if not self.log_test("1. Image Upload", response.status_code == 200,
                               f"Status: {response.status_code}, Response: {response.text[:200]}"):
                return False
            
            uploaded_image = response.json()
            print(f"   📋 Uploaded Image Details: {uploaded_image}")
            
            # Step 4: Extract image ID (Step 2 from review)
            image_id = uploaded_image['id']
            image_url = uploaded_image['url']
            thumbnail_url = uploaded_image['thumbnail_url']
            
            if not self.log_test("2. Get Image ID", bool(image_id),
                               f"Image ID: {image_id}"):
                return False
            
            # Step 5: Create post with image (Step 3 from review)
            print(f"\n📝 Step 3: Creating post with image ID: {image_id}")
            
            post_data = {
                "content": "Test postare cu imagine"  # Exact text from review request
            }
            
            response = self.session.post(f"{API_BASE}/world-chat/posts?images={image_id}", 
                                       json=post_data, headers=headers)
            if not self.log_test("3. Create Post with Image", response.status_code == 200,
                               f"Status: {response.status_code}, Response: {response.text[:300]}"):
                return False
            
            created_post = response.json()
            print(f"   📋 Created Post Details: {created_post}")
            
            # Step 6: Verify post contains image with thumbnail_url (Step 4 from review)
            print("\n🔍 Step 4: Verifying post contains image with thumbnail_url...")
            
            if not created_post.get('images'):
                return self.log_test("4. Post Contains Images", False, "No images found in post")
            
            if len(created_post['images']) != 1:
                return self.log_test("4. Image Count", False, 
                                   f"Expected 1 image, got {len(created_post['images'])}")
            
            post_image = created_post['images'][0]
            
            # Verify image has thumbnail_url
            if not post_image.get('thumbnail_url'):
                return self.log_test("4. Thumbnail URL Present", False, "thumbnail_url missing from post image")
            
            if post_image['thumbnail_url'] != thumbnail_url:
                return self.log_test("4. Thumbnail URL Correct", False, 
                                   f"Expected: {thumbnail_url}, Got: {post_image['thumbnail_url']}")
            
            self.log_test("4. Post Contains Image with Thumbnail", True, 
                         f"✅ Image ID: {post_image['id']}, Thumbnail: {post_image['thumbnail_url']}")
            
            # Step 7: Test GET /api/world-chat/posts (Step 5 from review)
            print("\n📖 Step 5: Testing GET /api/world-chat/posts to see post with image...")
            
            response = self.session.get(f"{API_BASE}/world-chat/posts?limit=10", headers=headers)
            if not self.log_test("5. Get Posts", response.status_code == 200,
                               f"Status: {response.status_code}"):
                return False
            
            posts = response.json()
            
            # Find our post
            our_post = None
            for post in posts:
                if post.get('id') == created_post['id']:
                    our_post = post
                    break
            
            if not our_post:
                return self.log_test("5. Find Our Post", False, "Created post not found in posts list")
            
            # Verify image is still there with all details
            if not our_post.get('images') or len(our_post['images']) == 0:
                return self.log_test("5. Image in Retrieved Post", False, "Image missing from retrieved post")
            
            retrieved_image = our_post['images'][0]
            if retrieved_image['id'] != image_id:
                return self.log_test("5. Image ID Match", False, "Image ID mismatch in retrieved post")
            
            if not retrieved_image.get('thumbnail_url'):
                return self.log_test("5. Thumbnail in Retrieved Post", False, "Thumbnail URL missing from retrieved post")
            
            self.log_test("5. Post with Image Retrieved", True, 
                         f"✅ Post found with image, thumbnail: {retrieved_image['thumbnail_url']}")
            
            # Step 8: Verify image serving endpoint (Step 6 from review)
            print("\n🌐 Step 6: Verifying image serving endpoints...")
            
            # Test full image serving
            full_image_url = f"{BACKEND_URL}{image_url}"
            response = self.session.get(full_image_url)
            if not self.log_test("6a. Full Image Serving", response.status_code == 200,
                               f"URL: {full_image_url}, Status: {response.status_code}"):
                return False
            
            # Test thumbnail serving
            thumbnail_full_url = f"{BACKEND_URL}{thumbnail_url}"
            response = self.session.get(thumbnail_full_url)
            if not self.log_test("6b. Thumbnail Image Serving", response.status_code == 200,
                               f"URL: {thumbnail_full_url}, Status: {response.status_code}"):
                return False
            
            # Final verification - check image paths and thumbnails
            print("\n🔍 Final Verification: Image paths and thumbnails...")
            
            print(f"   📁 Full Image Path: {image_url}")
            print(f"   📁 Thumbnail Path: {thumbnail_url}")
            print(f"   📏 Image Dimensions: {uploaded_image['width']}x{uploaded_image['height']}")
            print(f"   📦 File Size: {uploaded_image['file_size']} bytes")
            print(f"   📝 Post Content: '{created_post['content']}'")
            print(f"   🆔 Post ID: {created_post['id']}")
            
            self.log_test("🎉 END-TO-END IMAGE FLOW", True, 
                         "All 6 steps completed successfully! Images appear correctly in posts.")
            return True
            
        except Exception as e:
            return self.log_test("END-TO-END IMAGE FLOW", False, f"Exception: {str(e)}")

def main():
    tester = FocusedImageTester()
    success = tester.test_end_to_end_image_flow()
    
    if success:
        print("\n" + "="*80)
        print("🎯 REVIEW REQUEST RESULT: SUCCESS")
        print("✅ All image upload and posting functionality is working correctly")
        print("✅ Images appear in posts after upload")
        print("✅ Thumbnail URLs are correct")
        print("✅ Image serving endpoints work properly")
        print("="*80)
    else:
        print("\n" + "="*80)
        print("❌ REVIEW REQUEST RESULT: FAILURE")
        print("❌ Issues found with image upload and posting flow")
        print("="*80)

if __name__ == "__main__":
    main()