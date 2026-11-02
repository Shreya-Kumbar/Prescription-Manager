import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Search,
  Filter,
  PlusCircle,
  Eye,
  CheckCircle,
  XCircle,
  Calendar,
  User,
  ArrowUpDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { prescriptionService, type PrescriptionFilters } from '../services/prescriptionService';
import type { PrescriptionSummary } from '../types';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';

export default function PrescriptionsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [prescriptions, setPrescriptions] = useState<PrescriptionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchPrescriptions = async () => {
    try {
      setIsLoading(true);
      const filters: PrescriptionFilters = {
        page,
        per_page: 15,
        status: statusFilter || undefined,
        search: searchTerm || undefined,
      };
      const res = await prescriptionService.list(filters);
      setPrescriptions(res.items);
      setTotal(res.total);
    } catch {
      toast.error('Failed to load prescriptions.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPrescriptions();
  }, [page, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchPrescriptions();
  };

  const handleFinalize = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to finalize this draft prescription? Once active, it will be visible to the patient and pharmacist.')) {
      return;
    }
    try {
      await prescriptionService.finalize(id);
      toast.success('Prescription finalized and activated!');
      fetchPrescriptions();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to finalize prescription.');
    }
  };

  const handleCancel = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to cancel this prescription?')) {
      return;
    }
    try {
      await prescriptionService.cancel(id);
      toast.success('Prescription cancelled.');
      fetchPrescriptions();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to cancel prescription.');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-text dark:text-white">Prescriptions</h2>
          <p className="text-xs text-text-secondary dark:text-slate-400 mt-0.5">
            {total} total records found in ArogyaNova database
          </p>
        </div>

        {user?.role === 'doctor' && (
          <button
            onClick={() => navigate('/prescriptions/new')}
            className="btn-primary text-sm shadow-xs self-start sm:self-auto"
          >
            <PlusCircle className="w-4 h-4" />
            Create Prescription
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4 flex flex-col md:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="w-full md:w-80 relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-text-light dark:text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by diagnosis or notes..."
            className="input pl-9 text-xs py-2"
          />
        </form>

        <div className="w-full md:w-auto flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-text-secondary dark:text-slate-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="input text-xs py-2 w-full md:w-40"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Records Table */}
      {isLoading ? (
        <div className="card p-8 space-y-4 animate-pulse">
          <div className="h-6 bg-slate-100 dark:bg-slate-800 rounded w-1/4" />
          <div className="h-40 bg-slate-100 dark:bg-slate-800 rounded" />
        </div>
      ) : prescriptions.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-[#0F172A] text-text-secondary dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-border dark:border-[#233044]">
                <tr>
                  <th className="py-3 px-4">Prescription ID</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Prescriber</th>
                  <th className="py-3 px-4">Issue Date</th>
                  <th className="py-3 px-4">Medicines</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border dark:divide-[#233044]">
                {prescriptions.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/prescriptions/${p.id}`)}
                    className="hover:bg-teal-50/30 dark:hover:bg-teal-950/20 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono font-medium text-text dark:text-white">
                      #{p.id.slice(0, 8)}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge status={p.status} size="sm" />
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-text dark:text-white">
                        {p.patient ? `${p.patient.first_name} ${p.patient.last_name}` : 'Authorized Patient'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-text-secondary dark:text-slate-400">
                      {p.doctor ? `Dr. ${p.doctor.first_name} ${p.doctor.last_name}` : 'Staff Physician'}
                    </td>
                    <td className="py-3.5 px-4 text-text-secondary dark:text-slate-400">{p.issue_date}</td>
                    <td className="py-3.5 px-4 font-semibold text-text dark:text-white">
                      {p.item_count} items
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => navigate(`/prescriptions/${p.id}`)}
                          className="p-1 rounded text-text-secondary hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {user?.role === 'doctor' && p.status === 'draft' && (
                          <button
                            onClick={(e) => handleFinalize(p.id, e)}
                            className="p-1 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                            title="Finalize Draft"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}

                        {user?.role === 'doctor' && p.status !== 'cancelled' && p.status !== 'completed' && (
                          <button
                            onClick={(e) => handleCancel(p.id, e)}
                            className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            title="Cancel Prescription"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {total > 15 && (
            <div className="p-4 border-t border-border dark:border-[#233044] flex items-center justify-between text-xs text-text-secondary dark:text-slate-400">
              <span>Showing Page {page}</span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1 rounded border border-border dark:border-[#233044] disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  disabled={page * 15 >= total}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1 rounded border border-border dark:border-[#233044] disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          title="No Prescriptions Found"
          description={
            searchTerm || statusFilter
              ? 'No prescriptions match your current search and filter criteria.'
              : 'There are no prescriptions recorded in the system.'
          }
          actionText={user?.role === 'doctor' ? 'Create Prescription' : undefined}
          onAction={user?.role === 'doctor' ? () => navigate('/prescriptions/new') : undefined}
        />
      )}
    </div>
  );
}
