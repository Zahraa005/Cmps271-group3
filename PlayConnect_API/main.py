from typing import Union, List
import asyncpg
from fastapi import FastAPI, Depends, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from dotenv import load_dotenv

from PlayConnect_API.schemas.Users import UserRead, UserCreate
from PlayConnect_API.Database import connect_to_db, disconnect_db
from PlayConnect_API import Database
from PlayConnect_API.schemas.registration import RegisterRequest


from PlayConnect_API.schemas.Coaches import CoachRead, CoachCreate 
from PlayConnect_API.schemas.User_stats import UserStatCreate, UserStatRead
from PlayConnect_API.schemas.Game_Instance import GameInstanceCreate, GameInstanceResponse
from PlayConnect_API.schemas.ForgotPasswordRequest import ForgotPasswordRequestCreate, ForgotPasswordRequestOut, ResetPasswordIn, ResetPasswordOut
from PlayConnect_API.schemas.Login import LoginRequest, TokenResponse
from PlayConnect_API.schemas.sport import SportRead, SportCreate
from PlayConnect_API.schemas.Profile import ProfileCreate, ProfileRead
from PlayConnect_API.schemas.Game_participants import GameParticipantJoin, GameParticipantLeave
from PlayConnect_API.schemas.Waitlist import WaitlistRead  
from PlayConnect_API.schemas.report import ReportCreate, ReportRead, ReportUpdate
from PlayConnect_API.schemas.Notifications import NotificationCreate, NotificationRead
from PlayConnect_API.schemas.Friends import FriendCreate, FriendRead
from PlayConnect_API.schemas.Match_Histories import MatchHistoryCreate, MatchHistoryRead

from PlayConnect_API.services.mailer import render_template, send_email
from PlayConnect_API.security_utils import gen_reset_token, hash_token, hash_password

from datetime import datetime, timezone, timedelta
import os, secrets, hashlib
import jwt



app = FastAPI()

load_dotenv(dotenv_path=".env")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],  
    allow_credentials=True,
    allow_methods=["*"],  
    allow_headers=["*"],  
)



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


