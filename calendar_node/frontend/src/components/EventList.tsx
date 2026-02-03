import React from 'react';
import { Clock, MapPin } from 'lucide-react';
import { CalendarEvent } from '../types/shared_schemas';

interface EventListProps {
  events: CalendarEvent[];
}

export const EventList: React.FC<EventListProps> = ({ events }) => {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDay = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-200">Upcoming Events</h3>
      {events.length === 0 ? (
        <div className="p-8 text-center bg-slate-900/30 rounded-2xl border border-dashed border-slate-700">
          <p className="text-slate-500">No events found in the shadow database.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <div key={event.id} className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl hover:bg-slate-800 transition-all group">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-slate-100 group-hover:text-blue-400 transition-colors">{event.summary}</h4>
                <span className="text-xs font-mono bg-slate-900 px-2 py-1 rounded text-slate-400">
                  {formatDay(event.start_time)}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                <div className="flex items-center gap-1">
                  <Clock size={14} />
                  <span>{formatDate(event.start_time)} - {formatDate(event.end_time)}</span>
                </div>
                {event.location && (
                  <div className="flex items-center gap-1">
                    <MapPin size={14} />
                    <span className="truncate max-w-[200px]">{event.location}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
