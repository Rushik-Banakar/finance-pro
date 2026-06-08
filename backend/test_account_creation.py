import requests

def test():
    # Login
    login_url = "http://127.0.0.1:8000/api/auth/login"
    login_data = {
        "username": "demo",
        "password": "Password123"
    }
    
    print("Logging in...")
    r = requests.post(login_url, json=login_data)
    print("Login Status Code:", r.status_code)
    print("Login Response:", r.json())
    
    if r.status_code != 200:
        return
        
    token = r.json()["access_token"]
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    # Create Account
    account_url = "http://127.0.0.1:8000/api/accounts/"
    account_data = {
        "name": "Test Savings Account",
        "bank_name": "SBI",
        "type": "Savings",
        "balance": 50000.0,
        "currency": "INR"
    }
    
    print("\nCreating account...")
    r2 = requests.post(account_url, json=account_data, headers=headers)
    print("Create Account Status Code:", r2.status_code)
    print("Create Account Response:", r2.json())

if __name__ == "__main__":
    test()
