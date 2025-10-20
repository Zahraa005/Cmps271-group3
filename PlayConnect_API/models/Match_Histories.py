from sqlalchemy import Column, Integer, String, ForeignKey, TIMESTAMP
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class MatchHistory(Base):
    __tablename__ = "Match_Histories"
    __table_args__ = {"schema": "public"}

    match_id = Column(Integer, primary_key=True, autoincrement=True)
    player_id = Column(Integer, ForeignKey("Users.user_id", ondelete="CASCADE"), nullable=False)
    opponent_id = Column(Integer, ForeignKey("Users.user_id", ondelete="CASCADE"), nullable=False)

    score_player = Column(Integer, nullable=True)
    score_opponent = Column(Integer, nullable=True)
    result = Column(String, nullable=True)  # e.g., "win", "loss", "draw"
    duration_minutes = Column(Integer, nullable=False)
    played_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow)
