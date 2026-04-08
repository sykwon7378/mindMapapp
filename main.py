import os
import json
import shutil
import uuid
from typing import List, Dict, Any

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv
import mysql.connector
from mysql.connector import Error

# Load environment variables
load_dotenv()

app = FastAPI(title="Mind Map API")

# Ensure essential directories exist
os.makedirs("static", exist_ok=True)
os.makedirs("static/uploads", exist_ok=True)

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    # Generate unique filename to avoid collisions
    ext = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join("static/uploads", unique_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"url": f"/static/uploads/{unique_filename}", "filename": file.filename}

class UpdateFileRequest(BaseModel):
    path: str
    content: str

@app.put("/api/files/update")
async def update_file_content(payload: UpdateFileRequest):
    # Pre-process path to get local file system path
    target_path = payload.path
    if target_path.startswith("/"):
        target_path = target_path[1:]
    
    # Security: Only allow updating files in static/uploads/
    if not target_path.startswith("static/uploads/"):
        raise HTTPException(status_code=403, detail="Access denied: Can only update uploaded files.")
    
    if not os.path.exists(target_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    try:
        with open(target_path, "w", encoding="utf-8") as f:
            f.write(payload.content)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/download")
async def download_file(path: str, filename: str):
    # Security check: Ensure path is within static/uploads
    local_path = path[1:] if path.startswith("/") else path
    if not local_path.startswith("static/uploads/"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not os.path.exists(local_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    return FileResponse(local_path, filename=filename)

# Database Configuration
def get_db_connection():
    try:
        connection = mysql.connector.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            database=os.getenv("DB_NAME"),
            charset=os.getenv("DB_CHARSET", "utf8mb4")
        )
        return connection
    except Error as e:
        print(f"Error connecting to MySQL: {e}")
        return None

def init_db():
    connection = get_db_connection()
    if connection:
        try:
            cursor = connection.cursor()
            # Create table if not exists with title and description columns
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS mind_maps (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    key_name VARCHAR(50) UNIQUE,
                    title VARCHAR(255) NOT NULL DEFAULT 'Untitled Mind Map',
                    description TEXT,
                    map_data LONGTEXT NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)
            connection.commit()
            
            # Check if columns exist (Migration for existing table)
            try:
                cursor.execute("ALTER TABLE mind_maps ADD COLUMN title VARCHAR(255) NOT NULL DEFAULT 'Untitled Mind Map' AFTER key_name")
            except Error as e:
                if e.errno != 1060: # Ignore duplicate column error
                    raise e
            
            try:
                cursor.execute("ALTER TABLE mind_maps ADD COLUMN description TEXT AFTER title")
            except Error as e:
                if e.errno != 1060:
                    raise e
            
            connection.commit()
            
            # Create user_settings table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_settings (
                    setting_key VARCHAR(50) PRIMARY KEY,
                    setting_value TEXT
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)
            connection.commit()
            
            # Check if current map exists
            cursor.execute("SELECT COUNT(*) FROM mind_maps")
            count = cursor.fetchone()[0]
            
            # Migration logic: if DB is empty and JSON exists, migrate it
            if count == 0:
                json_path = "data/map.json"
                if os.path.exists(json_path):
                    with open(json_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        map_json = json.dumps(data, ensure_ascii=False)
                        cursor.execute(
                            "INSERT INTO mind_maps (key_name, title, map_data) VALUES ('default_map', 'Central Idea', %s)", 
                            (map_json,)
                        )
                        connection.commit()
                        print("Migrated existing JSON data to MySQL.")
            
            print("Database initialized and checked successfully.")
        except Error as e:
            print(f"Error initializing database: {e}")
        finally:
            connection.close()

# Initialize DB on startup
@app.on_event("startup")
async def startup_event():
    init_db()

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def read_index():
    return FileResponse("static/index.html")

# --- API Endpoints for Multi-Map Management ---

@app.get("/api/maps")
async def list_maps():
    connection = get_db_connection()
    if not connection: raise HTTPException(status_code=500)
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT id, title, description, updated_at FROM mind_maps ORDER BY updated_at DESC")
        return cursor.fetchall()
    finally: connection.close()

@app.post("/api/maps")
async def create_map():
    connection = get_db_connection()
    if not connection: 
        print("Database connection failed during map creation.")
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        cursor = connection.cursor()
        default_data = {
            "nodes": [{"id": "root", "text": "New Central Idea", "x": -60, "y": -24, "width": 220, "height": 80, "isRoot": True}], 
            "edges": []
        }
        # Explicitly set key_name to NULL to avoid issues with unique constraints on some MySQL configs
        sql = "INSERT INTO mind_maps (key_name, title, description, map_data) VALUES (NULL, %s, %s, %s)"
        cursor.execute(sql, ("New Mind Map", "Created from dashboard", json.dumps(default_data)))
        connection.commit()
        new_id = cursor.lastrowid
        print(f"Successfully created new mind map with ID: {new_id}")
        return {"id": new_id}
    except Error as e:
        print(f"Error during map creation: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally: 
        connection.close()

@app.get("/api/maps/{map_id}")
async def get_map_detail(map_id: int):
    connection = get_db_connection()
    if not connection: raise HTTPException(status_code=500)
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT * FROM mind_maps WHERE id = %s", (map_id,))
        result = cursor.fetchone()
        if not result: raise HTTPException(status_code=404)
        result['map_data'] = json.loads(result['map_data'])
        return result
    finally: connection.close()

@app.put("/api/maps/{map_id}")
async def update_map(map_id: int, payload: dict):
    connection = get_db_connection()
    if not connection: raise HTTPException(status_code=500)
    try:
        cursor = connection.cursor()
        sql = "UPDATE mind_maps SET title = %s, description = %s, map_data = %s WHERE id = %s"
        cursor.execute(sql, (
            payload.get('title', 'Untitled'),
            payload.get('description', ''),
            json.dumps(payload.get('map_data', {}), ensure_ascii=False),
            map_id
        ))
        connection.commit()
        return {"status": "success"}
    finally: connection.close()

@app.delete("/api/maps/{map_id}")
async def delete_map(map_id: int):
    connection = get_db_connection()
    if not connection: raise HTTPException(status_code=500)
    try:
        cursor = connection.cursor()
        cursor.execute("DELETE FROM mind_maps WHERE id = %s", (map_id,))
        connection.commit()
        return {"status": "success"}
    finally: connection.close()

# --- User Settings Management ---

@app.get("/api/settings/{key}")
async def get_setting(key: str):
    connection = get_db_connection()
    if not connection: raise HTTPException(status_code=500)
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT setting_value FROM user_settings WHERE setting_key = %s", (key,))
        result = cursor.fetchone()
        return result if result else {"setting_value": None}
    finally: connection.close()

@app.post("/api/settings")
async def save_setting(payload: dict):
    connection = get_db_connection()
    if not connection: raise HTTPException(status_code=500)
    try:
        cursor = connection.cursor()
        sql = """
            INSERT INTO user_settings (setting_key, setting_value) 
            VALUES (%s, %s) 
            ON DUPLICATE KEY UPDATE setting_value = %s
        """
        key = payload.get('key')
        val = payload.get('value')
        cursor.execute(sql, (key, val, val))
        connection.commit()
        return {"status": "success"}
    finally: connection.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
