// ArogyaNova — Prescription Service
import api from './api';
import type {
  PrescriptionDetail,
  PrescriptionListResponse,
  PrescriptionSummary,
} from '../types';

export interface CreatePrescriptionData {
  patient_id: string;
  issue_date: string;
  follow_up_date?: string;
  diagnosis?: string;
  clinical_notes?: string;
  items: Array<{
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
  }>;
}

export interface PrescriptionFilters {
  page?: number;
  per_page?: number;
  status?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

export const prescriptionService = {
  async list(filters: PrescriptionFilters = {}): Promise<PrescriptionListResponse> {
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== undefined && v !== '')
    );
    const { data } = await api.get<PrescriptionListResponse>('/prescriptions', { params });
    return data;
  },

  async get(id: string): Promise<PrescriptionDetail> {
    const { data } = await api.get<PrescriptionDetail>(`/prescriptions/${id}`);
    return data;
  },

  async create(prescription: CreatePrescriptionData): Promise<PrescriptionDetail> {
    const { data } = await api.post<PrescriptionDetail>('/prescriptions', prescription);
    return data;
  },

  async update(id: string, updates: Partial<{ diagnosis: string; clinical_notes: string; follow_up_date: string }>): Promise<PrescriptionDetail> {
    const { data } = await api.patch<PrescriptionDetail>(`/prescriptions/${id}`, updates);
    return data;
  },

  async finalize(id: string): Promise<PrescriptionDetail> {
    const { data } = await api.post<PrescriptionDetail>(`/prescriptions/${id}/finalize`);
    return data;
  },

  async cancel(id: string): Promise<PrescriptionDetail> {
    const { data } = await api.post<PrescriptionDetail>(`/prescriptions/${id}/cancel`);
    return data;
  },
};
