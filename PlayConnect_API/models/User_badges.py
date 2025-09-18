from sqlalchemy import Column, Integer, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()

class UserBadge(Base):
    __tablename__ = "User_badges"   

    user_id = Column(Integer, ForeignKey("Users.user_id", ondelete="CASCADE"), primary_key=True)
    badge_id = Column(Integer, ForeignKey("Badges.badge_id", ondelete="CASCADE"), primary_key=True)

    awarded_at = Column(DateTime(timezone=True), server_default=func.now())
