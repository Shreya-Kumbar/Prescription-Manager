import React, { useEffect, useState } from 'react';
import { Pill, Search, Plus, Filter, Tag, Check, X, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import type { Medication } from '../types';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';

export default function MedicationsPage() {
  const { user } = useAuth();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Add Medication Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [genericName, setGenericName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [strength, setStrength] = useState('');
  const [dosageForm, setDosageForm] = useState('Tablet');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchMedications = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/medications');
      setMedications(res.data || []);
    } catch {
      toast.error('Failed to load medication catalogue.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMedications();
  }, []);

  const handleAddMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genericName || !strength || !dosageForm) {
      toast.error('Please fill in required fields.');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post('/medications', {
        generic_name: genericName,
        brand_name: brandName || undefined,
        strength,
        dosage_form: dosageForm,
        category: category || undefined,
        description: description || undefined,
      });

      toast.success('Medication added to catalogue.');
      setShowAddModal(false);
      setGenericName('');
      setBrandName('');
      setStrength('');
      setCategory('');
      setDescription('');
      fetchMedications();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to add medication.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = Array.from(
    new Set(medications.map((m) => m.category).filter(Boolean))
  ) as string[];

  const filtered = medications.filter((m) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      m.generic_name.toLowerCase().includes(term) ||
      (m.brand_name && m.brand_name.toLowerCase().includes(term)) ||
      (m.category && m.category.toLowerCase().includes(term));
    const matchesCategory = categoryFilter ? m.category === categoryFilter : true;
    return matchesSearch && matchesCategory;
  });

  const canManage = user?.role === 'administrator' || user?.role === 'pharmacist' || user?.role === 'doctor';

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-text">Medication Catalogue</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Verified pharmaceutical formulations and therapeutic categories ({medications.length} items)
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary text-xs shadow-xs self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" /> Add Formulation
          </button>
        )}
      </div>

      {/* Search and Category Filters */}
      <div className="card p-4 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-text-light" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search generic, brand name, category..."
            className="input pl-9 text-xs py-2"
          />
        </div>

        <div className="w-full md:w-auto flex items-center gap-2">
          <Filter className="w-4 h-4 text-text-secondary" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="input text-xs py-2 w-full md:w-48"
          >
            <option value="">All Therapeutic Classes</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Medications Table */}
      {isLoading ? (
        <div className="card p-8 space-y-4 animate-pulse">
          <div className="h-6 bg-slate-100 rounded w-1/4" />
          <div className="h-40 bg-slate-100 rounded" />
        </div>
      ) : filtered.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-text-secondary uppercase text-[10px] tracking-wider border-b border-border">
                <tr>
                  <th className="py-3 px-4">Generic Name</th>
                  <th className="py-3 px-4">Brand Name</th>
                  <th className="py-3 px-4">Strength</th>
                  <th className="py-3 px-4">Dosage Form</th>
                  <th className="py-3 px-4">Therapeutic Class</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-teal-50/20 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-text flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-teal-50 text-primary flex items-center justify-center shrink-0">
                        <Pill className="w-3.5 h-3.5" />
                      </div>
                      {m.generic_name}
                    </td>
                    <td className="py-3.5 px-4 text-text-secondary">
                      {m.brand_name || '—'}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium text-text">
                      {m.strength}
                    </td>
                    <td className="py-3.5 px-4 text-text-secondary">{m.dosage_form}</td>
                    <td className="py-3.5 px-4">
                      {m.category ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700">
                          <Tag className="w-3 h-3 text-text-light" />
                          {m.category}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <Check className="w-3 h-3" /> Available
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={Pill}
          title="No Medications Found"
          description="No entries matched your current search and therapeutic class filter."
        />
      )}

      {/* Add Medication Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Medication to Catalogue"
      >
        <form onSubmit={handleAddMedication} className="space-y-4 text-xs">
          <div>
            <label className="label">Generic Name *</label>
            <input
              type="text"
              required
              value={genericName}
              onChange={(e) => setGenericName(e.target.value)}
              placeholder="e.g. Levothyroxine"
              className="input text-xs"
            />
          </div>

          <div>
            <label className="label">Brand Name (Optional)</label>
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="e.g. Synthroid, Eltroxin"
              className="input text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Strength *</label>
              <input
                type="text"
                required
                value={strength}
                onChange={(e) => setStrength(e.target.value)}
                placeholder="e.g. 50mcg, 500mg"
                className="input text-xs"
              />
            </div>
            <div>
              <label className="label">Dosage Form *</label>
              <select
                value={dosageForm}
                onChange={(e) => setDosageForm(e.target.value)}
                className="input text-xs"
              >
                <option value="Tablet">Tablet</option>
                <option value="Capsule">Capsule</option>
                <option value="Syrup">Syrup</option>
                <option value="Injection">Injection</option>
                <option value="Inhaler">Inhaler</option>
                <option value="Ointment">Ointment</option>
                <option value="Drops">Drops</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Therapeutic Category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Thyroid Hormone, Antibiotic, NSAID"
              className="input text-xs"
            />
          </div>

          <div>
            <label className="label">Clinical Description / Indications</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Clinical indications and administration guidelines..."
              className="input text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="btn-secondary text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary text-xs"
            >
              {isSubmitting ? 'Saving...' : 'Save to Catalogue'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
