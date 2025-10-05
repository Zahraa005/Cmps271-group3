
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

pool: asyncpg.pool.Pool = None

async def connect_to_db():
    global pool
    # Many managed Postgres providers (e.g., Neon Session mode) have strict client limits.
    # Use a very small pool in dev unless overridden by env.
    min_size = int(os.getenv("DB_POOL_MIN", "1"))
    max_size = int(os.getenv("DB_POOL_MAX", "2"))
    pool = await asyncpg.create_pool(
        DATABASE_URL,
        min_size=min_size,
        max_size=max_size,
        command_timeout=60,
        max_inactive_connection_lifetime=300,
    )

async def disconnect_db():
    global pool
    if pool is not None:
        await pool.close()
        pool = None
