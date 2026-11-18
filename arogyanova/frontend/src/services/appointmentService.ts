import api from './api';
import type { User } from '../types';

export type AppointmentStatus = 'booked' | 'checked_in' | 'completed' | 'cancelled' | 'no_show';

export interface Appointment {
  id: string;
  scheduled_at: string; // clinic local time, e.g. "2026-11-19T10:30:00"
  duration_minutes: number;
  reason: string;
  status: AppointmentStatus;
  cancellation_reason?: string | null;
  patient?: User;
  doctor?: User;
  booked_by_name?: string | null;
  created_at: string;
}

export interface DoctorOption { id: string; first_name: string; last_name: string; specialization?: string | null }
export interface DaySlots { doctor_id: string; day: string; working_day: boolean; slots: { time: string; available: boolean }[] }

/** Local YYYY-MM-DD (not UTC) so "today" matches the clinic's day. */
export const localDay = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** "10:30 AM" from a naive clinic-time ISO string (no time-zone shifting). */
export const clockTime = (iso: string) => {
  const [h, m] = iso.slice(11, 16).split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
export const dayLabel = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

export const appointmentService = {
  async list(params: { day?: string; when?: 'upcoming' | 'past'; doctor_id?: string; patient_id?: string; status?: string } = {}) {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v));
    return (await api.get<Appointment[]>('/appointments', { params: clean })).data;
  },
  async doctors() {
    return (await api.get<DoctorOption[]>('/appointments/doctors')).data;
  },
  async slots(doctor_id: string, day: string) {
    return (await api.get<DaySlots>('/appointments/slots', { params: { doctor_id, day } })).data;
  },
  async book(body: { patient_id: string; doctor_id: string; scheduled_at: string; reason: string }) {
    return (await api.post<Appointment>('/appointments', body)).data;
  },
  async act(id: string, action: 'check_in' | 'complete' | 'cancel' | 'no_show', reason?: string) {
    return (await api.post<Appointment>(`/appointments/${id}/status`, { action, reason })).data;
  },
};
