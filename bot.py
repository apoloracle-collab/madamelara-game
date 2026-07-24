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
VERCEL_WEB_APP_URL = os.getenv("VERCEL_WEB_APP_URL", "https://madamelara-game.vercel.app")

# ==========================================================================
# HEALTH CHECK SERVER FOR RENDER UPTIME
# ==========================================================================
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

# ==========================================================================
# INVOICE LINK GENERATOR (TEST MODE: ALL PRICES SET TO 1 STAR)
# ==========================================================================
@bot.message_handler(commands=['get_invoice_link'])
def handle_get_invoice_link(message):
    telegram_id = message.from_user.id
    text_parts = message.text.strip().split()
    if len(text_parts) > 1:
        payload = text_parts[1].strip()
        # TEST MODU: Tüm paketlerin fiyatı geçici olarak 1 Yıldız yapıldı
        prices_map = {
            "pack_3750": ("Starter Bag (3,750 Diamonds)", 1),
            "pack_15000": ("Medium Box (15,000 Diamonds)", 1),
            "pack_62500": ("Heavy Chest (62,500 Diamonds)", 1),
            "pack_300000": ("VIP Whale Pack (300,000 Diamonds)", 1),
            "autobot_pass": ("Auto-Obey Bot Activation", 1),
        }
        if payload in prices_map:
            title, amount = prices_map[payload]
            try:
                link = bot.create_invoice_link(
                    title,
                    "Secure Telegram Stars Payment (Test)",
                    payload,
                    "",
                    "XTR",
                    [types.LabeledPrice(title, amount)]
                )
                bot.send_message(
                    message.chat.id,
                    f"🔗 **Invoice Link Ready:**\n`{link}`\n\nTap to pay securely.",
                    parse_mode="Markdown"
                )
                return
            except Exception as e:
                bot.send_message(message.chat.id, f"Error generating link: {e}")
                return
        elif payload.startswith("content_") or payload.startswith("unlock_content_"):
            card_id = payload.replace("unlock_content_", "").replace("content_", "").strip()
            card_prices = {
                "card_1": ("First Encounter", 1),
                "card_2": ("Sharp Glances", 1),
                "card_3": ("Leather Elegance", 1),
                "card_4": ("Throne Queen", 1)
            }
            title, stars_cost = card_prices.get(card_id, ("Exclusive Content", 1))
            try:
                link = bot.create_invoice_link(
                    f"Secret Content: {title}",
                    f"Unlock '{title}' permanently.",
                    f"content_{card_id}",
                    "",
                    "XTR",
                    [types.LabeledPrice(title, stars_cost)]
                )
                bot.send_message(
                    message.chat.id,
                    f"🔗 **Invoice Link Ready:**\n`{link}`",
                    parse_mode="Markdown"
                )
                return
            except Exception as e:
                bot.send_message(message.chat.id, f"Error generating link: {e}")
                return

