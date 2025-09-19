from sqlalchemy import Column, Integer, String, Text, Numeric, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP

Base = declarative_base()

class GameInstance(Base):
    __tablename__ = "game_instance"
    __table_args__ = {"schema": "public"}

    game_id = Column(Integer, primary_key=True, autoincrement=True)

    host_id = Column(
        Integer,
        ForeignKey("users.user_id", onupdate="CASCADE", ondelete="RESTRICT"),
        nullable=False
    )

    sport_id = Column(
        Integer,
        ForeignKey("sports.sport_id", onupdate="CASCADE", ondelete="RESTRICT"),
        nullable=False
    )

    start_time = Column(TIMESTAMP(timezone=True), nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    location = Column(Text, nullable=False)
    skill_level = Column(String, nullable=False)
    max_players = Column(Integer, nullable=False)

    cost = Column(Numeric, nullable=False, default=0)
    status = Column(String, nullable=False, default="Open")
    notes = Column(Text, nullable=True)

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )
