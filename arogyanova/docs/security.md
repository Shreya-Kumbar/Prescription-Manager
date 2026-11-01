# ArogyaNova — Cybersecurity Architecture & Safeguards

> **Security Philosophy:** Defense in depth, principle of least privilege, zero trust authorization on all endpoints, and cryptographic integrity for clinical records.

---

## 1. Authentication & Cryptography

### A. Argon2id Password Hashing
Password hashing uses **Argon2id** (`argon2-cffi`), the winner of the Password Hashing Competition (PHC) and the gold standard recommended by OWASP:
- **Memory-hard & Time-hard:** Resists GPU and ASIC brute-force attacks by requiring significant RAM per verification.
- **Unique Per-User Salts:** Automatically generated cryptographically secure random salts prevent precomputed rainbow table attacks.
- **Complexity Enforcement:** Passwords must be at least 8 characters long and contain uppercase, lowercase, and numeric digits.

```python
# Code Reference: app/security/passwords.py
ph = PasswordHasher(
    time_cost=3,
    memory_cost=65536,  # 64 MB
    parallelism=4,
    hash_len=32,
    salt_len=16,
)
```

### B. JWT & Secure Cookie Strategy
- Tokens are signed with `HS256` using a secret key loaded strictly from environment variables.
- Transmitted inside `HttpOnly`, `Secure`, and `SameSite=Lax` cookies:
  - `HttpOnly`: Prevents JavaScript execution in the browser from accessing or stealing tokens (mitigating XSS token theft).
  - `SameSite=Lax`: Prevents cross-site request forgery (CSRF) in cross-origin requests.
  - Short token lifetimes (60 minutes) combined with revocable refresh sessions.

---

## 2. Authorization: RBAC & Object-Level Authorization

### A. Role-Based Access Control (RBAC)
FastAPI dependency `get_current_user` extracts and verifies credentials, checking against defined domain permissions:

| Operation | Doctor | Patient | Pharmacist | Administrator |
|---|:---:|:---:|:---:|:---:|
| Author / Create Prescriptions | **Allowed** | Denied (403) | Denied (403) | Denied (403) |
| Finalize Prescriptions | **Allowed** | Denied (403) | Denied (403) | Denied (403) |
| Log Medication Doses | Denied (403) | **Allowed** | Denied (403) | Denied (403) |
| Review / Flag Formulations | Denied (403) | Denied (403) | **Allowed** | Denied (403) |
| Manage User Accounts | Denied (403) | Denied (403) | Denied (403) | **Allowed** |
| Access Security Audit Trail | Denied (403) | Denied (403) | Denied (403) | **Allowed** |

### B. Object-Level Authorization (IDOR Prevention)
In healthcare systems, verifying that a user is a "Patient" is insufficient; the system must verify that the patient owns the record:
- **Patient Isolation:** A patient attempting to access `/api/v1/patients/{id}` or `/api/v1/prescriptions/{id}` where `{id}` belongs to another patient receives an explicit `HTTP 403 Forbidden` response.
- **Doctor Scoping:** Doctors can only view records of authorized patients under their clinical care.
- **Admin Privilege Limitation:** Administrators cannot browse private psychiatric or clinical notes without an explicit authorized administrative workflow.

---

## 3. OWASP Top 10 Mitigation Matrix

| Vulnerability | ArogyaNova Safeguard |
|---|---|
| **A01: Broken Access Control** | Server-side role checks on every single route handler; object ownership validation before returning records. |
| **A02: Cryptographic Failures** | Argon2id for password storage; TLS encryption for data in transit; secrets loaded from `.env` and excluded from Git. |
| **A03: Injection (SQLi)** | 100% parameterized SQL queries via SQLAlchemy ORM; no string concatenation in SQL queries. |
| **A04: Insecure Design** | Explicit state machines in `Prescription` entity prevent unauthorized status mutations. |
| **A05: Security Misconfiguration** | Strict CORS allowlist; security headers (`X-Frame-Options`, `X-Content-Type-Options`). |
| **A06: Vulnerable Components** | Pinned dependencies in `requirements.txt` and `package.json`. |
| **A07: Identification & Auth Failures** | Rate limiting via SlowAPI on `/auth/login` to prevent credential stuffing; automatic session timeout. |
| **A08: Software & Data Integrity** | Secure image upload validation (`image/png`, `image/jpeg` MIME verification, 10MB size limit) prevents arbitrary code execution. |
| **A09: Security Logging & Monitoring** | Audit log records actor ID, action name, resource, and client IP in database table `audit_logs`. |
| **A10: Server-Side Request Forgery** | No dynamic unvalidated external HTTP request fetching from user input. |
