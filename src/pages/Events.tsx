import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEvents } from '../hooks/useEvents';
import EventCard from '../components/EventCard';
import { SearchIcon, PlusIcon, CalendarIcon } from '../components/icons/Icons';
import { Spinner } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';

type Filter = 'all' | 'upcoming' | 'completed';

export default function Events() {
  const { events, loading } = useEvents();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let result = events;
    if (filter !== 'all') {
      result = result.filter((e) => e.status === filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.client_name?.toLowerCase().includes(q) ||
          e.venue_name?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [events, filter, search]);

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'completed', label: 'Completed' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-text-primary">Events</h2>
        <button
          onClick={() => navigate('/add')}
          className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center text-accent hover:bg-accent/25 transition-colors"
          aria-label="Add Event"
        >
          <PlusIcon size={20} strokeWidth={2.5} />
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <SearchIcon
          size={16}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-text-quaternary"
        />
        <input
          type="text"
          placeholder="Search client or venue..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="!pl-11 !py-3 text-sm"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {filters.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              filter === key
                ? 'bg-accent text-white shadow-sm'
                : 'bg-surface-2 text-text-tertiary border border-border hover:border-text-quaternary hover:text-text-secondary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<CalendarIcon size={24} className="text-text-quaternary" />}
          title={search ? 'No results found' : 'No events yet'}
          description={search ? 'Try a different search term' : 'Add your first event to get started'}
          action={!search ? { label: 'Add Event', onClick: () => navigate('/add') } : undefined}
        />
      ) : (
        <div className="space-y-3 stagger-children">
          {filtered.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onClick={() => navigate(`/events/${event.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
