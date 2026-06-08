import pandas as pd
import numpy as np
from datetime import datetime
from typing import List, Dict, Any
from ..models.finance import Transaction, Account

def get_basic_kpis(transactions: List[Transaction], accounts: List[Account]) -> Dict[str, Any]:
    """
    Computes statistical KPIs:
    - Average and Median expense
    - Income Stability (Coefficient of Variation)
    - Monthly Savings Rate
    - Net Worth (aggregate balance)
    """
    if not transactions:
        return {
            "avg_spend": 0.0,
            "median_spend": 0.0,
            "income_stability": "N/A",
            "income_stability_cv": 0.0,
            "savings_rate": 0.0,
            "net_worth": sum(a.balance for a in accounts if not a.is_archived)
        }

    # Load transactions into a Pandas DataFrame
    df = pd.DataFrame([{
        "id": tx.id,
        "amount": tx.amount,
        "type": tx.type,
        "date": tx.date,
        "category": tx.category.name if tx.category else "Other"
    } for tx in transactions])

    net_worth = sum(a.balance for a in accounts if not a.is_archived)
    
    # Filter expenses and incomes
    expenses_df = df[df["type"] == "Expense"]
    incomes_df = df[df["type"] == "Income"]

    avg_spend = float(expenses_df["amount"].mean()) if not expenses_df.empty else 0.0
    median_spend = float(expenses_df["amount"].median()) if not expenses_df.empty else 0.0

    # Income stability (Coefficient of Variation of monthly income streams)
    income_stability = "Low"
    income_stability_cv = 0.0
    
    if not incomes_df.empty:
        # Group income by year and month
        monthly_income = incomes_df.groupby(incomes_df["date"].dt.to_period("M"))["amount"].sum()
        if len(monthly_income) >= 2:
            mean_inc = monthly_income.mean()
            std_inc = monthly_income.std()
            if mean_inc > 0:
                cv = std_inc / mean_inc
                income_stability_cv = float(cv)
                # Lower CV means more stable/consistent income streams
                if cv < 0.15:
                    income_stability = "High"
                elif cv < 0.35:
                    income_stability = "Medium"
                else:
                    income_stability = "Low"
        elif len(monthly_income) == 1:
            income_stability = "High" # Single month of income, assume stable for now

    # Monthly Savings Rate for the current/latest complete month
    savings_rate = 0.0
    if not df.empty:
        # Group by month and type
        monthly_flows = df.groupby([df["date"].dt.to_period("M"), "type"])["amount"].sum().unstack(fill_value=0.0)
        if not monthly_flows.empty:
            # Let's take the average savings rate across the last 3 months
            recent_flows = monthly_flows.tail(3)
            rates = []
            for idx, row in recent_flows.iterrows():
                inc = row.get("Income", 0.0)
                exp = row.get("Expense", 0.0)
                if inc > 0:
                    rates.append(((inc - exp) / inc) * 100)
            if rates:
                savings_rate = float(np.mean(rates))

    return {
        "avg_spend": round(avg_spend, 2),
        "median_spend": round(median_spend, 2),
        "income_stability": income_stability,
        "income_stability_cv": round(income_stability_cv, 4),
        "savings_rate": round(max(0.0, savings_rate), 2),
        "net_worth": round(net_worth, 2)
    }


