import os
import time
import telebot
from telebot import types
from dotenv import load_dotenv

# Import database functions
from database import get_or_create_slave, add_energy

# ==========================================================================
# 1. ENVIRONMENT LOAD & BOT INITIALIZATION
# ==========================================================================
load_dotenv()

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
if not TOKEN:
    raise ValueError("CRITICAL ERROR: Missing TELEGRAM_BOT_TOKEN in .env file.")

bot = telebot.TeleBot(TOKEN)

# ==========================================================================
# 2. COMMAND HANDLERS & DEEP LINK INVOICES
# ==========================================================================
@bot.message_handler(commands=['start'])
def send_welcome(message):
    telegram_id = message.from_user.id
    username = message.from_user.username
    
    # --- DEEP LINK CONTROL (Purchase requests from WebApp) ---
    if len(message.text.split()) > 1:
        payload = message.text.split()[1]
        
        if payload == "buy_energy_5":
            bot.send_invoice(
                chat_id=message.chat.id,
                title="5 Energy Refill",
                description="Instantly refill 5 Energy to continue serving Madame Lara.",
                invoice_payload="db_energy_5",
                provider_token="", # Must be EMPTY for Telegram Stars (XTR)
                currency="XTR",
                prices=[types.LabeledPrice(label="5 Energy", amount=15)]
            )
            return
            
        elif payload == "buy_energy_10":
            bot.send_invoice(
                chat_id=message.chat.id,
                title="10 Energy Refill",
                description="Advantage Pack: Refill 10 Energy.",
                invoice_payload="db_energy_10",
                provider_token="",
                currency="XTR",
                prices=[types.LabeledPrice(label="10 Energy", amount=25)]
            )
            return

    # --- STANDARD WELCOME MESSAGE ---
    slave_data = get_or_create_slave(telegram_id, username)
    
    welcome_text = (
        "👑 **Welcome to Madame Lara's World!** 👑\n\n"
        "This is the exclusive domain where Madame Lara rewards her most loyal followers. "
        "Step inside and begin uncovering the hidden treasures.\n\n"
        "⛓️ **What Awaits You Inside?**\n"
        "• **Unlock Secret Treasures:** Collect points with every tap and gain exclusive access to private content!\n"
        "• **Rise Through The Ranks:** Climb the global leaderboard and prove your devotion.\n\n"
        "Click the button below to enter, explore the hidden secrets, and start earning your rewards right now!"
    )
    
    markup = types.InlineKeyboardMarkup()
    cache_buster = int(time.time())
    web_app_url = f"https://apoloracle-collab.github.io/madamelara-game/?v={cache_buster}"
    
    web_app_info = types.WebAppInfo(url=web_app_url)
    btn_enter = types.InlineKeyboardButton("🔗 Enter (Discover Secrets)", web_app=web_app_info)
    btn_join = types.InlineKeyboardButton("📢 Join Channel", url="https://t.me/your_channel_username")
    
    markup.row(btn_enter)
    markup.row(btn_join)
    
    bot.send_message(message.chat.id, welcome_text, parse_mode="Markdown", reply_markup=markup)

# ==========================================================================
# 3. TELEGRAM STARS (XTR) PAYMENT PROCESSORS
# ==========================================================================
@bot.pre_checkout_query_handler(func=lambda query: True)
def checkout(pre_checkout_query):
    bot.answer_pre_checkout_query(pre_checkout_query.id, ok=True, 
                                  error_message="Payment validation failed. Please try again.")

@bot.message_handler(content_types=['successful_payment'])
def got_payment(message):
    payment_info = message.successful_payment
    payload = payment_info.invoice_payload
    telegram_id = message.from_user.id
    
    if payload == "db_energy_5":
        # Add energy to database
        add_energy(telegram_id, 5) 
        bot.send_message(message.chat.id, "🎉 Payment successful! 5 Energy has been added. You can click 'Enter' to return to the game.")
        
    elif payload == "db_energy_10":
        # Add energy to database
        add_energy(telegram_id, 10)
        bot.send_message(message.chat.id, "🎉 Payment successful! 10 Energy has been added. Madame Lara favors you. Click 'Enter' to return.")

# ==========================================================================
# 4. BOT EXECUTION LOOP
# ==========================================================================
print("Madame Lara's Telegram Bot engine is initialized and actively listening to slaves...")
bot.infinity_polling()