from sqlalchemy import Column, Integer, String, Boolean, DateTime, BigInteger, Text, Numeric
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP
from datetime import datetime

Base = declarative_base()

class Coach(Base):
    __tablename__ = "Coaches"
    __table_args__ = {"schema": "public"}

    coach_id = Column(BigInteger, primary_key=True, autoincrement=True)
    experience_yrs = Column(Integer, nullable=True)
    certifications = Column(Text, nullable=True)
    isverified = Column(Boolean, default=False)
    hourly_rate = Column(Numeric, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
