import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Calendar,
  Droplet,
  AlertTriangle,
  FileText,
  PlusCircle,
  Clock,
  Shield,
  Edit2,
  Save,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import type { User as UserType, PrescriptionSummary } from '../types';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';

export default function PatientDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [patient, setPatient] = useState<UserType | null>(null);
  const [prescriptions, setPrescriptions] = useState<PrescriptionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Edit Mode
  const [isEditing, setIsEditing] = useState(false);
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [allergies, setAllergies] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');

  const fetchPatientData = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const [patRes, prescRes] = await Promise.all([
        api.get(`/patients/${id}`),
        api.get(`/prescriptions?patient_id=${id}`),
      ]);
      setPatient(patRes.data);
      const prof = patRes.data.patient_profile;
      if (prof) {
        setPhone(prof.phone || '');
        setAddress(prof.address || '');
        setBloodGroup(prof.blood_group || '');
        setAllergies(prof.allergies || '');
        setEmergencyContact(prof.emergency_contact || '');
      }
      setPrescriptions(prescRes.data.items || []);
    } catch {
      toast.error('Failed to load patient profile.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPatientData();
  }, [id]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      await api.patch(`/patients/${id}/profile`, {
        phone,
        address,
        blood_group: bloodGroup,
        allergies,
        emergency_contact: emergencyContact,
      });
      toast.success('Patient clinical profile updated.');
      setIsEditing(false);
      fetchPatientData();
    } catch {
      toast.error('Failed to update patient profile.');
    }
  };

  if (isLoading) {
    return (
      <div className="card p-8 space-y-4 animate-pulse max-w-4xl mx-auto">
        <div className="h-6 bg-slate-100 rounded w-1/3" />
        <div className="h-40 bg-slate-100 rounded" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="card p-12 text-center max-w-xl mx-auto">
        <h3 className="text-base font-bold text-text">Patient Not Found</h3>
        <button onClick={() => navigate('/patients')} className="btn-secondary text-xs mt-4">
          Back to Directory
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/patients')}
          className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text p-2 rounded-lg border border-border bg-white"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Directory
        </button>

        {user?.role === 'doctor' && (
          <button
            onClick={() => navigate('/prescriptions/new')}
            className="btn-primary text-xs shadow-xs"
          >
            <PlusCircle className="w-3.5 h-3.5" /> Author Prescription
          </button>
        )}
      </div>

      {/* Patient Demographic Card */}
      <div className="card p-6 border border-border space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl">
              {patient.first_name[0]}
              {patient.last_name[0]}
            </div>
            <div>
              <h2 className="text-xl font-bold text-text">
                {patient.first_name} {patient.last_name}
              </h2>
              <p className="text-xs text-text-secondary mt-0.5">{patient.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                  Patient ID: {patient.id.slice(0, 8)}
                </span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                  Verified Patient
                </span>
              </div>
            </div>
          </div>

          <div>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="btn-secondary text-xs"
              >
                <Edit2 className="w-3.5 h-3.5" /> Edit Profile
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(false)}
                className="btn-ghost text-xs text-text-secondary"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Profile Details (View or Edit) */}
        {!isEditing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 border border-border">
              <span className="text-text-secondary block">Date of Birth</span>
              <span className="font-semibold text-text mt-0.5 block">
                {patient.patient_profile?.date_of_birth || 'Not recorded'}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-border">
              <span className="text-text-secondary block">Blood Group</span>
              <span className="font-semibold text-rose-600 mt-0.5 block">
                {patient.patient_profile?.blood_group || 'O+'}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-border">
              <span className="text-text-secondary block">Contact Number</span>
              <span className="font-semibold text-text mt-0.5 block">
                {patient.patient_profile?.phone || 'Not recorded'}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-border">
              <span className="text-text-secondary block">Emergency Contact</span>
              <span className="font-semibold text-text mt-0.5 block">
                {patient.patient_profile?.emergency_contact || 'None'}
              </span>
            </div>

            <div className="col-span-1 sm:col-span-2 md:col-span-4 p-3 rounded-lg bg-amber-50/60 border border-amber-200">
              <span className="font-semibold text-amber-900 block flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Known Drug Allergies & Precautions
              </span>
              <p className="text-amber-800 font-medium mt-1">
                {patient.patient_profile?.allergies || 'No known drug allergies reported.'}
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input text-xs"
                />
              </div>
              <div>
                <label className="label">Blood Group</label>
                <input
                  type="text"
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="input text-xs"
                />
              </div>
              <div>
                <label className="label">Emergency Contact</label>
                <input
                  type="text"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  className="input text-xs"
                />
              </div>
            </div>

            <div>
              <label className="label">Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="input text-xs"
              />
            </div>

            <div>
              <label className="label">Known Drug Allergies</label>
              <textarea
                rows={2}
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                className="input text-xs"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary text-xs">
                <Save className="w-3.5 h-3.5" /> Save Changes
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Prescription History for this Patient */}
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-text text-sm">Clinical Prescription History</h3>
            <p className="text-xs text-text-secondary">
              All prescriptions issued for {patient.first_name} {patient.last_name}
            </p>
          </div>
        </div>

        {prescriptions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-text-secondary uppercase text-[10px] tracking-wider border-b border-border">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Prescribing Doctor</th>
                  <th className="py-3 px-4">Diagnosis</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {prescriptions.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/40">
                    <td className="py-3 px-4 text-text-secondary">{p.issue_date}</td>
                    <td className="py-3 px-4">
                      <Badge status={p.status} size="sm" />
                    </td>
                    <td className="py-3 px-4 text-text">
                      {p.doctor ? `Dr. ${p.doctor.first_name} ${p.doctor.last_name}` : 'Staff Doctor'}
                    </td>
                    <td className="py-3 px-4 font-medium text-text">
                      {p.diagnosis || 'Clinical evaluation'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => navigate(`/prescriptions/${p.id}`)}
                        className="text-primary hover:underline font-semibold"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={FileText}
            title="No Prescriptions on Record"
            description="No prescriptions have been authored for this patient yet."
          />
        )}
      </div>
    </div>
  );
}
