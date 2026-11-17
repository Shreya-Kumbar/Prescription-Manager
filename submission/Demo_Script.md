# ArogyaNova — Live Demo Script (with concepts)

**Setup:** backend + frontend running → open `http://localhost:5173` (light mode).
All file paths are inside `arogyanova/backend/app/` unless they start with `frontend/`.

---

## 1. Login page (30 s)

| Show | Say | Concept | Where in code |
|---|---|---|---|
| Four demo role buttons | "Four user types share common features from one parent class." | **Inheritance**, **Abstraction** (`BaseUser` is an abstract class) | `domain/base_user.py`, `domain/users.py` |
| Type email + password, sign in | "The password is never stored — only an Argon2 hash. Login gives a JWT stored in an HttpOnly cookie." | **Cybersecurity**: hashing, JWT, HttpOnly cookies | `security/passwords.py`, `api/v1/auth.py` |
| "Forgot password?" link | "One-time reset link, expires in 30 minutes, only its hash is stored." | **Cybersecurity**, **Polymorphism** (sent via `EmailNotificationChannel`) | `api/v1/auth.py`, `domain/notifications.py` |
| Browser → server | "The React app talks to the Python server over HTTP with JSON — a REST API." | **Computer Networks**: client–server, REST, HTTP | `frontend/src/services/api.ts` |

## 2. Doctor (4 min) — the main part

| Show | Say | Concept | Where in code |
|---|---|---|---|
| Dashboard | "Same page, different content per role." | **Polymorphism** — each role overrides `get_permissions()` | `domain/users.py` |
| Create Prescription → pick patient, add **Clopidogrel + Ibuprofen** | "A prescription *owns* its medicine items — they can't exist without it." | **Composition** (`Prescription` ◆— `PrescriptionItem`) | `domain/prescription.py` |
| Click **Check Drug Interactions** → MAJOR warning | "Our AI checker is a rule-based expert system behind an abstract interface. We can swap in a different checker without changing any other code." | **AI**, **Abstraction**, **Polymorphism**, **Strategy pattern**, **Open/Closed principle** | `domain/ai_providers.py` (`InteractionChecker` → `LocalInteractionChecker`) |
| Swap Ibuprofen → Paracetamol, check → safe | "Rules are data, so adding a new interaction needs no code change." | **Open/Closed principle** | `domain/ai_providers.py` (`_KNOWN_INTERACTIONS`) |
| Click **Finalize & Issue** | "Status goes DRAFT → ACTIVE. Only the Prescription class can change its own status; illegal moves raise an error." | **Encapsulation**, **State pattern** | `domain/prescription.py` (`finalize()`, `_transition_to()`, `_VALID_TRANSITIONS`) |
| (same click) | "Finalising saves the prescription, schedule and notification together — all or nothing." | **DBMS**: ACID transaction | `api/v1/prescriptions.py` |
| Open the new prescription — no edit option | "Once active it's locked — the object protects itself." | **Encapsulation** (`is_editable` property) | `domain/prescription.py` |
| Medication Catalogue | "Each medicine is a row in a normalised table, mapped to a Python class by the ORM." | **DBMS**: 3NF, ORM | `models/models.py` |
| Analytics | "Charts computed from real logs." | **Data analytics** | `services/analytics_service.py` |

## 3. Patient (1.5 min)

| Show | Say | Concept | Where in code |
|---|---|---|---|
| Medication Schedule | "These doses were generated automatically when the doctor finalised." | **Service layer** | `api/v1/prescriptions.py`, `services/prescription_service.py` |
| Mark a dose **Taken** | "Adherence % = taken ÷ logged × 100." | **AI/Analytics** | `services/analytics_service.py` |
| Notifications | "One event, delivered through any number of channels — in-app, email, SMS." | **Polymorphism**, **Observer pattern**, **Dependency Inversion** | `domain/notifications.py` (`NotificationService`) |

## 4. Pharmacist (30 s)

| Show | Say | Concept | Where in code |
|---|---|---|---|
| Open a prescription to review | "Same data, different permissions. The server checks the role on every request." | **Role-Based Access Control** (Cybersecurity) | `security/dependencies.py`, `domain/users.py` |

## 5. Admin (1 min)

| Show | Say | Concept | Where in code |
|---|---|---|---|
| Users page | "Only Administrator has `can_manage_users()`." | **Polymorphism**, **RBAC** | `domain/users.py` |
| (mention) | "Every action — login, finalise, cancel — is written to an audit log." | **Cybersecurity**: accountability | `models/models.py` (`AuditLogModel`) |

## 6. Wrap-up (30 s)

| Show | Say | Concept | Where in code |
|---|---|---|---|
| Toggle dark mode | "Theme is shared app-wide through a React Context." | **GUI**, Provider pattern | `frontend/src/context/ThemeContext.tsx` |
| Open `localhost:8000/docs` | "Auto-generated API documentation for our REST endpoints." | **Computer Networks**: REST/HTTP | `main.py` |
| (mention) | "62 automated tests check these rules." | **Testing** | `backend/tests/` |

---

### If they ask "show me the code"

1. **`domain/prescription.py`** — encapsulation, composition, state machine (best example).
2. **`domain/base_user.py` + `domain/users.py`** — abstraction, inheritance, polymorphism.
3. **`domain/ai_providers.py`** — interfaces + interchangeable implementations.
4. **`repositories/base.py`** — generics `BaseRepository[T]`, Repository pattern, Dependency Inversion.

### One-line answers to likely questions

- **Why Python not Java?** OOP is a design method, not a language. Python has classes, inheritance, abstract classes (`ABC`), properties and generics — the same concepts.
- **Where is encapsulation?** `Prescription` keeps `_status` private; only `finalize()` / `cancel()` can change it.
- **Where is polymorphism?** `get_permissions()` differs per role; `NotificationChannel.send()` differs per channel.
- **Where is abstraction?** `BaseUser`, `InteractionChecker`, `NotificationChannel`, `BaseRepository` — all abstract base classes.
- **Where is inheritance?** `Doctor`, `Patient`, `Pharmacist`, `Administrator` extend `BaseUser`.
