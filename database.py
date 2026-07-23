import os
from dotenv import load_dotenv

# ==========================================================================
# 1. ENVIRONMENT LOAD & SUPABASE INITIALIZATION
# ==========================================================================
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        from supabase import create_client, Client
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("✅ Supabase client initialized in database.py")
    except Exception as e:
        print(f"⚠️ Supabase init warning: {e}")

# ==========================================================================
# 2. USER CREATION & DATA SYNC
# ==========================================================================
def get_or_create_slave(telegram_id: int, username: str = "Devotee") -> dict:
    """
    Fetches a user by Telegram ID. If not present, creates a new entry
    compatible with the current Tap-to-Earn engine.
    """
    if not supabase:
        print(f"[DB Local] get_or_create_slave: {telegram_id} - @{username}")
        return {
            "telegram_id": telegram_id,
            "username": username,
            "diamonds": 0,
            "total_points": 0,
            "energy": 500,
            "max_energy": 500
        }

    try:
        response = supabase.table("slaves").select("*").eq("telegram_id", telegram_id).execute()
        
        if response.data and len(response.data) > 0:
            return response.data[0]
        
        # New player template matching game attributes
        new_slave = {
            "telegram_id": telegram_id,
            "username": username if username else "Devotee",
            "diamonds": 0,
            "total_points": 0,
            "energy": 500,        
            "max_energy": 500,
            "active_multiplier": 1.0,
            "multitap_level": 1,
            "energy_level": 1,
            "recharge_level": 1,
            "passive_income_rate": 0,
            "has_autobot": False,
            "unlocked_contents": [],
            "unlocked_badges": []
        }
        
        insert_response = supabase.table("slaves").insert(new_slave).execute()
        print(f"✅ Created new player in Supabase: {telegram_id}")
        return insert_response.data[0] if insert_response.data else new_slave
        
    except Exception as e:
        print(f"Database error in get_or_create_slave: {e}")
        return {}

# ==========================================================================
# 3. DIAMONDS & ENERGY TRANSACTIONS
# ==========================================================================
def add_diamonds(telegram_id: int, amount: int) -> bool:
    """
    Increments both 'diamonds' and legacy 'total_points' for Stars purchases or referrals.
    """
    if not supabase:
        print(f"[DB Local] add_diamonds: {telegram_id} +{amount} 💎")
        return True

    try:
        # Guarantee user existence first
        get_or_create_slave(telegram_id)

        response = supabase.table("slaves").select("diamonds", "total_points").eq("telegram_id", telegram_id).execute()
        
        if response.data and len(response.data) > 0:
            curr_diamonds = response.data[0].get("diamonds", 0) or 0
            curr_points = response.data[0].get("total_points", 0) or 0
            
            new_diamonds = curr_diamonds + amount
            new_points = curr_points + amount
            
            supabase.table("slaves").update({
                "diamonds": new_diamonds,
                "total_points": new_points
            }).eq("telegram_id", telegram_id).execute()
            print(f"✅ Success: Added {amount} diamonds to {telegram_id}. New Balance: {new_diamonds}")
            return True
        return False

    except Exception as e:
        print(f"Database error in add_diamonds: {e}")
        return False

def add_energy(telegram_id: int, amount: int) -> bool:
    """
    Increments player's energy level up to max_energy.
    """
    if not supabase:
        print(f"[DB Local] add_energy: {telegram_id} +{amount} ⚡")
        return True

    try:
        # Guarantee user existence first
        get_or_create_slave(telegram_id)

        response = supabase.table("slaves").select("energy", "max_energy").eq("telegram_id", telegram_id).execute()
        
        if response.data and len(response.data) > 0:
            curr_energy = response.data[0].get("energy", 500) or 500
            max_energy = response.data[0].get("max_energy", 500) or 500
            new_energy = min(max_energy, curr_energy + amount)
            
            supabase.table("slaves").update({"energy": new_energy}).eq("telegram_id", telegram_id).execute()
            print(f"✅ Success: Added {amount} energy to {telegram_id}. New Energy: {new_energy}")
            return True
            
        return False
    except Exception as e:
        print(f"Database error in add_energy: {e}")
        return False

