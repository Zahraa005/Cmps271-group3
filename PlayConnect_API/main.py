from typing import Union, List
import asyncpg
from fastapi import FastAPI, Depends, HTTPException

from PlayConnect_API.schemas.Users import UserRead, UserCreate
from PlayConnect_API.Database import connect_to_db, disconnect_db
from PlayConnect_API import Database
from PlayConnect_API.schemas.Registration import Registration

from PlayConnect_API.schemas.Coaches import CoachRead, CoachCreate 
from PlayConnect_API.schemas.User_stats import UserStatCreate, UserStatRead
from PlayConnect_API.schemas.Game_Instance import GameInstanceCreate, GameInstanceResponse

from datetime import datetime, timezone


app = FastAPI()

@app.post("/register")
async def register_user(reg: Registration):
    try:
        async with Database.pool.acquire() as connection:
            query = '''
                INSERT INTO public."Users" (first_name, last_name, email, password, age, created_at, isverified, role)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING user_id, first_name, last_name, email, age, created_at, isverified, role
            '''
            created_at = reg.created_at if reg.created_at else datetime.utcnow()
            isverified = False
            role = "player"
            row = await connection.fetchrow(
                query,
                reg.first_name,
                reg.last_name,
                reg.email,
                reg.password,
                reg.age,
                created_at,
                isverified,
                role
            )
            return dict(row) if row else None
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.on_event("startup")
async def startup():
    await connect_to_db()

@app.on_event("shutdown")
async def shutdown():
    await disconnect_db()

@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.get("/users", response_model=List[UserRead])
async def get_users():
    try:
        async with Database.pool.acquire() as connection:
            rows = await connection.fetch('SELECT * FROM public."Users"')
            users = [UserRead(**dict(row)) for row in rows]
            return users
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/users", response_model=UserRead)
async def create_user(user: UserCreate):
    try:
        async with Database.pool.acquire() as connection:
            query = '''
                INSERT INTO public."Users" (email, password, first_name, last_name, age, avatar_url, bio, favorite_sport, isverified, role)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING user_id, email, first_name, last_name, age, avatar_url, bio, favorite_sport, isverified, num_of_strikes, created_at, role
            '''
            row = await connection.fetchrow(
                query,
                user.email,
                user.password,
                user.first_name,
                user.last_name,         #made this to test my Users model, this shouldn't be used for registration and login n stuff 
                user.age,                           
                user.avatar_url,
                user.bio,
                user.favorite_sport,
                user.isverified,
                user.role
            )
            return UserRead(**dict(row))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
#coaches endpoints
@app.get("/coaches", response_model=List[CoachRead])
async def get_coaches():
    try:
        async with Database.pool.acquire() as connection:
            rows = await connection.fetch('SELECT * FROM public."Coaches"')
            coaches = [CoachRead(**dict(row)) for row in rows]
            return coaches
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/coaches", response_model=CoachRead)
async def create_coach(coach: CoachCreate):
    try:
        async with Database.pool.acquire() as connection:
            query = '''
                INSERT INTO public."Coaches" (experience_yrs, certifications, isverified, hourly_rate)
                VALUES ($1, $2, $3, $4)
                RETURNING coach_id, experience_yrs, certifications, isverified, hourly_rate, created_at
            '''
            row = await connection.fetchrow(
                query,
                coach.experience_yrs,
                coach.certifications,
                coach.isverified,
                coach.hourly_rate
            )
            return CoachRead(**dict(row))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
#USER_STATS endpoints
@app.get("/user_stats", response_model=List[UserStatRead])
async def get_user_stats():
    try:
        async with Database.pool.acquire() as connection:
            rows = await connection.fetch('SELECT * FROM public."User_stats"')
            stats = [UserStatRead(**dict(row)) for row in rows]
            return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/user_stats", response_model=UserStatRead)
async def create_user_stat(stat: UserStatCreate):
    try:
        async with Database.pool.acquire() as connection:
            query = '''
                INSERT INTO public."User_stats" (user_id, games_played, games_hosted, attendance_rate, sport_id)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING user_id, games_played, games_hosted, attendance_rate, sport_id
            '''
            row = await connection.fetchrow(
                query,
                stat.user_id,
                stat.games_played,
                stat.games_hosted,
                stat.attendance_rate,
                stat.sport_id
            )
            return UserStatRead(**dict(row))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/game-instances", response_model=GameInstanceResponse)
async def create_game_instance(game: GameInstanceCreate):
    try:
        async with Database.pool.acquire() as connection:
            query = '''
                INSERT INTO public."Game_instance" (
                    host_id, sport_id, start_time, duration_minutes,
                    location, skill_level, max_players, cost, status, notes
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            '''
            # Handle timezone conversion properly
            start_time = game.start_time
            if start_time.tzinfo is not None:
                # If timezone-aware, convert to UTC and make it timezone-naive
                start_time = start_time.astimezone(timezone.utc).replace(tzinfo=None)
            else:
                # If timezone-naive, assume it's already UTC
                pass
            
            row = await connection.fetchrow(
                query,
                game.host_id,
                game.sport_id,
                start_time,
                game.duration_minutes,
                game.location,
                game.skill_level,
                game.max_players,
                game.cost,
                game.status,
                game.notes
            )
            return GameInstanceResponse(**dict(row))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/game-instances", response_model=List[GameInstanceResponse])
async def get_game_instances():
    try:
        async with Database.pool.acquire() as connection:
            query = 'SELECT * FROM public."Game_instance" ORDER BY created_at DESC'
            rows = await connection.fetch(query)
            return [GameInstanceResponse(**dict(row)) for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/game-instances/{game_id}", response_model=GameInstanceResponse)
async def get_game_instance(game_id: int):
    try:
        async with Database.pool.acquire() as connection:
            query = 'SELECT * FROM public."Game_instance" WHERE game_id = $1'
            row = await connection.fetchrow(query, game_id)
            if row is None:
                raise HTTPException(status_code=404, detail="Game instance not found")
            return GameInstanceResponse(**dict(row))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
