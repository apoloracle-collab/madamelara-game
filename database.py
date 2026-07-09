import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase configuration! Please check your .env file.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_or_create_slave(telegram_id: int, username: str) -> dict:
    try:
        response = supabase.table("slaves").select("*").eq("telegram_id", telegram_id).execute()
        if response.data:
            return response.data[0]
        
        new_slave = {
            "telegram_id": telegram_id,
            "username": username if username else "Unknown Slave",
            "total_points": 0,
            "active_multiplier": 1
        }
        insert_response = supabase.table("slaves").insert(new_slave).execute()
        return insert_response.data[0]
    except Exception as e:
        print(f"Database error in get_or_create_slave: {e}")
        return {}

def update_user_interaction(telegram_id: int):
    pass