import pandas as pd
import numpy as np
import re
from datetime import datetime, timedelta
from typing import List, Dict, Any
from ..models.finance import Transaction, Account, Category
from ..services.ds_service import get_basic_kpis

class CoachService:
    def __init__(self, db_session, user_id: int):
        self.db = db_session
        self.user_id = user_id
        
        # Load user context data
        self.accounts = self.db.query(Account).filter(Account.user_id == self.user_id, Account.is_archived == False).all()
        self.categories = self.db.query(Category).filter((Category.user_id == self.user_id) | (Category.user_id == None)).all()
        self.transactions = self.db.query(Transaction).filter(Transaction.user_id == self.user_id).all()
        
        # Compute baseline numbers
        self.total_balance = sum(a.balance for a in self.accounts)
        self.liquid_balance = sum(a.balance for a in self.accounts if a.type in ["Savings", "Cash", "Wallet"])
        
        # Current month boundary
        now = datetime.utcnow()
        self.current_year = now.year
        self.current_month = now.month
        self.days_in_month = pd.Period(now.strftime("%Y-%m")).days_in_month
        self.day_of_month = now.day
        
        # Filter transactions
        self.current_month_tx = []
        self.historical_tx = []
        for tx in self.transactions:
            tx_date = tx.date
            if tx_date.year == self.current_year and tx_date.month == self.current_month:
                self.current_month_tx.append(tx)
            else:
                self.historical_tx.append(tx)
                
        # Income and Expense aggregates
        self.current_month_income = sum(t.amount for t in self.current_month_tx if t.type == "Income")
        self.current_month_expense = sum(t.amount for t in self.current_month_tx if t.type == "Expense")
        
        # Fallback income if no transactions present
        self.monthly_income_baseline = self.current_month_income
        if self.monthly_income_baseline == 0:
            hist_income = sum(t.amount for t in self.historical_tx if t.type == "Income")
            hist_months = len(set((t.date.year, t.date.month) for t in self.historical_tx))
            if hist_months > 0:
                self.monthly_income_baseline = hist_income / hist_months
            else:
                self.monthly_income_baseline = 50000.0 # Standard fallback
                
        self.monthly_expense_average = self.current_month_expense
        hist_expense = sum(t.amount for t in self.historical_tx if t.type == "Expense")
        hist_months = len(set((t.date.year, t.date.month) for t in self.historical_tx))
        if hist_months > 0:
            self.monthly_expense_average = (hist_expense + self.current_month_expense) / (hist_months + 1)
        if self.monthly_expense_average == 0:
            self.monthly_expense_average = 20000.0 # Standard fallback

    def get_insights_dashboard(self) -> Dict[str, Any]:
        savings_rate = self.calculate_savings_rate()
        health_score, explanation = self.calculate_health_score(savings_rate)
        budget_suggestions = self.generate_budget_rules()
        risks = self.detect_spending_risks()
        insights = self.generate_personalized_insights()
        review = self.generate_monthly_review(savings_rate)
        savings_recommendations = self.generate_smart_savings()
        warnings = self.generate_predictive_warnings()
        
        return {
            "income_baseline": round(self.monthly_income_baseline, 2),
            "current_month_income": round(self.current_month_income, 2),
            "current_month_expense": round(self.current_month_expense, 2),
            "liquid_balance": round(self.liquid_balance, 2),
            "total_balance": round(self.total_balance, 2),
            "savings_rate": round(savings_rate, 2),
            "health_score": health_score,
            "explanation": explanation,
            "budget_suggestions": budget_suggestions,
            "risks": risks,
            "insights": insights,
            "monthly_review": review,
            "savings_recommendations": savings_recommendations,
            "predictive_warnings": warnings
        }

    def calculate_savings_rate(self) -> float:
        if self.monthly_income_baseline > 0:
            surplus = self.monthly_income_baseline - self.current_month_expense
            return max(0.0, (surplus / self.monthly_income_baseline) * 100)
        return 0.0

    def calculate_health_score(self, savings_rate: float) -> tuple[int, List[Dict[str, Any]]]:
        score = 0
        explanations = []
        
        # 1. Savings Rate (Max 25 pts)
        if savings_rate >= 35:
            score += 25
            explanations.append({"type": "good", "msg": f"Outstanding savings rate of {round(savings_rate, 1)}%."})
        elif savings_rate >= 20:
            score += 20
            explanations.append({"type": "good", "msg": f"Healthy savings rate of {round(savings_rate, 1)}% (Target: 20%)."})
        elif savings_rate >= 10:
            score += 10
            explanations.append({"type": "warning", "msg": f"Modest savings rate of {round(savings_rate, 1)}%. Try to save at least 20%."})
        else:
            explanations.append({"type": "bad", "msg": "Low savings rate. Almost all income is spent."})
            
        # 2. Budget Adherence (Max 25 pts)
        budgeted_categories = [c for c in self.categories if c.type == "Expense" and c.planned_outlay > 0]
        exceeded_count = 0
        exceeded_categories = []
        
        for cat in budgeted_categories:
            spent = sum(t.amount for t in self.current_month_tx if t.category_id == cat.id)
            if spent > cat.planned_outlay:
                exceeded_count += 1
                exceeded_categories.append(cat.name)
                
        if len(budgeted_categories) == 0:
            score += 20
            explanations.append({"type": "warning", "msg": "No budget limits defined. Configure budgets to track overspending."})
        elif exceeded_count == 0:
            score += 25
            explanations.append({"type": "good", "msg": "Perfect budget adherence! No category limits exceeded."})
        elif exceeded_count <= 2:
            score += 15
            explanations.append({"type": "warning", "msg": f"Minor overspending in: {', '.join(exceeded_categories)}."})
        else:
            score += 5
            explanations.append({"type": "bad", "msg": f"Critical overspending in {exceeded_count} budget categories."})
            
        # 3. Income Stability (Max 20 pts)
        kpis = get_basic_kpis(self.transactions, self.accounts)
        stability = kpis.get("income_stability", "Medium")
        if stability == "High":
            score += 20
            explanations.append({"type": "good", "msg": "Very stable monthly income streams."})
        elif stability == "Medium":
            score += 15
            explanations.append({"type": "good", "msg": "Consistent monthly income stream detected."})
        else:
            score += 5
            explanations.append({"type": "warning", "msg": "Income is highly variable. Build a larger savings safety cushion."})
            
        # 4. Emergency Fund Level (Max 20 pts)
        emergency_months = self.liquid_balance / self.monthly_expense_average if self.monthly_expense_average > 0 else 0
        if emergency_months >= 6:
            score += 20
            explanations.append({"type": "good", "msg": f"Excellent emergency reserve covering {round(emergency_months, 1)} months of expenses."})
        elif emergency_months >= 3:
            score += 15
            explanations.append({"type": "good", "msg": f"Solid emergency safety net covering {round(emergency_months, 1)} months of expenses."})
        elif emergency_months >= 1:
            score += 10
            explanations.append({"type": "warning", "msg": f"Small emergency fund covering {round(emergency_months, 1)} months. Target is 3-6 months."})
        else:
            score += 5
            explanations.append({"type": "bad", "msg": "Low emergency reserves. You are vulnerable to unexpected bills."})
            
        # 5. Spending Spikes / Consistency (Max 10 pts)
        large_spikes = [t for t in self.current_month_tx if t.type == "Expense" and t.amount > (self.monthly_income_baseline * 0.25)]
        if not large_spikes:
            score += 10
            explanations.append({"type": "good", "msg": "Consistent, steady spending behavior throughout the month."})
        else:
            score += 5
            explanations.append({"type": "warning", "msg": f"Detected {len(large_spikes)} large single purchase spending spikes."})
            
        return score, explanations

    def generate_budget_rules(self) -> Dict[str, Any]:
        income = self.monthly_income_baseline
        return {
            "rule_50_30_20": {
                "needs": income * 0.50,
                "wants": income * 0.30,
                "savings": income * 0.20,
                "allocations": {
                    "Rent & Housing": income * 0.30,
                    "Utilities": income * 0.10,
                    "Food & Dining": income * 0.15,
                    "Shopping": income * 0.10,
                    "Entertainment & Travel": income * 0.10,
                    "Savings & Investments": income * 0.20,
                    "Other": income * 0.05
                }
            },
            "rule_60_20_20": {
                "needs": income * 0.60,
                "wants": income * 0.20,
                "savings": income * 0.20,
                "allocations": {
                    "Rent & Housing": income * 0.35,
                    "Utilities": income * 0.15,
                    "Food & Dining": income * 0.12,
                    "Shopping": income * 0.08,
                    "Entertainment & Travel": income * 0.05,
                    "Savings & Investments": income * 0.20,
                    "Other": income * 0.05
                }
            },
            "rule_aggressive": {
                "needs": income * 0.40,
                "wants": income * 0.15,
                "savings": income * 0.45,
                "allocations": {
                    "Rent & Housing": income * 0.25,
                    "Utilities": income * 0.08,
                    "Food & Dining": income * 0.10,
                    "Shopping": income * 0.05,
                    "Entertainment & Travel": income * 0.05,
                    "Savings & Investments": income * 0.45,
                    "Other": income * 0.02
                }
            },
            "rule_debt": {
                "needs": income * 0.50,
                "wants": income * 0.10,
                "savings": income * 0.10,
                "debt_payoff": income * 0.30,
                "allocations": {
                    "Rent & Housing": income * 0.30,
                    "Utilities": income * 0.10,
                    "Food & Dining": income * 0.10,
                    "Shopping": income * 0.05,
                    "Entertainment & Travel": income * 0.05,
                    "Savings & Investments": income * 0.10,
                    "Debt Repayment": income * 0.30
                }
            }
        }

    def detect_spending_risks(self) -> List[str]:
        risks = []
        budgeted_categories = [c for c in self.categories if c.type == "Expense" and c.planned_outlay > 0]
        for cat in budgeted_categories:
            spent = sum(t.amount for t in self.current_month_tx if t.category_id == cat.id)
            if spent > cat.planned_outlay:
                overage = spent - cat.planned_outlay
                risks.append(f"Exceeded budget in '{cat.name}': spent ₹{int(spent):,} which is ₹{int(overage):,} over limit.")
                
        if self.historical_tx:
            df_hist = pd.DataFrame([{
                "amount": t.amount, "type": t.type, "date": t.date, "cat": t.category.name if t.category else "Other"
            } for t in self.historical_tx])
            
            df_curr = pd.DataFrame([{
                "amount": t.amount, "type": t.type, "date": t.date, "cat": t.category.name if t.category else "Other"
            } for t in self.current_month_tx])
            
            if not df_hist.empty and not df_curr.empty:
                hist_expenses = df_hist[df_hist["type"] == "Expense"]
                curr_expenses = df_curr[df_curr["type"] == "Expense"]
                hist_cat_avg = hist_expenses.groupby("cat")["amount"].sum()
                hist_months = len(set((t.date.year, t.date.month) for t in self.historical_tx))
                if hist_months > 0:
                    hist_cat_avg = hist_cat_avg / hist_months
                    curr_cat_sum = curr_expenses.groupby("cat")["amount"].sum()
                    
                    for cat_name, curr_sum in curr_cat_sum.items():
                        hist_avg = hist_cat_avg.get(cat_name, 0.0)
                        if hist_avg > 1000.0:
                            increase = ((curr_sum - hist_avg) / hist_avg) * 100
                            if increase > 35:
                                risks.append(f"Significant spend spike: '{cat_name}' spending is up {int(increase)}% compared to historical averages.")
                                
        wants_cats = ["Shopping", "Food & Dining", "Entertainment", "Travel"]
        wants_sum = 0
        for tx in self.current_month_tx:
            if tx.type == "Expense" and tx.category and any(wc in tx.category.name for wc in wants_cats):
                wants_sum += tx.amount
        if self.monthly_income_baseline > 0:
            wants_ratio = (wants_sum / self.monthly_income_baseline) * 100
            if wants_ratio > 40:
                risks.append(f"High discretionary spend: Wants consume {int(wants_ratio)}% of monthly income.")
                
        if not risks:
            risks.append("No active spending risks or anomalies detected so far this month.")
        return risks

    def generate_personalized_insights(self) -> List[str]:
        insights = []
        rent_cat = next((c for c in self.categories if "Rent" in c.name), None)
        if rent_cat:
            rent_spent = sum(t.amount for t in self.current_month_tx if t.category_id == rent_cat.id)
            if rent_spent > 0 and self.monthly_income_baseline > 0:
                rent_ratio = (rent_spent / self.monthly_income_baseline) * 100
                if rent_ratio > 35:
                    insights.append(f"Your rent consumes {int(rent_ratio)}% of income (Recommended target: < 30%).")
                else:
                    insights.append(f"Great job keeping rent at {int(rent_ratio)}% of monthly income.")
                    
        surplus = self.monthly_income_baseline - self.current_month_expense
        if surplus > 0:
            target = 100000.0
            months = target / surplus
            insights.append(f"Saving your surplus of ₹{int(surplus):,} builds a ₹1 Lakh emergency fund in {max(1, int(round(months)))} months.")
        else:
            insights.append("Your current spending exceeds income. Trim dining out or shopping to restore a savings surplus.")
            
        dining_cat = next((c for c in self.categories if "Food" in c.name or "Dining" in c.name), None)
        if dining_cat:
            dining_spent = sum(t.amount for t in self.current_month_tx if t.category_id == dining_cat.id)
            if dining_spent > 1500:
                savings_pot = dining_spent * 0.15
                insights.append(f"Reducing Dining out by 15% will save ₹{int(savings_pot):,} this month.")
                
        if len(insights) < 3:
            insights.append("Consistently tracking utility bills and automated subscriptions can reduce fixed needs by 10% on average.")
        return insights

    def generate_monthly_review(self, savings_rate: float) -> Dict[str, Any]:
        cat_totals = {}
        for tx in self.current_month_tx:
            if tx.type == "Expense" and tx.category:
                cat_totals[tx.category.name] = cat_totals.get(tx.category.name, 0.0) + tx.amount
                
        highest_cat = "N/A"
        highest_amt = 0.0
        best_cat = "N/A"
        best_amt = 9999999.0
        
        for cat, amt in cat_totals.items():
            if amt > highest_amt:
                highest_amt = amt
                highest_cat = cat
            if amt < best_amt and amt > 0:
                best_amt = amt
                best_cat = cat
                
        if savings_rate >= 40:
            grade = "A"
        elif savings_rate >= 25:
            grade = "B"
        elif savings_rate >= 15:
            grade = "C"
        elif savings_rate >= 5:
            grade = "D"
        else:
            grade = "F"
            
        return {
            "income": round(self.current_month_income, 2),
            "expense": round(self.current_month_expense, 2),
            "savings": round(max(0.0, self.current_month_income - self.current_month_expense), 2),
            "savings_rate": round(savings_rate, 2),
            "highest_category": highest_cat,
            "highest_spent": round(highest_amt, 2),
            "best_category": best_cat,
            "best_spent": round(best_amt, 2) if best_amt < 9999999.0 else 0.0,
            "grade": grade
        }

    def generate_smart_savings(self) -> Dict[str, Any]:
        surplus = max(0.0, self.monthly_income_baseline - self.current_month_expense)
        safe_to_save = surplus * 0.85
        trim_suggestions = []
        cat_totals = {}
        for tx in self.current_month_tx:
            if tx.type == "Expense" and tx.category:
                cat_totals[tx.category.name] = cat_totals.get(tx.category.name, 0.0) + tx.amount
                
        discretionary_spend = 0.0
        for cat, amt in cat_totals.items():
            if cat in ["Shopping", "Food & Dining", "Entertainment", "Travel"]:
                discretionary_spend += amt
                trim_suggestions.append(f"Reduce '{cat}' by 15% to save ₹{int(amt * 0.15):,}")
                
        if not trim_suggestions:
            trim_suggestions.append("Maintain spending rates. No large discretionary outlays detected.")
            
        return {
            "safe_to_save": round(safe_to_save, 2),
            "potential_trim": trim_suggestions,
            "discretionary_total": round(discretionary_spend, 2)
        }

    def generate_predictive_warnings(self) -> List[str]:
        warnings = []
        budgeted_categories = [c for c in self.categories if c.type == "Expense" and c.planned_outlay > 0]
        for cat in budgeted_categories:
            spent = sum(t.amount for t in self.current_month_tx if t.category_id == cat.id)
            if spent > 0 and spent < cat.planned_outlay and self.day_of_month > 0:
                daily_avg = spent / self.day_of_month
                days_left = self.days_in_month - self.day_of_month
                projected_total = spent + (daily_avg * days_left)
                
                if projected_total > cat.planned_outlay:
                    days_to_exceed = int(cat.planned_outlay / daily_avg) - self.day_of_month
                    if days_to_exceed > 0:
                        warnings.append(f"At this spend rate, you may exceed your '{cat.name}' budget in {days_to_exceed} days.")
                        
        if self.day_of_month > 0:
            daily_run_rate = self.current_month_expense / self.day_of_month
            month_end_projected = daily_run_rate * self.days_in_month
            warnings.append(f"Projected month-end expenses are on track to hit ₹{int(month_end_projected):,}.")
            
        if self.historical_tx:
            kpis = get_basic_kpis(self.historical_tx, self.accounts)
            avg_savings = kpis.get("savings_rate", 20.0)
            current_rate = self.calculate_savings_rate()
            if current_rate < (avg_savings * 0.85):
                warnings.append(f"Projected savings rate ({round(current_rate, 1)}%) is lower than historical avg ({round(avg_savings, 1)}%).")
                
        if len(warnings) < 2:
            warnings.append("Projected savings rate is currently steady and aligned with targets.")
        return warnings

    def answer_conversational_query(self, query: str) -> str:
        q = query.lower().strip()
        
        # 1. Intent Classification
        intent = self.classify_intent(q)
        
        # 2. Intent Routing
        if intent == "cfo_review":
            return self.handle_cfo_review()
        elif intent == "health_score":
            return self.handle_health_score()
        elif intent == "spending_risks":
            return self.handle_spending_risks()
        elif intent == "savings_optimization":
            return self.handle_savings_optimization()
        elif intent == "salary_increase":
            return self.handle_salary_increase(q)
        elif intent == "goal_acceleration":
            return self.handle_goal_acceleration(q)
        elif intent == "spending_habit":
            return self.handle_spending_habits()
        elif intent == "lifestyle_inflation":
            return self.handle_lifestyle_inflation()
        elif intent == "emergency_fund":
            return self.handle_emergency_fund_query(q)
        elif intent == "affordability":
            return self.handle_affordability_query(q)
        else:
            # Fallback check for standard help
            return "I can answer specific questions about your real-time finances! Try asking one of the quick suggestions above, or type things like:\n\n" \
                   "• 'Give me a CFO Review report'\n" \
                   "• 'Am I overspending?'\n" \
                   "• 'What happens if my salary increases by ₹15,000?'\n" \
                   "• 'How long to build a ₹2 lakh emergency fund?'\n" \
                   "• 'Show my spending habits'"

    def classify_intent(self, q: str) -> str:
        intents = {
            "cfo_review": ["cfo", "chief financial officer", "financial review", "full audit", "give me a financial review", "rate my money management"],
            "health_score": ["health score", "how healthy", "diagnose", "diagnostic", "rate my finances", "health", "how are my finances", "rate my money"],
            "spending_risks": ["spending risk", "spending warning", "spending alert", "overspend", "overspending", "budget overrun", "leak"],
            "savings_optimization": ["save more", "optimize savings", "trim budget", "cut expenses", "trimming", "savings opportunity", "reduce spending"],
            "salary_increase": ["salary increase", "pay raise", "salary raise", "income increase", "salary bump", "make more", "earn more", "what if my salary"],
            "goal_acceleration": ["accelerate", "speed up", "reach goal faster", "save faster", "timeline drop", "acceleration"],
            "spending_habit": ["spending habit", "spending pattern", "behavior analysis", "how do i spend", "spending style", "habits"],
            "lifestyle_inflation": ["lifestyle inflation", "lifestyle creep", "spending creep", "spending growth", "spending grow", "inflating"],
            "emergency_fund": ["emergency fund", "safety net", "safety cushion", "build emergency"],
            "affordability": ["afford", "can i buy", "purchase", "affordability"]
        }
        
        # Prefix/Contains checking
        for intent_name, phrases in intents.items():
            for phrase in phrases:
                if phrase in q:
                    return intent_name
                    
        # Fallback keyword counts
        scores = {}
        words = q.split()
        for intent_name, phrases in intents.items():
            score = 0
            for phrase in phrases:
                phrase_words = phrase.split()
                if all(pw in words for pw in phrase_words):
                    score += len(phrase_words) * 2
                else:
                    matching = sum(1 for pw in phrase_words if pw in words)
                    score += matching
            scores[intent_name] = score
            
        best_intent = max(scores, key=scores.get)
        if scores[best_intent] > 0:
            return best_intent
        return "general"

    # --- CFO REVIEW HANDLER ---
    def handle_cfo_review(self) -> str:
        savings_rate = self.calculate_savings_rate()
        score, explanation = self.calculate_health_score(savings_rate)
        review = self.generate_monthly_review(savings_rate)
        risks = self.detect_spending_risks()
        smart_save = self.generate_smart_savings()
        
        # Divide explanations into strengths & weaknesses
        strengths = [item["msg"] for item in explanation if item["type"] == "good"]
        weaknesses = [item["msg"] for item in explanation if item["type"] in ["warning", "bad"]]
        
        # Format overspent categories
        overspent = []
        budgeted_categories = [c for c in self.categories if c.type == "Expense" and c.planned_outlay > 0]
        for cat in budgeted_categories:
            spent = sum(t.amount for t in self.current_month_tx if t.category_id == cat.id)
            if spent > cat.planned_outlay:
                diff = spent - cat.planned_outlay
                overspent.append(f"• **{cat.name}**: spent ₹{int(spent):,} (₹{int(diff):,} over limit)")
        if not overspent:
            overspent.append("• *None! All active categories are within budget.*")
            
        strength_bullets = "\n".join(f"✓ {s}" for s in strengths) if strengths else "✓ *No high strengths detected yet.*"
        weakness_bullets = "\n".join(f"⚠ {w}" for w in weaknesses) if weaknesses else "⚠ *No major weaknesses detected.*"
        
        # Recommended actions
        actions = []
        for suggestion in smart_save.get("potential_trim", []):
            actions.append(f"1. {suggestion}.")
        if len(actions) < 2:
            actions.append("1. Keep dining & shopping outlays below standard limit targets.")
            actions.append("2. Set up automated salary-day savings sweeps to lock in surplus.")
            
        action_bullets = "\n".join(actions)
        
        return f"💼 **CFO FINANCIAL AUDIT REPORT**\n" \
               f"------------------------------------------------\n" \
               f"**Financial Health Grade**: Grade {review['grade']}\n" \
               f"**Financial Health Score**: {score} / 100\n" \
               f"**Active Savings Rate**: {round(savings_rate, 1)}%\n\n" \
               f"**Key Strengths**:\n" \
               f"{strength_bullets}\n\n" \
               f"**Weaknesses & Risks**:\n" \
               f"{weakness_bullets}\n\n" \
               f"**Top Overspending Categories**:\n" \
               f"{chr(10).join(overspent)}\n\n" \
               f"**Recommended Actions This Month**:\n" \
               f"{action_bullets}\n\n" \
               f"**Estimated Monthly Savings Opportunity**:\n" \
               f"Trim opportunities yield up to **₹{int(smart_save.get('discretionary_total', 0) * 0.15):,}** back into your wallet."

    # --- HEALTH SCORE HANDLER ---
    def handle_health_score(self) -> str:
        savings_rate = self.calculate_savings_rate()
        score, explanation = self.calculate_health_score(savings_rate)
        bullets = "\n".join(f"{'✓' if item['type'] == 'good' else '⚠'} {item['msg']}" for item in explanation)
        return f"📊 **Financial Health Diagnosis**\n\n" \
               f"Your current Financial Health Score is **{score} / 100**.\n\n" \
               f"**Details**:\n{bullets}\n\n" \
               f"To increase your score, maintain a savings rate above 20% and define planned outlays under Budgets & Categories to keep spending controlled."

    # --- SPENDING RISKS HANDLER ---
    def handle_spending_risks(self) -> str:
        risks = self.detect_spending_risks()
        bullets = "\n".join(f"• {risk}" for risk in risks)
        return f"🚨 **Spending Risk Assessment**\n\n" \
               f"Here are the active warnings detected from your recent database transactions:\n\n{bullets}\n\n" \
               f"Check your Active Budgets widget on the dashboard to verify how much run-rate budget is remaining."

    # --- SAVINGS OPTIMIZATION HANDLER ---
    def handle_savings_optimization(self) -> str:
        smart_save = self.generate_smart_savings()
        trims = "\n".join(f"• {trim}" for trim in smart_save["potential_trim"])
        return f"💡 **Savings Optimization Plan**\n\n" \
               f"• **Safe-to-Save Surplus**: ₹{smart_save['safe_to_save']:.0f} (the amount you can safely deposit into savings/investments based on current months cash flow).\n" \
               f"• **Trim Guidelines**:\n{trims}\n\n" \
               f"Reducing discretionary spending by 15% is the fastest way to hit your emergency and shopping goals without altering fixed needs."

    # --- SALARY INCREASE SIMULATOR ---
    def handle_salary_increase(self, q: str) -> str:
        # Detect increase amount
        import re
        numbers = re.findall(r'\d[\d,\.]*', q)
        increase_amt = 10000.0 # Default ₹10,000 raise
        if numbers:
            try:
                increase_amt = float(numbers[0].replace(',', ''))
            except ValueError:
                pass
                
        old_income = self.monthly_income_baseline
        new_income = old_income + increase_amt
        old_surplus = max(0.0, old_income - self.current_month_expense)
        new_surplus = old_surplus + increase_amt
        
        old_rate = (old_surplus / old_income * 100) if old_income > 0 else 0
        new_rate = (new_surplus / new_income * 100)
        
        # emergency fund acceleration
        target = 100000.0
        old_months = target / old_surplus if old_surplus > 0 else 24
        new_months = target / new_surplus
        
        return f"📈 **Salary Increase Scenario Simulator (₹{increase_amt:,.0f} Raise)**\n\n" \
               f"If your monthly income increases by ₹{increase_amt:,.0f}:\n\n" \
               f"• **Monthly Income**: Grows from ₹{old_income:,.0f} to **₹{new_income:,.0f}**.\n" \
               f"• **Monthly Surplus**: Grows from ₹{old_surplus:,.0f} to **₹{new_surplus:,.0f}**.\n" \
               f"• **Savings Rate**: Boosted from {round(old_rate, 1)}% to **{round(new_rate, 1)}%**.\n" \
               f"• **Goal Acceleration**: Time to build a ₹1 Lakh Emergency Fund drops from {max(1, int(round(old_months)))} months to **{max(1, int(round(new_months)))} months** (saving you {max(0, int(round(old_months - new_months)))} months!)."

    # --- GOAL ACCELERATION HANDLER ---
    def handle_goal_acceleration(self, q: str) -> str:
        monthly_surplus = max(1000, self.monthly_income_baseline - self.current_month_expense)
        extra_contribution = monthly_surplus * 0.15 # 15% extra contribution
        target_goal = 150000.0
        
        standard_months = target_goal / (monthly_surplus * 0.40)
        accel_months = target_goal / ((monthly_surplus * 0.40) + extra_contribution)
        
        time_saved = max(1, int(round(standard_months - accel_months)))
        
        return f"⚡ **Goal Acceleration Analysis**\n\n" \
               f"By optimizing discretionary budgets and increasing monthly contributions by 15% of your surplus (+₹{extra_contribution:,.0f}/month):\n\n" \
               f"• You accelerate savings towards a standard ₹1.5 Lakh target.\n" \
               f"• **Standard Timeline**: {max(1, int(round(standard_months)))} months.\n" \
               f"• **Accelerated Timeline**: {max(1, int(round(accel_months)))} months.\n" \
               f"• **Time Saved**: You reach your financial goal **{time_saved} months faster**!"

    # --- SPENDING HABIT ANALYSIS ---
    def handle_spending_habits(self) -> str:
        if not self.current_month_tx:
            return "You don't have any logged transactions in your ledger this month. Try logging expenses to analyze your habits."
            
        cat_totals = {}
        for tx in self.current_month_tx:
            if tx.type == "Expense" and tx.category:
                cat_totals[tx.category.name] = cat_totals.get(tx.category.name, 0.0) + tx.amount
                
        needs_cats = ["Rent", "Housing", "Utilities", "Bills", "Groceries", "Tax", "Healthcare"]
        wants_cats = ["Dining", "Food", "Shopping", "Entertainment", "Travel", "Splurge"]
        
        needs_sum = 0.0
        wants_sum = 0.0
        
        for cat, amt in cat_totals.items():
            if any(nc in cat for nc in needs_cats):
                needs_sum += amt
            elif any(wc in cat for wc in wants_cats):
                wants_sum += amt
            else:
                wants_sum += amt # Default other/discretionary
                
        total_exp = needs_sum + wants_sum
        needs_pct = (needs_sum / total_exp * 100) if total_exp > 0 else 50
        wants_pct = (wants_sum / total_exp * 100) if total_exp > 0 else 50
        
        # Highest volume category
        sorted_cats = sorted(cat_totals.items(), key=lambda x: x[1], reverse=True)
        top_cat = sorted_cats[0][0] if sorted_cats else "N/A"
        top_amt = sorted_cats[0][1] if sorted_cats else 0.0
        
        return f"🔍 **Spending Habit Audit**\n\n" \
               f"Your expenses are balanced as follows:\n" \
               f"• **Fixed Needs**: {round(needs_pct, 1)}% of spending (₹{needs_sum:,.0f}).\n" \
               f"• **Discretionary Wants**: {round(wants_pct, 1)}% of spending (₹{wants_sum:,.0f}).\n\n" \
               f"**Primary Driver**: Your largest spending category is **{top_cat}** at ₹{top_amt:,.0f}.\n" \
               f"For ideal financial hygiene, aim for a 50% Needs / 30% Wants / 20% Savings split."

    # --- LIFESTYLE INFLATION DETECTION ---
    def handle_lifestyle_inflation(self) -> str:
        if not self.historical_tx:
            return "No historical transactions found to assess lifestyle inflation trend. I will track your month-over-month ledger entries to analyze creep."
            
        hist_expense_sum = sum(t.amount for t in self.historical_tx if t.type == "Expense")
        hist_months = len(set((t.date.year, t.date.month) for t in self.historical_tx))
        
        if hist_months == 0:
            return "Add transactions across multiple months to run lifestyle inflation creep analysis."
            
        avg_hist_expense = hist_expense_sum / hist_months
        curr_expense = self.current_month_expense
        
        if curr_expense > (avg_hist_expense * 1.12):
            increase = ((curr_expense - avg_hist_expense) / avg_hist_expense) * 100
            return f"⚠️ **Lifestyle Inflation Detected**\n\n" \
                   f"Your current monthly spending (₹{curr_expense:,.0f}) is **{int(increase)}% higher** than your historical monthly average of ₹{avg_hist_expense:,.0f}.\n\n" \
                   f"This indicates lifestyle creep. Verify if this increase is due to temporary emergency costs or permanent hikes in discretionary categories like Shopping or Entertainment."
        else:
            return f"✅ **Spending Stability Confirmed**\n\n" \
                   f"Your current monthly expenses (₹{curr_expense:,.0f}) are aligned with your historical average of ₹{avg_hist_expense:,.0f}. No lifestyle creep detected. Keep maintaining this consistent spending behavior!"

    # --- EMERGENCY FUND HANDLER ---
    def handle_emergency_fund_query(self, q: str) -> str:
        import re
        numbers = re.findall(r'\d[\d,\.]*', q)
        target = 150000.0
        if numbers:
            try:
                target = float(numbers[0].replace(',', ''))
            except ValueError:
                pass
        
        monthly_surplus = max(0.0, self.monthly_income_baseline - self.current_month_expense)
        if monthly_surplus > 0:
            months = (target - self.liquid_balance) / monthly_surplus
            if months <= 0:
                return f"Excellent! Your liquid balances (₹{self.liquid_balance:,.0f}) cover your safety cushion target of ₹{target:,.0f}."
            else:
                return f"To construct a ₹{target:,.0f} emergency net (Liquid savings: ₹{self.liquid_balance:,.0f}), you need to save ₹{target - self.liquid_balance:,.0f}. Depositing your monthly surplus (₹{monthly_surplus:,.0f}) will take **{max(1, int(round(months)))} months**."
        else:
            return f"Currently, you do not have a positive savings surplus. Saving ₹5,000/month by trimming wants will build a ₹{target:,.0f} fund in **{max(1, int(round((target-self.liquid_balance)/5000)))} months**."

    # --- AFFORDABILITY HANDLER ---
    def handle_affordability_query(self, q: str) -> str:
        import re
        numbers = re.findall(r'\d[\d,\.]*', q)
        amount = 0.0
        if numbers:
            try:
                amount = float(numbers[0].replace(',', ''))
            except ValueError:
                pass
        
        item = "this item"
        for word in ["bike", "phone", "car", "house", "vacation", "trip", "laptop", "watch"]:
            if word in q:
                item = f"a {word}"
                break
                
        if amount > 0:
            monthly_surplus = max(0.0, self.monthly_income_baseline - self.current_month_expense)
            if amount <= self.total_balance * 0.15:
                return f"Yes, you can afford {item} worth ₹{amount:,.0f} comfortably. It accounts for only {round((amount / self.total_balance) * 100, 1)}% of total net worth (₹{self.total_balance:,.0f})."
            elif amount <= self.total_balance:
                months = amount / monthly_surplus if monthly_surplus > 0 else 12
                return f"You can afford {item} worth ₹{amount:,.0f}, but it consumes a significant part ({round((amount / self.total_balance) * 100, 1)}%) of your net worth. I recommend setting aside a monthly contribution of ₹{int(amount/6):,.0f} for 6 months, or saving over {int(round(months))} months from your monthly surplus (₹{monthly_surplus:,.0f}/mo)."
            else:
                return f"Currently, ₹{amount:,.0f} exceeds your aggregate balances of ₹{self.total_balance:,.0f} (Deficit: ₹{amount - self.total_balance:,.0f}). Focus on building emergency reserves first, then plan a saving layout of ₹{int(amount/24):,.0f}/month for 24 months."
        return "To evaluate affordability, please provide the price, e.g. 'Can I afford a bike worth ₹1,20,000?'."
