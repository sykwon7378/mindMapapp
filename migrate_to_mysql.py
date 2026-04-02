import os
import json
import mysql.connector
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def run_migration():
    print("Starting migration process...")
    try:
        # 1. Connect to MySQL (without database first to ensure it exists)
        conn = mysql.connector.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            charset=os.getenv("DB_CHARSET", "utf8mb4")
        )
        cursor = conn.cursor()
        
        # 2. Create database if not exists
        db_name = os.getenv("DB_NAME")
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {db_name}")
        cursor.execute(f"USE {db_name}")
        print(f"Database '{db_name}' ready.")

        # 3. Create table if not exists
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS mind_maps (
                id INT AUTO_INCREMENT PRIMARY KEY,
                key_name VARCHAR(50) UNIQUE DEFAULT 'default_map',
                map_data LONGTEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)
        conn.commit()
        print("Table 'mind_maps' ready.")

        # 4. Check for existing data in DB
        cursor.execute("SELECT COUNT(*) FROM mind_maps WHERE key_name = 'default_map'")
        count = cursor.fetchone()[0]

        # 5. Migrate from map.json if DB is empty
        if count == 0:
            json_path = "data/map.json"
            if os.path.exists(json_path):
                with open(json_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    map_json = json.dumps(data, ensure_ascii=False)
                    cursor.execute(
                        "INSERT INTO mind_maps (key_name, map_data) VALUES ('default_map', %s)", 
                        (map_json,)
                    )
                    conn.commit()
                    print(f"Successfully migrated data from '{json_path}' to MySQL.")
            else:
                # Insert default starter map if no file exists
                default_data = {
                    "nodes": [{"id": "root", "text": "Central Idea", "x": -60, "y": -24, "isRoot": True}],
                    "edges": []
                }
                cursor.execute(
                    "INSERT INTO mind_maps (key_name, map_data) VALUES ('default_map', %s)", 
                    (json.dumps(default_data),)
                )
                conn.commit()
                print("No JSON file found. Created default Central Idea node in MySQL.")
        else:
            print("Database already contains data. Skipping migration.")

        cursor.close()
        conn.close()
        print("Migration process completed successfully!")

    except Exception as e:
        print(f"Error during migration: {e}")

if __name__ == "__main__":
    run_migration()
