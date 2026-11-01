# ArogyaNova — Intelligent Prescription Management System

> **Healthcare, reimagined through innovation.**  
> Academic Capstone Project for **Object-Oriented Methodologies (OOM)** | Full-Stack Web Application

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-cyan.svg)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688.svg)](https://fastapi.tiangolo.com/)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0-red.svg)](https://www.sqlalchemy.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8.svg)](https://tailwindcss.com/)

---

## 1. Project Overview

**ArogyaNova** (*Arogya* = Health, *Nova* = Innovation) is a modern, enterprise-grade prescription management platform designed to transform how clinical prescriptions are authored, audited, reviewed, and accessed.

The platform provides distinct, role-tailored workflows:
- **Doctors:** Author digital prescriptions, run AI drug-drug interaction screenings, manage draft lifecycles, and monitor patient adherence.
- **Patients:** Access active prescriptions, track daily medication schedules with interactive Taken/Skipped compliance logging, and view clinical history.
- **Pharmacists:** Search verified prescription records, evaluate medication formulations, and review flagged drug interactions.
- **Administrators:** Manage system accounts, assign professional roles, toggle account statuses, and inspect security audit trails.

---

## 2. Technology Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide React, Recharts, React Router v6, Axios, React Hot Toast.
- **Backend:** Python 3.12, FastAPI, SQLAlchemy ORM (AsyncIO), Pydantic v2, SlowAPI rate limiting, Structlog.
- **Database:** SQLite+aiosqlite (Zero-config local development — no install needed) / PostgreSQL (Production / Docker).
- **Security:** Argon2id password hashing, JWT tokens, Role-Based Access Control (RBAC), Object-Level Authorization, OWASP safeguards.
- **AI / Decision Support:** Prescription OCR extraction pipeline, rule-backed multi-drug interaction checker, medication adherence analytics.

---

## 3. Demo Accounts & One-Click Sign In

The login interface includes **1-Click Demo Buttons** for instant evaluation of all 4 roles.

> **These accounts are created automatically on first startup — no manual seeding needed.**

| Role | Email | Password | Primary Capabilities |
|---|---|---|---|
| **Doctor** | `dr.sharma@arogyanova.dev` | `Demo@Doctor123` | Author, edit, finalize, and cancel prescriptions; AI checks |
| **Doctor** | `dr.patel@arogyanova.dev` | `Demo@Doctor123` | Prescribe medications, view assigned patients |
| **Patient** | `patient.ravi@arogyanova.dev` | `Demo@Patient123` | View own prescriptions, log daily schedule compliance |
| **Patient** | `patient.priya@arogyanova.dev` | `Demo@Patient123` | View own prescriptions and profile |
| **Pharmacist** | `pharma.anil@arogyanova.dev` | `Demo@Pharma123` | Review active prescriptions, inspect drug interactions |
| **Administrator** | `admin@arogyanova.dev` | `Demo@Admin123` | Manage user accounts, inspect security audit trails |

---

## 4. Quick Start Guide

### Option A: Local Development — Zero Config (Recommended)

**No PostgreSQL, no Docker, no manual database setup needed.**  
Just clone, install, and run. The app auto-creates the database and demo accounts on first launch.

#### Step 1 — Backend

```bash
cd arogyanova/backend

# Create virtual environment
python -m venv .venv

# Activate it
# Windows:
.venv\Scripts\activate
# macOS / Linux:
source .venv/bin/activate

# Install all dependencies (includes aiosqlite for SQLite support)
pip install -r requirements.txt

# Start the backend — DB tables + demo accounts are created automatically
python run.py
```

The backend will start at **http://localhost:8000**.  
Demo accounts are seeded on the **first launch only** (idempotent).

#### Step 2 — Frontend

Open a **second terminal**:

```bash
cd arogyanova/frontend

# Install packages
npm install

# Start Vite development server
npm run dev
```

Visit:
- **Web Application:** `http://localhost:5173`
- **Interactive API Docs:** `http://localhost:8000/docs`
- **Health Check:** `http://localhost:8000/health`

> **Windows note:** If `uvicorn` is blocked by App Control policy, `python run.py` bypasses this by invoking `python -m uvicorn` internally.

---

### Option B: Docker Compose

```bash
# Start PostgreSQL, FastAPI backend, and React frontend
docker compose up --build
```

The backend auto-seeds on first startup — no extra steps needed.

---

## 5. Environment Variables

No `.env` file is required for local development — sensible defaults are built in.

To customise, copy `.env.example` to `.env` and edit:

```bash
cp backend/.env.example backend/.env
```

Key variables:

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | `sqlite+aiosqlite:///./arogyanova.db` | Change to PostgreSQL URL for production |
| `SECRET_KEY` | Development default | **Override with a long random string in production** |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Add your frontend URL |

---

## 6. Object-Oriented Methodologies (OOM) Highlights

ArogyaNova is engineered to demonstrate rigorous Object-Oriented Software Engineering:

- **Encapsulation:** The `Prescription` domain entity (`app/domain/prescription.py`) strictly owns its internal state and collection of `PrescriptionItem` objects. State transitions (from `DRAFT` to `ACTIVE` or `CANCELLED`) are governed by domain methods (`finalize()`, `cancel()`) that enforce clinical invariants.
- **Abstraction:** Abstract Base Classes (`BaseUser`, `BaseRepository`, `NotificationChannel`, `InteractionChecker`, `OCRProvider`) define clear interface contracts while concealing low-level mechanics.
- **Inheritance:** `BaseUser` is specialized by `Doctor`, `Patient`, `Pharmacist`, and `Administrator` (`app/domain/users.py`), sharing core identity logic while providing role-specific permission sets.
- **Polymorphism:** `NotificationChannel` features interchangeable runtime implementations (`InAppNotificationChannel`, `EmailNotificationChannel`, `SMSNotificationChannel`). Similarly, `InteractionChecker` seamlessly switches between `LocalInteractionChecker` and `UnavailableInteractionChecker`.
- **Composition & Dependency Inversion:** Prescriptions are composed of prescription items. `PrescriptionService` depends on abstract `PrescriptionRepository` interfaces rather than raw database sessions.

Detailed viva notes and code mappings: **[docs/oop-design.md](docs/oop-design.md)**

---

## 7. Comprehensive Project Documentation

The `docs/` directory contains full technical specifications, diagrams, and viva preparation materials:

- **[OOM Design & SOLID Principles](docs/oop-design.md)**
- **[UML Class Diagram](docs/class-diagram.md)**
- **[Use Case Diagram](docs/use-case-diagram.md)**
- **[Sequence & Activity Diagrams](docs/sequence-diagrams.md)**
- **[ER Diagram & Database Design](docs/er-diagram.md)**
- **[Computer Networks Integration](docs/network-architecture.md)**
- **[Cybersecurity Architecture](docs/security.md)**
- **[REST API Reference](docs/api-documentation.md)**

---

## 8. Running Backend Tests

```bash
cd arogyanova/backend
.venv\Scripts\python -m pytest tests -v
```

---

## 9. License & Academic Disclaimer

Developed for academic demonstration in Object-Oriented Methodologies (OOM). AI and interaction checks provide clinical decision support and are not intended as independent medical diagnoses.
