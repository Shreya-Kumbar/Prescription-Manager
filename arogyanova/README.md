# ArogyaNova — Intelligent Prescription Management System

> **Healthcare, reimagined through innovation.**  
> Academic Capstone Project for **Object-Oriented Methodologies (OOM)** | Full-Stack Web Application

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-cyan.svg)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688.svg)](https://fastapi.tiangolo.com/)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0-red.svg)](https://www.sqlalchemy.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791.svg)](https://www.postgresql.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8.svg)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/Tests-54%20Passing-brightgreen.svg)]()

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
- **Database:** PostgreSQL (Production / Docker) & SQLite+aiosqlite (Zero-config local development).
- **Security:** Argon2id password hashing, JWT in `HttpOnly` / `SameSite` cookies, Role-Based Access Control (RBAC), Object-Level Authorization, OWASP safeguards.
- **AI / Decision Support:** Prescription OCR extraction pipeline, rule-backed multi-drug interaction checker, medication adherence analytics.

---

## 3. Demo Accounts & One-Click Sign In

The login interface includes **1-Click Demo Buttons** for instant evaluation of all 4 roles:

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

### Option A: Local Development (Fastest — 0 Docker Required)

#### 1. Backend Setup
```bash
cd backend

# Create virtual environment with uv or python
uv venv --python 3.12 .venv
.venv\Scripts\activate

# Install dependencies
uv pip install -r requirements.txt aiosqlite

# Seed demo accounts and initialize database tables
python -m app.db.seed

# Start FastAPI development server
uvicorn app.main:app --reload --port 8000
```

#### 2. Frontend Setup
```bash
cd frontend

# Install packages
npm install

# Start Vite development server
npm run dev
```

Visit:
- **Web Application:** `http://localhost:5173`
- **Interactive OpenAPI Docs:** `http://localhost:8000/docs`
- **Health Check Endpoint:** `http://localhost:8000/health`

---

### Option B: Docker Compose

```bash
# Start PostgreSQL database, FastAPI backend, and React frontend
docker compose up --build

# Run database migrations and seed script
docker compose exec backend python -m app.db.seed
```

---

## 5. Object-Oriented Methodologies (OOM) Highlights

ArogyaNova is engineered to demonstrate rigorous Object-Oriented Software Engineering:

- **Encapsulation:** The `Prescription` domain entity (`app/domain/prescription.py`) strictly owns its internal state and collection of `PrescriptionItem` objects. State transitions (from `DRAFT` to `ACTIVE` or `CANCELLED`) are governed by domain methods (`finalize()`, `cancel()`) that enforce clinical invariants.
- **Abstraction:** Abstract Base Classes (`BaseUser`, `BaseRepository`, `NotificationChannel`, `InteractionChecker`, `OCRProvider`) define clear interface contracts while concealing low-level mechanics.
- **Inheritance:** `BaseUser` is specialized by `Doctor`, `Patient`, `Pharmacist`, and `Administrator` (`app/domain/users.py`), sharing core identity logic while providing role-specific permission sets.
- **Polymorphism:** `NotificationChannel` features interchangeable runtime implementations (`InAppNotificationChannel`, `EmailNotificationChannel`, `SMSNotificationChannel`). Similarly, `InteractionChecker` seamlessly switches between `LocalInteractionChecker` and `UnavailableInteractionChecker`.
- **Composition & Dependency Inversion:** Prescriptions are composed of prescription items. `PrescriptionService` depends on abstract `PrescriptionRepository` interfaces rather than raw database sessions.

Detailed viva notes and code mappings: **[docs/oop-design.md](docs/oop-design.md)**

---

## 6. Comprehensive Project Documentation

The `docs/` directory contains full technical specifications, diagrams, and viva preparation materials:

- **[OOM Design & SOLID Principles](docs/oop-design.md):** Encapsulation, inheritance, polymorphism, abstraction, and SOLID breakdown.
- **[UML Class Diagram](docs/class-diagram.md):** Complete Mermaid class diagram of domain entities and repositories.
- **[Use Case Diagram](docs/use-case-diagram.md):** Actor interactions for Doctor, Patient, Pharmacist, and Admin.
- **[Sequence & Activity Diagrams](docs/sequence-diagrams.md):** Sequence diagram for prescription creation and state machine workflow.
- **[ER Diagram & Database Design](docs/er-diagram.md):** Third Normal Form (3NF) relational schema, ACID properties, and constraints.
- **[Computer Networks Integration](docs/network-architecture.md):** TCP/IP, TLS 1.3, HTTP REST lifecycle, CORS, and connection pooling.
- **[Cybersecurity Architecture](docs/security.md):** Argon2id hashing, HttpOnly JWT cookies, RBAC, and OWASP Top 10 mitigations.
- **[REST API Reference](docs/api-documentation.md):** Complete API routes, request/response bodies, and HTTP status codes.

---

## 7. Running Backend Tests

The test suite validates domain invariants, encapsulation, RBAC permissions, password validation, and repository persistence:

```bash
cd backend
.venv\Scripts\python -m pytest tests -v
```

All **54 test cases** execute and pass.

---

## 8. License & Academic Disclaimer

Developed for academic demonstration in Object-Oriented Methodologies (OOM). AI and interaction checks provide clinical decision support and are not intended as independent medical diagnoses.
