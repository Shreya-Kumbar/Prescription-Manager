import React, { useEffect, useState } from 'react';
import { UserCog, Search, Filter, ShieldCheck, Check, X, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import type { User } from '../types';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const params: any = {};
      if (roleFilter) params.role = roleFilter;
      if (searchTerm) params.search = searchTerm;
      const res = await api.get('/admin/users', { params });
      setUsers(res.data || []);
    } catch {
      toast.error('Failed to load user list.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [roleFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers();
  };

  const toggleUserActive = async (user: User) => {
    try {
      await api.patch(`/admin/users/${user.id}`, {
        is_active: !user.is_active,
      });
      toast.success(`User ${user.is_active ? 'deactivated' : 'activated'}.`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to update user.');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-text dark:text-white">User Account Administration</h2>
        <p className="text-xs text-text-secondary dark:text-slate-400 mt-0.5">
          Manage system credentials, professional role assignments, and active account status
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4 flex flex-col md:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="w-full md:w-80 relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-text-light dark:text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or email..."
            className="input pl-9 text-xs py-2"
          />
        </form>

        <div className="w-full md:w-auto flex items-center gap-2">
          <Filter className="w-4 h-4 text-text-secondary dark:text-slate-400" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="input text-xs py-2 w-full md:w-48"
          >
            <option value="">All Account Roles</option>
            <option value="doctor">Doctors</option>
            <option value="patient">Patients</option>
            <option value="pharmacist">Pharmacists</option>
            <option value="administrator">Administrators</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      {isLoading ? (
        <div className="card p-8 space-y-4 animate-pulse">
          <div className="h-6 bg-slate-100 dark:bg-slate-800 rounded w-1/4" />
          <div className="h-40 bg-slate-100 dark:bg-slate-800 rounded" />
        </div>
      ) : users.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-[#0F172A] text-text-secondary dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-border dark:border-[#233044]">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">License / Hospital / Clinic</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Member Since</th>
                  <th className="py-3 px-4 text-right">Account Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border dark:divide-[#233044]">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-[#162238] transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary dark:bg-teal-900/30 dark:text-teal-400 flex items-center justify-center font-bold text-xs">
                          {u.first_name[0]}
                          {u.last_name[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-text dark:text-white">
                            {u.first_name} {u.last_name}
                          </p>
                          <p className="text-text-secondary dark:text-slate-400 text-[11px]">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge status={u.role} size="sm" />
                    </td>
                    <td className="py-3.5 px-4 text-text-secondary dark:text-slate-400">
                      {u.doctor_profile?.license_number ||
                        u.pharmacist_profile?.license_number ||
                        (u.patient_profile?.blood_group ? `Blood: ${u.patient_profile.blood_group}` : 'Standard Account')}
                    </td>
                    <td className="py-3.5 px-4">
                      {u.is_active ? (
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <Check className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/40 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <X className="w-3 h-3" /> Deactivated
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-text-secondary dark:text-slate-400">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => toggleUserActive(u)}
                        className={`text-xs font-semibold px-3 py-1 rounded-lg border transition-colors ${
                          u.is_active
                            ? 'border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/30'
                            : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-950/30'
                        }`}
                      >
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={UserCog}
          title="No Users Found"
          description="No user records matched your current query."
        />
      )}
    </div>
  );
}
