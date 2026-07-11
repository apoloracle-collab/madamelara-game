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
        response = supabase.table("slaves").select("*").eq("telegram_id", telegram_id).execute()
        
        if response.data:
            return response.data[0]
        
        new_slave = {
            "telegram_id": telegram_id,
            "username": username if username else "Unknown_Slave",
            "total_points": 0,
            "active_multiplier": 1.0,
            "energy": 5,        
            "max_energy": 5     
        }
        
        insert_response = supabase.table("slaves").insert(new_slave).execute()
        return insert_response.data[0]
        
    except Exception as e:
        print(f"Database transaction error in get_or_create_slave: {e}")
        return {}

def add_energy(telegram_id: int, amount: int) -> bool:
    """
    Safely increments user energy upon a successful Telegram Stars purchase.
    """
    try:
        # Fetch the current energy status from database
        response = supabase.table("slaves").select("energy").eq("telegram_id", telegram_id).execute()
        
        if response.data:
            current_energy = response.data[0].get("energy", 0)
            
            # Add purchased amount to the current stack
            new_energy = current_energy + amount
            
            # Update database status
            supabase.table("slaves").update({"energy": new_energy}).eq("telegram_id", telegram_id).execute()
            print(f"Success: Added {amount} energy to {telegram_id}. New Energy Balance: {new_energy}")
            return True
            
        return False
    except Exception as e:
        print(f"Database error in add_energy: {e}")
        return False