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
# 2. CORE USER & ENERGY TRANSACTIONS
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
            "max_energy": 5,
            "unlocked_badges": []  # Kilit açılan rozet id'leri (['moon', 'flame'])
        }
        
        insert_response = supabase.table("slaves").insert(new_slave).execute()
        return insert_response.data[0]
        
    except Exception as e:
        print(f"Database transaction error in get_or_create_slave: {e}")
        return {}

def add_energy(telegram_id: int, amount: int) -> bool:
    """
    Safely increments user energy upon a successful Telegram Stars purchase or ad watch.
    """
    try:
        response = supabase.table("slaves").select("energy").eq("telegram_id", telegram_id).execute()
        
        if response.data:
            current_energy = response.data[0].get("energy", 0)
            new_energy = current_energy + amount
            
            supabase.table("slaves").update({"energy": new_energy}).eq("telegram_id", telegram_id).execute()
            print(f"Success: Added {amount} energy to {telegram_id}. New Energy Balance: {new_energy}")
            return True
            
        return False
    except Exception as e:
        print(f"Database error in add_energy: {e}")
        return False

# ==========================================================================
# 3. BADGES & ACHIEVEMENTS SYSTEM
# ==========================================================================
def unlock_badge(telegram_id: int, badge_id: str) -> bool:
    """
    Unlocks a badge for the user and saves it to their profile if not already unlocked.
    """
    try:
        response = supabase.table("slaves").select("unlocked_badges").eq("telegram_id", telegram_id).execute()
        if response.data:
            badges = response.data[0].get("unlocked_badges", []) or []
            if badge_id not in badges:
                badges.append(badge_id)
                supabase.table("slaves").update({"unlocked_badges": badges}).eq("telegram_id", telegram_id).execute()
                print(f"Success: Badge '{badge_id}' unlocked for {telegram_id}")
                return True
        return False
    except Exception as e:
        print(f"Error unlocking badge: {e}")
        return False

# ==========================================================================
# 4. CREATORS & LOCKED GALLERY SYSTEM
# ==========================================================================
def get_all_creators() -> list:
    """
    Fetches all active content creators (Yıldızlar) for the vitrine.
    """
    try:
        response = supabase.table("creators").select("*").execute()
        return response.data if response.data else []
    except Exception as e:
        print(f"Error fetching creators: {e}")
        return []

def get_creator_gallery(creator_id: str) -> list:
    """
    Fetches all gallery items/contents belonging to a specific creator.
    """
    try:
        response = supabase.table("contents").select("*").eq("creator_id", creator_id).execute()
        return response.data if response.data else []
    except Exception as e:
        print(f"Error fetching gallery for creator {creator_id}: {e}")
        return []

def unlock_content(telegram_id: int, content_id: str, cost: int, payment_type: str = "POINTS") -> dict:
    """
    Handles unlocking a locked image/content using Elmas (POINTS) or Telegram Stars (STARS).
    """
    try:
        # Check if already purchased
        already_bought = supabase.table("purchases").select("*").eq("user_id", telegram_id).eq("content_id", content_id).execute()
        if already_bought.data:
            return {"success": True, "message": "Already unlocked!"}

        # Fetch user's current balance
        user_res = supabase.table("slaves").select("total_points").eq("telegram_id", telegram_id).execute()
        if not user_res.data:
            return {"success": False, "message": "User not found!"}

        current_points = user_res.data[0].get("total_points", 0)

        if payment_type == "POINTS":
            if current_points < cost:
                return {"success": False, "message": "Yetersiz Elmas Bakiyesi!"}
            
            # Deduct points
            new_points = current_points - cost
            supabase.table("slaves").update({"total_points": new_points}).eq("telegram_id", telegram_id).execute()

        # Add transaction record
        new_purchase = {
            "user_id": telegram_id,
            "content_id": content_id,
            "payment_type": payment_type
        }
        supabase.table("purchases").insert(new_purchase).execute()

        return {"success": True, "message": "Kilit başarıyla açıldı!"}

    except Exception as e:
        print(f"Error unlocking content: {e}")
        return {"success": False, "message": str(e)}