def get_ml_insights(transactions: List[Transaction]) -> Dict[str, Any]:
    """
    Computes Scikit-Learn based machine learning outputs:
    1. Time-Series Forecast: LinearRegression over monthly aggregated expenses.
    2. Outlier Anomalies: Flag unusual transactions using Z-score and IsolationForest.
    3. Behavioral KMeans Clustering: Cluster daily expense aggregates into Frugal, Moderate Utility, and High-Volume Splurge.
    """
    if not transactions:
        return {
            "forecast": {"status": "insufficient_data", "predicted_amount": 0.0, "next_month": "", "trend": "stable"},
            "anomalies": [],
            "clustering": {"status": "insufficient_data", "clusters": [], "days_classified": 0}
        }

    # Load all data into a pandas dataframe
    df = pd.DataFrame([{
        "id": tx.id,
        "amount": tx.amount,
        "type": tx.type,
        "date": tx.date,
        "description": tx.description or "Expense"
    } for tx in transactions])

    expenses_df = df[df["type"] == "Expense"]

    # 1. TIME-SERIES FORECAST
    forecast_result = {"status": "insufficient_data", "predicted_amount": 0.0, "next_month": "", "trend": "stable"}
    if not expenses_df.empty:
        # Group by month
        monthly = expenses_df.groupby(expenses_df["date"].dt.to_period("M"))["amount"].sum().reset_index()
        monthly["month_idx"] = np.arange(len(monthly))

        if len(monthly) >= 2:
            from sklearn.linear_model import LinearRegression
            X = monthly[["month_idx"]].values
            y = monthly["amount"].values
            
            model = LinearRegression()
            model.fit(X, y)
            
            next_idx = len(monthly)
            pred = float(model.predict([[next_idx]])[0])
            
            last_period = monthly["date"].iloc[-1]
            next_period = last_period + 1
            
            forecast_result = {
                "status": "success",
                "predicted_amount": round(max(0.0, pred), 2),
                "next_month": str(next_period),
                "trend": "up" if model.coef_[0] > 0 else "down"
            }
        elif len(monthly) == 1:
            last_period = monthly["date"].iloc[-1]
            forecast_result = {
                "status": "fallback",
                "predicted_amount": round(float(monthly["amount"].iloc[0]), 2),
                "next_month": str(last_period + 1),
                "trend": "stable"
            }

    # 2. OUTLIER ANOMALIES
    anomalies = []
    expenses_list = [tx for tx in transactions if tx.type == "Expense"]
    if len(expenses_list) >= 3:
        amounts = np.array([tx.amount for tx in expenses_list]).reshape(-1, 1)
        mean = np.mean(amounts)
        std = np.std(amounts)

        if std > 0:
            z_scores = (amounts - mean) / std
            
            # Run IsolationForest if we have at least 5 expenses
            if len(expenses_list) >= 5:
                from sklearn.ensemble import IsolationForest
                clf = IsolationForest(contamination=0.1, random_state=42)
                preds = clf.fit_predict(amounts)
            else:
                preds = np.ones(len(expenses_list))

            for i, tx in enumerate(expenses_list):
                is_anomaly = False
                reason = ""
                score = float(z_scores[i][0])

                if score > 2.0:
                    is_anomaly = True
                    reason = f"Spike outlier (Z-score: {round(score, 2)})"
                elif preds[i] == -1:
                    is_anomaly = True
                    reason = "Isolation Forest flagged pattern anomaly"

                if is_anomaly:
                    date_str = tx.date.strftime("%Y-%m-%d") if hasattr(tx.date, "strftime") else str(tx.date).split('T')[0]
                    anomalies.append({
                        "id": tx.id,
                        "description": tx.description or "Expense",
                        "amount": tx.amount,
                        "date": date_str,
                        "reason": reason,
                        "score": round(score, 2)
                    })

    # 3. BEHAVIORAL KMEANS CLUSTERING
    cluster_result = {"status": "insufficient_data", "clusters": [], "days_classified": 0}
    if len(expenses_list) >= 3:
        # Construct daily sums
        df_daily = pd.DataFrame([{
            "date": tx.date.strftime("%Y-%m-%d") if hasattr(tx.date, "strftime") else str(tx.date).split('T')[0],
            "amount": tx.amount
        } for tx in expenses_list])
        
        daily_sums = df_daily.groupby("date")["amount"].sum().reset_index()

        if len(daily_sums) >= 3:
            from sklearn.cluster import KMeans
            X_daily = daily_sums[["amount"]].values
            n_clusters = min(3, len(daily_sums))
            
            kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
            kmeans.fit(X_daily)
            
            daily_sums["cluster"] = kmeans.labels_
            centers = kmeans.cluster_centers_.flatten()
            sorted_idx = np.argsort(centers)
            
            # Map centers to labels
            labels = ["Frugal", "Moderate Utility", "High-Volume Splurge"]
            label_mapping = {}
            for rank, idx in enumerate(sorted_idx):
                if rank < len(labels):
                    label_mapping[idx] = labels[rank]
                else:
                    label_mapping[idx] = "Other"

            daily_sums["cluster_label"] = daily_sums["cluster"].map(label_mapping)
            counts = daily_sums["cluster_label"].value_counts().to_dict()
            
            cluster_details = []
            for rank, idx in enumerate(sorted_idx):
                if rank < len(labels):
                    label_text = labels[rank]
                    cluster_details.append({
                        "label": label_text,
                        "center": round(float(centers[idx]), 2),
                        "count": int(counts.get(label_text, 0))
                    })
                    
            cluster_result = {
                "status": "success",
                "clusters": cluster_details,
                "days_classified": len(daily_sums)
            }

    return {
        "forecast": forecast_result,
        "anomalies": anomalies,
        "clustering": cluster_result
    }
