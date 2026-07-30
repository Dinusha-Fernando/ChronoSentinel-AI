# ChronoSentinel AI

A high-performance security auditing system that analyzes historical snapshots of a domain using the Wayback Machine (CDX & snapshot archives), runs rule-based threat signature scanners, calculates domain-level risks, caches results, and presents an interactive dark glassmorphic React dashboard.

## 🚀 Key Features

* **Wayback CDX Integration**: Fetches historical snapshot metadata and retrieves raw capture contents asynchronously.
* **Performance Sampling Strategy**: Restricts analysis overhead by inspecting the latest snapshot, 3 recent snapshots, and 2 random historical snapshots.
* **Rule-based Content Auditing**: Strips scripts, style blocks, and HTML tags, running counts of risk keywords across categories (Gambling, Adult, Phishing/Scams, Hacking/Malware).
* **Multi-tiered Caching**: Instant response delivery through a 7-day Redis caching layer and persistent PostgreSQL analytics records.
* **Celery Background Workers**: Queue and execute heavy domain lists or scheduled pre-analysis bulk scans.
* **Premium Dashboard UI**: Rich dark glassmorphic design featuring interactive Recharts trend timelines, keyword breakdown list chips, live database metrics, and health diagnostic node monitors.

---

## 🛠️ Tech Stack

* **Backend**: Python 3.11+, FastAPI, Uvicorn, SQLAlchemy ORM (asyncpg), aiohttp
* **Caching & Queue**: Redis, Celery worker
* **Database**: PostgreSQL (v15)
* **Frontend**: React, Vite, Tailwind CSS, Recharts, Lucide Icons, Axios
* **Deployment**: Docker, Docker Compose, Nginx (frontend container)

---

## 📂 Project Structure

```
domain-risk-system/
│
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI gateway
│   │   ├── core/
│   │   │   ├── config.py            # App settings (pydantic-settings)
│   │   │   ├── database.py          # PostgreSQL session management (asyncio)
│   │   │   └── redis.py             # Redis connection manager
│   │   ├── api/
│   │   │   └── routes/
│   │   │       ├── domain.py        # Single, bulk, & statistics endpoints
│   │   │       └── analysis.py      # Celery task monitoring & rule querying
│   │   ├── services/
│   │   │   ├── cdx_service.py       # CDX fetcher (with retry & mock generator)
│   │   │   ├── snapshot_fetcher.py  # Concurrent raw HTML snapshot download
│   │   │   ├── analyzer.py          # Content HTML cleaner & category rules
│   │   │   ├── risk_engine.py       # Sampling selection & risk scoring
│   │   │   └── pipeline.py          # Integrated pipeline orchestration
│   │   ├── workers/
│   │   │   ├── celery_worker.py     # Celery worker configuration
│   │   │   └── tasks.py             # Asynchronous worker task definitions
│   │   ├── models/                  # SQLAlchemy tables (Domain, Snapshot, AnalysisFlag)
│   │   ├── schemas/                 # Pydantic validation structures
│   │   └── utils/                   # Loggers and Beautiful Soup text clean utilities
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx                  # Master dashboard container
│   │   ├── components/              # Header, DomainInput, RiskSummary, SnapshotTimeline, FlagList
│   │   ├── services/
│   │   │   └── api.js               # Axios API client wrapper
│   │   └── index.css                # Custom glassmorphic typography styles
│   └── Dockerfile
│
├── docker-compose.yml
└── README.md
```

---

## 🏃 Quick Start (Docker Compose)

The easiest way to boot the complete system (Database, Redis cache, Backend server, Celery worker, and Nginx frontend) is via Docker Compose:

1. **Verify Prerequisites**: Make sure you have Docker and Docker Compose installed.
2. **Build and Start**: Run the following command in the project root directory:
   ```bash
   docker compose up --build
   ```
3. **Access the Dashboard**: Open your browser and navigate to:
   * **Frontend Dashboard**: [http://localhost](http://localhost) (port 80)
   * **FastAPI Docs (Swagger UI)**: [http://localhost:8000/docs](http://localhost:8000/docs) (port 8000)

*Note: By default, `MOCK_WAYBACK=True` is enabled in `docker-compose.yml` to allow instant local testing without being rate-limited by the Wayback Machine. If you want to connect to real archive snapshots, edit `docker-compose.yml` to change `MOCK_WAYBACK` to `False`.*

---

## 💻 Local Development Setup (Manual)

If you prefer to run services manually for debugging:

### 1. Prerequisite Stores
Ensure **PostgreSQL** is running on port 5432 and **Redis** is running on port 6379.

### 2. Run Backend & Celery
```bash
cd backend
python -m venv venv
# Activate virtual environment:
# Windows:
.\venv\Scripts\activate
# Unix/Mac:
source venv/bin/activate

pip install -r requirements.txt

# Start FastAPI gateway
uvicorn backend.app.main:app --reload

# In a separate terminal (with env activated):
celery -A backend.app.workers.celery_worker.celery_app worker --loglevel=info
```

### 3. Run Frontend
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🌐 API Endpoint Specifications

### `POST /api/v1/domains/analyze`
Starts an inline domain content audit.
```json
// Request Body
{
  "domain": "gambling-scam.test",
  "force_refresh": false
}
```

### `POST /api/v1/domains/bulk-analyze`
Queues a batch scan in Celery background queues. Returns task ID.
```json
// Request Body
{
  "domains": ["google.com", "gambling-casino.test", "xxx-adult-blog.test"]
}
```

### `GET /api/v1/domains/stats`
Fetches global statistics: domain counts, risk breakdowns, and 5 recently searched records.

### `GET /api/v1/analysis/task/{task_id}`
Checks Celery worker execution state and returns results if finished.

### `GET /api/v1/analysis/rules`
Returns active risk categories, keywords, and respective weight thresholds.
