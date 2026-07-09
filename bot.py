import os
import telebot
from telebot import types
from dotenv import load_dotenv
from database import get_or_create_slave

load_dotenv()

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
if not TOKEN:
    raise ValueError("Missing TELEGRAM_BOT_TOKEN in .env file.")

bot = telebot.TeleBot(TOKEN)

@bot.message_handler(commands=['start'])
def send_welcome(message):
    telegram_id = message.from_user.id
    username = message.from_user.username
    
    slave_data = get_or_create_slave(telegram_id, username)
    
    welcome_text = (
        "👑 **Welcome to Madame Lara's World!** 👑\n\n"
        "This is the exclusive domain where Madame Lara rewards her most loyal followers. "
        "Step inside and begin uncovering the hidden treasures.\n\n"
        "⛓️ **What Awaits You Inside?**\n"
        "• **Unlock Secret Treasures:** Collect points with every single tap and gain exclusive access to Madame Lara's private content and special rewards!\n"
        "• **Rise Through The Ranks:** Leave everyone else behind, climb the global leaderboard, and prove your ultimate devotion.\n\n"
        "Click the button below to enter, explore the hidden secrets, and start earning your rewards right now!"
    )
    
    markup = types.InlineKeyboardMarkup()
    web_app_url = "https://apoloracle-collab.github.io/madamelara-game/"
    
    web_app_info = types.WebAppInfo(url=web_app_url)
    
    btn_enter = types.InlineKeyboardButton("🔗 Enter (Discover Secrets)", web_app=web_app_info)
    btn_join = types.InlineKeyboardButton("📢 Join Channel", url="https://t.me/your_channel_username")
    
    markup.row(btn_enter)
    markup.row(btn_join)
    
    bot.send_message(message.chat.id, welcome_text, parse_mode="Markdown", reply_markup=markup)

print("Madame Lara's Telegram Bot engine is now actively listening to slaves...")
bot.infinity_polling()