
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

pool: asyncpg.pool.Pool = None

async def connect_to_db():
    global pool
    pool = await asyncpg.create_pool(DATABASE_URL)

async def disconnect_db():
    await pool.close()