# ==========================================================================
# 4. AUTOBOT & CONTENT UNLOCKING
# ==========================================================================
def activate_autobot(telegram_id: int) -> bool:
    """
    Activates Auto-Obey Bot in Supabase.
    """
    if not supabase:
        print(f"[DB Local] activate_autobot: {telegram_id}")
        return True

    try:
        get_or_create_slave(telegram_id)
        supabase.table("slaves").update({"has_autobot": True}).eq("telegram_id", telegram_id).execute()
        print(f"✅ AutoBot activated for {telegram_id}")
        return True
    except Exception as e:
        print(f"Database error in activate_autobot: {e}")
        return False

def unlock_content(telegram_id: int, content_id: str, cost: int = 0, payment_type: str = "POINTS") -> dict:
    """
    Unlocks secret media content card using Diamonds (POINTS) or Stars (STARS).
    """
    if not supabase:
        return {"success": True, "message": "Unlocked locally!"}

    try:
        # Guarantee user exists in database
        get_or_create_slave(telegram_id)

        user_res = supabase.table("slaves").select("diamonds", "total_points", "unlocked_contents").eq("telegram_id", telegram_id).execute()
        if not user_res.data:
            return {"success": False, "message": "User not found!"}

        user_data = user_res.data[0]
        unlocked = user_data.get("unlocked_contents", []) or []

        if content_id in unlocked:
            return {"success": True, "message": "Already unlocked!"}

        current_diamonds = user_data.get("diamonds", 0) or user_data.get("total_points", 0) or 0

        if payment_type == "POINTS" and cost > 0:
            if current_diamonds < cost:
                return {"success": False, "message": "Insufficient Diamonds balance!"}
            
            new_diamonds = current_diamonds - cost
            supabase.table("slaves").update({
                "diamonds": new_diamonds,
                "total_points": new_diamonds
            }).eq("telegram_id", telegram_id).execute()

        unlocked.append(content_id)
        supabase.table("slaves").update({"unlocked_contents": unlocked}).eq("telegram_id", telegram_id).execute()

        return {"success": True, "message": "Content successfully unlocked!"}

    except Exception as e:
        print(f"Error unlocking content: {e}")
        return {"success": False, "message": str(e)}

# ==========================================================================
# 5. BADGES SYSTEM
# ==========================================================================
def unlock_badge(telegram_id: int, badge_id: str) -> bool:
    """
    Unlocks achievement badge for the user profile.
    """
    if not supabase:
        return True

    try:
        get_or_create_slave(telegram_id)
        response = supabase.table("slaves").select("unlocked_badges").eq("telegram_id", telegram_id).execute()
        if response.data:
            badges = response.data[0].get("unlocked_badges", []) or []
            if badge_id not in badges:
                badges.append(badge_id)
                supabase.table("slaves").update({"unlocked_badges": badges}).eq("telegram_id", telegram_id).execute()
                print(f"✅ Success: Badge '{badge_id}' unlocked for {telegram_id}")
                return True
        return False
    except Exception as e:
        print(f"Error unlocking badge: {e}")
        return False

# ==========================================================================
# 6. CREATORS & GALLERY (Legacy / Vitrine support)
# ==========================================================================
def get_all_creators() -> list:
    if not supabase:
        return []
    try:
        response = supabase.table("creators").select("*").execute()
        return response.data if response.data else []
    except Exception as e:
        print(f"Error fetching creators: {e}")
        return []

def get_creator_gallery(creator_id: str) -> list:
    if not supabase:
        return []
    try:
        response = supabase.table("contents").select("*").eq("creator_id", creator_id).execute()
        return response.data if response.data else []
    except Exception as e:
        print(f"Error fetching gallery for creator {creator_id}: {e}")
        return []
