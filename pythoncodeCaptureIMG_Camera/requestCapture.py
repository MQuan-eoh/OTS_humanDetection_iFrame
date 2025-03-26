from flask import Flask, jsonify
from flask_cors import CORS 
import requests
from requests.auth import HTTPDigestAuth
from urllib.parse import quote_plus
import firebase_admin
from firebase_admin import credentials, storage
from datetime import datetime
#Initial Firebase Admin SDK
cred = credentials.Certificate("")

firebase_admin.initialize_app(cred, {
    'storageBucket': 'esp32cam-4dbf9.appspot.com'  #projectID
})

def capture_and_upload_image():
    try:
        # Camera credentials
        username = ""
        password = "" 
        encoded_password = quote_plus(password)  #Processing of special symbols
        
        # URL và xác thực
        url = ""
    
        #Send request using Digest Auth
        response = requests.get(
            url,
            auth=HTTPDigestAuth(username, encoded_password),
            timeout=10,
            verify=False,  #Skip SSL verify
            allow_redirects=True,  #Allo  redirect
            headers={"User-Agent": "Mozilla/5.0"}  #Simulate browser
        )
        
        
        print("HTTP Status Code từ camera:", response.status_code)
        
        if response.status_code == 200:
            bucket = storage.bucket()
            current_time = datetime.now()
            filename = current_time.strftime("HIKVISION_%H-%M-%S_%m-%d-%y.jpg")
            blob = bucket.blob(f'images/{filename}')
            blob.upload_from_string(response.content, content_type='image/jpeg')
            
            blob.make_public()
            print('Public URL:', blob.public_url)
            
            return blob.public_url
        else:
            print("Lỗi khi tải ảnh từ camera:", response.status_code)
            return None
    except requests.exceptions.RequestException as e:
        print("Lỗi khi kết nối tới camera:", e)
        return None
    except Exception as e:
        print("Lỗi không mong muốn xảy ra:", e)
        return None
#Initial Flask
app = Flask(__name__)
CORS(app)  #Allow CORS for all Route
#Define original router "/"
@app.route('/', methods=['GET'])
def home():
    return jsonify({"message": "Welcome to the camera capture API!"})

# Define route "/capture" for capture
@app.route('/capture', methods=['GET'])
def capture_image():
    try:
        public_url = capture_and_upload_image()
        if public_url:
            return jsonify({"imageUrl": public_url})
        else:
            return jsonify({"error": "Failed to capture image"}), 500
    except Exception as e:
        print("Lỗi xảy ra trong /capture:", e)
        return jsonify({"error": "Internal Server Error"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)
