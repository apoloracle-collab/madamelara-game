import os
from supabase import create_client, Client
from dotenv import load_dotenv

# ==========================================================================
# 1. ENVIRONMENT LOAD & SUPABASE INITIALIZATION
# ==========================================================================
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("CRITICAL ERROR: Missing Supabase configuration! Please check your .env file.")

# Initialize the global Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ==========================================================================
# 2. DATABASE TRANSACTION FUNCTIONS
# ==========================================================================
def get_or_create_slave(telegram_id: int, username: str) -> dict:
    """
    Fetches a user by their Telegram ID. If they do not exist,
    creates a new record with default starting values to sync with app.js.
    """
    try:
        # Attempt to fetch existing user
        response = supabase.table("slaves").select("*").eq("telegram_id", telegram_id).execute()
        
        if response.data:
            return response.data[0]
        
        # User does not exist, prepare default initialization payload
        new_slave = {
            "telegram_id": telegram_id,
            "username": username if username else "Unknown_Slave",
            "total_points": 0,
            "active_multiplier": 1.0,
            "energy": 5,        # Aligned with frontend app.js configs
            "max_energy": 5     # Aligned with frontend app.js configs
        }
        
        # Insert new user into the database
        insert_response = supabase.table("slaves").insert(new_slave).execute()
        return insert_response.data[0]
        
    except Exception as e:
        print(f"Database transaction error in get_or_create_slave: {e}")
        return {}

def update_user_interaction(telegram_id: int):
    """
    Placeholder function for tracking user engagement metrics.
    Can be expanded later to track last login times, daily streaks, or activity logs.
    """
    pass