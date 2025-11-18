from typing import Union, List, Optional
import asyncpg
from fastapi import FastAPI, Depends, HTTPException, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from dotenv import load_dotenv

from PlayConnect_API.schemas.Users import UserRead, UserCreate
from PlayConnect_API.Database import connect_to_db, disconnect_db
from PlayConnect_API import Database
from PlayConnect_API.schemas.registration import RegisterRequest

from PlayConnect_API.schemas.Coaches import CoachRead, CoachCreate, CoachVerifyUpdate, CoachUpdate 
from PlayConnect_API.schemas.User_stats import UserStatCreate, UserStatRead
from PlayConnect_API.schemas.Game_Instance import GameInstanceCreate, GameInstanceResponse
from PlayConnect_API.schemas.ForgotPasswordRequest import ForgotPasswordRequestCreate
from PlayConnect_API.schemas.Login import LoginRequest, TokenResponse
from PlayConnect_API.schemas.EmailVerificationRequest import EmailVerificationRequest
from PlayConnect_API.schemas.sport import SportRead, SportCreate
from PlayConnect_API.schemas.Profile import ProfileCreate, ProfileRead
from PlayConnect_API.schemas.Game_participants import GameParticipantJoin, GameParticipantLeave
from PlayConnect_API.schemas.Waitlist import WaitlistRead  
from PlayConnect_API.schemas.report import ReportCreate, ReportRead, ReportUpdate
from PlayConnect_API.schemas.Notifications import NotificationCreate, NotificationRead, NotificationType
from PlayConnect_API.schemas.Friends import FriendCreate, FriendRead
from PlayConnect_API.schemas.Match_Histories import MatchHistoryCreate, MatchHistoryRead
from PlayConnect_API.schemas.user_badging import UserBadgeCreate, UserBadgeRead, UserBadgeUpdate
from PlayConnect_API.schemas.activity_log import ActivityLogCreate, ActivityLogRead, ActivityLogUpdate

from PlayConnect_API.security_utils import hash_password, verify_password

from PlayConnect_API.services.mailer import render_template, send_email
import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from PlayConnect_API.recurrence_worker import process_due_schedules


from datetime import date, datetime, timezone, timedelta
import os, secrets, hashlib
import jwt
from fastapi import Request
import json
from fastapi import Body
from typing import List
from fastapi import UploadFile, File, Form, HTTPException
import os, shutil

# =======================
# LOGIN ATTEMPT TRACKING
# =======================
FAILED_LOGINS = {}  # {email: {"count": int, "first_fail": datetime}}

MAX_ATTEMPTS = 5
#BLOCK_DURATION = timedelta(seconds=30)   # ⬅️ changed from 15 minutes for testing
BLOCK_DURATION = timedelta(minutes=15)  

def check_login_attempt(email: str):
    """Raise HTTPException if user is temporarily blocked."""
    entry = FAILED_LOGINS.get(email)
    if not entry:
        return

    # if cooldown expired, reset
    if datetime.utcnow() - entry["first_fail"] > BLOCK_DURATION:
        FAILED_LOGINS.pop(email, None)
        return

    if entry["count"] >= MAX_ATTEMPTS:
        remaining = BLOCK_DURATION - (datetime.utcnow() - entry["first_fail"])
        mins = int(remaining.total_seconds() // 60) + 1
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed login attempts. Try again in {mins} minute(s).",
        )

def record_failed_login(email: str):
    """Increment fail counter for an email."""
    now = datetime.utcnow()
    entry = FAILED_LOGINS.get(email)
    if entry:
        if now - entry["first_fail"] > BLOCK_DURATION:
            # Reset window
            FAILED_LOGINS[email] = {"count": 1, "first_fail": now}
        else:
            entry["count"] += 1
    else:
        FAILED_LOGINS[email] = {"count": 1, "first_fail": now}

def reset_login_attempts(email: str):
    """Reset after successful login."""
    FAILED_LOGINS.pop(email, None)


# =======================
# XP / BADGE DEFINITIONS
# =======================
XP_PER_LEVEL = int(os.getenv("XP_PER_LEVEL", "100"))
XP_REWARDS = {
    "play_game": int(os.getenv("XP_REWARD_PLAY", "25")),
    "host_game": int(os.getenv("XP_REWARD_HOST", "40")),
    "friend_accept": int(os.getenv("XP_REWARD_FRIEND", "15")),
    "update_bio": int(os.getenv("XP_REWARD_BIO", "20")),
}


def _badge_first_match(ctx): return ctx["total_games_played"] >= 1
def _badge_active_player(ctx): return ctx["total_games_played"] >= 10
def _badge_strategist(ctx): return ctx["total_games_hosted"] >= 5
def _badge_socializer(ctx): return ctx["friend_count"] >= 10
def _badge_coach_verified(ctx): return ctx["is_verified_coach"]
def _badge_weekly_streak(ctx): return ctx["login_streak"] >= 7
def _badge_top_player(ctx): return ctx["is_top_player"]


BADGE_DEFINITIONS = [
    {"name": "First Match", "check": _badge_first_match},
    {"name": "Active Player", "check": _badge_active_player},
    {"name": "Strategist", "check": _badge_strategist},
    {"name": "Socializer", "check": _badge_socializer},
    {"name": "Coach Verified", "check": _badge_coach_verified},
    {"name": "Weekly Streak", "check": _badge_weekly_streak},
    {"name": "Top Player", "check": _badge_top_player},
]


async def log_activity(connection, user_id: int, action: str):
    await connection.execute(
        '''
        INSERT INTO public."activity_logs" (user_id, action, created_at)
        VALUES ($1, $2, NOW())
        ''',
        user_id, action
    )


async def upsert_user_stats_delta(
    connection,
    *,
    user_id: int,
    sport_id: int | None,
    games_played_delta: int = 0,
    games_hosted_delta: int = 0,
    xp_delta: int = 0
):
    sport = sport_id if sport_id is not None else 0
    if games_played_delta == 0 and games_hosted_delta == 0 and xp_delta == 0:
        return None

    row = await connection.fetchrow(
        '''
        INSERT INTO public."User_stats" (user_id, sport_id, games_played, games_hosted, attendance_rate, xp, level)
        VALUES ($1, $2, $3, $4, NULL, $5, FLOOR(GREATEST($5, 0)::numeric / $6))
        ON CONFLICT (user_id, sport_id)
        DO UPDATE SET
            games_played = GREATEST(public."User_stats".games_played + EXCLUDED.games_played, 0),
            games_hosted = GREATEST(public."User_stats".games_hosted + EXCLUDED.games_hosted, 0),
            xp = GREATEST(public."User_stats".xp + EXCLUDED.xp, 0),
            level = FLOOR(GREATEST(public."User_stats".xp + EXCLUDED.xp, 0)::numeric / $6)
        RETURNING user_id, sport_id, games_played, games_hosted, xp, level
        ''',
        user_id,
        sport,
        games_played_delta,
        games_hosted_delta,
        xp_delta,
        XP_PER_LEVEL
    )
    return row


async def get_user_progress_context(connection, user_id: int):
    stat_totals = await connection.fetchrow(
        '''
        SELECT
            COALESCE(SUM(games_played), 0) AS total_games_played,
            COALESCE(SUM(games_hosted), 0) AS total_games_hosted,
            COALESCE(SUM(xp), 0) AS total_xp,
            COALESCE(MAX(level), 0) AS current_level
        FROM public."User_stats"
        WHERE user_id = $1
        ''',
        user_id
    ) or {"total_games_played": 0, "total_games_hosted": 0, "total_xp": 0, "current_level": 0}

    games_played_total = await connection.fetchval(
        'SELECT COUNT(*) FROM public."Game_participants" WHERE user_id = $1',
        user_id
    ) or 0

    games_hosted_total = await connection.fetchval(
        'SELECT COUNT(*) FROM public."Game_instance" WHERE host_id = $1',
        user_id
    ) or 0

    friend_count = await connection.fetchval(
        '''
        SELECT COUNT(*)
        FROM public."Friends"
        WHERE status = 'accepted' AND ($1 = user_id OR $1 = friend_id)
        ''',
        user_id
    ) or 0

    is_verified_coach = bool(await connection.fetchval(
        '''
        SELECT 1 FROM public."Coaches"
        WHERE coach_id = $1 AND isverified = TRUE
        LIMIT 1
        ''',
        user_id
    ))

    login_days = await connection.fetch(
        '''
        SELECT DISTINCT DATE(created_at) AS day
        FROM public."activity_logs"
        WHERE user_id = $1 AND action = 'login' AND created_at >= NOW() - INTERVAL '14 days'
        ORDER BY day DESC
        ''',
        user_id
    )
    login_day_set = {row["day"] for row in login_days}
    streak = 0
    current_day = date.today()
    while current_day in login_day_set:
        streak += 1
        current_day = current_day - timedelta(days=1)

    xp_row = await connection.fetchrow(
        '''
        WITH totals AS (
            SELECT user_id, COALESCE(SUM(xp), 0) AS total_xp
            FROM public."User_stats"
            GROUP BY user_id
        ), ranked AS (
            SELECT
                user_id,
                total_xp,
                ROW_NUMBER() OVER (ORDER BY total_xp DESC) AS rk,
                COUNT(*) OVER () AS total_users
            FROM totals
        )
        SELECT total_xp, rk, total_users
        FROM ranked
        WHERE user_id = $1
        ''',
        user_id
    )
    total_users = xp_row["total_users"] if xp_row else 0
    rank_position = xp_row["rk"] if xp_row else None
    cutoff = max(1, int((total_users or 1) * 0.1)) if total_users else 0
    is_top_player = bool(rank_position and rank_position <= cutoff and (xp_row["total_xp"] or 0) > 0)

    return {
        "total_games_played": games_played_total,
        "total_games_hosted": games_hosted_total,
        "total_xp": stat_totals["total_xp"],
        "current_level": stat_totals["current_level"],
        "friend_count": friend_count,
        "is_verified_coach": is_verified_coach,
        "login_streak": streak,
        "is_top_player": is_top_player,
    }


