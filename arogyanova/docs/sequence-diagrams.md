# ArogyaNova — Sequence & Activity Diagrams

## 1. Sequence Diagram: Prescription Creation Lifecycle

This sequence diagram illustrates the complete end-to-end flow across Computer Networks layers and backend architecture when a Doctor authors, checks interactions, and finalizes a prescription.

```mermaid
sequenceDiagram
    autonumber
    actor Doc as Doctor (Client)
    participant Browser as React Frontend
    participant Gateway as FastAPI Router (/api/v1)
    participant Auth as Auth & RBAC Middleware
    participant Service as PrescriptionService
    participant Checker as InteractionChecker (AI)
    participant Repo as PrescriptionRepository
    participant DB as PostgreSQL Database
    participant Notif as NotificationService

    Doc->>Browser: Fill patient details, diagnosis, add medications
    Doc->>Browser: Clicks "Check Drug Interactions"
    Browser->>Gateway: POST /api/v1/ai/interaction-check {medicines}
    Gateway->>Checker: check(medicine_names)
    Checker-->>Gateway: Return interaction flags & severity
    Gateway-->>Browser: JSON {has_interactions, interactions, disclaimer}
    Browser-->>Doc: Display clinical warnings & advisories

    Doc->>Browser: Clicks "Finalize & Issue Prescription"
    Browser->>Gateway: POST /api/v1/prescriptions {patient_id, items, ...}
    Gateway->>Auth: Validate JWT cookie & check role == "doctor"
    Auth-->>Gateway: Authorized Doctor Context

    Gateway->>Service: create_and_finalize(payload, doctor)
    Service->>Service: Validate state transitions & domain invariants
    
    critical Database Transaction Boundary
        Service->>Repo: create(prescription_model, items)
        Repo->>DB: INSERT INTO prescriptions, prescription_items
        Service->>Repo: generate_schedule(prescription)
        Repo->>DB: INSERT INTO medication_schedules
        DB-->>Repo: COMMIT TRANSACTION
    end

    Service->>Notif: notify_patient(patient_id, "New Prescription Issued")
    Notif->>DB: INSERT INTO notifications
    
    Service-->>Gateway: PrescriptionDetail response schema
    Gateway-->>Browser: HTTP 201 Created (JSON)
    Browser-->>Doc: Show success toast & redirect to details view
```

---

## 2. Activity Diagram: Prescription State Machine & Workflow

```mermaid
stateDiagram-v2
    [*] --> Draft : Doctor creates prescription

    state Draft {
        [*] --> Editing
        Editing --> CheckingInteractions : Run AI check
        CheckingInteractions --> Editing : Review warnings
        Editing --> AddingMedications : Add / remove line items
        AddingMedications --> Editing
    }

    Draft --> Active : Doctor clicks Finalize & Invariants Pass
    note right of Active
        Medication schedule rows
        automatically generated.
        Visible to Patient & Pharmacist.
    end note

    Draft --> Cancelled : Doctor cancels draft

    Active --> Completed : All scheduled doses completed / Course end date reached
    Active --> Cancelled : Doctor issues clinical cancellation

    Completed --> [*]
    Cancelled --> [*]
```
