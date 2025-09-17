from typing import Union, List
import asyncpg
from fastapi import FastAPI, Depends, HTTPException
from PlayConnect_API.schemas.Users import UserRead, UserCreate
from PlayConnect_API.Database import connect_to_db, disconnect_db
from PlayConnect_API import Database

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
    
