from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base 
from sqlalchemy.squl import func
from sqlalchemy.types import TIMESTAMP
from datetime import datetime

Base = declarative_base()

class Sport(Base):
    __tablename__= "sports"
    __table_args__ = {'schema': 'public'}
    
    sport_id = Column (Integer,primary_key= True, autoincrement=True)
    name = Column (Text, Unique = True, nullable = False)
    description = Column (Text, nullable = True)
    min_players = Column (Integer, default = 1, nullable = False)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
