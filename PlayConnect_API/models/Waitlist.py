from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP
from datetime import datetime

Base = declarative_base()

class Waitlist(Base):
    __tablename__ = 'Waitlist'
    __table_args__ = {'schema': 'public'}

    game_id = Column(Integer, primary_key=True)
    user_id = Column(Integer, primary_key=True)
    joined_at = Column(TIMESTAMP, default=datetime.utcnow)
    admitted = Column(Boolean, default=False)

    


    
