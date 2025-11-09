from sqlalchemy import Column, BigInteger, Text, Boolean, TIMESTAMP, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class UserBadge(Base):
    __tablename__ = "user_badges"
    __table_args__ = {"schema": "public"}

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("Users.user_id", ondelete="CASCADE"), nullable=False)
    badge_name = Column(Text, nullable=False)
    earned_on = Column(TIMESTAMP, nullable=False, default=datetime.utcnow)
    seen = Column(Boolean, nullable=False, default=False)
