from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP
from datetime import datetime

Base = declarative_base()

class Friends(Base):
    __tablename__ = 'Friends'
    __table_args__ = {'schema': 'public'}

    user_id = Column(Integer, primary_key=True)
    friend_id = Column(Integer, primary_key=True)
    status = Column(String)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)


    
