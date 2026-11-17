import React, { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import { prescriptionService } from '../../services/prescriptionService';
import type { PrescriptionDetail } from '../../types';

/** Doctor edits the clinical details of a DRAFT prescription (the server refuses once it is active). */
export default function EditDraftModal({ prescription, isOpen, onClose, onSaved }: {
  prescription: PrescriptionDetail;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (p: PrescriptionDetail) => void;
}) {
  const [diagnosis, setDiagnosis] = useState(prescription.diagnosis ?? '');
  const [notes, setNotes] = useState(prescription.clinical_notes ?? '');
  const [followUp, setFollowUp] = useState(prescription.follow_up_date ?? '');
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const updated = await prescriptionService.update(prescription.id, {
        diagnosis, clinical_notes: notes, ...(followUp ? { follow_up_date: followUp } : {}),
      });
      onSaved(updated);
      toast.success('Draft updated');
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Could not update the draft.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit draft prescription" maxWidth="lg">
      <form onSubmit={save} className="space-y-4">
        <div><label className="label">Diagnosis</label><input className="input" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} /></div>
        <div><label className="label">Clinical notes</label><textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <div><label className="label">Follow-up date</label><input type="date" className="input" value={followUp} onChange={(e) => setFollowUp(e.target.value)} /></div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save draft'}</button>
        </div>
      </form>
    </Modal>
  );
}
