import { useMemo } from 'react';
import { format, isThisMonth, isWithinInterval, addDays, startOfYear } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useEvents } from '../hooks/useEvents';
import { formatCurrency } from '../lib/payCalc';
import { parseLocalDate } from '../lib/dateUtils';
import StatCard from '../components/StatCard';
import EventCard from '../components/EventCard';
import {
  CheckIcon,
  CalendarIcon,
  ClockIcon,
  DollarIcon,
  TrendingUpIcon,
  PlusIcon,
} from '../components/icons/Icons';
import { Spinner } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';

export default function Dashboard() {
  const { events, loading } = useEvents();
  const navigate = useNavigate();

  const stats = useMemo(() => {
    const completed = events.filter((e) => e.status === 'completed');
    const thisMonthEvents = events.filter((e) => isThisMonth(parseLocalDate(e.event_date)));
    const upcoming30 = events.filter(
      (e) =>
        e.status === 'upcoming' &&
        isWithinInterval(parseLocalDate(e.event_date), {
          start: new Date(),
          end: addDays(new Date(), 30),
        })
    );
    const thisMonthPay = thisMonthEvents.reduce((sum, e) => sum + e.total_pay, 0);
    const ytd = events.filter(
      (e) =>
        e.status === 'completed' &&
        parseLocalDate(e.event_date) >= startOfYear(new Date())
    );
    const ytdPay = ytd.reduce((sum, e) => sum + e.total_pay, 0);
    const avgPay =
      completed.length > 0
        ? completed.reduce((sum, e) => sum + e.total_pay, 0) / completed.length
        : 0;

    return {
      totalCompleted: completed.length,
      thisMonth: thisMonthEvents.length,
      upcoming30: upcoming30.length,
      thisMonthPay,
      ytdPay,
      avgPay,
      next3: events
        .filter((e) => e.status === 'upcoming')
        .sort(
          (a, b) =>
            parseLocalDate(a.event_date).getTime() - parseLocalDate(b.event_date).getTime()
        )
        .slice(0, 3),
    };
  }, [events]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-sm text-text-tertiary font-medium">
          {format(new Date(), 'EEEE, MMMM d')}
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-text-primary mt-0.5">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'} 👋
        </h2>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 stagger-children">
        <StatCard
          icon={<CheckIcon size={17} />}
          label="Completed"
          value={stats.totalCompleted}
          variant="success"
        />
        <StatCard
          icon={<CalendarIcon size={17} />}
          label="This Month"
          value={stats.thisMonth}
        />
        <StatCard
          icon={<ClockIcon size={17} />}
          label="Next 30 Days"
          value={stats.upcoming30}
        />
        <StatCard
          icon={<DollarIcon size={17} />}
          label="This Month"
          value={formatCurrency(stats.thisMonthPay)}
          variant="accent"
        />
        <StatCard
          icon={<TrendingUpIcon size={17} />}
          label="YTD Earnings"
          value={formatCurrency(stats.ytdPay)}
        />
        <StatCard
          icon={<DollarIcon size={17} />}
          label="Avg / Event"
          value={formatCurrency(stats.avgPay)}
        />
      </div>

      {/* Upcoming */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider">
            Upcoming Events
          </h3>
          {stats.next3.length > 0 && (
            <button
              onClick={() => navigate('/events')}
              className="text-xs font-semibold text-accent hover:underline"
            >
              View all
            </button>
          )}
        </div>

        {stats.next3.length === 0 ? (
          <EmptyState
            icon={<CalendarIcon size={24} className="text-accent" />}
            title="No upcoming events"
            description="Scan paperwork to add your next gig"
            action={{ label: 'Scan Paperwork', onClick: () => navigate('/scan') }}
          />
        ) : (
          <div className="space-y-3 stagger-children">
            {stats.next3.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onClick={() => navigate(`/events/${event.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => navigate('/scan')}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-2xl bg-accent hover:bg-accent-hover text-white flex items-center justify-center z-40 transition-all hover:scale-105 active:scale-95 fab"
        aria-label="Scan Paperwork"
      >
        <PlusIcon size={24} strokeWidth={2.5} />
      </button>
    </div>
  );
}
