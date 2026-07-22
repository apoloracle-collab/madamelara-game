import os
import time
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
import telebot
from telebot import types
from dotenv import load_dotenv

try:
    from database import get_or_create_slave, add_energy, add_diamonds, activate_autobot, unlock_content
except ImportError:
    from database import get_or_create_slave, add_energy

load_dotenv()

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
if not TOKEN:
    raise ValueError("CRITICAL ERROR: Missing TELEGRAM_BOT_TOKEN in environment variables.")

bot = telebot.TeleBot(TOKEN)

VERCEL_WEB_APP_URL = "https://madamelara-game.vercel.app"

class HealthCheckHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-type", "text/plain")
        self.end_headers()
        self.wfile.write(b"Madame Lara Bot is awake and listening.")

    def do_HEAD(self):
        self.send_response(200)
        self.send_header("Content-type", "text/plain")
        self.end_headers()

    def log_message(self, format, *args):
        return

def run_health_server():
    port = int(os.getenv("PORT", 8080))
    server = HTTPServer(("0.0.0.0", port), HealthCheckHandler)
    server.serve_forever()

server_thread = threading.Thread(target=run_health_server, daemon=True)
server_thread.start()

@bot.message_handler(commands=['start'])
def send_welcome(message):
    telegram_id = message.from_user.id
    username = message.from_user.username or "Devotee"
    
    # --- DEEP LINK CONTROL (Purchase requests triggered from WebApp) ---
    if len(message.text.split()) > 1:
        payload = message.text.split()[1]
        
        # 1. DIAMOND VAULT PACKS
        if payload == "buy_pack_3750":
            bot.send_invoice(
                chat_id=message.chat.id,
                title="Starter Bag (3,750 Diamonds)",
                description="Instantly credit 3,750 Diamonds to your Madame Lara vault.",
                invoice_payload="pack_3750",
                provider_token="",
                currency="XTR",
                prices=[types.LabeledPrice(label="3,750 Diamonds", amount=15)]
            )
            return

        elif payload == "buy_pack_15000":
            bot.send_invoice(
                chat_id=message.chat.id,
                title="Medium Box (15,000 Diamonds)",
                description="Instantly credit 15,000 Diamonds to your Madame Lara vault.",
                invoice_payload="pack_15000",
                provider_token="",
                currency="XTR",
                prices=[types.LabeledPrice(label="15,000 Diamonds", amount=60)]
            )
            return

        elif payload == "buy_pack_62500":
            bot.send_invoice(
                chat_id=message.chat.id,
                title="Heavy Chest (62,500 Diamonds)",
                description="Instantly credit 62,500 Diamonds to your Madame Lara vault.",
                invoice_payload="pack_62500",
                provider_token="",
                currency="XTR",
                prices=[types.LabeledPrice(label="62,500 Diamonds", amount=250)]
            )
            return

        elif payload == "buy_pack_300000":
            bot.send_invoice(
                chat_id=message.chat.id,
                title="VIP Whale Pack (300,000 Diamonds)",
                description="Heavy VIP Pack: 300,000 Diamonds with +20% Bonus included!",
                invoice_payload="pack_300000",
                provider_token="",
                currency="XTR",
                prices=[types.LabeledPrice(label="300,000 Diamonds", amount=1000)]
            )
            return

        # 2. AUTO-OBEY BOT
        elif payload == "buy_autobot":
            bot.send_invoice(
                chat_id=message.chat.id,
                title="Auto-Obey Bot Activation",
                description="Activate Auto-Obey Bot to mine diamonds continuously while you sleep (12-Hour Shift).",
                invoice_payload="autobot_pass",
                provider_token="",
                currency="XTR",
                prices=[types.LabeledPrice(label="Auto-Obey Bot", amount=100)]
            )
            return

        # 3. SECRET PORTAL CONTENT UNLOCKS (Throne Queen 300 ⭐️ tam eşleşme)
        elif payload.startswith("unlock_content_"):
            card_id = payload.replace("unlock_content_", "")
            
            card_prices = {
                "card_1": ("First Encounter", 10),
                "card_2": ("Sharp Glances", 35),
                "card_3": ("Leather Elegance", 100),
                "card_4": ("Throne Queen", 300)
            }

            title, stars_cost = card_prices.get(card_id, ("Exclusive Secret Content", 50))

            bot.send_invoice(
                chat_id=message.chat.id,
                title=f"Secret Content: {title}",
                description=f"Unlock '{title}' permanently & receive passive income boosts!",
                invoice_payload=f"content_{card_id}",
                provider_token="",
                currency="XTR",
                prices=[types.LabeledPrice(label=title, amount=stars_cost)]
            )
            return

        # 4. ENERGY REFILLS
        elif payload == "buy_energy_5":
            bot.send_invoice(
                chat_id=message.chat.id,
                title="5 Energy Refill",
                description="Instantly refill 5 Energy to continue serving Madame Lara.",
                invoice_payload="db_energy_5",
                provider_token="",
                currency="XTR",
                prices=[types.LabeledPrice(label="5 Energy", amount=15)]
            )
            return

    # --- STANDARD WELCOME MESSAGE ---
    if 'get_or_create_slave' in globals():
        get_or_create_slave(telegram_id, username)
    
    welcome_text = (
        "👑 **Welcome to Madame Lara's Portal!** 👑\n\n"
        "This is the exclusive domain where Madame Lara rewards her most loyal followers. "
        "Step inside, tap to earn diamonds, and unlock hidden secrets.\n\n"
        "⛓️ **What Awaits You Inside?**\n"
        "• **Tap & Mine:** Collect diamonds with every touch and upgrade your power.\n"
        "• **Auto Bot:** Automate your earnings while away.\n"
        "• **Secret Gallery:** Access exclusive, private media cards.\n\n"
        "Click the button below to enter Madame Lara's realm!"
    )
    
    markup = types.InlineKeyboardMarkup()
    cache_buster = int(time.time())
    full_app_url = f"{VERCEL_WEB_APP_URL}?v={cache_buster}"
    
    web_app_info = types.WebAppInfo(url=full_app_url)
    btn_enter = types.InlineKeyboardButton("👑 Play / Open Portal", web_app=web_app_info)
    btn_join = types.InlineKeyboardButton("📢 Join Channel", url="https://t.me/madamelara")
    
    markup.row(btn_enter)
    markup.row(btn_join)
    
    bot.send_message(message.chat.id, welcome_text, parse_mode="Markdown", reply_markup=markup)

