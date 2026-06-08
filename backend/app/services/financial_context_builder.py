"""
financial_context_builder.py
────────────────────────────
Builds a rich, structured financial context JSON for the AI advisor.
All data is sourced directly from the database via CoachService.
Context is kept under 6,000 characters to fit within LLM token budgets.
"""

import json
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple


class FinancialContextBuilder:
    """
    Takes an initialised CoachService instance and constructs a compact,
    information-dense context object for the LLM.
    """

    MAX_TRANSACTIONS = 20
    MAX_CATEGORIES = 10

    def __init__(self, coach_service: Any):
        self.svc = coach_service

    # ──────────────────────────────────────────────────────────────────────
    # PUBLIC ENTRY POINT
    # ──────────────────────────────────────────────────────────────────────

    def build(self) -> Dict[str, Any]:
        """
        Build and return the rich context dict.
        Also logs debug information to stdout.
        """
        context = {
            "account_summary":         self._build_account_summary(),
            "monthly_pnl":             self._build_monthly_pnl(),
            "budget_analysis":         self._build_budget_analysis(),
            "spending_intelligence":   self._build_spending_intelligence(),
            "trend_analysis":          self._build_trend_analysis(),
            "health_components":       self._build_health_components(),
            "dashboard_intelligence":  self._build_dashboard_intelligence(),
            "recent_transactions":     self._build_recent_transactions(),
            "savings_projection":      self._build_savings_projection(),
        }

        # ── Debug logging ─────────────────────────────────────────────────
        context_str = json.dumps(context, ensure_ascii=False)
        context_size = len(context_str)

        print("────────── FINANCIAL CONTEXT DEBUG ──────────", flush=True)
        print(f"Context Size        : {context_size:,} characters", flush=True)

        # Top categories
        top_cats = context["spending_intelligence"].get("top_categories", [])
        top_cat_names = [f"{c['category']} (₹{c['amount']:,})" for c in top_cats[:5]]
        print(f"Top Categories      : {', '.join(top_cat_names) or 'None'}", flush=True)

        # Budget risks
        budget_risks = [
            b["category"] for b in context["budget_analysis"]
            if b.get("risk_level") in ("Critical", "Warning")
        ]
        print(f"Budget Risks        : {', '.join(budget_risks) or 'None'}", flush=True)

        # Health score breakdown
        hc = context["health_components"]
        print(
            f"Health Score        : {hc.get('total_score', 0)}/100  "
            f"[Savings={hc.get('savings_score', 0)} | "
            f"Budget={hc.get('budget_discipline_score', 0)} | "
            f"CashFlow={hc.get('cash_flow_score', 0)} | "
            f"Stability={hc.get('spending_stability_score', 0)} | "
            f"Emergency={hc.get('emergency_fund_score', 0)}]",
            flush=True
        )

        # Dashboard intelligence summary
        di = context["dashboard_intelligence"]
        print(f"Top Strength        : {di.get('top_financial_strength', 'N/A')}", flush=True)
        print(f"Biggest Weakness    : {di.get('biggest_financial_weakness', 'N/A')}", flush=True)
        print(f"Highest Budget Risk : {di.get('highest_budget_risk', 'N/A')}", flush=True)
        print(f"Savings Opportunity : {di.get('best_savings_opportunity', 'N/A')}", flush=True)
        print("──────────────────────────────────────────────", flush=True)

        # ── Trim to 6 000 chars if needed ────────────────────────────────
        if context_size > 6000:
            context = self._trim_context(context)
            trimmed_size = len(json.dumps(context, ensure_ascii=False))
            print(f"Context trimmed to  : {trimmed_size:,} characters", flush=True)

        return context

    # ──────────────────────────────────────────────────────────────────────
    # SECTION BUILDERS
    # ──────────────────────────────────────────────────────────────────────

    def _build_account_summary(self) -> Dict[str, Any]:
        accounts = []
        for acct in self.svc.accounts:
            accounts.append({
                "name":    acct.name,
                "type":    acct.type,
                "bank":    acct.bank_name,
                "balance": round(acct.balance, 2),
            })
        return {
            "total_balance":   round(self.svc.total_balance, 2),
            "liquid_balance":  round(self.svc.liquid_balance, 2),
            "account_count":   len(accounts),
            "accounts":        accounts,
        }

    def _build_monthly_pnl(self) -> Dict[str, Any]:
        income   = round(self.svc.monthly_income_baseline, 2)
        expenses = round(self.svc.current_month_expense, 2)
        savings  = round(max(0.0, income - expenses), 2)
        rate     = round((savings / income * 100) if income > 0 else 0.0, 2)
        return {
            "income":           income,
            "expenses":         expenses,
            "savings":          savings,
            "savings_rate_pct": rate,
            "cash_flow":        round(income - expenses, 2),
            "surplus_status":   "Positive" if savings > 0 else "Deficit",
        }

    def _build_budget_analysis(self) -> List[Dict[str, Any]]:
        result = []
        budgeted = [
            c for c in self.svc.categories
            if c.type == "Expense" and c.planned_outlay > 0
        ]
        for cat in budgeted:
            spent = sum(
                t.amount for t in self.svc.current_month_tx
                if t.category_id == cat.id
            )
            limit      = round(cat.planned_outlay, 2)
            spent_r    = round(spent, 2)
            remaining  = round(max(0.0, limit - spent_r), 2)
            util_pct   = round((spent_r / limit * 100) if limit > 0 else 0.0, 1)

            if util_pct >= 90:
                risk = "Critical"
            elif util_pct >= 70:
                risk = "Warning"
            else:
                risk = "Healthy"

            result.append({
                "category":         cat.name,
                "budget_amount":    limit,
                "spent_amount":     spent_r,
                "remaining_amount": remaining,
                "utilisation_pct":  util_pct,
                "risk_level":       risk,
            })

        # Sort by utilisation descending (most critical first)
        result.sort(key=lambda x: x["utilisation_pct"], reverse=True)
        return result

    def _build_spending_intelligence(self) -> Dict[str, Any]:
        # Category totals
        cat_totals: Dict[str, float] = {}
        for tx in self.svc.current_month_tx:
            if tx.type == "Expense" and tx.category:
                name = tx.category.name
                cat_totals[name] = cat_totals.get(name, 0.0) + tx.amount

        # Top 10 categories
        sorted_cats = sorted(cat_totals.items(), key=lambda x: x[1], reverse=True)
        top_categories = [
            {"rank": i + 1, "category": name, "amount": round(amt, 2)}
            for i, (name, amt) in enumerate(sorted_cats[:self.MAX_CATEGORIES])
        ]

        # Transaction stats (expense only)
        expense_txs = [t for t in self.svc.current_month_tx if t.type == "Expense"]
        amounts = [t.amount for t in expense_txs]

        highest_tx = None
        lowest_tx  = None
        avg_size   = 0.0

        if amounts:
            avg_size = round(sum(amounts) / len(amounts), 2)
            max_tx   = max(expense_txs, key=lambda t: t.amount)
            min_tx   = min(expense_txs, key=lambda t: t.amount)

            highest_tx = {
                "date":        max_tx.date.strftime("%Y-%m-%d"),
                "description": max_tx.description or "N/A",
                "category":    max_tx.category.name if max_tx.category else "Other",
                "amount":      round(max_tx.amount, 2),
            }
            lowest_tx = {
                "date":        min_tx.date.strftime("%Y-%m-%d"),
                "description": min_tx.description or "N/A",
                "category":    min_tx.category.name if min_tx.category else "Other",
                "amount":      round(min_tx.amount, 2),
            }

        # Recurring transaction detection
        recurring = self._detect_recurring()

        return {
            "top_categories":       top_categories,
            "highest_transaction":  highest_tx,
            "lowest_transaction":   lowest_tx,
            "average_transaction":  avg_size,
            "transaction_count":    len(expense_txs),
            "recurring_detected":   recurring,
        }

    def _detect_recurring(self) -> List[str]:
        """
        Simple heuristic: if the same description (case-insensitive, stripped)
        appears ≥2 times in current month transactions, flag it as recurring.
        """
        desc_counts: Dict[str, int] = {}
        for tx in self.svc.current_month_tx:
            if tx.description:
                key = tx.description.strip().lower()
                desc_counts[key] = desc_counts.get(key, 0) + 1

        recurring = [
            desc.title() for desc, count in desc_counts.items()
            if count >= 2
        ]
        return recurring[:10]  # cap at 10

    def _build_trend_analysis(self) -> Dict[str, Any]:
        """
        Compare current month vs. previous calendar month.
        """
        now   = datetime.utcnow()
        prev_month = now.month - 1 if now.month > 1 else 12
        prev_year  = now.year if now.month > 1 else now.year - 1

        prev_month_tx = [
            t for t in self.svc.historical_tx
            if t.date.year == prev_year and t.date.month == prev_month
        ]

        prev_income   = sum(t.amount for t in prev_month_tx if t.type == "Income")
        prev_expenses = sum(t.amount for t in prev_month_tx if t.type == "Expense")
        prev_savings  = max(0.0, prev_income - prev_expenses)

        curr_income   = self.svc.monthly_income_baseline
        curr_expenses = self.svc.current_month_expense
        curr_savings  = max(0.0, curr_income - curr_expenses)

        def pct_change(current: float, previous: float) -> Optional[float]:
            if previous == 0:
                return None
            return round(((current - previous) / previous) * 100, 1)

        # Per-category MoM
        prev_cat_totals: Dict[str, float] = {}
        for t in prev_month_tx:
            if t.type == "Expense" and t.category:
                name = t.category.name
                prev_cat_totals[name] = prev_cat_totals.get(name, 0.0) + t.amount

        curr_cat_totals: Dict[str, float] = {}
        for t in self.svc.current_month_tx:
            if t.type == "Expense" and t.category:
                name = t.category.name
                curr_cat_totals[name] = curr_cat_totals.get(name, 0.0) + t.amount

        category_trends = []
        all_cats = set(list(curr_cat_totals.keys()) + list(prev_cat_totals.keys()))
        for cat in sorted(all_cats):
            curr_amt = curr_cat_totals.get(cat, 0.0)
            prev_amt = prev_cat_totals.get(cat, 0.0)
            change   = pct_change(curr_amt, prev_amt)
            category_trends.append({
                "category":        cat,
                "current_month":   round(curr_amt, 2),
                "previous_month":  round(prev_amt, 2),
                "change_pct":      change,
            })

        # Sort by abs change descending
        category_trends.sort(
            key=lambda x: abs(x["change_pct"]) if x["change_pct"] is not None else 0,
            reverse=True,
        )

        has_prev_data = len(prev_month_tx) > 0

        return {
            "has_previous_month_data": has_prev_data,
            "income_growth_pct":       pct_change(curr_income, prev_income),
            "expense_growth_pct":      pct_change(curr_expenses, prev_expenses),
            "savings_growth_pct":      pct_change(curr_savings, prev_savings),
            "current_month_expenses":  round(curr_expenses, 2),
            "previous_month_expenses": round(prev_expenses, 2),
            "category_trends":         category_trends[:self.MAX_CATEGORIES],
        }

    def _build_health_components(self) -> Dict[str, Any]:
        """
        Decompose the health score into 5 independent sub-scores.
        Mirrors the logic in coach_service.calculate_health_score but returns
        per-component values for the LLM to reference.
        """
        savings_rate = self.svc.calculate_savings_rate()

        # 1. Savings Rate score (max 25)
        if savings_rate >= 35:
            savings_score = 25
            savings_label = "Outstanding"
        elif savings_rate >= 20:
            savings_score = 20
            savings_label = "Healthy"
        elif savings_rate >= 10:
            savings_score = 10
            savings_label = "Modest"
        else:
            savings_score = 0
            savings_label = "Poor"

        # 2. Budget Discipline score (max 25)
        budgeted_cats = [c for c in self.svc.categories if c.type == "Expense" and c.planned_outlay > 0]
        exceeded = 0
        for cat in budgeted_cats:
            spent = sum(t.amount for t in self.svc.current_month_tx if t.category_id == cat.id)
            if spent > cat.planned_outlay:
                exceeded += 1

        if len(budgeted_cats) == 0:
            budget_score = 20
            budget_label = "No budgets set"
        elif exceeded == 0:
            budget_score = 25
            budget_label = "Perfect"
        elif exceeded <= 2:
            budget_score = 15
            budget_label = "Minor overruns"
        else:
            budget_score = 5
            budget_label = "Critical overruns"

        # 3. Cash Flow score (max 20) — proxy via income stability
        from ..services.ds_service import get_basic_kpis
        kpis      = get_basic_kpis(self.svc.transactions, self.svc.accounts)
        stability = kpis.get("income_stability", "Medium")
        if stability == "High":
            cash_flow_score = 20
            cash_flow_label = "High stability"
        elif stability == "Medium":
            cash_flow_score = 15
            cash_flow_label = "Medium stability"
        else:
            cash_flow_score = 5
            cash_flow_label = "Low stability"

        # 4. Spending Stability score (max 10)
        large_spikes = [
            t for t in self.svc.current_month_tx
            if t.type == "Expense" and t.amount > (self.svc.monthly_income_baseline * 0.25)
        ]
        if not large_spikes:
            stability_score = 10
            stability_label = "Consistent"
        else:
            stability_score = 5
            stability_label = f"{len(large_spikes)} spike(s) detected"

        # 5. Emergency Fund score (max 20)
        emergency_months = (
            self.svc.liquid_balance / self.svc.monthly_expense_average
            if self.svc.monthly_expense_average > 0 else 0
        )
        if emergency_months >= 6:
            emg_score = 20
            emg_label = f"Excellent ({round(emergency_months, 1)} months)"
        elif emergency_months >= 3:
            emg_score = 15
            emg_label = f"Solid ({round(emergency_months, 1)} months)"
        elif emergency_months >= 1:
            emg_score = 10
            emg_label = f"Low ({round(emergency_months, 1)} months)"
        else:
            emg_score = 5
            emg_label = "Critical (<1 month)"

        total_score = savings_score + budget_score + cash_flow_score + stability_score + emg_score

        return {
            "total_score":               total_score,
            "savings_score":             savings_score,
            "savings_label":             savings_label,
            "savings_rate_pct":          round(savings_rate, 1),
            "budget_discipline_score":   budget_score,
            "budget_discipline_label":   budget_label,
            "budgeted_categories":       len(budgeted_cats),
            "overrun_categories":        exceeded,
            "cash_flow_score":           cash_flow_score,
            "cash_flow_label":           cash_flow_label,
            "spending_stability_score":  stability_score,
            "spending_stability_label":  stability_label,
            "emergency_fund_score":      emg_score,
            "emergency_fund_label":      emg_label,
            "emergency_fund_months":     round(emergency_months, 1),
        }

    def _build_dashboard_intelligence(self) -> Dict[str, Any]:
        """
        Derive four actionable intelligence signals from real data.
        """
        budget_analysis   = self._build_budget_analysis()
        spending_intel    = self._build_spending_intelligence()
        health_components = self._build_health_components()
        monthly_pnl       = self._build_monthly_pnl()

        # ── Top Strength ──────────────────────────────────────────────────
        strengths: List[Tuple[int, str]] = [
            (health_components["savings_score"],            f"Savings rate of {health_components['savings_rate_pct']}% ({health_components['savings_label']})"),
            (health_components["budget_discipline_score"],  f"Budget discipline: {health_components['budget_discipline_label']}"),
            (health_components["cash_flow_score"],          f"Income stability: {health_components['cash_flow_label']}"),
            (health_components["emergency_fund_score"],     f"Emergency fund: {health_components['emergency_fund_label']}"),
            (health_components["spending_stability_score"], f"Spending stability: {health_components['spending_stability_label']}"),
        ]
        top_strength = max(strengths, key=lambda x: x[0])[1]

        # ── Biggest Weakness ──────────────────────────────────────────────
        weakest = min(strengths, key=lambda x: x[0])[1]

        # ── Highest Budget Risk ───────────────────────────────────────────
        critical_cats = [b for b in budget_analysis if b["risk_level"] == "Critical"]
        warning_cats  = [b for b in budget_analysis if b["risk_level"] == "Warning"]

        if critical_cats:
            top_risk_cat = critical_cats[0]
            highest_budget_risk = (
                f"{top_risk_cat['category']} is at "
                f"{top_risk_cat['utilisation_pct']}% of its ₹{top_risk_cat['budget_amount']:,} budget "
                f"(₹{top_risk_cat['remaining_amount']:,} remaining)"
            )
        elif warning_cats:
            top_risk_cat = warning_cats[0]
            highest_budget_risk = (
                f"{top_risk_cat['category']} is at "
                f"{top_risk_cat['utilisation_pct']}% of its ₹{top_risk_cat['budget_amount']:,} budget"
            )
        else:
            highest_budget_risk = "No budget risks detected — all categories within healthy limits"

        # ── Best Savings Opportunity ──────────────────────────────────────
        top_cats = spending_intel.get("top_categories", [])
        savings_opps: List[str] = []
        discretionary_keywords = ["Food", "Dining", "Shopping", "Entertainment", "Travel", "Fuel"]

        for cat_entry in top_cats[:5]:
            cat_name = cat_entry["category"]
            if any(kw.lower() in cat_name.lower() for kw in discretionary_keywords):
                potential_save = round(cat_entry["amount"] * 0.15, 0)
                savings_opps.append(
                    f"Reducing {cat_name} by 15% saves ₹{int(potential_save):,}/month"
                )

        if savings_opps:
            best_savings_opportunity = savings_opps[0]
        elif monthly_pnl["cash_flow"] > 0:
            best_savings_opportunity = (
                f"Deploy your ₹{int(monthly_pnl['cash_flow']):,} monthly surplus "
                f"into a high-yield savings or SIP"
            )
        else:
            best_savings_opportunity = "Reduce total expenses to restore a positive monthly surplus"

        return {
            "top_financial_strength":   top_strength,
            "biggest_financial_weakness": weakest,
            "highest_budget_risk":      highest_budget_risk,
            "best_savings_opportunity": best_savings_opportunity,
        }

    def _build_savings_projection(self) -> dict:
        """
        Project how long it will take to reach common savings milestones
        using the user's actual current surplus.
        """
        income   = self.svc.monthly_income_baseline
        expenses = self.svc.current_month_expense
        surplus  = max(0.0, income - expenses)

        liquid   = self.svc.liquid_balance
        monthly_avg_expense = self.svc.monthly_expense_average

        # Months to ₹1 lakh emergency fund
        target_1lakh = 100_000.0
        remaining_1lakh = max(0.0, target_1lakh - liquid)
        months_1lakh = (
            round(remaining_1lakh / surplus, 1) if surplus > 0 else None
        )

        # Months to 6-month emergency fund (6 × avg monthly expense)
        target_6m = max(monthly_avg_expense * 6, 1.0)
        remaining_6m = max(0.0, target_6m - liquid)
        months_6m = (
            round(remaining_6m / surplus, 1) if surplus > 0 else None
        )

        # Accelerated timeline (+15% of surplus)
        accel_surplus = surplus * 1.15
        months_1lakh_accel = (
            round(remaining_1lakh / accel_surplus, 1) if accel_surplus > 0 else None
        )

        return {
            "liquid_balance":              round(liquid, 2),
            "monthly_surplus":             round(surplus, 2),
            "target_1lakh_emergency":      target_1lakh,
            "months_to_1lakh_emergency":   months_1lakh,
            "months_to_1lakh_accelerated": months_1lakh_accel,
            "target_6month_fund":          round(target_6m, 2),
            "months_to_6month_fund":       months_6m,
        }

    def _build_recent_transactions(self) -> List[Dict[str, Any]]:

        all_tx = sorted(
            self.svc.transactions,
            key=lambda t: t.date,
            reverse=True,
        )[:self.MAX_TRANSACTIONS]

        result = []
        for tx in all_tx:
            result.append({
                "date":        tx.date.strftime("%Y-%m-%d"),
                "description": tx.description or "N/A",
                "category":    tx.category.name if tx.category else "Other",
                "amount":      round(tx.amount, 2),
                "type":        tx.type,
            })
        return result

    # ──────────────────────────────────────────────────────────────────────
    # CONTEXT TRIM GUARD (keeps under 6 000 chars)
    # ──────────────────────────────────────────────────────────────────────

    def _trim_context(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Progressive trimming strategy when context exceeds 6 000 chars.
        Priority: remove verbose lists first, then truncate transactions.
        """
        # 1. Truncate category_trends to top 5
        trend = context.get("trend_analysis", {})
        if "category_trends" in trend:
            trend["category_trends"] = trend["category_trends"][:5]

        # 2. Truncate recent_transactions to 10
        if len(context.get("recent_transactions", [])) > 10:
            context["recent_transactions"] = context["recent_transactions"][:10]

        # 3. Remove account-level detail (keep totals only)
        acc = context.get("account_summary", {})
        if "accounts" in acc:
            del acc["accounts"]

        # 4. Remove recurring detection if still large
        si = context.get("spending_intelligence", {})
        if "recurring_detected" in si:
            del si["recurring_detected"]

        return context
