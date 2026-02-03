import React, { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { CalendarInsertRequest } from '../types/shared_schemas';

interface AddEventFormProps {
  onAddEvent: (event: CalendarInsertRequest) => Promise<void>;
}

export const AddEventForm: React.FC<AddEventFormProps> = ({ onAddEvent }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<CalendarInsertRequest>({
    subject: '',
    start: new Date().toISOString().slice(0, 16),
    duration_minutes: 60,
    description: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Ensure ISO format
      const isoStart = new Date(formData.start).toISOString();
      await onAddEvent({ ...formData, start: isoStart });
      setFormData({
        subject: '',
        start: new Date().toISOString().slice(0, 16),
        duration_minutes: 60,
        description: ''
      });
      setIsOpen(false);
    } catch (err) {
      console.error('Failed to add event:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center justify-center gap-2 w-full p-4 border-2 border-dashed border-slate-700 rounded-2xl text-slate-400 hover:text-blue-400 hover:border-blue-400/50 transition-all"
      >
        <Plus size={20} />
        <span>Add Manual Event</span>
      </button>
    );
  }

  return (
    <div className="p-6 bg-slate-900/80 border border-slate-700 rounded-2xl shadow-xl">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-slate-200">New Appointment</h3>
        <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-slate-300">Cancel</button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Subject</label>
          <input
            type="text"
            required
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Dentist appointment..."
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Start Time</label>
            <input
              type="datetime-local"
              required
              value={formData.start}
              onChange={(e) => setFormData({ ...formData, start: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Duration (min)</label>
            <input
              type="number"
              required
              value={formData.duration_minutes}
              onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Description (Optional)</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none h-20"
          />
        </div>
        <button
          disabled={isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
        >
          {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
          {isSubmitting ? 'Creating...' : 'Create Event'}
        </button>
      </form>
    </div>
  );
};