@bot.pre_checkout_query_handler(func=lambda query: True)
def checkout(pre_checkout_query):
    bot.answer_pre_checkout_query(pre_checkout_query.id, ok=True, 
                                  error_message="Payment validation failed. Please try again.")

@bot.message_handler(content_types=['successful_payment'])
def got_payment(message):
    payment_info = message.successful_payment
    payload = payment_info.invoice_payload
    telegram_id = message.from_user.id
    
    if payload == "pack_3750":
        if 'add_diamonds' in globals(): add_diamonds(telegram_id, 3750)
        bot.send_message(message.chat.id, "🎉 **Payment Successful!** +3,750 Diamonds added! Open the app to spend them.")
    elif payload == "pack_15000":
        if 'add_diamonds' in globals(): add_diamonds(telegram_id, 15000)
        bot.send_message(message.chat.id, "🎉 **Payment Successful!** +15,000 Diamonds added to your vault!")
    elif payload == "pack_62500":
        if 'add_diamonds' in globals(): add_diamonds(telegram_id, 62500)
        bot.send_message(message.chat.id, "👑 **Heavy Chest Claimed!** +62,500 Diamonds added to your account.")
    elif payload == "pack_300000":
        if 'add_diamonds' in globals(): add_diamonds(telegram_id, 300000)
        bot.send_message(message.chat.id, "🏰 **VIP Whale Pack Activated!** +300,000 Diamonds added! Madame Lara honors your supreme devotion!")
    elif payload == "autobot_pass":
        if 'activate_autobot' in globals(): activate_autobot(telegram_id)
        bot.send_message(message.chat.id, "🤖 **Auto-Obey Bot Activated!** Your bot is now mining diamonds for you in the background.")
    elif payload.startswith("content_"):
        card_id = payload.replace("content_", "")
        if 'unlock_content' in globals(): unlock_content(telegram_id, card_id)
        bot.send_message(message.chat.id, f"🔓 **Content Unlocked!** Card '{card_id}' is now unlocked in your Secret Portal.")
    elif payload == "db_energy_5":
        if 'add_energy' in globals(): add_energy(telegram_id, 5)
        bot.send_message(message.chat.id, "⚡ **Payment Successful!** 5 Energy refilled.")

if __name__ == "__main__":
    print("Madame Lara's Telegram Bot engine is initialized and actively listening...")
    bot.infinity_polling(skip_pending=True)
