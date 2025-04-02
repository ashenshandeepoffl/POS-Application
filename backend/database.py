# Backend/database.py
import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()  # Loads variables from a .env file if you choose to use one

DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://root:4989@localhost/pos_db2")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
