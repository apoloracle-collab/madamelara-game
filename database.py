import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environmental variables from .env file
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Initialize Supabase Client safely
if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase configuration! Please check your .env file.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_or_create_slave(telegram_id: int, username: str -> dict:
    """
    Fetches a slave's data from the database. 
    If the slave doesn't exist, registers them automatically with base default stats.
    """
    try:
        # Check if the slave already exists in the database
        response = supabase.table("slaves").select("*").eq("telegram_id", telegram_id).execute()
        
        if response.data:
            return response.data[0]
        
        # If not found, create a brand new slave profile with your requested rule system
        new_slave = {
            "telegram_id": telegram_id,
            "username": username if username else f"Slave_{telegram_id}",
            "total_points": 0,
            "active_multiplier": 1.0,  # Base Multiplier: x1.0
            "extra_time": 0            # Base extra time: +0 seconds
        }
        
        insert_response = supabase.table("slaves").insert(new_slave).execute()
        return insert_response.data[0]
        
    except Exception as e:
        print(f"[DATABASE ERROR] Error fetching or creating slave: {e}")
        return {}

def update_slave_points(telegram_id: int, points_to_add: int) -> bool:
    """
    Adds diamonds/points to the slave's total balance inside the database.
    """
    try:
        slave = get_or_create_slave(telegram_id, "")
        if not slave:
            return False
            
        new_total = slave["total_points"] + points_to_add
        
        supabase.table("slaves").update({"total_points": new_total}).eq("telegram_id", telegram_id).execute()
        return True
    except Exception as e:
        print(f"[DATABASE ERROR] Failed to update points for {telegram_id}: {e}")
        return False

def apply_shop_boost(telegram_id: int, multiplier_boost: float, time_boost: int) -> bool:
    """
    Updates slave multipliers when they unlock premium items (e.g. +20% multiplier, +30s time)
    """
    try:
        update_data = {
            "active_multiplier": multiplier_boost,
            "extra_time": time_boost
        }
        supabase.table("slaves").update(update_data).eq("telegram_id", telegram_id).execute()
        return True
    except Exception as e:
        print(f"[DATABASE ERROR] Failed to apply shop boost for {telegram_id}: {e}")
        return False