from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = 'Users'
    __table_args__ = {'schema': 'public'}

    user_id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String, unique=True, nullable=False)
    password = Column(String, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    age = Column(Integer, nullable=False)
    avatar_url = Column(String, nullable=True)
    bio = Column(String, nullable=True)
    favorite_sport = Column(String, nullable=True)
    isverified = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    num_of_strikes = Column(Integer, default=0)
    role = Column(String, nullable=False)
