from sqlalchemy import Column , Integer, DateTime , Enum , ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from datetime import datetime
import enum

Base = declarative_base()

class RoleEnum(str, enum.Enum):
   PLAYER = "PLAYER"
   HOST = "HOST"


class GameParticipant(Base):
   __tablename__ = 'Game_participants'

game_id = Column(Integer, ForeignKey("Game_instance.game_id", ondelete="CASCADE"), primary_key=True)
user_id = Column(Integer, ForeignKey("Users.user_id", ondelete="CASCADE"), primary_key=True)
role = Column(Enum(RoleEnum, name="role_enum", create_type=False), nullable=False, default=RoleEnum.PLAYER)
joined_at = Column(DateTime(timezone=True), server_default=func.now())