from typing import Union, List
import asyncpg
from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from PlayConnect_API.schemas.Users import UserRead, UserCreate
from PlayConnect_API.Database import connect_to_db, disconnect_db
from PlayConnect_API import Database
from PlayConnect_API.schemas.registration import RegisterRequest


from PlayConnect_API.schemas.Coaches import CoachRead, CoachCreate 
from PlayConnect_API.schemas.User_stats import UserStatCreate, UserStatRead
from PlayConnect_API.schemas.Game_Instance import GameInstanceCreate, GameInstanceResponse
from PlayConnect_API.schemas.ForgotPasswordRequest import ForgotPasswordRequestCreate

from datetime import datetime, timezone, timedelta
import os, secrets, hashlib
import smtplib, ssl, asyncio
import certifi
from email.message import EmailMessage



app = FastAPI()

# function to send reset email
async def send_reset_email(to_email: str, reset_url: str):
    
    subject = "PlayConnect Password Reset"
    body_text = f"Click here to reset your password: {reset_url}\nIf you did not request this, ignore this email."

    msg = EmailMessage()
    msg["From"] = os.getenv("MAIL_FROM", "no-reply@playconnect.com")
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body_text)

    host = os.getenv("SMTP_HOST")
    user = os.getenv("SMTP_USERNAME")
    pwd  = os.getenv("SMTP_PASSWORD")

    env = os.getenv("ENV", "dev").lower()

    def _send():
        context = ssl.create_default_context(cafile=certifi.where())
        port = int(os.getenv("SMTP_PORT", "587"))

        if env != "production":
            mode = "SSL" if port == 465 else ("STARTTLS" if port == 587 else "PLAIN")
            print(f"[DEV ONLY] SMTP -> host:{host} port:{port} mode:{mode}")

        if port == 465:
            with smtplib.SMTP_SSL(host, port, context=context, timeout=10) as s:
                if user and pwd:
                    s.login(user, pwd)
                s.send_message(msg)
        elif port == 587:
            with smtplib.SMTP(host, port, timeout=10) as s:
                s.starttls(context=context)
                if user and pwd:
                    s.login(user, pwd)
                s.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=10) as s:
                if user and pwd:
                    s.login(user, pwd)
                s.send_message(msg)

   
    return await asyncio.to_thread(_send)


# this function hashes tokens
def _sha256_hex(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

async def ensure_password_reset_table():
    
    async with Database.pool.acquire() as connection:
        await connection.execute(
            '''
            CREATE TABLE IF NOT EXISTS public."Password_reset_tokens" (
                id BIGSERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES public."Users"(user_id) ON DELETE CASCADE,
                token_hash TEXT NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL,
                used_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_pwdreset_user_expires ON public."Password_reset_tokens" (user_id, expires_at);
            '''
        )

@app.post("/register")
async def register_user(reg: RegisterRequest):
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



@app.post("/forgot-password", status_code=202)
async def forgot_password(payload: ForgotPasswordRequestCreate):
   
    ttl_minutes = int(os.getenv("RESET_TOKEN_TTL_MINUTES", "30"))
    app_url = os.getenv("APP_URL", "http://localhost:5173")

    try:
        async with Database.pool.acquire() as connection:
            user = await connection.fetchrow(
                'SELECT user_id, email FROM public."Users" WHERE LOWER(email) = LOWER($1) LIMIT 1',
                payload.email,
            )

            if user:
                raw_token = secrets.token_urlsafe(32)
                token_hash = _sha256_hex(raw_token)
                expires_at = datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)

                await connection.execute(
                    'INSERT INTO public."Password_reset_tokens" (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
                    user["user_id"],
                    token_hash,
                    expires_at,
                )

                reset_url = f"{app_url}/reset-password?token={raw_token}"
                try:
                    await send_reset_email(user["email"], reset_url)
                    if os.getenv("ENV", "dev").lower() != "production":
                        print(f"[DEV ONLY] Email sent to {user['email']}")
                except Exception as send_err:
                    #added logs to find problem its been 3 hours :PPPP
                    print(f"[DEV ONLY] Email send failed: {repr(send_err)}")
                if os.getenv("ENV", "dev").lower() != "production":
                    print(f"[DEV ONLY] Password reset link for {user['email']}: {reset_url}")

        return {"message": "If an account exists for that email, you will receive a reset link shortly."}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.on_event("startup")
async def startup():
    await connect_to_db()
    await ensure_password_reset_table()

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
