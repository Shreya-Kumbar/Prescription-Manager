# ArogyaNova — Database Management System (DBMS) Specification & ER Diagram

> **Database Engine:** PostgreSQL (Production / Docker) / SQLite+aiosqlite (Local Dev)  
> **ORM:** SQLAlchemy 2.0 (AsyncIO)  
> **Migration Tool:** Alembic  
> **Normalization Standard:** Third Normal Form (3NF)

---

## 1. Entity-Relationship (ER) Diagram

```mermaid
erDiagram
    USERS ||--o| DOCTOR_PROFILES : "has profile"
    USERS ||--o| PATIENT_PROFILES : "has profile"
    USERS ||--o| PHARMACIST_PROFILES : "has profile"
    USERS ||--o{ PRESCRIPTIONS : "prescribes (as doctor)"
    USERS ||--o{ PRESCRIPTIONS : "receives (as patient)"
    USERS ||--o{ NOTIFICATIONS : "receives"
    USERS ||--o{ AUDIT_LOGS : "triggers"
    USERS ||--o{ REFRESH_TOKENS : "owns"

    PRESCRIPTIONS ||--|{ PRESCRIPTION_ITEMS : "contains"
    MEDICATIONS ||--o{ PRESCRIPTION_ITEMS : "referenced by"

    PRESCRIPTIONS ||--o{ MEDICATION_SCHEDULES : "generates"
    PRESCRIPTION_ITEMS ||--o{ MEDICATION_SCHEDULES : "schedules"
    MEDICATION_SCHEDULES ||--o{ MEDICATION_LOGS : "logs compliance"

    USERS {
        uuid id PK
        string email UK
        string hashed_password
        string first_name
        string last_name
        string role
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    DOCTOR_PROFILES {
        uuid id PK
        uuid user_id FK
        string license_number UK
        string specialization
        string hospital_affiliation
        string phone
    }

    PATIENT_PROFILES {
        uuid id PK
        uuid user_id FK
        date date_of_birth
        string phone
        string address
        string blood_group
        string emergency_contact
        text allergies
        text medical_history
    }

    PHARMACIST_PROFILES {
        uuid id PK
        uuid user_id FK
        string license_number UK
        string pharmacy_name
        string phone
    }

    MEDICATIONS {
        uuid id PK
        string generic_name
        string brand_name
        string strength
        string dosage_form
        string category
        text description
        boolean is_active
        timestamp created_at
    }

    PRESCRIPTIONS {
        uuid id PK
        uuid patient_id FK
        uuid doctor_id FK
        string status
        date issue_date
        date follow_up_date
        string diagnosis
        text clinical_notes
        timestamp created_at
        timestamp updated_at
    }

    PRESCRIPTION_ITEMS {
        uuid id PK
        uuid prescription_id FK
        uuid medication_id FK
        string strength
        string dosage
        string route
        string frequency
        int duration_days
        string quantity
        string instructions
        date start_date
        date end_date
    }

    MEDICATION_SCHEDULES {
        uuid id PK
        uuid patient_id FK
        uuid prescription_item_id FK
        timestamp scheduled_time
        timestamp created_at
    }

    MEDICATION_LOGS {
        uuid id PK
        uuid schedule_id FK
        uuid patient_id FK
        string action
        timestamp logged_at
    }

    NOTIFICATIONS {
        uuid id PK
        uuid user_id FK
        string title
        text message
        string priority
        boolean is_read
        timestamp created_at
    }

    AUDIT_LOGS {
        uuid id PK
        uuid actor_id FK
        string action
        string resource_type
        uuid resource_id
        string details
        string ip_address
        timestamp created_at
    }
```

---

## 2. Relational Database Normalization Analysis

### First Normal Form (1NF)
- **Elimination of Repeating Groups:** Rather than storing comma-separated medicines inside `PRESCRIPTIONS`, a separate normalized table `PRESCRIPTION_ITEMS` holds atomic medication rows.
- **Atomicity:** All attributes store single, indivisible values (e.g. `first_name`, `last_name`, `strength`, `duration_days`).
- **Primary Keys:** Every entity contains a unique `UUID` primary key (`id`).

### Second Normal Form (2NF)
- Meets all 1NF requirements.
- **Full Functional Dependency:** In `PRESCRIPTION_ITEMS`, every attribute depends entirely on the primary key `id`, with no partial dependency on composite candidate keys.
- Role-specific attributes are partitioned into profile tables (`DOCTOR_PROFILES`, `PATIENT_PROFILES`, `PHARMACIST_PROFILES`) rather than causing null-padded columns in a monolithic `USERS` table.

### Third Normal Form (3NF)
- Meets all 2NF requirements.
- **Transitive Dependency Elimination:** In `PRESCRIPTION_ITEMS`, rather than copying `category`, `dosage_form`, or `manufacturer` from `MEDICATIONS`, it holds a foreign key `medication_id`. Any update to drug formulations propagates automatically without data anomalies.

---

## 3. ACID Properties & Transaction Boundaries

- **Atomicity:** When a doctor finalizes a prescription, the creation of the prescription items, status transition, and schedule generation occur inside an explicit `async with session.begin():` block. If any insert fails, the entire transaction rolls back cleanly, leaving zero partial prescription records in the database.
- **Consistency:** Enforced via database foreign keys (`ON DELETE CASCADE`), unique constraints (`users.email`, `doctor_profiles.license_number`), and check constraints (`duration_days > 0`).
- **Isolation:** Managed via connection pool isolation level (`READ COMMITTED`), preventing dirty reads during concurrent patient and doctor requests.
- **Durability:** Committed transactions write to write-ahead logs (WAL) in PostgreSQL, persisting data across server restarts.
