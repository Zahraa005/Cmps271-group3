from typing import Union, List
import asyncpg
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr

from PlayConnect_API.schemas.Users import UserRead, UserCreate
from PlayConnect_API.Database import connect_to_db, disconnect_db
from PlayConnect_API import Database
from PlayConnect_API.schemas.registration import RegisterRequest


from PlayConnect_API.schemas.Coaches import CoachRead, CoachCreate 
from PlayConnect_API.schemas.User_stats import UserStatCreate, UserStatRead
from PlayConnect_API.schemas.Game_Instance import GameInstanceCreate, GameInstanceResponse
from PlayConnect_API.schemas.ForgotPasswordRequest import ForgotPasswordRequestCreate
from PlayConnect_API.schemas.Login import LoginRequest, TokenResponse
from PlayConnect_API.schemas.sport import SportRead, SportCreate
from PlayConnect_API.schemas.Profile import ProfileCreate
from PlayConnect_API.schemas.Game_participants import GameParticipantJoin, GameParticipantLeave
from PlayConnect_API.schemas.Waitlist import WaitlistRead  
from PlayConnect_API.schemas.report import ReportCreate, ReportRead


from datetime import datetime, timezone, timedelta
import os, secrets, hashlib
import smtplib, ssl, asyncio
import certifi
from email.message import EmailMessage
import jwt



app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],  
    allow_credentials=True,
    allow_methods=["*"],  
    allow_headers=["*"],  
)

# function to send reset email
from email.message import EmailMessage
from pathlib import Path
import os
import smtplib
import ssl


async def send_reset_email(to_email: str, reset_url: str, first_name: str = "user"):
    """
    Sends a styled password reset email using the HTML template in templates/emails/reset_password.html
    """

    # Load the HTML file
    template_path = Path(__file__).parent / "templates" / "emails" / "reset_password.html"
    html_content = template_path.read_text(encoding="utf-8")

    # Replace placeholders
    html_content = (
        html_content.replace("{{first_name}}", first_name)
                    .replace("{{reset_url}}", reset_url)
    )

    # Fallback plain text
    plain_text = f"Hi {first_name}, click here to reset your password: {reset_url}"

    # Build the message
    msg = EmailMessage()
    msg["From"] = os.getenv("MAIL_FROM", "no-reply@playconnect.com")
    msg["To"] = to_email
    msg["Subject"] = "PlayConnect Password Reset"
    msg.set_content(plain_text)
    msg.add_alternative(html_content, subtype="html")

    # Connect to the SMTP server
    smtp_server = os.getenv("MAIL_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("MAIL_PORT", 465))
    smtp_user = os.getenv("MAIL_USERNAME")
    smtp_pass = os.getenv("MAIL_PASSWORD")

    context = ssl.create_default_context()
    try:
        with smtplib.SMTP_SSL(smtp_server, smtp_port, context=context) as server:
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        print(f"✅ Reset email sent successfully to {to_email}")
    except Exception as e:
        print(f"❌ Failed to send reset email: {e}")



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