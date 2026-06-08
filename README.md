# Finance Pro — Personal Finance & Expense Analytics Platform

A production-grade, full-stack, data-driven personal finance management and expense analytics platform designed to evoke a high-end neomorphic/glassmorphic banking experience.

---

## 🚀 Key Features

1. **Multi-Account Aggregator**: Track Savings, Credit Cards, Cash, and Digital Wallets (ICICI, HDFC, SBI) with live aggregated net asset selectors.
2. **Double-Entry Ledger & Transfers**: CRUD transactions (Income, Expense) and atomic Self-Transfers between user banks.
3. **Advanced ML Analytics**:
   - **Time-Series Forecast**: Fit a `LinearRegression` model over aggregated monthly values to project next month's anticipated bills.
   - **Outlier Anomalies**: Flag unusual spending using Z-score and `IsolationForest` algorithms.
   - **Behavioral KMeans**: Cluster daily aggregates into *Frugal*, *Moderate Utility*, and *High-Volume Splurge* days.
4. **AI Finance Coach Widget**: Floating neomorphic assistant providing contextual guidance on budget overruns and stability averages.
5. **Session PIN Lock**: 4-digit overlay that acts on launch, manual lock, or session idle time (customizable inactivity track).

---

## 📦 Credentials & Quick Start

* **Demo Account**: `demo@financepro.com` / `Password123`
* **Default Security PIN**: `1234`

### Local Execution (Fastest Setup)

Make sure you have Node.js (v18+) and Python (v3.11+) installed on your machine.

#### 1. Boot up the Backend

```bash
cd backend
# 1. Activate the pre-configured virtual environment
.venv\Scripts\activate

# 2. (Optional) Run the database seeder if you want to reset records
python app/seed.py

# 3. Launch the FastAPI server
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
FastAPI endpoints will be exposed at `http://127.0.0.1:8000`. Detailed Swagger documentation is at `/docs`.

#### 2. Boot up the Frontend

```bash
cd frontend
# 1. Start the Vite React development server
npm run dev
```
Open your browser and navigate to `http://localhost:5173`. Click the **"One-Click Demo Access"** button to log in instantly!

---

## 🐳 Docker Compose Execution

To run both services inside lightweight container environments without manual installations:

```bash
# In the root project directory, compile and spin up the services
docker-compose up --build
```
Vite web client will build and launch at `http://localhost:5173` communicating with backend on port `8000`.

---

## 📂 Project Architecture

```text
money-manager/
├── backend/                  # FastAPI & SQLAlchemy SQLite Service
│   ├── app/
│   │   ├── config.py         # Settings & CORS profiles
│   │   ├── database.py       # Engine session bindings
│   │   ├── models/           # SQLAlchemy DB Schemas
│   │   ├── schemas/          # Pydantic payloads
│   │   ├── services/         # Auth helper + Machine Learning (Scikit-Learn)
│   │   ├── routers/          # REST Router modules
│   │   └── main.py           # Core FastAPI bootstrap
│   └── seed.py               # 6-Month transactional database seeder
├── frontend/                 # React, TypeScript, Zustand, Tailwind CSS v4, Recharts
│   ├── src/
│   │   ├── components/       # Custom Glassmorphic elements & PinLock / AI Coach
│   │   ├── store/            # Zustand global stores (auth, UI)
│   │   ├── services/         # Axios network client
│   │   ├── pages/            # View components (Dashboard, Analytics, Support, Settings)
│   │   └── App.tsx           # Route guards & Query clients
└── docker-compose.yml        # Multi-service packaging orchestrator
```
