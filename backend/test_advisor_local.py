import requests
import re
import sys

# Reconfigure stdout to support UTF-8 characters (like the Rupee symbol) on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

def test_prompts():
    login_url = "http://127.0.0.1:8000/api/auth/login"
    login_data = {
        "username": "demo",
        "password": "Password123"
    }
    
    print("Logging in demo user...")
    r = requests.post(login_url, json=login_data)
    if r.status_code != 200:
        print("Login failed:", r.text)
        return
        
    token = r.json()["access_token"]
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    prompts = [
        "Act as my CFO and review this month.",
        "Create a budget for me.",
        "How much should I reduce food spending?",
        "Can I afford a ₹90,000 laptop?",
        "If I save for 24 months what happens?"
    ]
    
    chat_url = "http://127.0.0.1:8000/api/coach/chat"
    history = []
    
    for i, p in enumerate(prompts):
        print(f"\n--- Running Prompt {i+1}: '{p}' ---")
        payload = {
            "message": p,
            "history": history
        }
        res = requests.post(chat_url, json=payload, headers=headers)
        print("Status Code:", res.status_code)
        if res.status_code == 200:
            reply = res.json()["reply"]
            print("Response Length:", len(reply))
            
            # Check for emojis
            has_emojis = bool(re.search(r'[\U0001f600-\U0001f64f\U0001f300-\U0001f5ff\U0001f680-\U0001f6ff]', reply))
            print("Contains Emojis:", "YES" if has_emojis else "NO")
            
            # Check for Markdown vs HTML
            has_md_headers = "###" in reply or "##" in reply or "**" in reply
            print("Contains Raw Markdown Headers/Bold:", "YES" if has_md_headers else "NO")
            
            has_html = "<h2>" in reply or "<h3>" in reply or "<ul>" in reply or "<table>" in reply
            print("Contains HTML Elements:", "YES" if has_html else "NO")
            
            print("Full Reply:")
            print(reply)
            
            # Add to history
            history.append({"role": "user", "content": p})
            history.append({"role": "assistant", "content": reply})
        else:
            print("Error:", res.text)

if __name__ == "__main__":
    test_prompts()