async def ensure_user_badges(connection, user_id: int, context: dict | None = None):
    if context is None:
        context = await get_user_progress_context(connection, user_id)

    existing = {
        row["badge_name"]
        for row in await connection.fetch(
            'SELECT badge_name FROM public."user_badges" WHERE user_id = $1',
            user_id
        )
    }
    awarded = []
    for badge in BADGE_DEFINITIONS:
        name = badge["name"]
        if name in existing:
            continue
        if badge["check"](context):
            await connection.execute(
                '''
                INSERT INTO public."user_badges" (user_id, badge_name, earned_on, seen)
                VALUES ($1, $2, NOW(), FALSE)
                ''',
                user_id,
                name
            )
            awarded.append(name)
    return awarded


async def apply_progress(
    connection,
    *,
    user_id: int,
    sport_id: int | None = None,
    games_played_delta: int = 0,
    games_hosted_delta: int = 0,
    xp_delta: int = 0
):
    await upsert_user_stats_delta(
        connection,
        user_id=user_id,
        sport_id=sport_id,
        games_played_delta=games_played_delta,
        games_hosted_delta=games_hosted_delta,
        xp_delta=xp_delta
    )
    await ensure_user_badges(connection, user_id)


app = FastAPI()

# APScheduler instance used to run the recurrence worker in-process
scheduler = AsyncIOScheduler()

load_dotenv(dotenv_path=".env")


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://cmps271-group3.vercel.app",
        "https://cmps271-group3-cbl2.vercel.app"
    ],
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


async def send_verification_email(connection, user_id: int, email: str, first_name: str):
    """Send email verification to user"""
    try:
        # Create verification URL with email parameter
        app_url = os.getenv("APP_URL") or os.getenv("FRONTEND_URL", "https://cmps271-group3-cbl2.vercel.app")
        import urllib.parse
        verification_url = f"{app_url}/verify-email?email={urllib.parse.quote(email)}"
        
        # Render HTML template and send email
        html = render_template(
            "PlayConnect_API/templates/emails/email_verification.html",
            {"first_name": first_name, "verification_url": verification_url}
        )
        
        try:
            await send_email(email, "Verify Your Email - PlayConnect", html)
            if os.getenv("ENV", "dev").lower() != "production":
                print(f"[DEV ONLY] Verification email sent to {email}")
                print(f"[DEV ONLY] Verification link: {verification_url}")
        except Exception as send_err:
            print(f"[DEV ONLY] Email send failed: {repr(send_err)}")
            
    except Exception as e:
        print(f"[DEV ONLY] Failed to send verification email: {repr(e)}")

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
            from pydantic import SecretStr
            raw_pw = reg.password.get_secret_value() if isinstance(reg.password, SecretStr) else str(reg.password)
            print("[DEBUG] /register password raw:", raw_pw)
            print("[DEBUG] /register password byte len:", len(raw_pw.encode("utf-8")))
            hashed_pw = hash_password(raw_pw)
            row = await connection.fetchrow(
                query,
                reg.first_name,
                reg.last_name,
                reg.email,
                hashed_pw,
                reg.age,
                created_at,
                isverified,
                role
            )
            
            if row:
                # Send email verification after registration
                await send_verification_email(connection, row["user_id"], row["email"], row["first_name"])
                return dict(row)
            return None
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
                'SELECT game_id, sport_id FROM public."Game_instance" WHERE game_id = $1 LIMIT 1',
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
            if inserted:
                await apply_progress(
                    connection,
                    user_id=payload.user_id,
                    sport_id=game["sport_id"],
                    games_played_delta=1,
                    xp_delta=XP_REWARDS["play_game"]
                )
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
    app_url = os.getenv("APP_URL") or os.getenv("FRONTEND_URL", "https://cmps271-group3-cbl2.vercel.app")
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

# Password Reset: finalize using token
from pydantic import BaseModel, SecretStr

class PasswordResetPayload(BaseModel):
    token: str
    new_password: SecretStr | str
    confirm_password: SecretStr | str

@app.post("/reset-password", status_code=200)
async def reset_password(body: PasswordResetPayload):
    """Finalize password reset.
    Steps:
    - find token in public."Password_reset_tokens" by token_hash
    - check not expired and not used
    - get user_id, update user's password (hashed)
    - mark token as used
    """
    # 1) basic checks
    # unwrap secretstrs
    new_pw = body.new_password.get_secret_value() if isinstance(body.new_password, SecretStr) else str(body.new_password)
    conf_pw = body.confirm_password.get_secret_value() if isinstance(body.confirm_password, SecretStr) else str(body.confirm_password)
    if new_pw != conf_pw:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    if len(new_pw) < 6:
        raise HTTPException(status_code=400, detail="Password too short (min 6 chars)")

    token_hash = _sha256_hex(body.token)

    try:
        async with Database.pool.acquire() as connection:
            # 2) find token row
            token_row = await connection.fetchrow(
                '''
                SELECT id, user_id, expires_at, used_at
                FROM public."Password_reset_tokens"
                WHERE token_hash = $1
                LIMIT 1
                ''',
                token_hash,
            )
            if not token_row:
                raise HTTPException(status_code=400, detail="Invalid or unknown reset token")
            if token_row["used_at"] is not None:
                raise HTTPException(status_code=400, detail="Reset token already used")
            # check expiry
            now_utc = datetime.now(timezone.utc)
            if token_row["expires_at"] < now_utc:
                raise HTTPException(status_code=400, detail="Reset token expired")

            user_id = token_row["user_id"]

            # 3) hash new password and update user
            hashed_pw = hash_password(new_pw)
            await connection.execute(
                '''
                UPDATE public."Users"
                SET password = $1
                WHERE user_id = $2
                ''',
                hashed_pw,
                user_id,
            )

            # 4) mark token as used
            await connection.execute(
                '''
                UPDATE public."Password_reset_tokens"
                SET used_at = NOW()
                WHERE id = $1
                ''',
                token_row["id"],
            )

            return {"message": "Password has been reset successfully"}

    except HTTPException:
        raise
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

