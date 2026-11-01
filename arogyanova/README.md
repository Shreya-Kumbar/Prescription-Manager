# ArogyaNova — Intelligent Prescription Management System

> Healthcare, reimagined through innovation.

ArogyaNova is a full-stack prescription management platform built as an **Object-Oriented Methodologies (OOM)** college project. It demonstrates real OOP design patterns, REST APIs, relational database management, authentication, role-based access control, AI-assisted workflows, and cybersecurity best practices.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router, Axios |
| Backend | Python 3.11, FastAPI, SQLAlchemy ORM, Pydantic v2 |
| Database | PostgreSQL 15 |
| Auth | JWT (HttpOnly cookies), Argon2id password hashing |
| AI/ML | pytesseract OCR, local interaction checker |
| DevOps | Docker, Docker Compose, Alembic migrations |

---

## Quick Start (Docker)

### Prerequisites
- Docker Desktop installed and running
- Git

### 1. Clone and configure

```bash
git clone <repo-url>
cd arogyanova
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit `backend/.env` and set a strong `SECRET_KEY`.

### 2. Start all services

```bash
docker compose up --build
```

### 3. Run migrations and seed demo data

```bash
docker compose exec backend alembic upgrade head
docker compose exec backend python -m app.db.seed
```

### 4. Open the app

- **Frontend:** http://localhost:5173
- **API docs:** http://localhost:8000/docs

---

## Local Development (without Docker)

### Backend

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Edit .env with your local PostgreSQL credentials

alembic upgrade head
python -m app.db.seed

uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
pnpm install
cp .env.example .env
pnpm dev
```

---

## Demo Accounts

After running the seed script, the following accounts are available:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@arogyanova.dev | Demo@Admin123 |
| Doctor | dr.sharma@arogyanova.dev | Demo@Doctor123 |
| Doctor | dr.patel@arogyanova.dev | Demo@Doctor123 |
| Patient | patient.ravi@arogyanova.dev | Demo@Patient123 |
| Patient | patient.priya@arogyanova.dev | Demo@Patient123 |
| Pharmacist | pharma.anil@arogyanova.dev | Demo@Pharma123 |

> **Note:** These are demo credentials for local development only. Never use these in production.

---

## Project Structure

```
arogyanova/
├── frontend/          # React + TypeScript + Vite
├── backend/           # FastAPI + SQLAlchemy
├── docs/              # UML, ER, architecture diagrams
├── docker-compose.yml
└── README.md
```

---

## OOP Design Highlights

The backend demonstrates all four OOP pillars:

- **Encapsulation:** `Prescription` domain class controls status transitions via methods
- **Abstraction:** `BaseUser`, `OCRProvider`, `InteractionChecker`, `NotificationChannel` ABCs
- **Inheritance:** `Doctor`, `Patient`, `Pharmacist`, `Administrator` extend `BaseUser`
- **Polymorphism:** Multiple `OCRProvider` and `NotificationChannel` implementations

See [docs/oop-design.md](docs/oop-design.md) for full details.

---

## Running Tests

```bash
cd backend
pytest tests/ -v --tb=short
```

---

## API Documentation

Interactive API docs are available at `http://localhost:8000/docs` when the backend is running.

---

## Security Notes

- Passwords hashed with Argon2id
- JWT stored in HttpOnly cookies (not localStorage)
- RBAC enforced on every backend endpoint
- Object-level authorization (patients cannot access other patients' records)
- Rate limiting on auth endpoints
- All secrets in environment variables (never committed)

---

## Limitations and Future Work

- OCR requires `tesseract` installed on the host system; falls back gracefully when unavailable
- Drug interaction checker uses a local development dataset; not a clinical reference
- Email/SMS notifications are architecturally designed but require provider configuration
- No HIPAA/GDPR assessment has been performed; this is an academic project

---

## License

This project is developed for academic purposes (OOM course). Not intended for production medical use.
