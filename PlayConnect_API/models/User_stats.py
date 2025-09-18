from sqlalchemy import Column, Integer, BigInteger, Numeric
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class UserStat(Base):
    __tablename__ = "User_stats"
    __table_args__ = {"schema": "public"}

    user_id = Column(BigInteger, primary_key=True)
    games_played = Column(Integer, nullable=True)
    games_hosted = Column(Integer, nullable=True)
    attendance_rate = Column(Numeric, nullable=True)
    sport_id = Column(BigInteger, primary_key=True)
