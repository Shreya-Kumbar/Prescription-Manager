# ArogyaNova — What Each Role Can Do (and how to test it)

Demo logins are on the sign-in page (click a chip, then **Sign in**).

| Role | Email | Password |
|---|---|---|
| Doctor | dr.sharma@arogyanova.dev | Demo@Doctor123 |
| Patient | patient.ravi@arogyanova.dev | Demo@Patient123 |
| Pharmacist | pharma.anil@arogyanova.dev | Demo@Pharma123 |
| Admin | admin@arogyanova.dev | Demo@Admin123 |

---

## 1. Doctor — writes prescriptions

| Can do | Where | Try it |
|---|---|---|
| See own patients, prescriptions, adherence charts | Dashboard | Check the status donut and "Patient load" |
| Write a prescription, save as **draft** | **New Prescription** (top bar) | Pick patient **Ravi Verma**, add Paracetamol, **Save Draft** |
| **Edit a draft** (diagnosis, notes, follow-up) | Prescription page → **Edit draft** | Change the diagnosis, save |
| Run the **AI drug-interaction check** | New Prescription → **Check Drug Interactions** | Add **Clopidogrel + Ibuprofen** → MAJOR warning |
| **Finalize & issue** (makes the dose schedule, notifies patient) | Prescription page → **Finalize** | Status becomes ACTIVE; editing is now blocked |
| **Cancel** a prescription | Prescription page → **Cancel** | Cancelling twice gives a clear error |
| View patient records (read-only) | Patients | Doctors **cannot** edit patient details |
| Get pharmacy flags | Bell / Notifications → **Open** | Opens the flagged prescription with the reason |
| Print a prescription | Prescription page → **Print** | Only the prescription prints |
| **Cannot:** edit an active prescription, verify/dispense, add medicines, create accounts | | |

## 2. Pharmacist — verifies and dispenses

| Can do | Where | Try it |
|---|---|---|
| See the work queue: to review / ready / flagged / dispensed | Dashboard | |
| Filter prescriptions by pharmacy state | Prescriptions → "All pharmacy states" filter | |
| **Verify** a prescription | Prescription page → Pharmacy panel → **Verify** | Doctor gets a "verified" notification |
| **Flag a problem** (reason required) | Pharmacy panel → **Flag a problem** | Doctor gets a high-priority notification with the reason |
| **Dispense** (only after verify) | Pharmacy panel → **Dispense** | Patient gets "Medicines dispensed"; history shows who/when |
| Run the AI interaction check / OCR | AI Clinical Review | Warfarin + Aspirin → MAJOR |
| Add, **retire** or **restore** medicines | Medication Catalogue | Retired medicines can't be prescribed |
| **Cannot:** see drafts, write prescriptions, dispense before verifying, act on cancelled prescriptions | | |

## 3. Patient — follows the treatment

| Can do | Where | Try it |
|---|---|---|
| **Sign up** (only patients can) | Sign-in page → **Create one** | |
| See today's doses, adherence, prescriptions | Dashboard | |
| **Log a dose** taken / skipped (today or earlier only, once each) | Medication Schedule or Dashboard | Future doses show **Upcoming** |
| See own prescriptions + pharmacy status | Prescriptions | "Dispensed to patient" after the pharmacist dispenses |
| Update own **health profile** (phone, blood group, allergies) | Settings → My health profile | |
| Notifications | Bell | |
| Change password / forgot password | Settings / sign-in page | |
| **Cannot:** see other patients, write or change prescriptions | | |

## 4. Administrator — runs the system

| Can do | Where | Try it |
|---|---|---|
| **Create doctor & pharmacist accounts** | User Management → **Add staff** | New doctor can log in immediately |
| **Deactivate / activate** any user | User Management | Deactivated user can't log in |
| View all prescriptions (clinical notes hidden) | Prescriptions | |
| Edit any patient's details | Patients → patient → Edit Profile | |
| Maintain medicine catalogue | Medication Catalogue | |
| See users by role, security audit log | Dashboard | Every login, finalize, flag, dispense is logged |
| **Cannot:** write, verify or dispense prescriptions; use AI clinical tools | | |

---

## Full end-to-end demo (≈5 minutes)

1. **Doctor** → New Prescription → Ravi Verma → Paracetamol → Check interactions → **Finalize & Issue**.
2. **Pharmacist** → Dashboard → open Ravi's prescription → **Verify** → **Dispense**.
3. **Patient** (Ravi) → Notifications shows "Medicines dispensed" → Medication Schedule → **Take Dose** for today.
4. **Doctor** → Dashboard → adherence chart updated.
5. **Admin** → Dashboard → audit log shows the finalize / verify / dispense events → **Add staff** to create a new pharmacist.

---

## Where the concepts are (for the viva)

**Four OOP pillars**
- **Encapsulation** — `Prescription` (`_status`, `_items`) and `PharmacyReview` (`_status`) are private; changed only via `finalize()`, `cancel()`, `verify()`, `flag()`, `dispense()`. *domain/prescription.py, domain/pharmacy.py*
- **Abstraction** — abstract classes `BaseUser`, `BaseRepository[T]`, `InteractionChecker`, `OCRProvider`, `NotificationChannel`. *domain/, repositories/base.py*
- **Inheritance** — `Doctor`, `Patient`, `Pharmacist`, `Administrator` extend `BaseUser`. *domain/users.py*
- **Polymorphism** — `get_permissions()` differs per role; `NotificationChannel.send()` per channel; `PharmacyReview.apply(action)` picks behaviour by action.

**Classes & objects** — every prescription, item, user and review is an object of a domain class; the API creates them per request.

**Design** — SOLID, State pattern (two state machines), Repository, Strategy, Observer, Factory (`create_user_account`), Dependency Injection, UML (use case, class, sequence, state ×2, activity, ER, deployment).

**DBMS** — 3NF schema (14 tables incl. `pharmacy_actions` and `password_reset_tokens`), PK/FK/UNIQUE/CHECK constraints, ACID transactions, ORM, eager loading, schema upgrade on start-up.

**Computer Networks** — client–server REST over HTTP/TCP, JSON, status codes (201/400/401/403/404), CORS, ports 5173/8000, SMTP email over TLS.

**Cybersecurity** — Argon2id hashing, JWT in HttpOnly cookies, RBAC + object-level checks, patient-only sign-up, admin-created staff, one-time hashed reset tokens, audit log, security headers.

**AI / ML** — rule-based drug-interaction expert system, Tesseract (LSTM neural network) OCR, adherence analytics.

**Testing** — 77 automated tests + 73-action end-to-end run + crawl of every page as every role.
