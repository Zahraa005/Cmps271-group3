from typing import Union, List
from fastapi import FastAPI, Depends
from PlayConnect_API.schemas.Users import UserRead
import asyncpg
from PlayConnect_API.Database import connect_to_db, disconnect_db
from PlayConnect_API import Database
from fastapi import HTTPException

app = FastAPI()

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
    
