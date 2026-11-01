# ArogyaNova — REST API Documentation

> **Base URL:** `/api/v1`  
> **Documentation UI:** Interactive Swagger available at `http://localhost:8000/docs`  
> **Alternative Specs:** ReDoc available at `http://localhost:8000/redoc`

---

## 1. Authentication Endpoints (`/api/v1/auth`)

### `POST /api/v1/auth/login`
- **Description:** Authenticates user credentials using Argon2id, creates an encrypted session, sets an `HttpOnly` cookie, and returns user details.
- **Request Body:**
  ```json
  {
    "email": "dr.sharma@arogyanova.dev",
    "password": "Demo@Doctor123"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "id": "e5b8e94a-8d76-4f3b-87c2-123456789abc",
    "email": "dr.sharma@arogyanova.dev",
    "first_name": "Priya",
    "last_name": "Sharma",
    "role": "doctor",
    "is_active": true,
    "created_at": "2026-11-01T12:00:00Z"
  }
  ```

### `POST /api/v1/auth/register`
- **Description:** Self-service registration for Patients, Doctors, and Pharmacists. (Administrator creation via public registration is forbidden).
- **Request Body:**
  ```json
  {
    "email": "new.doctor@arogyanova.dev",
    "password": "SecurePassword123!",
    "first_name": "Siddharth",
    "last_name": "Rao",
    "role": "doctor",
    "license_number": "MCI-2026-9901",
    "specialization": "Pediatrics"
  }
  ```
- **Response:** `200 OK`

### `POST /api/v1/auth/logout`
- **Description:** Clears the authentication session cookie.
- **Response:** `200 OK`

### `GET /api/v1/auth/me`
- **Description:** Returns the authenticated user's profile and permissions.
- **Response:** `200 OK`

---

## 2. Prescription Endpoints (`/api/v1/prescriptions`)

### `GET /api/v1/prescriptions`
- **Description:** Lists prescriptions with filtering by status, search, and pagination. Scoped by user role (doctors view their patients; patients view their own records; pharmacists view review queue).
- **Query Parameters:** `page`, `per_page`, `status`, `search`
- **Response (200 OK):**
  ```json
  {
    "total": 1,
    "page": 1,
    "per_page": 15,
    "pages": 1,
    "items": [
      {
        "id": "7f1e63a1-2d9c-44b2-a6f9-715694c34a11",
        "status": "active",
        "issue_date": "2026-11-01",
        "diagnosis": "Hypertension Stage 1",
        "item_count": 2,
        "patient": { "first_name": "Ravi", "last_name": "Verma" },
        "doctor": { "first_name": "Priya", "last_name": "Sharma" }
      }
    ]
  }
  ```

### `POST /api/v1/prescriptions`
- **Description:** Creates a new prescription draft. (Doctor only).
- **Request Body:**
  ```json
  {
    "patient_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "issue_date": "2026-11-01",
    "diagnosis": "Type 2 Diabetes Mellitus",
    "clinical_notes": "Monitor fasting blood glucose weekly.",
    "items": [
      {
        "medication_id": "8bb85f64-5717-4562-b3fc-2c963f66afa6",
        "strength": "500mg",
        "dosage": "1 tablet",
        "route": "oral",
        "frequency": "Twice daily with meals",
        "duration_days": 30,
        "quantity": "60 tablets",
        "instructions": "Take after breakfast and dinner."
      }
    ]
  }
  ```
- **Response:** `201 Created`

### `POST /api/v1/prescriptions/{id}/finalize`
- **Description:** Finalizes a draft prescription, transitioning it to `ACTIVE` and automatically generating the medication schedule rows.
- **Response:** `200 OK`

### `POST /api/v1/prescriptions/{id}/cancel`
- **Description:** Cancels an active or draft prescription.
- **Response:** `200 OK`

---

## 3. Medication Schedule Endpoints (`/api/v1/schedule`)

### `GET /api/v1/schedule`
- **Description:** Retrieves the patient's daily and upcoming dosing schedule.
- **Response (200 OK):**
  ```json
  [
    {
      "id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
      "scheduled_at": "2026-11-01T09:00:00Z",
      "medication_name": "Metformin",
      "dosage": "1 tablet",
      "instructions": "Take with water after breakfast",
      "logged_action": null
    }
  ]
  ```

### `POST /api/v1/schedule/{id}/log`
- **Description:** Patient logs a scheduled dose as `taken` or `skipped`.
- **Request Body:**
  ```json
  {
    "action": "taken"
  }
  ```
- **Response:** `200 OK`

---

## 4. AI & Decision Support (`/api/v1/ai`)

### `POST /api/v1/ai/interaction-check`
- **Description:** Evaluates a list of medication names for potential pharmacokinetic and adverse interactions.
- **Request Body:**
  ```json
  {
    "medicine_names": ["Aspirin", "Warfarin"]
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "checked_medicines": ["Aspirin", "Warfarin"],
    "has_interactions": true,
    "interactions": [
      {
        "drug_a": "Aspirin",
        "drug_b": "Warfarin",
        "severity": "major",
        "description": "Increased risk of severe bleeding due to additive antiplatelet and anticoagulant effects.",
        "source": "Local Pharmacological Interaction Ruleset",
        "is_uncertain": false
      }
    ],
    "is_available": true,
    "source": "Local Pharmacological Interaction Ruleset",
    "disclaimer": "AI and clinical interaction checks provide decision-support only. Medical professionals must exercise independent clinical judgement.",
    "checked_at": "2026-11-01T14:00:00Z"
  }
  ```

### `POST /api/v1/ai/ocr`
- **Description:** Uploads a scanned prescription slip (PNG, JPG, WebP) to extract candidate medication names, strengths, and dosages.
- **Payload:** `multipart/form-data` with field `file`.
- **Response:** `200 OK`
