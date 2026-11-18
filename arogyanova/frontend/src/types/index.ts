// ArogyaNova — TypeScript Type Definitions

export type UserRole = 'doctor' | 'patient' | 'pharmacist' | 'administrator' | 'receptionist';

export interface DoctorProfile {
  license_number: string;
  specialization?: string;
  hospital_affiliation?: string;
  phone?: string;
}

export interface PatientProfile {
  date_of_birth?: string;
  phone?: string;
  address?: string;
  blood_group?: string;
  emergency_contact?: string;
  allergies?: string;
  medical_history?: string;
}

export interface PharmacistProfile {
  license_number: string;
  pharmacy_name?: string;
  phone?: string;
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  access_token?: string;
  doctor_profile?: DoctorProfile | null;
  patient_profile?: PatientProfile | null;
  pharmacist_profile?: PharmacistProfile | null;
}

export type PrescriptionStatus = 'draft' | 'active' | 'completed' | 'cancelled' | 'expired';

export interface Medication {
  id: string;
  generic_name: string;
  brand_name?: string;
  strength: string;
  dosage_form: string;
  category?: string;
  description?: string;
  manufacturer?: string;
  is_active: boolean;
  created_at: string;
}

export interface PrescriptionItem {
  id: string;
  medication_id: string;
  strength: string;
  dosage: string;
  route: string;
  frequency: string;
  duration_days: number;
  quantity: string;
  instructions?: string;
  start_date?: string;
  end_date?: string;
  medication?: Medication;
}

export interface PrescriptionSummary {
  id: string;
  status: PrescriptionStatus;
  issue_date: string;
  follow_up_date?: string;
  diagnosis?: string;
  created_at: string;
  updated_at: string;
  patient?: User;
  doctor?: User;
  item_count: number;
  pharmacy_status?: 'pending' | 'verified' | 'flagged' | 'dispensed';
  cancellation_reason?: string | null;
  replaces_id?: string | null;   // this is a corrected version of that prescription
  replaced_by_id?: string | null; // this was replaced by that prescription
}

export interface PharmacyHistoryEntry {
  action: 'verify' | 'flag' | 'dispense' | 'respond';
  notes?: string;
  pharmacist_name: string;
  created_at: string;
}

export interface PrescriptionDetail extends PrescriptionSummary {
  items: PrescriptionItem[];
  clinical_notes?: string;
  pharmacy_history: PharmacyHistoryEntry[];
}

export interface PrescriptionListResponse {
  total: number;
  page: number;
  per_page: number;
  pages: number;
  items: PrescriptionSummary[];
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  action_url?: string;
  is_read: boolean;
  created_at: string;
}

export interface ScheduleEntry {
  id: string;
  scheduled_at: string;
  medication_name: string;
  dosage: string;
  instructions?: string;
  logged_action?: 'taken' | 'skipped';
}

export interface DrugInteraction {
  drug_a: string;
  drug_b: string;
  severity: 'minor' | 'moderate' | 'major' | 'contraindicated';
  description: string;
  source: string;
  is_uncertain: boolean;
}

export interface InteractionCheckResult {
  checked_medicines: string[];
  has_interactions: boolean;
  interactions: DrugInteraction[];
  is_available: boolean;
  source: string;
  disclaimer: string;
  checked_at: string;
  error_message?: string;
}

export interface AuditLog {
  id: string;
  actor_id?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details?: string;
  ip_address?: string;
  created_at: string;
}

export interface DashboardStats {
  role: UserRole;
  stats: Record<string, unknown>;
}

export interface ApiError {
  detail: string;
}


export interface VitalAlert {
  level: 'info' | 'warning' | 'critical';
  message: string;
}

export interface Vitals {
  id: string;
  patient_id: string;
  systolic_bp?: number | null;
  diastolic_bp?: number | null;
  pulse?: number | null;
  spo2?: number | null;
  temperature_c?: number | null;
  respiratory_rate?: number | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  notes?: string | null;
  bmi?: number | null;
  bmi_category?: string | null;
  alerts: VitalAlert[];
  recorded_by_name: string;
  recorded_by_role: string;
  recorded_at: string;
}
