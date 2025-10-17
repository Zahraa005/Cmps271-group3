from sqlalchemy import Column, Integer, String, Boolean, TIMESTAMP
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class Notification(Base):
    __tablename__ = "Notifications"
    __table_args__ = {"schema": "public"}

    notification_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    message = Column(String, nullable=False, default="")
    type = Column(String, nullable=False, default="")
    is_read = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
