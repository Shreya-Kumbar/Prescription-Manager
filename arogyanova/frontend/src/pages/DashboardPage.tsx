import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  PlusCircle,
  Activity,
  Calendar,
  Pill,
  ArrowRight,
  ShieldCheck,
  Check,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import StatCard from '../components/ui/StatCard';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/dashboard');
      setData(res.data);
    } catch {
      toast.error('Failed to load dashboard metrics.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogSchedule = async (scheduleId: string, action: 'taken' | 'skipped') => {
    try {
      await api.post(`/schedule/${scheduleId}/log`, { action });
      toast.success(`Dose marked as ${action}`);
      fetchDashboard();
    } catch {
      toast.error('Failed to log dose action.');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-6 h-32 animate-pulse bg-slate-100" />
          ))}
        </div>
        <div className="card p-6 h-64 animate-pulse bg-slate-100" />
      </div>
    );
  }

  const role = user?.role;
  const stats = data?.stats || {};

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Banner */}
      <div className="card p-6 bg-gradient-to-r from-teal-50 via-white to-slate-50 border-teal-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-primary uppercase tracking-wider">
            {role?.toUpperCase()} PORTAL
          </span>
          <h2 className="text-xl font-bold text-text mt-0.5">
            Welcome back, {role === 'doctor' ? `Dr. ${user?.first_name} ${user?.last_name}` : user?.first_name}!
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            ArogyaNova Intelligent Prescription Management & Medication Care System.
          </p>
        </div>

        {role === 'doctor' && (
          <button
            onClick={() => navigate('/prescriptions/new')}
            className="btn-primary text-sm shadow-sm shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            New Prescription
          </button>
        )}
      </div>

      {/* 1. DOCTOR DASHBOARD */}
      {role === 'doctor' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Authorized Patients"
              value={stats.patient_count ?? 0}
              subtitle="Registered patient records"
              icon={Users}
              color="primary"
            />
            <StatCard
              title="Total Prescriptions"
              value={stats.total_prescriptions ?? 0}
              subtitle="Authored in system"
              icon={FileText}
              color="secondary"
            />
            <StatCard
              title="Draft Prescriptions"
              value={stats.draft_prescriptions ?? 0}
              subtitle="Pending review/finalization"
              icon={Clock}
              color="warning"
            />
            <StatCard
              title="Active Prescriptions"
              value={stats.active_prescriptions ?? 0}
              subtitle="Currently in progress"
              icon={CheckCircle2}
              color="success"
            />
          </div>

          <div className="card overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-text text-sm">Recent Prescriptions Authored</h3>
                <p className="text-xs text-text-secondary">Latest clinical prescriptions issued</p>
              </div>
              <button
                onClick={() => navigate('/prescriptions')}
                className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {stats.recent_prescriptions?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-text-secondary uppercase text-[10px] tracking-wider border-b border-border">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Diagnosis</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {stats.recent_prescriptions.map((p: any) => (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 text-text-secondary">{p.issue_date}</td>
                        <td className="py-3 px-4">
                          <Badge status={p.status} size="sm" />
                        </td>
                        <td className="py-3 px-4 font-medium text-text">
                          {p.diagnosis || 'Clinical evaluation'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => navigate(`/prescriptions/${p.id}`)}
                            className="text-primary hover:underline font-semibold"
                          >
                            Details
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
                title="No Prescriptions Authored Yet"
                description="Start by creating your first prescription for an authorized patient."
                actionText="Create Prescription"
                onAction={() => navigate('/prescriptions/new')}
              />
            )}
          </div>
        </>
      )}

      {/* 2. PATIENT DASHBOARD */}
      {role === 'patient' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Active Prescriptions"
              value={stats.active_prescriptions ?? 0}
              subtitle="Active treatment plans"
              icon={FileText}
              color="primary"
            />
            <StatCard
              title="Total Prescribed"
              value={stats.total_prescriptions ?? 0}
              subtitle="Lifetime prescriptions"
              icon={Activity}
              color="secondary"
            />
            <StatCard
              title="Adherence Rate"
              value={`${stats.adherence?.adherence_rate ?? 100}%`}
              subtitle={stats.adherence?.status ?? 'Good'}
              icon={CheckCircle2}
              color="success"
            />
          </div>

          {/* Today's Schedule with Take/Skip buttons */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-text text-sm">Today's Medication Doses</h3>
                <p className="text-xs text-text-secondary">
                  Record your medication intake to maintain accurate adherence records
                </p>
              </div>
              <button
                onClick={() => navigate('/schedule')}
                className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
              >
                Full Schedule <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {stats.today_schedule?.length > 0 ? (
              <div className="space-y-3">
                {stats.today_schedule.map((entry: any) => (
                  <div
                    key={entry.id}
                    className="p-4 rounded-xl border border-border bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-teal-50 text-primary mt-0.5">
                        <Pill className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-text">
                          {entry.medication_name} — {entry.dosage}
                        </p>
                        <p className="text-xs text-text-secondary mt-0.5">
                          {new Date(entry.scheduled_time).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {entry.logged_action ? (
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                            entry.logged_action === 'taken'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          Marked as {entry.logged_action}
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => handleLogSchedule(entry.id, 'taken')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" /> Taken
                          </button>
                          <button
                            onClick={() => handleLogSchedule(entry.id, 'skipped')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition-colors"
                          >
                            <X className="w-3.5 h-3.5" /> Skipped
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Calendar}
                title="No Pending Doses for Today"
                description="You have no medication doses scheduled right now."
              />
            )}
          </div>
        </>
      )}

      {/* 3. PHARMACIST DASHBOARD */}
      {role === 'pharmacist' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Awaiting Review"
              value={stats.pending_reviews ?? 0}
              subtitle="Prescriptions in queue"
              icon={Clock}
              color="warning"
            />
            <StatCard
              title="Active Prescriptions"
              value={stats.active_prescriptions ?? 0}
              subtitle="Valid system prescriptions"
              icon={CheckCircle2}
              color="primary"
            />
            <StatCard
              title="Interactions Flagged"
              value={stats.flagged_count ?? 0}
              subtitle="Requiring professional assessment"
              icon={AlertTriangle}
              color="secondary"
            />
          </div>

          <div className="card overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-text text-sm">Review Queue</h3>
                <p className="text-xs text-text-secondary">Prescriptions awaiting pharmacist verification</p>
              </div>
              <button
                onClick={() => navigate('/prescriptions')}
                className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
              >
                Search all records <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {stats.recent_prescriptions?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-text-secondary uppercase text-[10px] tracking-wider border-b border-border">
                    <tr>
                      <th className="py-3 px-4">Issue Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Diagnosis</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {stats.recent_prescriptions.map((p: any) => (
                      <tr key={p.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 text-text-secondary">{p.issue_date}</td>
                        <td className="py-3 px-4">
                          <Badge status={p.status} size="sm" />
                        </td>
                        <td className="py-3 px-4 font-medium text-text">{p.diagnosis || 'Clinical evaluation'}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => navigate(`/prescriptions/${p.id}`)}
                            className="text-primary hover:underline font-semibold"
                          >
                            Review Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={CheckCircle2}
                title="Review Queue Clear"
                description="All active prescriptions have been reviewed."
              />
            )}
          </div>
        </>
      )}

      {/* 4. ADMINISTRATOR DASHBOARD */}
      {role === 'administrator' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Users"
              value={stats.total_users ?? 0}
              subtitle="Registered accounts"
              icon={Users}
              color="primary"
            />
            <StatCard
              title="Doctors"
              value={stats.total_doctors ?? 0}
              subtitle="Licensed prescribers"
              icon={ShieldCheck}
              color="secondary"
            />
            <StatCard
              title="Patients"
              value={stats.total_patients ?? 0}
              subtitle="Active patient records"
              icon={Activity}
              color="success"
            />
            <StatCard
              title="Prescriptions"
              value={stats.total_prescriptions ?? 0}
              subtitle="Total system records"
              icon={FileText}
              color="warning"
            />
          </div>

          <div className="card overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-text text-sm">System Security Audit Log</h3>
                <p className="text-xs text-text-secondary">Security events and user action traces</p>
              </div>
              <button
                onClick={() => navigate('/users')}
                className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
              >
                Manage users <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {stats.recent_audits?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-text-secondary uppercase text-[10px] tracking-wider border-b border-border">
                    <tr>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Resource</th>
                      <th className="py-3 px-4">Client IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {stats.recent_audits.map((a: any) => (
                      <tr key={a.id} className="hover:bg-slate-50/50 font-mono text-[11px]">
                        <td className="py-3 px-4 text-text-secondary">
                          {new Date(a.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-semibold text-text">{a.action}</td>
                        <td className="py-3 px-4 text-text-secondary">{a.resource_type}</td>
                        <td className="py-3 px-4 text-text-secondary">{a.ip_address || '127.0.0.1'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={ShieldCheck}
                title="Audit Trail Active"
                description="System events and security access logs are recorded in real time."
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