# ==========================================================================
# /START COMMAND & PAYLOAD ROUTER (TEST MODE: ALL INVOICES = 1 STAR)
# ==========================================================================
@bot.message_handler(commands=['start'])
def send_welcome(message):
    telegram_id = message.from_user.id
    username = message.from_user.username or "Devotee"
    
    if 'get_or_create_slave' in globals():
        try:
            get_or_create_slave(telegram_id, username)
        except Exception as e:
            print(f"Database error on start: {e}")

    text_parts = message.text.strip().split()
    if len(text_parts) > 1:
        payload = text_parts[1].strip()
        
        # --- STARS PACK INVOICES (TEST MODE: 1 STAR EACH) ---
        if payload == "buy_pack_3750":
            bot.send_invoice(
                chat_id=message.chat.id,
                title="Starter Bag (3,750 Diamonds)",
                description="Instantly credit 3,750 Diamonds to your Madame Lara vault.",
                invoice_payload="pack_3750",
                provider_token="",
                currency="XTR",
                prices=[types.LabeledPrice(label="3,750 Diamonds [TEST]", amount=1)]
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
                prices=[types.LabeledPrice(label="15,000 Diamonds [TEST]", amount=1)]
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
                prices=[types.LabeledPrice(label="62,500 Diamonds [TEST]", amount=1)]
            )
            return

        elif payload == "buy_pack_300000":
            bot.send_invoice(
                chat_id=message.chat.id,
                title="VIP Whale Pack (300,000 Diamonds)",
                description="Heavy VIP Pack: 300,000 Diamonds included!",
                invoice_payload="pack_300000",
                provider_token="",
                currency="XTR",
                prices=[types.LabeledPrice(label="300,000 Diamonds [TEST]", amount=1)]
            )
            return

        elif payload == "buy_autobot":
            bot.send_invoice(
                chat_id=message.chat.id,
                title="Auto-Obey Bot Activation",
                description="Activate Auto-Obey Bot to mine diamonds continuously (12-Hour Shift).",
                invoice_payload="autobot_pass",
                provider_token="",
                currency="XTR",
                prices=[types.LabeledPrice(label="Auto-Obey Bot [TEST]", amount=1)]
            )
            return

        # --- SECRET CONTENT CARDS (TEST MODE: 1 STAR EACH) ---
        elif payload.startswith("unlock_content_") or payload.startswith("content_"):
            card_id = payload.replace("unlock_content_", "").replace("content_", "").strip()
            
            card_prices = {
                "card_1": ("First Encounter", 1),
                "card_2": ("Sharp Glances", 1),
                "card_3": ("Leather Elegance", 1),
                "card_4": ("Throne Queen", 1)
            }

            title, stars_cost = card_prices.get(card_id, ("Exclusive Secret Content", 1))

            bot.send_invoice(
                chat_id=message.chat.id,
                title=f"Secret Content: {title}",
                description=f"Unlock '{title}' permanently & receive passive income boosts!",
                invoice_payload=f"content_{card_id}",
                provider_token="",
                currency="XTR",
                prices=[types.LabeledPrice(label=f"{title} [TEST]", amount=stars_cost)]
            )
            return

        elif payload == "buy_energy_5":
            bot.send_invoice(
                chat_id=message.chat.id,
                title="5 Energy Refill",
                description="Instantly refill 5 Energy to continue serving Madame Lara.",
                invoice_payload="db_energy_5",
                provider_token="",
                currency="XTR",
                prices=[types.LabeledPrice(label="5 Energy [TEST]", amount=1)]
            )
            return

        # --- REFERRAL LINK ROUTER ---
        elif payload.startswith("ref_"):
            referrer_str = payload.replace("ref_", "").strip()
            if referrer_str.isdigit():
                referrer_id = int(referrer_str)
                if referrer_id != telegram_id:
                    if 'add_diamonds' in globals():
                        add_diamonds(referrer_id, 2500)
                    try:
                        bot.send_message(
                            referrer_id,
                            f"🎉 **Referral Bonus!** User @{username} joined using your referral link! You earned **+2,500 Diamonds**! 💎",
                            parse_mode="Markdown"
                        )
                    except Exception as e:
                        print(f"Could not send message to referrer: {e}")

            markup = types.InlineKeyboardMarkup()
            btn_join = types.InlineKeyboardButton("📢 Join Channel", url="https://t.me/+XrzPL2PXnYxkNjk0")
            markup.row(btn_join)

            bot.send_message(
                message.chat.id,
                "🎉 **Welcome!** You joined via a friend's referral link!\n\n"
                "👇 Tap the **Play** button at the bottom of your screen to open the app!",
                parse_mode="Markdown",
                reply_markup=markup
            )
            return

        # --- TELEGRAM CHANNEL VERIFICATION ---
        elif payload == "check_telegram_channel":
            channel_id = os.getenv("TELEGRAM_CHANNEL_ID", "@laragameportal")
            channel_invite_link = "https://t.me/+XrzPL2PXnYxkNjk0"
            try:
                member = bot.get_chat_member(channel_id, telegram_id)
                if member.status in ['member', 'administrator', 'creator']:
                    if 'add_diamonds' in globals():
                        add_diamonds(telegram_id, 1000)
                    bot.send_message(
                        message.chat.id,
                        "✅ **Channel Membership Verified!**\n\n"
                        "You are a confirmed member of Madame Lara's channel. +1,000 Diamonds have been credited to your account! 🎉",
                        parse_mode="Markdown"
                    )
                else:
                    bot.send_message(
                        message.chat.id,
                        "❌ **Verification Failed!**\n\n"
                        "You have not joined Madame Lara's Telegram channel yet.\n"
                        "Please join the channel below, then try again!",
                        parse_mode="Markdown",
                        reply_markup=types.InlineKeyboardMarkup().add(
                            types.InlineKeyboardButton("📢 Join Channel", url=channel_invite_link),
                            types.InlineKeyboardButton("🔄 Verify Again", url="https://t.me/madamelara_bot?start=check_telegram_channel")
                        )
                    )
            except Exception as e:
                print(f"Chat member check exception: {e}")
                bot.send_message(
                    message.chat.id,
                    "⚠️ **Verification Pending**\n\n"
                    "Please make sure you have joined the channel, then tap 'Verify Again'.",
                    parse_mode="Markdown",
                    reply_markup=types.InlineKeyboardMarkup().add(
                        types.InlineKeyboardButton("📢 Join Channel", url=channel_invite_link),
                        types.InlineKeyboardButton("🔄 Verify Again", url="https://t.me/madamelara_bot?start=check_telegram_channel")
                    )
                )
            return

    # Standard Welcome Message (No duplicate inline play button)
            return

    # --- STANDARD WELCOME MESSAGE ---
    welcome_text = (
        "👑 **Welcome to Madame Lara's Portal!** 👑\n\n"
        "This is the exclusive domain where Madame Lara rewards her most loyal followers. "
        "Step inside, tap to earn diamonds, and unlock hidden secrets.\n\n"
        "⛓️ **What Awaits You Inside?**\n"
        "• **Tap & Mine:** Collect diamonds with every touch and upgrade your power.\n"
        "• **Auto Bot:** Automate your earnings while away.\n"
        "• **Secret Gallery:** Access exclusive, private media cards.\n\n"
        "👇 Tap the **Play 👑** button at the bottom of your screen to open the app!"
    )
    
    markup = types.InlineKeyboardMarkup()
    btn_join = types.InlineKeyboardButton("📢 Join Channel", url="https://t.me/+XrzPL2PXnYxkNjk0")
    markup.row(btn_join)
    
    bot.send_message(message.chat.id, welcome_text, parse_mode="Markdown", reply_markup=markup)

# ==========================================================================
# PAYMENT HANDLERS
# ==========================================================================
@bot.pre_checkout_query_handler(func=lambda query: True)
def checkout(pre_checkout_query):
    bot.answer_pre_checkout_query(
        pre_checkout_query.id,
        ok=True,
        error_message="Payment validation failed. Please try again."
    )

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
    elif payload.startswith("content_") or payload.startswith("unlock_content_"):
        card_id = payload.replace("unlock_content_", "").replace("content_", "").strip()
        if 'unlock_content' in globals(): unlock_content(telegram_id, card_id)
        bot.send_message(message.chat.id, f"🔓 **Content Unlocked!** Card '{card_id}' is now unlocked in your Secret Portal.")
    elif payload == "db_energy_5":
        if 'add_energy' in globals(): add_energy(telegram_id, 5)
        bot.send_message(message.chat.id, "⚡ **Payment Successful!** 5 Energy refilled.")

if __name__ == "__main__":
    print("Madame Lara's Telegram Bot engine is initialized and actively listening (1-Star Test Mode Active)...")
    bot.infinity_polling(skip_pending=True)
