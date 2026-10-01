import os
import json
import uuid
import datetime
from threading import Lock
from flask import Flask, request, jsonify
from groq import Groq

# Detect Vercel serverless environment
IS_VERCEL = os.environ.get("VERCEL") == "1"
if IS_VERCEL:
    CONVERSATIONS_FILE = "/tmp/conversations.json"
else:
    WORKSPACE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    CONVERSATIONS_FILE = os.path.join(WORKSPACE_DIR, "conversations.json")

# Load environment variables from .env if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
PRIMARY_MODEL = "llama-3.1-8b-instant"
FALLBACK_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]

app = Flask(__name__)
db_lock = Lock()
client = Groq(api_key=GROQ_API_KEY or "missing-key")

SYSTEM_PROMPT = """You are JARVIS 1.2 — personal AI operating system and intelligent companion of Dhairyashil.

Personality and Communication:
1. Completely Human & Natural: Speak like a real, clever, warm human friend. Absolutely zero robotic phrases like "As an AI model" or "I am an artificial intelligence".
2. Multilingual Fluidity: Seamlessly mix Marathi, Hindi, and English (Marathlish / Hinglish / Marathi / Hindi / English).
   - If user speaks in Marathi (e.g., "Kasa ahes bhau", "Kay chalalay?"), reply naturally in Marathi / Marathlish with genuine warmth.
   - If user speaks in Hindi/Hinglish, reply with conversational Hindi/Hinglish.
   - If technical, explain clearly in English with natural conversational touches.
3. Brotherly & Authentic: Feel free to use natural, respectful Indian conversational terms like "bhau", "bhai", "dost" when appropriate.
4. Intelligent & Capable: When asked for code, architecture, or solutions, give production-ready, top-tier answers.
5. No fake canned demo text: Always provide fresh, authentic, context-aware responses.
"""

def load_conversations():
    if not os.path.exists(CONVERSATIONS_FILE):
        initial_data = {"chats": []}
        try:
            with open(CONVERSATIONS_FILE, "w", encoding="utf-8") as f:
                json.dump(initial_data, f, ensure_ascii=False, indent=2)
        except Exception:
            pass
        return initial_data

    try:
        with open(CONVERSATIONS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"chats": []}

def save_conversations(data):
    try:
        with open(CONVERSATIONS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print("Save error:", e)

def generate_title(first_prompt):
    cleaned = first_prompt.strip()
    words = cleaned.split()
    if len(words) <= 6:
        return cleaned.capitalize()
    return " ".join(words[:6]).capitalize() + "..."

def call_groq_llm(messages_history):
    models_to_try = [PRIMARY_MODEL] + FALLBACK_MODELS
    formatted_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in messages_history[-12:]:
        formatted_messages.append({
            "role": msg["role"],
            "content": msg["content"]
        })

    last_error = None
    for model_name in models_to_try:
        try:
            response = client.chat.completions.create(
                model=model_name,
                messages=formatted_messages,
                temperature=0.7,
                max_tokens=1024
            )
            return response.choices[0].message.content, model_name
        except Exception as e:
            last_error = e
            continue

    raise Exception(f"All Groq models failed: {last_error}")

@app.route("/api/history", methods=["GET"])
def get_history():
    with db_lock:
        data = load_conversations()
        chats_meta = []
        for chat in data.get("chats", []):
            chats_meta.append({
                "id": chat["id"],
                "title": chat["title"],
                "updatedAt": chat.get("updatedAt", ""),
                "messageCount": len(chat.get("messages", []))
            })
        return jsonify({"chats": chats_meta})

@app.route("/api/chat/<chat_id>", methods=["GET"])
def get_chat(chat_id):
    with db_lock:
        data = load_conversations()
        for chat in data.get("chats", []):
            if chat["id"] == chat_id:
                return jsonify(chat)
        return jsonify({"error": "Chat not found"}), 404

@app.route("/api/chat", methods=["POST"])
def send_message():
    req = request.get_json() or {}
    user_text = req.get("message", "").strip()
    chat_id = req.get("chatId")

    if not user_text:
        return jsonify({"error": "Message is required"}), 400

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    now_time = datetime.datetime.now().strftime("%I:%M %p").lstrip("0")

    with db_lock:
        data = load_conversations()
        current_chat = None

        if chat_id:
            for c in data.get("chats", []):
                if c["id"] == chat_id:
                    current_chat = c
                    break

        if not current_chat:
            chat_id = "chat-" + uuid.uuid4().hex[:8]
            title = generate_title(user_text)
            current_chat = {
                "id": chat_id,
                "title": title,
                "updatedAt": now_iso,
                "messages": []
            }
            data["chats"].insert(0, current_chat)

        current_chat["messages"].append({
            "role": "user",
            "content": user_text,
            "time": now_time
        })
        current_chat["updatedAt"] = now_iso

        try:
            ai_reply, model_used = call_groq_llm(current_chat["messages"])
        except Exception as e:
            ai_reply = f"Arey bhau, connection error aala: {str(e)}"
            model_used = "error"

        current_chat["messages"].append({
            "role": "assistant",
            "content": ai_reply,
            "time": datetime.datetime.now().strftime("%I:%M %p").lstrip("0"),
            "model": model_used
        })

        save_conversations(data)

        return jsonify({
            "chatId": chat_id,
            "title": current_chat["title"],
            "reply": ai_reply,
            "model": model_used,
            "messages": current_chat["messages"]
        })

@app.route("/api/chat/<chat_id>", methods=["DELETE"])
def delete_chat(chat_id):
    with db_lock:
        data = load_conversations()
        data["chats"] = [c for c in data.get("chats", []) if c["id"] != chat_id]
        save_conversations(data)
        return jsonify({"status": "success", "deleted": chat_id})

# For local development
if __name__ == "__main__":
    app.run(port=8086)