@app.post("/verify-email")
async def verify_email(request: EmailVerificationRequest):
    """Verify user email with email address"""
    try:
        print(f"[DEBUG] Verifying email: {request.email}")
        async with Database.pool.acquire() as connection:
            # Find user by email
            user = await connection.fetchrow(
                'SELECT user_id, email, isverified FROM public."Users" WHERE LOWER(email) = LOWER($1) LIMIT 1',
                request.email
            )
            
            print(f"[DEBUG] User found: {user}")
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            if user["isverified"]:
                print(f"[DEBUG] Email already verified")
                return {"message": "Email is already verified!"}
            
            # Update user verification status
            await connection.execute(
                'UPDATE public."Users" SET isverified = TRUE WHERE user_id = $1',
                user["user_id"]
            )
            
            print(f"[DEBUG] Email verification successful for user {user['user_id']}")
            return {"message": "Email verified successfully! You can now access all PlayConnect features."}
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"[DEBUG] Verification error: {repr(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/resend-verification")
async def resend_verification_email(request: EmailVerificationRequest):
    """Resend verification email for unverified users"""
    try:
        async with Database.pool.acquire() as connection:
            # Find user by email
            user = await connection.fetchrow(
                'SELECT user_id, email, first_name, isverified FROM public."Users" WHERE LOWER(email) = LOWER($1) LIMIT 1',
                request.email
            )
            
            if not user:
                # Don't reveal if email exists or not for security
                return {
                    "message": "If an account exists for that email and is not verified, a verification email has been sent."
                }
            
            if user["isverified"]:
                return {
                    "message": "This email is already verified."
                }
            
            # Send verification email
            await send_verification_email(connection, user["user_id"], user["email"], user["first_name"])
            
            return {
                "message": "Verification email sent successfully!"
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.on_event("startup")
async def startup():
    await connect_to_db()
    await ensure_password_reset_table()
#:(
@app.on_event("shutdown")
async def shutdown():
    # stop scheduler first
    try:
        scheduler.shutdown(wait=False)
    except Exception:
        pass
    await disconnect_db()


@app.post("/recurring/run-now")
async def run_recurring_now():
    """Manual trigger for the recurrence worker (useful for testing)."""
    try:
        await process_due_schedules()
        return {"message": "recurrence worker run completed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
            from pydantic import SecretStr
            raw_pw = user.password.get_secret_value() if isinstance(user.password, SecretStr) else str(user.password)
            print("[DEBUG] /users password raw:", raw_pw)
            print("[DEBUG] /users password byte len:", len(raw_pw.encode("utf-8")))
            hashed_pw = hash_password(raw_pw)
            row = await connection.fetchrow(
                query,
                user.email,
                hashed_pw,
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
@app.get("/coaches")
async def get_coaches():
    try:
        async with Database.pool.acquire() as connection:
            query = '''
                SELECT 
                    c.coach_id,
                    c.experience_yrs,
                    c.certifications,
                    c.isverified,
                    c.hourly_rate,
                    c.created_at,
                    u.first_name,
                    u.last_name,
                    u.avatar_url,
                    u.bio,
                    u.favorite_sport,
                    u.email
                FROM public."Coaches" c
                LEFT JOIN public."Users" u ON c.coach_id = u.user_id
                ORDER BY c.created_at DESC
            '''
            rows = await connection.fetch(query)
            return [dict(row) for row in rows]
    except Exception as e:
        print("🔥 ERROR in /coaches:", e)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/coaches/{coach_id}")
async def get_coach_by_id(coach_id: int):
    try:
        async with Database.pool.acquire() as connection:
            query = '''
                SELECT 
                    c.coach_id,
                    c.experience_yrs,
                    c.certifications,
                    c.isverified,
                    c.hourly_rate,
                    c.created_at,
                    u.first_name,
                    u.last_name,
                    u.avatar_url,
                    u.bio,
                    u.favorite_sport,
                    u.email
                FROM public."Coaches" c
                LEFT JOIN public."Users" u ON c.coach_id = u.user_id
                WHERE c.coach_id = $1
            '''
            row = await connection.fetchrow(query, coach_id)
            if not row:
                raise HTTPException(status_code=404, detail="Coach not found")
            return dict(row)
    except Exception as e:
        print("🔥 ERROR:", e)
        raise HTTPException(status_code=500, detail=str(e))




@app.post("/profile-creation", response_model=UserRead, status_code=200)
async def create_profile(profile: ProfileCreate, user_id: int):
    try:
        async with Database.pool.acquire() as connection:
            # Ensure user exists
            existing = await connection.fetchrow(
                'SELECT user_id, email, first_name FROM public."Users" WHERE user_id = $1 LIMIT 1',
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
                'SELECT user_id, bio FROM public."Users" WHERE user_id = $1 LIMIT 1',
                user_id
            )
            if not existing:
                raise HTTPException(status_code=404, detail="User not found")
            previous_bio = (existing["bio"] or "").strip() if "bio" in existing else ""

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
            updated_bio = (row["bio"] or "").strip() if "bio" in row else ""
            if not previous_bio and updated_bio:
                await apply_progress(
                    connection,
                    user_id=user_id,
                    sport_id=0,
                    xp_delta=XP_REWARDS["update_bio"]
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
                INSERT INTO public."Coaches" (coach_id, experience_yrs, certifications, isverified, hourly_rate)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING coach_id, experience_yrs, certifications, isverified, hourly_rate, created_at
            '''
            row = await connection.fetchrow(
                query,
                coach.user_id,
                coach.experience_yrs,
                coach.certifications,
                coach.isverified,
                coach.hourly_rate
            )
            return CoachRead(**dict(row))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/coaches/{coach_id}", response_model=CoachRead)
async def update_coach(coach_id: int, coach_update: CoachUpdate):
    try:
        async with Database.pool.acquire() as connection:
            # Check if coach exists
            coach_exists = await connection.fetchrow(
                '''
                SELECT coach_id FROM public."Coaches"
                WHERE coach_id = $1
                ''',
                coach_id
            )
            if not coach_exists:
                raise HTTPException(status_code=404, detail="Coach not found")

            # Build dynamic UPDATE query for Coaches table
            coach_updates = []
            coach_params = []
            param_num = 1

            if coach_update.experience_yrs is not None:
                coach_updates.append("experience_yrs = $" + str(param_num))
                coach_params.append(coach_update.experience_yrs)
                param_num += 1

            if coach_update.certifications is not None:
                coach_updates.append("certifications = $" + str(param_num))
                coach_params.append(coach_update.certifications)
                param_num += 1

            if coach_update.hourly_rate is not None:
                coach_updates.append("hourly_rate = $" + str(param_num))
                coach_params.append(coach_update.hourly_rate)
                param_num += 1

            # Note: isverified is intentionally excluded - use /coaches/{coach_id}/verification endpoint instead

            # Update Coaches table if there are fields to update
            if coach_updates:
                coach_query = f'''
                    UPDATE public."Coaches"
                    SET {', '.join(coach_updates)}
                    WHERE coach_id = $''' + str(param_num)
                coach_params.append(coach_id)
                await connection.execute(coach_query, *coach_params)

            # Build dynamic UPDATE query for Users table
            user_updates = []
            user_params = []
            user_param_num = 1

            if coach_update.first_name is not None:
                user_updates.append("first_name = $" + str(user_param_num))
                user_params.append(coach_update.first_name)
                user_param_num += 1

            if coach_update.last_name is not None:
                user_updates.append("last_name = $" + str(user_param_num))
                user_params.append(coach_update.last_name)
                user_param_num += 1

            if coach_update.favorite_sport is not None:
                user_updates.append("favorite_sport = $" + str(user_param_num))
                user_params.append(coach_update.favorite_sport)
                user_param_num += 1

            if coach_update.avatar_url is not None:
                user_updates.append("avatar_url = $" + str(user_param_num))
                user_params.append(coach_update.avatar_url)
                user_param_num += 1

            if coach_update.bio is not None:
                user_updates.append("bio = $" + str(user_param_num))
                user_params.append(coach_update.bio)
                user_param_num += 1

            # Update Users table if there are fields to update
            if user_updates:
                user_query = f'''
                    UPDATE public."Users"
                    SET {', '.join(user_updates)}
                    WHERE user_id = $''' + str(user_param_num)
                user_params.append(coach_id)
                await connection.execute(user_query, *user_params)

            # Return the updated coach with joined user data
            full = await connection.fetchrow(
                '''
                SELECT
                  c.coach_id, c.experience_yrs, c.certifications, c.isverified,
                  c.hourly_rate, c.created_at,
                  u.first_name, u.last_name, u.avatar_url, u.bio, u.favorite_sport, u.email
                FROM public."Coaches" c
                LEFT JOIN public."Users" u ON c.coach_id = u.user_id
                WHERE c.coach_id = $1
                ''',
                coach_id
            )

            return CoachRead(**dict(full))
    except HTTPException:
        raise
    except Exception as e:
        print(f"🔥 ERROR in PUT /coaches/{coach_id}:", e)
        raise HTTPException(status_code=500, detail=str(e))
    
@app.delete("/coaches/{coach_id}", status_code=200)
async def delete_coach(coach_id: int):
    try:
        async with Database.pool.acquire() as connection:
            # Ensure coach exists
            exists = await connection.fetchrow(
                'SELECT coach_id FROM public."Coaches" WHERE coach_id = $1 LIMIT 1',
                coach_id
            )
            if not exists:
                raise HTTPException(status_code=404, detail="Coach not found")

            # Delete coach record
            await connection.execute(
                'DELETE FROM public."Coaches" WHERE coach_id = $1',
                coach_id
            )
            return {"message": "Coach listing deleted", "coach_id": coach_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.put("/coaches/{coach_id}/verification", response_model=CoachRead)
async def verify_coach(coach_id: int, body: CoachVerifyUpdate):
    try:
        async with Database.pool.acquire() as connection:
            # Ensure the coach exists and check current status
            row = await connection.fetchrow(
                '''
                SELECT c.coach_id, c.isverified
                FROM public."Coaches" c
                WHERE c.coach_id = $1
                ''',
                coach_id
            )
            if not row:
                raise HTTPException(status_code=404, detail="Coach not found")

            if row["isverified"] is True:
                # Idempotent: already verified — return full resource
                full = await connection.fetchrow(
                    '''
                    SELECT
                      c.coach_id, c.experience_yrs, c.certifications, c.isverified,
                      c.hourly_rate, c.created_at,
                      u.first_name, u.last_name, u.avatar_url, u.bio, u.favorite_sport, u.email
                    FROM public."Coaches" c
                    LEFT JOIN public."Users" u ON c.coach_id = u.user_id
                    WHERE c.coach_id = $1
                    ''',
                    coach_id
                )
                return CoachRead(**dict(full))

            # Transition pending(False) -> verified(True)
            updated = await connection.fetchrow(
                '''
                UPDATE public."Coaches"
                SET isverified = TRUE
                WHERE coach_id = $1
                RETURNING coach_id, experience_yrs, certifications, isverified, hourly_rate, created_at
                ''',
                coach_id
            )

            # Return the joined shape your GETs already use
            full = await connection.fetchrow(
                '''
                SELECT
                  c.coach_id, c.experience_yrs, c.certifications, c.isverified,
                  c.hourly_rate, c.created_at,
                  u.first_name, u.last_name, u.avatar_url, u.bio, u.favorite_sport, u.email
                FROM public."Coaches" c
                LEFT JOIN public."Users" u ON c.coach_id = u.user_id
                WHERE c.coach_id = $1
                ''',
                updated["coach_id"]
            )

            return CoachRead(**dict(full))
    except HTTPException:
        raise
    except Exception as e:
        print("🔥 ERROR in /coaches/{coach_id}/verification:", e)
        raise HTTPException(status_code=500, detail=str(e))
    

@app.post("/coaches/request-verification", status_code=201)
async def request_coach_verification(
    coach_id: int = Form(...),
    message: str = Form(""),
    documents: List[UploadFile] = File(None)
):
    """
    Coaches submit a verification request (SCRUM-157)
    Supports multiple file uploads.
    """
    try:
        # ✅ 1) verify coach exists
        async with Database.pool.acquire() as connection:
            exists = await connection.fetchrow(
                'SELECT coach_id FROM public."Coaches" WHERE coach_id = $1 LIMIT 1',
                coach_id
            )
            if not exists:
                raise HTTPException(status_code=404, detail="Coach not found")

        # ✅ 2) save uploaded files
        upload_paths = []
        if documents:
            folder = "uploads/verification_docs"
            os.makedirs(folder, exist_ok=True)
            for doc in documents:
                filename = f"{coach_id}_{int(datetime.utcnow().timestamp())}_{doc.filename}"
                path = os.path.join(folder, filename)
                with open(path, "wb") as buffer:
                    shutil.copyfileobj(doc.file, buffer)
                upload_paths.append(path)

        # ✅ 3) insert request into DB
        async with Database.pool.acquire() as connection:
            await connection.execute(
                '''
                INSERT INTO public."Coach_verification_requests" (coach_id, message, document_url, status)
                VALUES ($1, $2, $3, 'pending')
                ''',
                coach_id, message, ", ".join(upload_paths) if upload_paths else None
            )

        return {
            "message": "Verification request submitted successfully!",
            "coach_id": coach_id,
            "documents_saved": len(upload_paths)
        }

    except HTTPException:
        raise
    except Exception as e:
        print("🔥 ERROR /coaches/request-verification:", e)
        raise HTTPException(status_code=500, detail="Failed to submit verification request")


    
#USER_STATS endpoints
@app.get("/user_stats", response_model=List[UserStatRead])
async def get_user_stats():
    try:
        async with Database.pool.acquire() as connection:
            rows = await connection.fetch(
                '''
                SELECT user_id, sport_id, games_played, games_hosted, attendance_rate, xp, level
                FROM public."User_stats"
                '''
            )
            stats = [UserStatRead(**dict(row)) for row in rows]
            return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/user_stats", response_model=UserStatRead)
async def create_user_stat(stat: UserStatCreate):
    try:
        async with Database.pool.acquire() as connection:
            query = '''
                INSERT INTO public."User_stats" (
                    user_id, sport_id, games_played, games_hosted, attendance_rate, xp, level
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING user_id, sport_id, games_played, games_hosted, attendance_rate, xp, level
            '''
            row = await connection.fetchrow(
                query,
                stat.user_id,
                stat.sport_id,
                stat.games_played,
                stat.games_hosted,
                stat.attendance_rate,
                stat.xp,
                stat.level
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
            await apply_progress(
                connection,
                user_id=game.host_id,
                sport_id=game.sport_id,
                games_hosted_delta=1,
                xp_delta=XP_REWARDS["host_game"]
            )
            return GameInstanceResponse(**dict(row))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.post("/book-session", status_code=201)
async def book_session(
    game_id: int = Body(..., embed=True),
    user_id: int = Body(..., embed=True)
):
    """
    Book a session for a user (SCRUM-156)
    - Verifies the game exists and is open.
    - Ensures the session isn't full.
    - Adds the user as a participant.
    - Returns game + booking info.
    """
    try:
        async with Database.pool.acquire() as connection:
            # 1️⃣ Ensure game exists
            game = await connection.fetchrow(
                '''
                SELECT gi.*, 
                       COALESCE(gp_count.cnt, 0) AS participants_count
                FROM public."Game_instance" AS gi
                LEFT JOIN (
                    SELECT game_id, COUNT(*) AS cnt 
                    FROM public."Game_participants"
                    GROUP BY game_id
                ) AS gp_count ON gp_count.game_id = gi.game_id
                WHERE gi.game_id = $1
                ''',
                game_id
            )
            if not game:
                raise HTTPException(status_code=404, detail="Session not found")

            if game["status"].lower() != "open":
                raise HTTPException(status_code=400, detail="This session is not open for booking")

            if game["participants_count"] >= game["max_players"]:
                raise HTTPException(status_code=400, detail="This session is already full")

            # 2️⃣ Ensure user exists
            user = await connection.fetchrow(
                'SELECT user_id FROM public."Users" WHERE user_id = $1 LIMIT 1',
                user_id
            )
            if not user:
                raise HTTPException(status_code=404, detail="User not found")

            # 3️⃣ Check if user already joined
            existing = await connection.fetchrow(
                '''
                SELECT 1 FROM public."Game_participants"
                WHERE game_id = $1 AND user_id = $2
                ''',
                game_id, user_id
            )
            if existing:
                raise HTTPException(status_code=400, detail="User already booked this session")

            # 4️⃣ Insert into Game_participants
            await connection.execute(
                '''
                INSERT INTO public."Game_participants" (game_id, user_id, role, joined_at)
                VALUES ($1, $2, 'PLAYER', NOW())
                ''',
                game_id, user_id
            )

            # 5️⃣ Return full booking info
            booking = await connection.fetchrow(
                '''
                SELECT 
                    gi.game_id, gi.location, gi.start_time, gi.duration_minutes,
                    gi.skill_level, gi.max_players, gi.status,
                    u.first_name AS coach_first_name, u.last_name AS coach_last_name
                FROM public."Game_instance" AS gi
                JOIN public."Users" AS u ON u.user_id = gi.host_id
                WHERE gi.game_id = $1
                ''',
                game_id
            )

            return {
                "message": "Session booked successfully!",
                "booking": dict(booking),
                "user_id": user_id
            }

    except HTTPException:
        raise
    except Exception as e:
        print("🔥 ERROR in /book-session:", e)
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
        # Archive past games automatically before fetching
        try:
            await archive_past_games()
        except Exception as e:
            # Log but don't fail if archiving fails
            print(f"Warning: Failed to archive past games: {e}")
        
        async with Database.pool.acquire() as connection:
            # Filter out past games: only show games where start_time + duration_minutes >= NOW()
            query = '''
                SELECT * FROM public."Game_instance"
                WHERE (start_time + INTERVAL '1 minute' * duration_minutes) >= NOW()
                ORDER BY created_at DESC
            '''
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
async def login(login_request: LoginRequest, request: Request):
    email = login_request.email
    if not email:
        raise HTTPException(status_code=400, detail="Email is required for login")

    # Check if blocked before processing
    check_login_attempt(email)

    try:
        async with Database.pool.acquire() as connection:
            # Query user by email including verification status
            query = '''
                SELECT user_id, email, password, role, first_name, last_name, isverified
                FROM public."Users"
                WHERE LOWER(email) = LOWER($1)
            '''
            user = await connection.fetchrow(query, login_request.email)

            # -----------------------------
            # ADD: record failed login if user not found
            # -----------------------------
            if not user:
                record_failed_login(email)
                raise HTTPException(status_code=401, detail="Invalid email or password")

            plain_pw = login_request.password.get_secret_value()
            stored_hash = user["password"]

            # -----------------------------
            # ADD: record failed login if password invalid
            # -----------------------------
            if not verify_password(plain_pw, stored_hash):
                record_failed_login(email)
                raise HTTPException(status_code=401, detail="Invalid email or password")

            # -----------------------------
            # ADD: reset failed counter on successful login
            # -----------------------------
            reset_login_attempts(email)

            # Check if email is verified
            if not user["isverified"]:
                await send_verification_email(connection, user["user_id"], user["email"], user["first_name"])
                raise HTTPException(
                    status_code=403,
                    detail="Please verify your email address. A verification email has been sent to your inbox."
                )

            await log_activity(connection, user["user_id"], "login")
            await ensure_user_badges(connection, user["user_id"])

            # Generate JWT token
            secret_key = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
            token_expiry = datetime.utcnow() + timedelta(hours=4)  # 4 hour expiry

            token_payload = {
                "user_id": user["user_id"],
                "email": user["email"],
                "role": user["role"],  # used JWT to track user login and dashboard role
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
            existing = await connection.fetchrow(
                'SELECT game_id, host_id, sport_id FROM public."Game_instance" WHERE game_id = $1',
                game_id
            )
            
            if not existing:
                raise HTTPException(status_code=404, detail="Game instance not found")
            
            await connection.execute(
                'DELETE FROM public."Game_instance" WHERE game_id = $1',
                game_id
            )

            if existing["host_id"]:
                await apply_progress(
                    connection,
                    user_id=existing["host_id"],
                    sport_id=existing["sport_id"],
                    games_hosted_delta=-1,
                    xp_delta=-XP_REWARDS["host_game"]
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
        # Archive past games automatically before fetching
        try:
            await archive_past_games()
        except Exception as e:
            # Log but don't fail if archiving fails
            print(f"Warning: Failed to archive past games: {e}")
        
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

        # Filter out past games: only show games where start_time + duration_minutes >= NOW()
        conditions.append("(gi.start_time + INTERVAL '1 minute' * gi.duration_minutes) >= NOW()")

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

            # --- Send confirmation email ---
            try:
                # Fetch reporter info
                user_row = await connection.fetchrow(
                    'SELECT email, first_name FROM public."Users" WHERE user_id = $1 LIMIT 1',
                    report.reporter_id
                )
                # Fetch reported user info
                reported_row = await connection.fetchrow(
                    'SELECT first_name FROM public."Users" WHERE user_id = $1 LIMIT 1',
                    report.reported_user_id
                )

                if user_row:
                    user_email = user_row["email"]
                    first_name = user_row["first_name"] or "Player"
                    reported_user_name = reported_row["first_name"] if reported_row else "the user"

                    context = {
                        "first_name": first_name,
                        "report_id": row["report_id"],
                        "reported_user_name": reported_user_name,
                        "reason": report.reason
                    }
                    html = render_template("PlayConnect_API/templates/emails/report_receipt.html", context)
                    await send_email(user_email, "Your report has been received", html)
            except Exception as email_err:
                print(f"[DEV ONLY] Failed to send report receipt email: {repr(email_err)}")

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
    
def _normalize_metadata(value):
    if isinstance(value, str) and value.strip():
        try:
            return json.loads(value)
        except Exception:
            return None
    if isinstance(value, dict) or value is None:
        return value
    return None

def _row_to_notification(row):
    d = dict(row)
    d["metadata"] = _normalize_metadata(d.get("metadata"))
    return NotificationRead(**d)

@app.post("/notifications", response_model=NotificationRead, status_code=201)
async def create_notification(notification: NotificationCreate):
    """
    Create a new notification entry (SCRUM-106)
    """
    try:
        async with Database.pool.acquire() as connection:
            query = '''
                INSERT INTO public."Notifications" (user_id, message, type, metadata, is_read, created_at)
                VALUES ($1, $2, $3, $4::jsonb, $5, NOW())
                RETURNING notification_id, user_id, message, type, metadata, is_read, created_at
            '''
            meta_value = None
            if notification.metadata is not None:
                # store as JSON string when column is TEXT
                meta_value = json.dumps(notification.metadata)

            row = await connection.fetchrow(
                query,
                notification.user_id,
                notification.message,
                notification.type,
                meta_value,
                notification.is_read
            )
            # 🔧 normalize metadata to dict for the schema
            data = dict(row)
            val = data.get("metadata")
            if isinstance(val, str) and val.strip():
                try:
                    data["metadata"] = json.loads(val)
                except Exception:
                    data["metadata"] = None
            # if it's already a dict (depending on driver), it's fine
            return NotificationRead(**data)
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

            notifications = [_row_to_notification(r) for r in rows]
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
            
            return _row_to_notification(row)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/notifications", response_model=List[NotificationRead])
async def list_notifications(
    user_id: int = Query(..., description="Target user"),
    unread_only: bool = Query(False),
    since_id: Optional[int] = Query(None, description="Return rows with id > since_id"),
    limit: int = Query(20, ge=1, le=100),
):
    try:
        async with Database.pool.acquire() as conn:
            clauses = ['user_id = $1']
            params = [user_id]
            idx = 2

            if unread_only:
                clauses.append('is_read = FALSE')
            if since_id is not None:
                clauses.append(f'notification_id > ${idx}')
                params.append(since_id); idx += 1

            where_sql = " AND ".join(clauses)
            rows = await conn.fetch(
                f'''
                SELECT notification_id, user_id, message, type, metadata, is_read, created_at
                FROM public."Notifications"
                WHERE {where_sql}
                ORDER BY notification_id DESC
                LIMIT ${idx}
                ''',
                *params, limit
            )
            return [NotificationRead(**dict(r)) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.patch("/notifications/{notification_id}/read", response_model=NotificationRead)
async def mark_notification_read(notification_id: int):
    try:
        async with Database.pool.acquire() as conn:
            row = await conn.fetchrow(
                '''
                UPDATE public."Notifications"
                SET is_read = TRUE
                WHERE notification_id = $1
                RETURNING notification_id, user_id, message, type, metadata, is_read, created_at
                ''',
                notification_id
            )
            if not row:
                raise HTTPException(status_code=404, detail="Notification not found")
            return NotificationRead(**dict(row))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/notifications/unread_count")
async def unread_count(user_id: int = Query(...)):
    try:
        async with Database.pool.acquire() as conn:
            cnt = await conn.fetchval(
                'SELECT COUNT(*) FROM public."Notifications" WHERE user_id = $1 AND is_read = FALSE',
                user_id
            )
            return {"user_id": user_id, "unread_count": int(cnt)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    
@app.get("/match-histories", response_model=List[MatchHistoryRead])
async def get_match_histories(
    user_id: Union[int, None] = None,
    player_id: Union[int, None] = None,
    opponent_id: Union[int, None] = None,
    limit: int = 50,
    offset: int = 0,
):
    """
    Retrieve match history records, optionally filtered by user_id (shows matches where user is player_id OR opponent_id).
    If user_id is provided, it takes precedence over player_id/opponent_id.
    """
    try:
        async with Database.pool.acquire() as connection:
            # Filter to show only matches where the user participated
            # Match histories are only created from games the user joined (from Game_participants)
            # Group by game (played_at, location, cost, duration_minutes) to show one entry per game
            if user_id is not None:
                # Use DISTINCT ON to get one match per game (grouped by played_at, location, cost, duration_minutes)
                # This ensures users see one entry per game they joined, not one per opponent
                # DISTINCT ON requires ORDER BY to start with the DISTINCT ON columns
                base_query = """
                    SELECT DISTINCT ON (played_at, location, COALESCE(cost, 0), duration_minute)
                           match_id, player_id, opponent_id, score_player, score_opponent,
                           result, duration_minute AS duration_minutes, location, cost, played_at
                    FROM public."Match_Histories"
                    WHERE (player_id = $1 OR opponent_id = $2)
                    ORDER BY played_at DESC, location, COALESCE(cost, 0), duration_minute, match_id
                """
                params = [user_id, user_id]
            elif player_id is not None:
                base_query = """
                    SELECT DISTINCT ON (played_at, location, COALESCE(cost, 0), duration_minute)
                           match_id, player_id, opponent_id, score_player, score_opponent,
                           result, duration_minute AS duration_minutes, location, cost, played_at
                    FROM public."Match_Histories"
                    WHERE player_id = $1
                    ORDER BY played_at DESC, location, COALESCE(cost, 0), duration_minute, match_id
                """
                params = [player_id]
            elif opponent_id is not None:
                base_query = """
                    SELECT DISTINCT ON (played_at, location, COALESCE(cost, 0), duration_minute)
                           match_id, player_id, opponent_id, score_player, score_opponent,
                           result, duration_minute AS duration_minutes, location, cost, played_at
                    FROM public."Match_Histories"
                    WHERE opponent_id = $1
                    ORDER BY played_at DESC, location, COALESCE(cost, 0), duration_minute, match_id
                """
                params = [opponent_id]
            else:
                # No filter provided - return empty (security: don't show all matches)
                return []
            
            # Wrap in subquery to apply LIMIT and OFFSET after DISTINCT ON
            query = f"""
                SELECT * FROM (
                    {base_query}
                ) AS distinct_matches
                ORDER BY played_at DESC
                LIMIT {limit} OFFSET {offset}
            """

            # Debug: print query and params
            print(f"DEBUG Query: {query}")
            print(f"DEBUG Params: {params}")
            
            rows = await connection.fetch(query, *params)
            # Convert Decimal cost to float for JSON serialization (like dashboard endpoint)
            matches = []
            for row in rows:
                match_dict = dict(row)
                if match_dict.get("cost") is not None:
                    try:
                        match_dict["cost"] = float(match_dict["cost"])
                    except Exception:
                        pass
                matches.append(MatchHistoryRead(**match_dict))
            return matches

    except Exception as e:
        import traceback
        error_detail = str(e)
        error_type = type(e).__name__
        traceback.print_exc()
        print(f"ERROR in get_match_histories: {error_type}: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch match histories: {error_type}: {error_detail}")


@app.get("/match-history/{user_id}", response_model=List[MatchHistoryRead])
async def get_match_history_by_user(user_id: int, limit: int = 50, offset: int = 0):
    """
    Get match history for a specific user.
    Only returns matches where the user participated (user is either player_id OR opponent_id).
    This ensures only games the user actually joined are shown.
    """
    # Ensure user_id is always provided to filter by user
    return await get_match_histories(user_id=user_id, limit=limit, offset=offset)


@app.post("/archive-past-games")
async def archive_past_games():
    """
    Archive past games to Match_Histories table and remove them from Game_instance.
    This creates match history entries for each pair of participants in past games.
    """
    try:
        async with Database.pool.acquire() as connection:
            # Find all past games (where start_time + duration_minutes < NOW())
            # Note: Table name might be case-sensitive, try both variations
            past_games_query = """
                SELECT game_id, host_id, sport_id, start_time, duration_minutes, location, cost
                FROM public."Game_instance"
                WHERE (start_time + INTERVAL '1 minute' * duration_minutes) < NOW()
            """
            past_games = await connection.fetch(past_games_query)
            
            print(f"DEBUG: Found {len(past_games)} past games to archive")
            
            # Also check total games for debugging
            total_games = await connection.fetchval('SELECT COUNT(*) FROM public."Game_instance"')
            print(f"DEBUG: Total games in database: {total_games}")
            
            # Check current time for debugging
            current_time = await connection.fetchval('SELECT NOW()')
            print(f"DEBUG: Current time: {current_time}")
            
            archived_count = 0
            deleted_count = 0
            
            for game in past_games:
                print(f"DEBUG: Processing game_id={game['game_id']}")
                game_id = game['game_id']
                
                # Get all participants for this game
                participants_query = """
                    SELECT user_id
                    FROM public."Game_participants"
                    WHERE game_id = $1
                    ORDER BY user_id
                """
                participants = await connection.fetch(participants_query, game_id)
                
                print(f"DEBUG: Game {game_id} has {len(participants)} participants")
                
                if len(participants) < 2:
                    # Skip games with less than 2 participants
                    print(f"DEBUG: Skipping game {game_id} - less than 2 participants")
                    continue
                
                # Create match history entries for each pair of participants
                participant_ids = [p['user_id'] for p in participants]
                played_at = game['start_time']
                duration_minutes = game['duration_minutes']
                location = game.get('location')
                cost = game.get('cost')
                
                # Create entries for each pair (avoid duplicates)
                for i in range(len(participant_ids)):
                    for j in range(i + 1, len(participant_ids)):
                        player_id = participant_ids[i]
                        opponent_id = participant_ids[j]
                        
                        # Check if this match history already exists
                        check_query = """
                            SELECT match_id FROM public."Match_Histories"
                            WHERE player_id = $1 AND opponent_id = $2
                            AND played_at = $3
                        """
                        existing = await connection.fetchrow(
                            check_query, player_id, opponent_id, played_at
                        )
                        
                        if not existing:
                            # Insert match history (note: column is duration_minute, not duration_minutes)
                            # Use default values since columns have NOT NULL constraints
                            insert_query = """
                                INSERT INTO public."Match_Histories"
                                (player_id, opponent_id, score_player, score_opponent, 
                                 result, duration_minute, location, cost, played_at)
                                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                            """
                            print(f"DEBUG: Inserting match history: player_id={player_id}, opponent_id={opponent_id}, location={location}, cost={cost}, played_at={played_at}")
                            await connection.execute(
                                insert_query,
                                player_id,
                                opponent_id,
                                0,  # score_player (default to 0 since NOT NULL)
                                0,  # score_opponent (default to 0 since NOT NULL)
                                'draw',  # result (default to 'draw' since NOT NULL - can be updated later)
                                duration_minutes,
                                location,  # location from game
                                cost,  # cost from game
                                played_at
                            )
                            archived_count += 1
                            print(f"DEBUG: Successfully inserted match history entry")
                
                # Delete associated records that reference this game first
                # Delete reports that reference this game
                delete_reports_query = """
                    DELETE FROM public."Reports"
                    WHERE report_game_id = $1
                """
                reports_deleted = await connection.execute(delete_reports_query, game_id)
                print(f"DEBUG: Deleted reports for game {game_id}: {reports_deleted}")
                
                # Delete game participants (they should cascade, but being explicit)
                delete_participants_query = """
                    DELETE FROM public."Game_participants"
                    WHERE game_id = $1
                """
                participants_deleted = await connection.execute(delete_participants_query, game_id)
                print(f"DEBUG: Deleted participants for game {game_id}: {participants_deleted}")
                
                # Now delete the game instance after archiving
                delete_query = """
                    DELETE FROM public."Game_instance"
                    WHERE game_id = $1
                """
                await connection.execute(delete_query, game_id)
                deleted_count += 1
                print(f"DEBUG: Deleted game instance {game_id}")
            
            print(f"DEBUG: Archive complete - {archived_count} match histories created, {deleted_count} games deleted")
            
            return {
                "message": "Past games archived successfully",
                "games_archived": archived_count,
                "games_deleted": deleted_count,
                "past_games_found": len(past_games)
            }
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to archive past games: {str(e)}")
    

# ===============================
# FRIENDS API (one-row per friendship)
# - requester stored as user_id, receiver as friend_id
# - create -> inserts 'pending'
# - accept -> updates to 'accepted'
# - reject -> deletes the pending row
# - responses include ONLY the "other" user's profile in `friend`
# ===============================


# ---------- Response DTOs for UI ----------
class FriendPerson(BaseModel):
    user_id: int
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    avatar_url: Optional[str] = None
    favorite_sport: Optional[str] = None
    mutual_count: int = 0


class FriendEdge(BaseModel):
    status: str
    created_at: Optional[datetime] = None
    friend: FriendPerson

# ---------- Request bodies ----------
class FriendCreateBody(BaseModel):
    user_id: int      # requester
    friend_id: int    # receiver

class FriendStatusBody(BaseModel):
    user_id: int      # requester
    friend_id: int    # receiver
    status: str       # 'accepted' or 'rejected' (rejected => delete)

# -------------------------------
# POST /friends  -> Send request (one row, no symmetry)
# -------------------------------
@app.post("/friends", response_model=FriendEdge, status_code=201)
async def create_friend(payload: FriendCreateBody):
    """
    Create a friend request:
      - ONE row only: (user_id=requester, friend_id=receiver, status='pending')
      - Prevent duplicates between same two users (any direction)
      - Prevent self-requests
      - Returns the row with the OTHER user's profile in `friend`
    """
    if payload.user_id == payload.friend_id:
        raise HTTPException(status_code=400, detail="user_id and friend_id must be different")

    try:
        async with Database.pool.acquire() as connection:
            # Block if any row exists between the same pair (either direction)
            exists = await connection.fetchrow(
                '''
                SELECT 1
                FROM public."Friends"
                WHERE (user_id = $1 AND friend_id = $2)
                   OR (user_id = $2 AND friend_id = $1)
                LIMIT 1
                ''',
                payload.user_id, payload.friend_id
            )
            if exists:
                raise HTTPException(status_code=409, detail="Friendship already exists or pending")

            # Insert pending request
            row = await connection.fetchrow(
                '''
                INSERT INTO public."Friends" (user_id, friend_id, status, created_at)
                VALUES ($1, $2, 'pending', NOW())
                RETURNING user_id, friend_id, status, created_at
                ''',
                payload.user_id, payload.friend_id
            )

            # Return with OTHER user's profile (receiver is the other)
            other = await connection.fetchrow(
                '''
                SELECT u.user_id, u.email, u.first_name, u.last_name, u.avatar_url, u.favorite_sport
                FROM public."Users" AS u
                WHERE u.user_id = $1
                ''',
                payload.friend_id
            )
            return {
                "status": row["status"],
                "created_at": row["created_at"],
                "friend": dict(other) if other else None
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -------------------------------
# PUT /friends/status  -> Accept or Reject
# -------------------------------
@app.put("/friends/status", response_model=Union[FriendEdge, dict])
async def update_friend_status(body: FriendStatusBody):
    """
    Accept or reject a friend request from user_id -> friend_id.
      - 'accepted' => update same row to accepted and return OTHER profile (receiver sees requester)
      - 'rejected' => delete the row and return {message}
    """
    if body.status not in ("accepted", "rejected"):
        raise HTTPException(status_code=400, detail="status must be 'accepted' or 'rejected'")

    try:
        async with Database.pool.acquire() as connection:
            # Ensure the pending row exists in the REQUEST direction
            pending = await connection.fetchrow(
                '''
                SELECT user_id, friend_id, status, created_at
                FROM public."Friends"
                WHERE user_id = $1 AND friend_id = $2
                LIMIT 1
                ''',
                body.user_id, body.friend_id
            )
            if not pending:
                raise HTTPException(status_code=404, detail="Friend request not found")

            if body.status == "rejected":
                if pending["status"] != "pending":
                    raise HTTPException(status_code=409, detail="Cannot reject a non-pending request")
                await connection.execute(
                    '''
                    DELETE FROM public."Friends"
                    WHERE user_id = $1 AND friend_id = $2
                    ''',
                    body.user_id, body.friend_id
                )
                return {"message": "Friend request rejected and removed."}

            if pending["status"] == "accepted":
                other = await connection.fetchrow(
                    '''
                    SELECT u.user_id, u.email, u.first_name, u.last_name, u.avatar_url, u.favorite_sport
                    FROM public."Users" AS u
                    WHERE u.user_id = $1
                    ''',
                    body.user_id
                )
                return {
                    "status": pending["status"],
                    "created_at": pending["created_at"],
                    "friend": dict(other) if other else None
                }

            # Accept: update same row
            updated = await connection.fetchrow(
                '''
                UPDATE public."Friends"
                SET status = 'accepted'
                WHERE user_id = $1 AND friend_id = $2
                RETURNING user_id, friend_id, status, created_at
                ''',
                body.user_id, body.friend_id
            )

            await apply_progress(
                connection,
                user_id=body.user_id,
                sport_id=0,
                xp_delta=XP_REWARDS["friend_accept"]
            )
            await apply_progress(
                connection,
                user_id=body.friend_id,
                sport_id=0,
                xp_delta=XP_REWARDS["friend_accept"]
            )

            # For the receiver (friend_id), the OTHER user is the requester (user_id)
            other = await connection.fetchrow(
                '''
                SELECT u.user_id, u.email, u.first_name, u.last_name, u.avatar_url, u.favorite_sport
                FROM public."Users" AS u
                WHERE u.user_id = $1
                ''',
                body.user_id
            )
            return {
                "status": updated["status"],
                "created_at": updated["created_at"],
                "friend": dict(other) if other else None
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -------------------------------
# DELETE /friends  -> Unfriend or Reject (generic)
# -------------------------------
@app.delete("/friends", status_code=200)
async def delete_friend(user_id: int, friend_id: int):
    """
    Delete the friendship/request row between two users (any direction).
    Use this for: unfriend OR rejecting (if you don't call /friends/status).
    """
    if user_id == friend_id:
        raise HTTPException(status_code=400, detail="user_id and friend_id must be different")

    try:
        async with Database.pool.acquire() as connection:
            result = await connection.execute(
                '''
                DELETE FROM public."Friends"
                WHERE (user_id = $1 AND friend_id = $2)
                   OR (user_id = $2 AND friend_id = $1)
                ''',
                user_id, friend_id
            )
        deleted = int(result.split()[-1]) if result else 0
        if deleted == 0:
            raise HTTPException(status_code=404, detail="No friendship found")
        return {"deleted": deleted}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -------------------------------
# GET /friends/my  -> Accepted friends for me (include OTHER profile)
# -------------------------------
@app.get("/friends/my", response_model=List[FriendEdge])
async def my_friends(user_id: int):
    """
    Return accepted friendships for user_id (either direction),
    with ONLY the OTHER user's profile in `friend`.
    """
    try:
        async with Database.pool.acquire() as connection:
            rows = await connection.fetch(
                '''
                WITH edges AS (
                  SELECT
                    CASE WHEN f.user_id = $1 THEN f.friend_id ELSE f.user_id END AS other_id,
                    f.status, f.created_at
                  FROM public."Friends" f
                  WHERE f.status = 'accepted'
                    AND ($1 = f.user_id OR $1 = f.friend_id)
                )
                SELECT e.status, e.created_at,
                       u.user_id, u.email, u.first_name, u.last_name, u.avatar_url, u.favorite_sport
                FROM edges e
                JOIN public."Users" u ON u.user_id = e.other_id
                ORDER BY e.created_at DESC
                ''',
                user_id
            )
            return [
                {
                    "status": r["status"],
                    "created_at": r["created_at"],
                    "friend": {
                        "user_id": r["user_id"],
                        "email": r["email"],
                        "first_name": r["first_name"],
                        "last_name": r["last_name"],
                        "avatar_url": r["avatar_url"],
                        "favorite_sport": r["favorite_sport"],
                    }
                }
                for r in rows
            ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -------------------------------
# GET /friends/requests  -> Pending requests RECEIVED by me
# -------------------------------
@app.get("/friends/requests", response_model=List[FriendEdge])
async def requests_received(user_id: int):
    """
    Pending requests RECEIVED by user_id.
    Shows ONLY the OTHER user (the requester) in `friend`.
    """
    try:
        async with Database.pool.acquire() as connection:
            rows = await connection.fetch(
                '''
                SELECT f.status, f.created_at,
                       u.user_id, u.email, u.first_name, u.last_name, u.avatar_url, u.favorite_sport
                FROM public."Friends" f
                JOIN public."Users"  u ON u.user_id = f.user_id
                WHERE f.status = 'pending' AND f.friend_id = $1
                ORDER BY f.created_at DESC
                ''',
                user_id
            )
            return [
                {
                    "status": r["status"],
                    "created_at": r["created_at"],
                    "friend": {
                        "user_id": r["user_id"],
                        "email": r["email"],
                        "first_name": r["first_name"],
                        "last_name": r["last_name"],
                        "avatar_url": r["avatar_url"],
                        "favorite_sport": r["favorite_sport"],
                    }
                }
                for r in rows
            ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -------------------------------
# GET /friends/find  -> Users with NO relation to me (discover)
# -------------------------------
@app.get("/friends/find", response_model=List[FriendPerson])
async def find_friends(user_id: int, query: Union[str, None] = None, limit: int = 20, offset: int = 0):
    """
    Users not already connected to user_id in any status and not me.
    Returns candidate users with a real mutual_count (accepted↔accepted).
    """
    try:
        async with Database.pool.acquire() as connection:
            sql = f'''
                WITH my_friends AS (
                    -- all accepted friends of the current user (as other_id)
                    SELECT CASE WHEN f.user_id = $1 THEN f.friend_id ELSE f.user_id END AS other_id
                    FROM public."Friends" AS f
                    WHERE f.status = 'accepted' AND ($1 = f.user_id OR $1 = f.friend_id)
                ),
                candidates AS (
                    -- all users who are NOT me and have NO relation (any status) with me
                    SELECT u.user_id, u.email, u.first_name, u.last_name, u.avatar_url, u.favorite_sport
                    FROM public."Users" AS u
                    WHERE u.user_id <> $1
                      AND NOT EXISTS (
                        SELECT 1
                        FROM public."Friends" AS f
                        WHERE (f.user_id = $1 AND f.friend_id = u.user_id)
                           OR (f.user_id = u.user_id AND f.friend_id = $1)
                      )
                )
                SELECT
                    c.user_id, c.email, c.first_name, c.last_name, c.avatar_url, c.favorite_sport,
                    COALESCE((
                        SELECT COUNT(*)
                        FROM my_friends mf
                        JOIN public."Friends" f2
                          ON f2.status = 'accepted'
                         AND (
                               (f2.user_id = c.user_id AND f2.friend_id = mf.other_id)
                            OR (f2.user_id = mf.other_id AND f2.friend_id = c.user_id)
                         )
                    ), 0) AS mutual_count
                FROM candidates c
                { "WHERE (c.email ILIKE $" + str(2) + " OR c.first_name ILIKE $" + str(2) + " OR c.last_name ILIKE $" + str(2) + ")" if query else "" }
                ORDER BY c.user_id DESC
                LIMIT {limit} OFFSET {offset}
            '''
            params = [user_id]
            if query:
                params.append(f"%{query}%")

            rows = await connection.fetch(sql, *params)
            return [FriendPerson(**dict(r)) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -------------------------------
# GET /friends/sent  -> Pending requests I SENT
# -------------------------------
@app.get("/friends/sent", response_model=List[FriendEdge])
async def requests_sent(user_id: int):
    """
    Pending requests SENT by user_id.
    Shows ONLY the OTHER user (the receiver) in `friend`.
    Same structure as /friends/requests for consistent frontend use.
    """
    try:
        async with Database.pool.acquire() as connection:
            rows = await connection.fetch(
                '''
                SELECT f.status, f.created_at,
                       u.user_id, u.email, u.first_name, u.last_name, u.avatar_url, u.favorite_sport
                FROM public."Friends" f
                JOIN public."Users" u ON u.user_id = f.friend_id
                WHERE f.status = 'pending' AND f.user_id = $1
                ORDER BY f.created_at DESC
                ''',
                user_id
            )

            return [
                {
                    "status": r["status"],
                    "created_at": r["created_at"],
                    "friend": {
                        "user_id": r["user_id"],
                        "email": r["email"],
                        "first_name": r["first_name"],
                        "last_name": r["last_name"],
                        "avatar_url": r["avatar_url"],
                        "favorite_sport": r["favorite_sport"],
                    },
                }
                for r in rows
            ]

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ====================
# USER BADGE ENDPOINTS
# ====================
@app.get("/user_badges", response_model=List[UserBadgeRead])
async def list_user_badges(
    user_id: Optional[int] = Query(None),
    only_unseen: bool = Query(False)
):
    """
    Return user badges, optionally filtered by user and unseen status.
    """
    try:
        async with Database.pool.acquire() as connection:
            if user_id is not None:
                await ensure_user_badges(connection, user_id)

            sql = '''
                SELECT id, user_id, badge_name, earned_on, seen
                FROM public."user_badges"
            '''
            clauses = []
            params: List = []
            if user_id is not None:
                params.append(user_id)
                clauses.append(f"user_id = ${len(params)}")
            if only_unseen:
                params.append(False)
                clauses.append(f"seen = ${len(params)}")
            if clauses:
                sql += " WHERE " + " AND ".join(clauses)
            sql += " ORDER BY earned_on DESC, id DESC"

            rows = await connection.fetch(sql, *params)
            return [UserBadgeRead(**dict(row)) for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/user_badges/{badge_id}", response_model=UserBadgeRead)
async def get_user_badge(badge_id: int):
    try:
        async with Database.pool.acquire() as connection:
            row = await connection.fetchrow(
                '''
                SELECT id, user_id, badge_name, earned_on, seen
                FROM public."user_badges"
                WHERE id = $1
                ''',
                badge_id
            )
            if not row:
                raise HTTPException(status_code=404, detail="Badge not found")
            return UserBadgeRead(**dict(row))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/user_badges", response_model=UserBadgeRead, status_code=201)
async def create_user_badge(badge: UserBadgeCreate):
    try:
        async with Database.pool.acquire() as connection:
            row = await connection.fetchrow(
                '''
                INSERT INTO public."user_badges" (user_id, badge_name, earned_on, seen)
                VALUES ($1, $2, $3, $4)
                RETURNING id, user_id, badge_name, earned_on, seen
                ''',
                badge.user_id,
                badge.badge_name,
                badge.earned_on or datetime.utcnow(),
                badge.seen
            )
            return UserBadgeRead(**dict(row))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/user_badges/{badge_id}", response_model=UserBadgeRead)
async def update_user_badge(badge_id: int, updates: UserBadgeUpdate):
    try:
        data = updates.dict(exclude_unset=True)
        if not data:
            raise HTTPException(status_code=400, detail="No fields to update")

        set_clauses = []
        params: List = []
        for field, value in data.items():
            params.append(value)
            set_clauses.append(f'{field} = ${len(params)}')

        params.append(badge_id)
        query = f'''
            UPDATE public."user_badges"
            SET {", ".join(set_clauses)}
            WHERE id = ${len(params)}
            RETURNING id, user_id, badge_name, earned_on, seen
        '''

        async with Database.pool.acquire() as connection:
            row = await connection.fetchrow(query, *params)
            if not row:
                raise HTTPException(status_code=404, detail="Badge not found")
            return UserBadgeRead(**dict(row))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/user_badges/{badge_id}", status_code=200)
async def delete_user_badge(badge_id: int):
    try:
        async with Database.pool.acquire() as connection:
            result = await connection.execute(
                'DELETE FROM public."user_badges" WHERE id = $1',
                badge_id
            )
            deleted = int(result.split()[-1]) if result else 0
            if deleted == 0:
                raise HTTPException(status_code=404, detail="Badge not found")
            return {"deleted": deleted}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========================
# ACTIVITY LOG ENDPOINTS
# ========================
@app.get("/activity_logs", response_model=List[ActivityLogRead])
async def list_activity_logs(
    user_id: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0)
):
    """
    Fetch activity logs ordered by most recent.
    """
    try:
        async with Database.pool.acquire() as connection:
            sql = '''
                SELECT id, user_id, action, created_at
                FROM public."activity_logs"
            '''
            clauses = []
            params: List = []
            if user_id is not None:
                params.append(user_id)
                clauses.append(f"user_id = ${len(params)}")
            if clauses:
                sql += " WHERE " + " AND ".join(clauses)
            sql += " ORDER BY created_at DESC, id DESC LIMIT $%d OFFSET $%d" % (len(params) + 1, len(params) + 2)

            params.extend([limit, offset])
            rows = await connection.fetch(sql, *params)
            return [ActivityLogRead(**dict(row)) for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/activity_logs/{log_id}", response_model=ActivityLogRead)
async def get_activity_log(log_id: int):
    try:
        async with Database.pool.acquire() as connection:
            row = await connection.fetchrow(
                '''
                SELECT id, user_id, action, created_at
                FROM public."activity_logs"
                WHERE id = $1
                ''',
                log_id
            )
            if not row:
                raise HTTPException(status_code=404, detail="Activity log not found")
            return ActivityLogRead(**dict(row))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/activity_logs", response_model=ActivityLogRead, status_code=201)
async def create_activity_log(entry: ActivityLogCreate):
    try:
        async with Database.pool.acquire() as connection:
            row = await connection.fetchrow(
                '''
                INSERT INTO public."activity_logs" (user_id, action, created_at)
                VALUES ($1, $2, $3)
                RETURNING id, user_id, action, created_at
                ''',
                entry.user_id,
                entry.action,
                entry.created_at or datetime.utcnow()
            )
            return ActivityLogRead(**dict(row))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/activity_logs/{log_id}", response_model=ActivityLogRead)
async def update_activity_log(log_id: int, updates: ActivityLogUpdate):
    try:
        data = updates.dict(exclude_unset=True)
        if not data:
            raise HTTPException(status_code=400, detail="No fields to update")

        set_clauses = []
        params: List = []
        for field, value in data.items():
            params.append(value)
            set_clauses.append(f'{field} = ${len(params)}')

        params.append(log_id)
        query = f'''
            UPDATE public."activity_logs"
            SET {", ".join(set_clauses)}
            WHERE id = ${len(params)}
            RETURNING id, user_id, action, created_at
        '''

        async with Database.pool.acquire() as connection:
            row = await connection.fetchrow(query, *params)
            if not row:
                raise HTTPException(status_code=404, detail="Activity log not found")
            return ActivityLogRead(**dict(row))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/activity_logs/{log_id}", status_code=200)
async def delete_activity_log(log_id: int):
    try:
        async with Database.pool.acquire() as connection:
            result = await connection.execute(
                'DELETE FROM public."activity_logs" WHERE id = $1',
                log_id
            )
            deleted = int(result.split()[-1]) if result else 0
            if deleted == 0:
                raise HTTPException(status_code=404, detail="Activity log not found")
            return {"deleted": deleted}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
