import os
import sys
import random
from datetime import datetime, timedelta

# Add the parent directory to the path so we can import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, Base, engine
from app.models.auth import User, Settings
from app.models.finance import Account, Category, Transaction, Transfer
from app.models.support import SupportTicket, Notification, AnalyticsSnapshot
from app.services.auth_service import get_password_hash, get_pin_hash

def seed_db():
    print("Initializing Database Seeder (Rollback to Phase 1)...")
    
    # Force Drop all tables to clean up Phase 2 tables and relation columns
    print("Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    
    print("Re-creating clean Phase 1 tables...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        print("Seeding System Default Categories...")
        system_categories = [
            # Incomes
            {"name": "Salary", "type": "Income"},
            {"name": "Freelance", "type": "Income"},
            {"name": "Investment", "type": "Income"},
            {"name": "Other Income", "type": "Income"},
            
            # Expenses
            {"name": "Rent & Housing", "type": "Expense", "planned_outlay": 30000.0},
            {"name": "Food & Dining", "type": "Expense", "planned_outlay": 15000.0},
            {"name": "Shopping", "type": "Expense", "planned_outlay": 12000.0},
            {"name": "Utilities", "type": "Expense", "planned_outlay": 8000.0},
            {"name": "Entertainment", "type": "Expense", "planned_outlay": 6000.0},
            {"name": "Travel & Fuel", "type": "Expense", "planned_outlay": 8000.0},
            {"name": "Healthcare", "type": "Expense", "planned_outlay": 5000.0},
            {"name": "Education", "type": "Expense", "planned_outlay": 4000.0},
            {"name": "Other Expense", "type": "Expense", "planned_outlay": 5000.0},
        ]
        
        category_objects = []
        for cat in system_categories:
            cat_obj = Category(
                user_id=None,
                name=cat["name"],
                type=cat["type"],
                planned_outlay=cat.get("planned_outlay", 0.0),
                is_custom=False
            )
            db.add(cat_obj)
            category_objects.append(cat_obj)
        db.commit()
        
        # Keep category mapping for easy access
        categories_by_name = {c.name: c for c in category_objects}

        print("Seeding Demo User...")
        demo_user = User(
            username="demo",
            email="demo@financepro.com",
            hashed_password=get_password_hash("Password123")
        )
        db.add(demo_user)
        db.commit()
        
        print("Seeding Demo User Settings...")
        demo_settings = Settings(
            user_id=demo_user.id,
            pin_hash=get_pin_hash("1234"),
            is_pin_enabled=False,  # Let user enable in Settings UI
            auto_lock_duration=300,
            session_timeout=3600,
            currency="INR",
            language="English",
            date_format="DD-MM-YYYY",
            notification_pref="Email",
            theme="FinancePro",
            theme_customization='{"density":"comfortable", "font":"Outfit", "card_style":"neon"}',
            hide_balance=False,
            lock_analytics=False
        )
        db.add(demo_settings)
        db.commit()

        print("Seeding Bank Accounts...")
        accounts_data = [
            {"name": "ICICI Savings Account", "bank_name": "ICICI", "type": "Savings", "balance": 180000.0},
            {"name": "HDFC Credit Card", "bank_name": "HDFC", "type": "CreditCard", "balance": -8200.0},
            {"name": "SBI Savings Account", "bank_name": "SBI", "type": "Savings", "balance": 48500.0},
            {"name": "Cash Wallet", "bank_name": "Cash", "type": "Cash", "balance": 3500.0}
        ]
        
        accounts_dict = {}
        for acc in accounts_data:
            acc_obj = Account(
                user_id=demo_user.id,
                name=acc["name"],
                bank_name=acc["bank_name"],
                type=acc["type"],
                balance=0.0, # We will calculate balances incrementally to ensure consistency!
                currency="INR",
                is_archived=False
            )
            db.add(acc_obj)
            accounts_dict[acc["name"]] = acc_obj
        db.commit()
        
        # Set base starting balances
        # Starting balances 6 months ago (Dec 1, 2025)
        balances = {
            "ICICI Savings Account": 80000.0,
            "HDFC Credit Card": 0.0,
            "SBI Savings Account": 20000.0,
            "Cash Wallet": 2000.0
        }
        
        # Apply starting balances
        for name, val in balances.items():
            accounts_dict[name].balance = val
        db.commit()

        print("Generating 6 Months of Transaction and Transfer Data...")
        
        # 6 Months of data: Dec 2025, Jan 2026, Feb 2026, Mar 2026, Apr 2026, May 2026 (up to May 26)
        start_date = datetime(2025, 12, 1)
        end_date = datetime(2026, 5, 26)
        
        current_time = start_date
        
        transactions_to_seed = []
        transfers_to_seed = []

        while current_time <= end_date:
            day = current_time.day
            
            # --- Monthly recurring transactions ---
            # 1. Salary Credit on the 1st of each month
            if day == 1:
                tx = Transaction(
                    user_id=demo_user.id,
                    account_id=accounts_dict["ICICI Savings Account"].id,
                    category_id=categories_by_name["Salary"].id,
                    type="Income",
                    amount=120000.0,
                    description=f"Monthly Salary credit for {current_time.strftime('%B %Y')}",
                    date=current_time + timedelta(hours=9) # 9 AM
                )
                transactions_to_seed.append(tx)
                accounts_dict["ICICI Savings Account"].balance += 120000.0
                
            # 2. Rent Payment on the 5th of each month
            if day == 5:
                tx = Transaction(
                    user_id=demo_user.id,
                    account_id=accounts_dict["ICICI Savings Account"].id,
                    category_id=categories_by_name["Rent & Housing"].id,
                    type="Expense",
                    amount=28000.0,
                    description="Apartment Rent payment",
                    date=current_time + timedelta(hours=10) # 10 AM
                )
                transactions_to_seed.append(tx)
                accounts_dict["ICICI Savings Account"].balance -= 28000.0
                
            # 3. Utilities Bill on the 10th of each month
            if day == 10:
                # Electric bill
                elec_amount = round(random.uniform(4200.0, 5500.0), 2)
                tx_elec = Transaction(
                    user_id=demo_user.id,
                    account_id=accounts_dict["ICICI Savings Account"].id,
                    category_id=categories_by_name["Utilities"].id,
                    type="Expense",
                    amount=elec_amount,
                    description="Electricity Bill payment (BESCOM)",
                    date=current_time + timedelta(hours=11) # 11 AM
                )
                # Internet bill
                tx_net = Transaction(
                    user_id=demo_user.id,
                    account_id=accounts_dict["ICICI Savings Account"].id,
                    category_id=categories_by_name["Utilities"].id,
                    type="Expense",
                    amount=1199.0,
                    description="Broadband Internet Bill (ACT Fibernet)",
                    date=current_time + timedelta(hours=15) # 3 PM
                )
                transactions_to_seed.extend([tx_elec, tx_net])
                accounts_dict["ICICI Savings Account"].balance -= (tx_elec.amount + 1199.0)
                
            # 4. Self Transfer from ICICI to SBI on the 15th
            if day == 15:
                tr = Transfer(
                    user_id=demo_user.id,
                    source_account_id=accounts_dict["ICICI Savings Account"].id,
                    destination_account_id=accounts_dict["SBI Savings Account"].id,
                    amount=15000.0,
                    description="Monthly Savings Transfer to SBI",
                    date=current_time + timedelta(hours=12)
                )
                transfers_to_seed.append(tr)
                accounts_dict["ICICI Savings Account"].balance -= 15000.0
                accounts_dict["SBI Savings Account"].balance += 15000.0
                
            # 5. Credit Card Auto-Pay on the 20th
            if day == 20:
                # Pay off the Credit Card balance of HDFC CC using ICICI
                cc_balance = accounts_dict["HDFC Credit Card"].balance
                if cc_balance < 0:
                    pay_amount = abs(cc_balance)
                    tr = Transfer(
                        user_id=demo_user.id,
                        source_account_id=accounts_dict["ICICI Savings Account"].id,
                        destination_account_id=accounts_dict["HDFC Credit Card"].id,
                        amount=pay_amount,
                        description="HDFC Credit Card Bill auto-pay settlement",
                        date=current_time + timedelta(hours=16)
                    )
                    transfers_to_seed.append(tr)
                    accounts_dict["ICICI Savings Account"].balance -= pay_amount
                    accounts_dict["HDFC Credit Card"].balance += pay_amount
            
            # 6. ATM Cash Withdrawal from SBI Savings to Cash Wallet on 25th
            if day == 25:
                tr = Transfer(
                    user_id=demo_user.id,
                    source_account_id=accounts_dict["SBI Savings Account"].id,
                    destination_account_id=accounts_dict["Cash Wallet"].id,
                    amount=3000.0,
                    description="ATM Cash withdrawal for monthly wallet budget",
                    date=current_time + timedelta(hours=18)
                )
                transfers_to_seed.append(tr)
                accounts_dict["SBI Savings Account"].balance -= 3000.0
                accounts_dict["Cash Wallet"].balance += 3000.0

            # --- Weekly / Random transactions ---
            weekday = current_time.weekday() # 0 = Monday, 6 = Sunday
            
            # Food & Dining: Every Friday & Saturday
            if weekday in [4, 5]:
                choice = random.random()
                if choice < 0.3:
                    acc_name = "SBI Savings Account"
                elif choice < 0.8:
                    acc_name = "HDFC Credit Card"
                else:
                    acc_name = "Cash Wallet"
                
                food_amount = round(random.uniform(800.0, 2400.0), 2)
                tx = Transaction(
                    user_id=demo_user.id,
                    account_id=accounts_dict[acc_name].id,
                    category_id=categories_by_name["Food & Dining"].id,
                    type="Expense",
                    amount=food_amount,
                    description=random.choice(["Dinner with friends", "Swiggy order", "Zomato delivery", "Restaurant lunch", "Grocery shopping at Zepto"]),
                    date=current_time + timedelta(hours=random.choice([13, 20]))
                )
                transactions_to_seed.append(tx)
                accounts_dict[acc_name].balance -= food_amount
                
            # Travel & Fuel: Every Monday or Wednesday
            if weekday in [0, 2]:
                fuel_amount = round(random.uniform(1000.0, 1800.0), 2)
                acc_name = random.choice(["SBI Savings Account", "HDFC Credit Card"])
                tx = Transaction(
                    user_id=demo_user.id,
                    account_id=accounts_dict[acc_name].id,
                    category_id=categories_by_name["Travel & Fuel"].id,
                    type="Expense",
                    amount=fuel_amount,
                    description=random.choice(["Shell Fuel Station refuel", "Uber rides weekly", "Metro card recharge", "HP Petrol Pump"]),
                    date=current_time + timedelta(hours=random.choice([8, 18]))
                )
                transactions_to_seed.append(tx)
                accounts_dict[acc_name].balance -= fuel_amount

            # Shopping: Every Tuesday/Thursday
            if weekday in [1, 3] and (day % 4 == 0 or day % 5 == 0):
                shop_amount = round(random.uniform(1500.0, 5000.0), 2)
                tx = Transaction(
                    user_id=demo_user.id,
                    account_id=accounts_dict["HDFC Credit Card"].id,
                    category_id=categories_by_name["Shopping"].id,
                    type="Expense",
                    amount=shop_amount,
                    description=random.choice(["Amazon purchase", "Myntra clothes delivery", "Ajio shopping", "Uniqlo store purchase"]),
                    date=current_time + timedelta(hours=19)
                )
                transactions_to_seed.append(tx)
                accounts_dict["HDFC Credit Card"].balance -= shop_amount
                
            # Entertainment: Occasional Sunday
            if weekday == 6 and day % 3 == 0:
                ent_amount = round(random.uniform(600.0, 1800.0), 2)
                tx = Transaction(
                    user_id=demo_user.id,
                    account_id=accounts_dict["HDFC Credit Card"].id,
                    category_id=categories_by_name["Entertainment"].id,
                    type="Expense",
                    amount=ent_amount,
                    description=random.choice(["PVR Cinema tickets", "Netflix subscription renewal", "Spotify Premium monthly", "Bowling & Gaming zone"]),
                    date=current_time + timedelta(hours=16)
                )
                transactions_to_seed.append(tx)
                accounts_dict["HDFC Credit Card"].balance -= ent_amount

            # Anomaly: Large Shopping expense in March 2026 (Keep as standard transaction, no outlier tagging needed)
            if current_time.year == 2026 and current_time.month == 3 and day == 14:
                tx = Transaction(
                    user_id=demo_user.id,
                    account_id=accounts_dict["HDFC Credit Card"].id,
                    category_id=categories_by_name["Shopping"].id,
                    type="Expense",
                    amount=48000.0,
                    description="MacBook Air M2 (Croma Electronic Store)",
                    date=current_time + timedelta(hours=14)
                )
                transactions_to_seed.append(tx)
                accounts_dict["HDFC Credit Card"].balance -= 48000.0
                
            # Anomaly: Large Medical expense in January 2026
            if current_time.year == 2026 and current_time.month == 1 and day == 18:
                tx = Transaction(
                    user_id=demo_user.id,
                    account_id=accounts_dict["ICICI Savings Account"].id,
                    category_id=categories_by_name["Healthcare"].id,
                    type="Expense",
                    amount=36000.0,
                    description="Dental Root Canal & Orthodontic Braces",
                    date=current_time + timedelta(hours=11)
                )
                transactions_to_seed.append(tx)
                accounts_dict["ICICI Savings Account"].balance -= 36000.0

            # Increment current time by 1 day
            current_time += timedelta(days=1)
            
        print(f"Adding {len(transactions_to_seed)} transactions and {len(transfers_to_seed)} self-transfers...")
        db.add_all(transactions_to_seed)
        db.add_all(transfers_to_seed)
        db.commit()
        
        # Log final calculated balances
        print("Final Account Balances calculated incrementally:")
        for name, acc in accounts_dict.items():
            print(f"- {name}: {acc.balance:.2f} INR")
            db.add(acc)
        db.commit()

        # Seed notifications
        print("Seeding Notifications...")
        notifications = [
            Notification(
                user_id=demo_user.id,
                type="Info",
                message="Welcome to Finance Pro! Make sure to set a secure 4/6-digit session PIN in settings.",
                is_read=True,
                created_at=datetime.utcnow() - timedelta(days=15)
            ),
            Notification(
                user_id=demo_user.id,
                type="BudgetWarning",
                message="Monthly budget warning: You have exceeded 95% of your Shopping category planned outlay.",
                is_read=False,
                created_at=datetime.utcnow() - timedelta(days=2)
            ),
        ]
        db.add_all(notifications)
        db.commit()

        # Seed Support Tickets
        print("Seeding Support Tickets...")
        tickets = [
            SupportTicket(
                user_id=demo_user.id,
                subject="Difficulty linking credit cards",
                description="I am unable to retrieve statements from my supplementary credit cards. The connection fails repeatedly with a network error.",
                type="Bug",
                status="Open",
                created_at=datetime.utcnow() - timedelta(days=6)
            ),
            SupportTicket(
                user_id=demo_user.id,
                subject="Request: Joint family accounts",
                description="It would be amazing to support a shared wallet structure where my spouse and I can log transactions into a common pool under different permissions.",
                type="FeatureRequest",
                status="Closed",
                created_at=datetime.utcnow() - timedelta(days=12)
            )
        ]
        db.add_all(tickets)
        db.commit()

        # Seed Analytics Snapshots (one for each of the last 4 months)
        print("Seeding Analytics Snapshots...")
        snapshots = [
            AnalyticsSnapshot(
                user_id=demo_user.id,
                date=datetime(2026, 2, 28),
                total_balance=215000.00,
                savings_rate=38.5,
                health_score=82,
                insights='["Your savings rate rose by 4% compared to January.", "Utilities spending was stable.", "Food dining remains a primary expense item."]'
            ),
            AnalyticsSnapshot(
                user_id=demo_user.id,
                date=datetime(2026, 3, 31),
                total_balance=164000.00,
                savings_rate=5.2,
                health_score=58,
                insights='["Savings rate dropped significantly due to a large outlier Shopping transaction of 48,000 INR.", "Consider postponing non-essential shopping to recover savings levels next month."]'
            ),
            AnalyticsSnapshot(
                user_id=demo_user.id,
                date=datetime(2026, 4, 30),
                total_balance=208000.00,
                savings_rate=42.1,
                health_score=89,
                insights='["Excellent recovery! Savings rate rose by 36% compared to March.", "Frugal day count increased, showing great expense control."]'
            )
        ]
        db.add_all(snapshots)
        db.commit()

        print("Database Seeding Completed Successfully!")
        
    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
