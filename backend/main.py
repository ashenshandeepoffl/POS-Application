from fastapi import FastAPI
import mysql.connector
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Get DB credentials from .env
DB_HOST = os.getenv("DB_HOST")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_NAME = os.getenv("DB_NAME")

app = FastAPI()

# Connect to MySQL without specifying a database initially
db = mysql.connector.connect(
    host=DB_HOST,
    user=DB_USER,
    password=DB_PASSWORD
)
cursor = db.cursor()

# Create Database if it doesn't exist
cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_NAME};")
db.commit()

# Connect to the newly created database
db.database = DB_NAME

# API Endpoint for Testing
@app.get("/")
def home():
    return {"message": "Backend is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
