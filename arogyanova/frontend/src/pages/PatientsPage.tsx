import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, Eye, Phone, Mail, Calendar, Droplet } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import type { User } from '../types';
import EmptyState from '../components/ui/EmptyState';

export default function PatientsPage() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/patients');
      setPatients(res.data || []);
    } catch {
      toast.error('Failed to load patient records.');
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = patients.filter((p) => {
    const term = searchTerm.toLowerCase();
    const name = `${p.first_name} ${p.last_name}`.toLowerCase();
    return name.includes(term) || p.email.toLowerCase().includes(term);
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-text">Patient Directory</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Authorized patient profiles and clinical history
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card p-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-text-light" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search patients by name or email..."
            className="input pl-9 text-xs py-2"
          />
        </div>
      </div>

      {/* Patients Grid / Table */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-6 h-40 bg-slate-100" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((patient) => (
            <div
              key={patient.id}
              onClick={() => navigate(`/patients/${patient.id}`)}
              className="card p-5 hover:shadow-card-hover cursor-pointer transition-all border border-border flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                      {patient.first_name[0]}
                      {patient.last_name[0]}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-text">
                        {patient.first_name} {patient.last_name}
                      </h3>
                      <p className="text-[11px] text-text-secondary flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3" /> {patient.email}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border space-y-1.5 text-xs text-text-secondary">
                  {patient.patient_profile?.phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-text-light" />
                      {patient.patient_profile.phone}
                    </p>
                  )}
                  {patient.patient_profile?.date_of_birth && (
                    <p className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-text-light" />
                      DOB: {patient.patient_profile.date_of_birth}
                    </p>
                  )}
                  {patient.patient_profile?.blood_group && (
                    <p className="flex items-center gap-2">
                      <Droplet className="w-3.5 h-3.5 text-rose-500" />
                      Blood Group: {patient.patient_profile.blood_group}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-primary font-semibold">
                <span>View Full Clinical Record</span>
                <Eye className="w-4 h-4" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title="No Patients Found"
          description="No registered patient records match your current search query."
        />
      )}
    </div>
  );
}
