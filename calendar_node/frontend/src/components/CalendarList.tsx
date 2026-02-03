import React from 'react';
import { Shield, EyeOff, Calendar as CalendarIcon, Activity, Share2, Globe, Slash } from 'lucide-react';
import { DbCalendar, CalendarRole } from '../types/shared_schemas';

interface CalendarListProps {
  calendars: DbCalendar[];
  onUpdateRole: (id: string, role: CalendarRole) => void;
}

const roleIcons: Record<CalendarRole, React.ReactNode> = {
  primary: <Shield className="text-blue-400" size={18} />,
  private: <EyeOff className="text-purple-400" size={18} />,
  fixed: <CalendarIcon className="text-green-400" size={18} />,
  presence: <Activity className="text-orange-400" size={18} />,
  social_slots: <Share2 className="text-pink-400" size={18} />,
  external: <Globe className="text-cyan-400" size={18} />,
  ignore: <Slash className="text-slate-500" size={18} />
};

export const CalendarList: React.FC<CalendarListProps> = ({ calendars, onUpdateRole }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-200">Calendar Roles</h3>
      <div className="grid gap-3">
        {calendars.map((cal) => (
          <div key={cal.id} className="flex items-center justify-between p-4 bg-slate-900/50 border border-slate-700/50 rounded-xl hover:border-slate-600 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-800 rounded-lg">
                {roleIcons[cal.role]}
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-slate-200">{cal.summary}</span>
                <span className="text-xs text-slate-500">{cal.external_id}</span>
              </div>
            </div>
            
            <select
              value={cal.role}
              onChange={(e) => onUpdateRole(cal.id, e.target.value as CalendarRole)}
              className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 transition-all"
            >
              <option value="primary">Primary</option>
              <option value="private">Private</option>
              <option value="fixed">Fixed</option>
              <option value="presence">Presence</option>
              <option value="social_slots">Social Slots</option>
              <option value="external">External</option>
              <option value="ignore">Ignore</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
};
