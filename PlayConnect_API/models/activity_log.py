from sqlalchemy import Column, BigInteger, Text, TIMESTAMP, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class ActivityLog(Base):
    __tablename__ = "activity_logs"
    __table_args__ = {"schema": "public"}

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("Users.user_id", ondelete="CASCADE"), nullable=False)
    action = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow)
