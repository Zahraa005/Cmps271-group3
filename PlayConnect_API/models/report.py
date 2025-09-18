from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP
from datetime import datetime

Base = declarative_base()

class Report(Base):
    __tablename__ = "reports"
    __table_args__ = {'schema': 'public'}

    report_id = Column(Integer, primary_key=True, autoincrement=True)
    reporter_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    reported_user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    report_game_id = Column(Integer, ForeignKey("game_instance.game_id"), nullable=False)
    reason = Column(Text, nullable=False)  # safer to force reason
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