@app.get("/game-participants")
async def get_game_participants(game_id: Union[int, None] = None, user_id: Union[int, None] = None):
    """
    List game participants with optional filters by game_id and/or user_id.
    """
    try:
        async with Database.pool.acquire() as connection:
            query = 'SELECT game_id, user_id, role, joined_at FROM public."Game_participants"'
            conditions = []
            params = []

            if game_id is not None:
                conditions.append(f"game_id = ${len(params) + 1}")
                params.append(game_id)

            if user_id is not None:
                conditions.append(f"user_id = ${len(params) + 1}")
                params.append(user_id)

            if conditions:
                query += " WHERE " + " AND ".join(conditions)

            query += " ORDER BY joined_at ASC"

            rows = await connection.fetch(query, *params)
            return [dict(row) for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/game-participants/join", status_code=201)
async def join_game_participant(payload: GameParticipantJoin):
    """
    Add a participant to a game (idempotent on game_id, user_id).
    """
    try:
        async with Database.pool.acquire() as connection:
            # Ensure game exists
            game = await connection.fetchrow(
                'SELECT game_id FROM public."Game_instance" WHERE game_id = $1 LIMIT 1',
                payload.game_id,
            )
            if not game:
                raise HTTPException(status_code=404, detail="Game not found")

            # Ensure user exists
            user = await connection.fetchrow(
                'SELECT user_id FROM public."Users" WHERE user_id = $1 LIMIT 1',
                payload.user_id,
            )
            if not user:
                raise HTTPException(status_code=404, detail="User not found")

            result = await connection.execute(
                '''
                INSERT INTO public."Game_participants" (game_id, user_id, role, joined_at)
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (game_id, user_id) DO NOTHING
                ''',
                payload.game_id,
                payload.user_id,
                payload.role,
            )
            inserted = result and result.startswith("INSERT")
            return {
                "message": "Joined game" if inserted else "Already participating",
                "game_id": payload.game_id,
                "user_id": payload.user_id,
                "role": payload.role,
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/game-participants/leave", status_code=200)
async def leave_game_participant(payload: GameParticipantLeave):
    """
    Remove a participant from a game.
    """
    try:
        async with Database.pool.acquire() as connection:
            result = await connection.execute(
                'DELETE FROM public."Game_participants" WHERE game_id = $1 AND user_id = $2',
                payload.game_id,
                payload.user_id,
            )
            deleted = result.split(" ")[-1]
            if deleted == "0":
                raise HTTPException(status_code=404, detail="Participant not found for game")
            return {
                "message": "Left game",
                "game_id": payload.game_id,
                "user_id": payload.user_id,
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/forgot-password", status_code=202)
async def forgot_password(payload: ForgotPasswordRequestCreate):
    ttl_minutes = int(os.getenv("RESET_TOKEN_TTL_MINUTES", "30"))
    app_url = os.getenv("APP_URL") or os.getenv("FRONTEND_URL", "http://localhost:5173")
    preview_html = None
    reset_url = None

    try:
        async with Database.pool.acquire() as connection:
            user = await connection.fetchrow(
                'SELECT user_id, email, first_name FROM public."Users" WHERE LOWER(email) = LOWER($1) LIMIT 1',
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
                # Render HTML template and send via central mailer
                first_name = user.get("first_name") or user.get("email", "").split("@")[0]
                html = render_template(
                    "PlayConnect_API/templates/emails/reset_password.html",
                    {"first_name": first_name, "reset_url": reset_url}
                )
                try:
                    await send_email(user["email"], "Reset Your Password", html)
                    if os.getenv("ENV", "dev").lower() != "production":
                        print(f"[DEV ONLY] Email sent to {user['email']}")
                except Exception as send_err:
                    print(f"[DEV ONLY] Email send failed: {repr(send_err)}")
                if os.getenv("ENV", "dev").lower() != "production":
                    print(f"[DEV ONLY] Password reset link for {user['email']}: {reset_url}")
                preview_html = html

        dev_mode = os.getenv("ENV", "dev").lower() != "production"
        if dev_mode and reset_url and preview_html:
            return {
                "message": "If an account exists for that email, you will receive a reset link shortly.",
                "reset_url": reset_url,
                "preview_html": preview_html,
            }
        return {"message": "If an account exists for that email, you will receive a reset link shortly."}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Development-only endpoint to preview reset email HTML
@app.get("/dev/preview/reset-email")
async def preview_reset_email(email: str = "test@example.com", token: str = "demo-token"):
    # Only serve in non-production environments
    if os.getenv("ENV", "dev").lower() == "production":
        raise HTTPException(status_code=404, detail="Not available")
    html = render_template(
        "PlayConnect_API/templates/emails/reset_password.html",
        {
            "first_name": email.split("@")[0],
            "reset_url": f"{os.getenv('FRONTEND_URL', 'http://localhost:5173')}/reset-password?token={token}",
        },
    )
    return Response(content=html, media_type="text/html")

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


@app.post("/profile-creation", response_model=UserRead, status_code=200)
async def create_profile(profile: ProfileCreate, user_id: int):
    try:
        async with Database.pool.acquire() as connection:
            # Ensure user exists
            existing = await connection.fetchrow(
                'SELECT user_id FROM public."Users" WHERE user_id = $1 LIMIT 1',
                user_id
            )
            if not existing:
                raise HTTPException(status_code=404, detail="User not found")

            # Update user profile fields in Users table
            row = await connection.fetchrow(
                '''
                UPDATE public."Users"
                SET first_name = $1,
                    last_name = $2,
                    age = $3,
                    favorite_sport = $4,
                    bio = $5,
                    avatar_url = $6,
                    role = $7
                WHERE user_id = $8
                RETURNING user_id, email, first_name, last_name, age, avatar_url, bio, favorite_sport, isverified, num_of_strikes, created_at, role
                ''',
                profile.first_name,
                profile.last_name,
                profile.age,
                profile.favorite_sport,
                profile.bio,
                profile.avatar_url,
                profile.role,
                user_id,
            )
            return UserRead(**dict(row))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/profile/{user_id}", response_model=ProfileRead)
async def get_profile(user_id: int):
    """Get user profile by user_id"""
    try:
        async with Database.pool.acquire() as connection:
            row = await connection.fetchrow(
                '''
                SELECT user_id, first_name, last_name, age, favorite_sport, bio, avatar_url, role
                FROM public."Users"
                WHERE user_id = $1
                ''',
                user_id
            )
            if not row:
                raise HTTPException(status_code=404, detail="Profile not found")
            return ProfileRead(**dict(row))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/profile/{user_id}", response_model=ProfileRead)
async def update_profile(user_id: int, profile: ProfileCreate):
    """Update user profile by user_id"""
    try:
        async with Database.pool.acquire() as connection:
            # Check if user exists
            existing = await connection.fetchrow(
                'SELECT user_id FROM public."Users" WHERE user_id = $1 LIMIT 1',
                user_id
            )
            if not existing:
                raise HTTPException(status_code=404, detail="User not found")

            # Update user profile fields
            row = await connection.fetchrow(
                '''
                UPDATE public."Users"
                SET first_name = $1,
                    last_name = $2,
                    age = $3,
                    favorite_sport = $4,
                    bio = $5,
                    avatar_url = $6,
                    role = $7
                WHERE user_id = $8
                RETURNING user_id, first_name, last_name, age, favorite_sport, bio, avatar_url, role
                ''',
                profile.first_name,
                profile.last_name,
                profile.age,
                profile.favorite_sport,
                profile.bio,
                profile.avatar_url,
                profile.role,
                user_id,
            )
            return ProfileRead(**dict(row))
    except HTTPException:
        raise
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

@app.put("/game-instances/{game_id}", response_model=GameInstanceResponse)
async def update_game_instance(game_id: int, game: GameInstanceCreate):
    try:
        async with Database.pool.acquire() as connection:
            query = '''
                UPDATE public."Game_instance"
                SET host_id = $1,
                    sport_id = $2,
                    start_time = $3,
                    duration_minutes = $4,
                    location = $5,
                    skill_level = $6,
                    max_players = $7,
                    cost = $8,
                    status = $9,
                    notes = $10,
                    updated_at = NOW()
                WHERE game_id = $11
                RETURNING *
            '''
            
            # Handle timezone conversion properly
            start_time = game.start_time
            if start_time.tzinfo is not None:
                start_time = start_time.astimezone(timezone.utc).replace(tzinfo=None)
            else:
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
                game.notes,
                game_id
            )
            
            if not row:
                raise HTTPException(status_code=404, detail="Game instance not found")
            
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

# -------------------------------
# Game participants (follow team style)
# -------------------------------
@app.get("/game-instances/{game_id}/participants")
async def api_get_game_participants(game_id: int):
    """
    Return participants for a given game instance.
    """
    try:
        async with Database.pool.acquire() as connection:
            rows = await connection.fetch(
                '''
                SELECT 
                    gp.participant_id,
                    gp.game_id,
                    gp.user_id,
                    gp.joined_at,
                    u.first_name,
                    u.last_name,
                    u.email
                FROM public."Game_participants" AS gp
                JOIN public."Users" AS u ON u.user_id = gp.user_id
                WHERE gp.game_id = $1
                ORDER BY gp.joined_at ASC
                ''',
                game_id,
            )
            data = [dict(r) for r in rows]
            # normalize a handy display name
            for row in data:
                fn = row.get("first_name") or ""
                ln = row.get("last_name") or ""
                row["name"] = (fn + " " + ln).strip() or row.get("email")
            return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -------------------------------
# Waitlist scoped by game instance
# -------------------------------
class WaitlistUserBody(BaseModel):
    user_id: int

@app.get("/game-instances/{game_id}/waitlist")
async def api_get_game_waitlist(game_id: int):
    """
    Return waitlist entries for a single game instance, ordered by joined_at.
    """
    try:
        async with Database.pool.acquire() as connection:
            rows = await connection.fetch(
                '''
                SELECT game_id, user_id, joined_at, admitted
                FROM public."Waitlist"
                WHERE game_id = $1
                ORDER BY joined_at ASC
                ''',
                game_id,
            )
            return [dict(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/game-instances/{game_id}/waitlist", status_code=201)
async def api_join_game_waitlist(game_id: int, body: WaitlistUserBody):
    """
    Add a user to the waitlist for a game (idempotent).
    """
    try:
        async with Database.pool.acquire() as connection:
            # ensure game exists
            exists = await connection.fetchrow(
                'SELECT game_id FROM public."Game_instance" WHERE game_id = $1 LIMIT 1',
                game_id,
            )
            if not exists:
                raise HTTPException(status_code=404, detail="Game not found")

            result = await connection.execute(
                '''
                INSERT INTO public."Waitlist" (game_id, user_id, joined_at, admitted)
                VALUES ($1, $2, NOW(), FALSE)
                ON CONFLICT (game_id, user_id) DO NOTHING
                ''',
                game_id,
                body.user_id,
            )
            inserted = result and result.startswith("INSERT")
            return {
                "message": "Joined waitlist" if inserted else "Already on waitlist",
                "game_id": game_id,
                "user_id": body.user_id,
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/game-instances/{game_id}/waitlist/{user_id}", status_code=200)
async def api_leave_game_waitlist(game_id: int, user_id: int):
    """
    Remove user from a game's waitlist.
    """
    try:
        async with Database.pool.acquire() as connection:
            result = await connection.execute(
                'DELETE FROM public."Waitlist" WHERE game_id = $1 AND user_id = $2',
                game_id,
                user_id,
            )
            deleted = result.split(" ")[-1]
            if deleted == "0":
                raise HTTPException(status_code=404, detail="Waitlist entry not found")
            return {"message": "Left waitlist", "game_id": game_id, "user_id": user_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.post("/login", response_model=TokenResponse)
async def login(login_request: LoginRequest):
    try:
        async with Database.pool.acquire() as connection:
            # Query user by email
            query = '''
                SELECT user_id, email, password, role, first_name, last_name
                FROM public."Users"
                WHERE LOWER(email) = LOWER($1)
            '''
            user = await connection.fetchrow(query, login_request.email)
            
            if not user:
                raise HTTPException(status_code=401, detail="Invalid email or password")
            
           
            if user["password"] != login_request.password.get_secret_value():
                raise HTTPException(status_code=401, detail="Invalid email or password")
            
            # Generate JWT token
            secret_key = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
            token_expiry = datetime.utcnow() + timedelta(hours=4)  # 4 hour expiry
            
            token_payload = {
                "user_id": user["user_id"],
                "email": user["email"],
                "role": user["role"],                   #used JWT to track user login and to track who is creating games in the dashboard
                "exp": token_expiry
            }
            
            access_token = jwt.encode(token_payload, secret_key, algorithm="HS256")
            
            return TokenResponse(
                access_token=access_token,
                token_type="bearer",
                expires_in=14400,  # 4 hours in seconds
                user_id=user["user_id"],
                role=user["role"]
            )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Sports endpoints
@app.get("/sports", response_model=List[SportRead])
async def get_sports():
    try:
        async with Database.pool.acquire() as connection:
            rows = await connection.fetch('SELECT * FROM public."Sports" ORDER BY name')
            sports = [SportRead(**dict(row)) for row in rows]
            return sports
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Waitlist endpoints
class WaitlistJoinRequest(BaseModel):
    game_id: int
    user_id: int


class WaitlistEntryRead(BaseModel):
    game_id: int
    user_id: int
    joined_at: datetime
    admitted: bool


@app.post("/waitlist", status_code=201)
async def join_waitlist(payload: WaitlistJoinRequest):
    try:
        async with Database.pool.acquire() as connection:
            # Ensure game exists
            game = await connection.fetchrow(
                'SELECT game_id FROM public."Game_instance" WHERE game_id = $1 LIMIT 1',
                payload.game_id,
            )
            if not game:
                raise HTTPException(status_code=404, detail="Game not found")

            # Insert into waitlist; ignore if already present
            result = await connection.execute(
                'INSERT INTO public."Waitlist" (game_id, user_id, joined_at, admitted)\n'
                'VALUES ($1, $2, NOW(), FALSE)\n'
                'ON CONFLICT (game_id, user_id) DO NOTHING',
                payload.game_id,
                payload.user_id,
            )

            inserted = result and result.startswith("INSERT")
            return {
                "message": "Joined waitlist" if inserted else "Already on waitlist",
                "game_id": payload.game_id,
                "user_id": payload.user_id,
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/waitlist", response_model=List[WaitlistEntryRead])
async def get_waitlist(game_id: Union[int, None] = None, user_id: Union[int, None] = None):
    try:
        async with Database.pool.acquire() as connection:
            query = 'SELECT game_id, user_id, joined_at, admitted FROM public."Waitlist"'
            conditions = []
            params = []

            if game_id is not None:
                conditions.append(f"game_id = ${len(params) + 1}")
                params.append(game_id)

            if user_id is not None:
                conditions.append(f"user_id = ${len(params) + 1}")
                params.append(user_id)

            if conditions:
                query += " WHERE " + " AND ".join(conditions)

            query += " ORDER BY joined_at ASC"

            rows = await connection.fetch(query, *params)
            return [WaitlistEntryRead(**dict(row)) for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/waitlist", response_model=List[WaitlistRead])
async def get_waitlist():
    try:
        async with Database.pool.acquire() as connection:
            query = 'SELECT * FROM public."Waitlist" ORDER BY joined_at DESC'
            rows = await connection.fetch(query)
            return [WaitlistRead(**dict(row)) for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/waitlist", status_code=200)
async def leave_waitlist(game_id: int, user_id: int):
    try:
        async with Database.pool.acquire() as connection:
            result = await connection.execute(
                'DELETE FROM public."Waitlist" WHERE game_id = $1 AND user_id = $2',
                game_id,
                user_id,
            )

            # result is like "DELETE <count>" in asyncpg
            deleted = result.split(" ")[-1]
            if deleted == "0":
                raise HTTPException(status_code=404, detail="Waitlist entry not found")

            return {"message": "Left waitlist", "game_id": game_id, "user_id": user_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/waitlist/by-user", status_code=200)
async def remove_user_from_waitlist(user_id: int, game_id: Union[int, None] = None):
    try:
        async with Database.pool.acquire() as connection:
            if game_id is None:
                result = await connection.execute(
                    'DELETE FROM public."Waitlist" WHERE user_id = $1',
                    user_id,
                )
            else:
                result = await connection.execute(
                    'DELETE FROM public."Waitlist" WHERE user_id = $1 AND game_id = $2',
                    user_id,
                    game_id,
                )

            deleted_count_str = result.split(" ")[-1]
            deleted_count = int(deleted_count_str) if deleted_count_str.isdigit() else 0

            if deleted_count == 0:
                raise HTTPException(status_code=404, detail="No waitlist entries found for user")

            return {
                "message": "Removed from waitlist",
                "user_id": user_id,
                "game_id": game_id,
                "deleted": deleted_count,
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.delete("/game-instances/{game_id}", status_code=200)
async def delete_game_instance(game_id: int):
    try:
        async with Database.pool.acquire() as connection:
            # First check if the game exists
            existing = await connection.fetchrow(
                'SELECT game_id FROM public."Game_instance" WHERE game_id = $1',
                game_id
            )
            
            if not existing:
                raise HTTPException(status_code=404, detail="Game instance not found")
            
            # Delete the game instance
            await connection.execute(
                'DELETE FROM public."Game_instance" WHERE game_id = $1',
                game_id
            )
            
            return {
                "message": "Game instance deleted successfully",
                "game_id": game_id
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from typing import Optional

@app.get("/dashboard/games")
async def dashboard_games(
    sport_id: Optional[int] = None,
    status: Optional[str] = None,
    skill_level: Optional[str] = None,
    host_id: Optional[int] = None,
    search: Optional[str] = None,        # matches location or notes (ILIKE)
    from_: Optional[str] = None,         # ISO datetime string (e.g., 2025-10-06T18:00:00Z)
    to: Optional[str] = None,            # ISO datetime string
    spots: Optional[str] = None,         # "available" | "full"
    sort: Optional[str] = "start_time:asc",  # whitelist below
    page: int = 1,
    page_size: int = 10,
):
    """
    Filtered, paginated list of games for the dashboard.

    Query params:
      - sport_id, status, skill_level, host_id
      - from_ (start_time >=), to (start_time <=)
      - search (ILIKE over location + notes)
      - spots: "available" (players < max) or "full" (players >= max)
      - sort: "start_time:asc|desc" or "created_at:asc|desc"
      - page (1-based), page_size
    """
    try:
        # --- sanitize paging ---
        page = max(1, page)
        page_size = max(1, min(page_size, 100))
        offset = (page - 1) * page_size

        # --- whitelist sorting ---
        allowed_sort = {
            "start_time:asc":  'gi.start_time ASC',
            "start_time:desc": 'gi.start_time DESC',
            "created_at:asc":  'gi.created_at ASC',
            "created_at:desc": 'gi.created_at DESC',
        }
        order_by_sql = allowed_sort.get(sort or "", 'gi.start_time ASC')

        # --- base SELECT w/ participant count and spots_left ---
        # count players via LEFT JOIN subquery; adjust if you want to exclude HOST
        base_select = '''
            SELECT
                gi.*,
                COALESCE(gpc.cnt, 0) AS participants_count,
                (gi.max_players - COALESCE(gpc.cnt, 0)) AS spots_left
            FROM public."Game_instance" AS gi
            LEFT JOIN (
                SELECT gp.game_id, COUNT(*) AS cnt
                FROM public."Game_participants" AS gp
                GROUP BY gp.game_id
            ) AS gpc ON gpc.game_id = gi.game_id
        '''

        # --- dynamic WHERE ---
        conditions = []
        params = []

        if sport_id is not None:
            conditions.append(f"gi.sport_id = ${len(params) + 1}")
            params.append(sport_id)

        if status:
            conditions.append(f"gi.status = ${len(params) + 1}")
            params.append(status)

        if skill_level:
            conditions.append(f"gi.skill_level = ${len(params) + 1}")
            params.append(skill_level)

        if host_id is not None:
            conditions.append(f"gi.host_id = ${len(params) + 1}")
            params.append(host_id)

        if from_:
            # Expect ISO string; Postgres will parse to timestamptz if needed
            conditions.append(f"gi.start_time >= ${len(params) + 1}")
            params.append(from_)

        if to:
            conditions.append(f"gi.start_time <= ${len(params) + 1}")
            params.append(to)

        if search:
            conditions.append(
                f"(gi.location ILIKE ${len(params) + 1} OR gi.notes ILIKE ${len(params) + 1})"
            )
            params.append(f"%{search}%")

        if spots:
            if spots.lower() == "available":
                conditions.append(f"(COALESCE(gpc.cnt, 0) < gi.max_players)")
            elif spots.lower() == "full":
                conditions.append(f"(COALESCE(gpc.cnt, 0) >= gi.max_players)")
            # else ignore invalid values

        where_sql = ""
        if conditions:
            where_sql = " WHERE " + " AND ".join(conditions)

        # --- final queries: count + page ---
        count_sql = f'''
            SELECT COUNT(*)::INT AS total
            FROM (
                {base_select}
                {where_sql}
            ) AS q
        '''

        page_sql = f'''
            {base_select}
            {where_sql}
            ORDER BY {order_by_sql}
            LIMIT {page_size} OFFSET {offset}
        '''

        async with Database.pool.acquire() as connection:
            # total count
            total_row = await connection.fetchrow(count_sql, *params)
            total = int(total_row["total"]) if total_row else 0

            # page items
            rows = await connection.fetch(page_sql, *params)
            items = [dict(r) for r in rows]

            # optional: normalize/ensure serializable types (e.g., Decimal)
            for it in items:
                # Convert Decimal cost -> float for JSON friendliness (optional)
                if "cost" in it and it["cost"] is not None:
                    try:
                        it["cost"] = float(it["cost"])
                    except Exception:
                        pass

            has_next = (offset + len(items)) < total

            return {
                "items": items,
                "page": page,
                "page_size": page_size,
                "total": total,
                "has_next": has_next,
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.post("/report", response_model=ReportRead, status_code=201)
async def create_report(report: ReportCreate):
    """
    Create a new report entry (SCRUM-103)
    """
    try:
        async with Database.pool.acquire() as connection:
            query = '''
                INSERT INTO public."Reports" (reporter_id, reported_user_id, report_game_id, reason, created_at)
                VALUES ($1, $2, $3, $4, NOW())
                RETURNING report_id, reporter_id, reported_user_id, report_game_id, reason, created_at
            '''
            row = await connection.fetchrow(
                query,
                report.reporter_id,
                report.reported_user_id,
                report.report_game_id,
                report.reason
            )
            if not row:
                raise HTTPException(status_code=500, detail="Failed to create report")
            return ReportRead(**dict(row))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/reports", response_model=List[ReportRead])
async def get_reports():
    """
    Retrieve all report entries (SCRUM-104)
    """
    try:
        async with Database.pool.acquire() as connection:
            query = '''
                SELECT report_id, reporter_id, reported_user_id, report_game_id, reason, created_at
                FROM public."Reports"
                ORDER BY created_at DESC
            '''
            rows = await connection.fetch(query)
            reports = [ReportRead(**dict(row)) for row in rows]
            return reports
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/reports/{report_id}", response_model=ReportRead)
async def get_report_by_id(report_id: int):
    """
    Retrieve a specific report entry by ID
    """
    try:
        async with Database.pool.acquire() as connection:
            query = '''
                SELECT report_id, reporter_id, reported_user_id, report_game_id, reason, created_at
                FROM public."Reports"
                WHERE report_id = $1
            '''
            row = await connection.fetchrow(query, report_id)
            if not row:
                raise HTTPException(status_code=404, detail="Report not found")
            return ReportRead(**dict(row))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/reports/{report_id}", response_model=ReportRead)
async def update_report(report_id: int, report_update: ReportUpdate):
    """
    Update a specific report entry by ID
    """
    try:
        async with Database.pool.acquire() as connection:
            # Check if report exists
            existing = await connection.fetchrow(
                'SELECT report_id FROM public."Reports" WHERE report_id = $1 LIMIT 1',
                report_id
            )
            if not existing:
                raise HTTPException(status_code=404, detail="Report not found")

            update_fields = []
            values = []
            param_count = 1

            if report_update.reporter_id is not None:
                update_fields.append(f"reporter_id = ${param_count}")
                values.append(report_update.reporter_id)
                param_count += 1

            if report_update.reported_user_id is not None:
                update_fields.append(f"reported_user_id = ${param_count}")
                values.append(report_update.reported_user_id)                  #anoying little shit made me make error reports to make me know what was wrong
                param_count += 1                                               #also its weird, cuz i made it so that it updates only the changed fields
                                                                               #cuz its really annoying to update the whole report when only one field is changed
            if report_update.report_game_id is not None:
                update_fields.append(f"report_game_id = ${param_count}")
                values.append(report_update.report_game_id)
                param_count += 1

            if report_update.reason is not None:
                update_fields.append(f"reason = ${param_count}")
                values.append(report_update.reason)
                param_count += 1

            if not update_fields:
                raise HTTPException(status_code=400, detail="No fields provided for update")

            values.append(report_id)

            query = f'''
                UPDATE public."Reports" 
                SET {', '.join(update_fields)}
                WHERE report_id = ${param_count}
                RETURNING report_id, reporter_id, reported_user_id, report_game_id, reason, created_at
            '''

            row = await connection.fetchrow(query, *values)
            if not row:
                raise HTTPException(status_code=500, detail="Failed to update report")
            return ReportRead(**dict(row))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/notifications", response_model=NotificationRead, status_code=201)
async def create_notification(notification: NotificationCreate):
    """
    Create a new notification entry (SCRUM-106)
    """
    try:
        async with Database.pool.acquire() as connection:
            query = '''
                INSERT INTO public."Notifications" (user_id, message, type, metadata, is_read, created_at)
                VALUES ($1, $2, $3, $4, $5, NOW())
                RETURNING notification_id, user_id, message, type, metadata, is_read, created_at
            '''
            row = await connection.fetchrow(
                query,
                notification.user_id,
                notification.message,
                notification.type,
                notification.metadata,
                notification.is_read
            )
            if not row:
                raise HTTPException(status_code=500, detail="Failed to create notification")
            return NotificationRead(**dict(row))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/notifications", response_model=List[NotificationRead])
async def get_notifications():
    """
    Retrieve all notification entries (SCRUM-107)
    """
    try:
        async with Database.pool.acquire() as connection:
            query = '''
                SELECT notification_id, user_id, message, type, metadata, is_read, created_at
                FROM public."Notifications"
                ORDER BY created_at DESC
            '''
            rows = await connection.fetch(query)
            notifications = [NotificationRead(**dict(row)) for row in rows]
            return notifications
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/notifications/{notification_id}", response_model=NotificationRead)
async def get_notification_by_id(notification_id: int):
    """
    Retrieve a specific notification entry by ID
    """
    try:
        async with Database.pool.acquire() as connection:
            query = '''
                SELECT notification_id, user_id, message, type, metadata, is_read, created_at
                FROM public."Notifications"
                WHERE notification_id = $1
            '''
            row = await connection.fetchrow(query, notification_id)
            if not row:
                raise HTTPException(status_code=404, detail="Notification not found")
            return NotificationRead(**dict(row))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -------------------------------
# Friends: create friendship (symmetric)
# -------------------------------
@app.post("/friends", response_model=FriendRead, status_code=201)
async def create_friend(friend: FriendCreate):
    """
    Create a friendship in BOTH directions:
      (user_id -> friend_id) and (friend_id -> user_id).
    Prevent self-friendship and duplicates.
    """
    if friend.user_id == friend.friend_id:
        raise HTTPException(status_code=400, detail="user_id and friend_id must be different")

    try:
        async with Database.pool.acquire() as connection:
            # Check if either direction already exists
            existing = await connection.fetchrow(
                'SELECT user_id, friend_id, status FROM public."Friends"\n'
                'WHERE (user_id = $1 AND friend_id = $2)\n'
                '   OR (user_id = $2 AND friend_id = $1)\n'
                'LIMIT 1',
                friend.user_id,
                friend.friend_id,
            )
            if existing:
                raise HTTPException(status_code=409, detail="Friendship already exists")

            async with connection.transaction():
                # Insert primary direction and return it
                created_row = await connection.fetchrow(
                    'INSERT INTO public."Friends" (user_id, friend_id, status, created_at)\n'
                    'VALUES ($1, $2, $3, NOW())\n'
                    'RETURNING user_id, friend_id, status, created_at',
                    friend.user_id,
                    friend.friend_id,
                    friend.status,
                )

                # Insert reverse direction
                await connection.execute(
                    'INSERT INTO public."Friends" (user_id, friend_id, status, created_at)\n'
                    'VALUES ($1, $2, $3, NOW())',
                    friend.friend_id,
                    friend.user_id,
                    friend.status,
                )

            return FriendRead(**dict(created_row))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -------------------------------
# Friends: delete friendship (symmetric)
# -------------------------------
@app.delete("/friends", status_code=200)
async def delete_friend(user_id: int, friend_id: int):
    """
    Hard-delete a friendship in BOTH directions:
      (user_id -> friend_id) and (friend_id -> user_id).
    Returns the number of rows removed (0, 1, or 2).
    """
    if user_id == friend_id:
        raise HTTPException(status_code=400, detail="user_id and friend_id must be different")

    try:
        async with Database.pool.acquire() as connection:
            result = await connection.execute(
                'DELETE FROM public."Friends"\n'
                'WHERE (user_id = $1 AND friend_id = $2)\n'
                '   OR (user_id = $2 AND friend_id = $1)',
                user_id,
                friend_id,
            )
            # asyncpg returns e.g. "DELETE 0", "DELETE 1", "DELETE 2"
            deleted = int(result.split()[-1]) if result else 0
            return {"deleted": deleted}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/match-histories", response_model=List[MatchHistoryRead])
async def get_match_histories(
    player_id: Union[int, None] = None,
    opponent_id: Union[int, None] = None,
    limit: int = 50,
    offset: int = 0,
):
    """
    Retrieve match history records, optionally filtered by player_id/opponent_id.
    """
    try:
        async with Database.pool.acquire() as connection:
            query = """
                SELECT match_id, player_id, opponent_id, score_player, score_opponent,
                       result, duration_minutes, played_at
                FROM public."Match_Histories"
            """
            conditions: list[str] = []
            params: list[object] = []

            if player_id is not None:
                conditions.append(f"player_id = ${len(params) + 1}")
                params.append(player_id)

            if opponent_id is not None:
                conditions.append(f"opponent_id = ${len(params) + 1}")
                params.append(opponent_id)

            if conditions:
                query += " WHERE " + " AND ".join(conditions)

            query += " ORDER BY played_at DESC"

            # pagination placeholders must come AFTER existing params
            limit_idx = len(params) + 1
            offset_idx = len(params) + 2
            query += f" LIMIT ${limit_idx} OFFSET ${offset_idx}"
            params.extend([limit, offset])

            rows = await connection.fetch(query, *params)
            return [MatchHistoryRead(**dict(row)) for row in rows]

    except Exception:
        raise HTTPException(status_code=500, detail="Failed to fetch match histories")
    
@app.get("/friends", response_model=List[FriendRead])
async def get_friends(
    user_id: Union[int, None] = None,
    friend_id: Union[int, None] = None,
    status: Union[str, None] = None,   # optional filter (e.g., "accepted")
    limit: int = 50,
    offset: int = 0,
):
    """
    Retrieve friendships, optionally filtered by user_id, friend_id, and/or status.
    Results are ordered by most recent first and paginated.
    """
    try:
        async with Database.pool.acquire() as connection:
            # base query
            query = """
                SELECT id, user_id, friend_id, status, created_at
                FROM public."Friends"
            """
            conditions: list[str] = []
            params: list[object] = []

            if user_id is not None:
                conditions.append(f"user_id = ${len(params) + 1}")
                params.append(user_id)

            if friend_id is not None:
                conditions.append(f"friend_id = ${len(params) + 1}")
                params.append(friend_id)

            if status is not None:
                conditions.append(f"status = ${len(params) + 1}")
                params.append(status)

            if conditions:
                query += " WHERE " + " AND ".join(conditions)

            query += " ORDER BY created_at DESC"

            # pagination placeholders come after existing params
            limit_idx = len(params) + 1
            offset_idx = len(params) + 2
            query += f" LIMIT ${limit_idx} OFFSET ${offset_idx}"
            params.extend([limit, offset])

            rows = await connection.fetch(query, *params)
            return [FriendRead(**dict(row)) for row in rows]

    except Exception:
        raise HTTPException(status_code=500, detail="Failed to fetch friends")

@app.post("/auth/forgot-password", response_model=ForgotPasswordRequestOut)
async def create_forgot_password_request(payload: ForgotPasswordRequestCreate):
    try:
        async with Database.pool.acquire() as conn:
            email = str(payload.email).lower().strip()
            user = await conn.fetchrow(
                'SELECT id, email FROM public."Users" WHERE email = $1',
                email
            )

            now = datetime.now(timezone.utc)
            expires_at = now + timedelta(minutes=30)

            await conn.execute(
                'INSERT INTO public."ForgotPasswordRequests"(email, created_at, expires_at, is_used) '
                'VALUES ($1, $2, $3, $4)',
                email, now, expires_at, False
            )

            if not user:
                return ForgotPasswordRequestOut(message="If the email exists, a reset link was sent.", reset_token=None)

            raw_token = gen_reset_token()
            token_h = hash_token(raw_token)

            await conn.execute(
                'INSERT INTO public."Password_Reset_Tokens"(user_id, token_hash, expires_at, used_at, created_at) '
                'VALUES ($1, $2, $3, $4, $5)',
                user["id"], token_h, expires_at, None, now
            )

            return ForgotPasswordRequestOut(message="Reset link generated.", reset_token=raw_token)

    except Exception:
        raise HTTPException(status_code=500, detail="Could not create password reset request")


@app.post("/auth/reset-password", response_model=ResetPasswordOut)
async def reset_password(payload: ResetPasswordIn):
    try:
        async with Database.pool.acquire() as conn:
            now = datetime.now(timezone.utc)
            incoming_hash = hash_token(payload.token)

            tok = await conn.fetchrow(
                'SELECT id, user_id, expires_at, used_at '
                'FROM public."Password_Reset_Tokens" '
                'WHERE token_hash = $1 AND used_at IS NULL AND expires_at > $2 '
                'ORDER BY id DESC LIMIT 1',
                incoming_hash, now
            )
            if not tok:
                raise HTTPException(status_code=400, detail="Invalid or expired token")

            user_id = tok["user_id"]
            u = await conn.fetchrow('SELECT id FROM public."Users" WHERE id = $1', user_id)
            if not u:
                raise HTTPException(status_code=404, detail="User not found")

            new_hash = hash_password(payload.new_password)
            await conn.execute(
                'UPDATE public."Users" SET password_hash = $1 WHERE id = $2',
                new_hash, user_id
            )

            await conn.execute(
                'UPDATE public."Password_Reset_Tokens" SET used_at = $1 WHERE id = $2',
                now, tok["id"]
            )

            return ResetPasswordOut(message="Password has been reset.")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Could not reset password")

