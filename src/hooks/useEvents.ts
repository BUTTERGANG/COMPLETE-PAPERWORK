import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import type { Event, EventFormData } from '../types/event';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `Request failed: ${resp.status}`);
  }
  if (resp.status === 204) return undefined as T;
  return resp.json();
}

export function useEvents() {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();

  const eventsQuery = useQuery({
    queryKey: ['events', userId],
    queryFn: () => fetchJson<Event[]>(`${API_BASE}/events`),
    enabled: !!userId,
  });

  const addEventMutation = useMutation({
    mutationFn: async ({ form, imageData }: { form: EventFormData; imageData?: string }) => {
      if (!userId) throw new Error('Not authenticated');
      return fetchJson<Event>(`${API_BASE}/events`, {
        method: 'POST',
        body: JSON.stringify({ ...form, paperwork_image_data: imageData ?? null }),
      });
    },
    onSuccess: (newEvent) => {
      if (newEvent) {
        queryClient.setQueryData(['events', userId], (old: Event[] | undefined) => {
          return [newEvent, ...(old ?? [])];
        });
      }
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<EventFormData> }) => {
      return fetchJson<Event>(`${API_BASE}/events/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: (updatedEvent) => {
      if (updatedEvent) {
        queryClient.setQueryData(['events', userId], (old: Event[] | undefined) => {
          return old?.map((e) => (e.id === updatedEvent.id ? updatedEvent : e)) ?? [];
        });
      }
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      return fetchJson<void>(`${API_BASE}/events/${id}`, { method: 'DELETE' });
    },
    onSuccess: (_data, deletedId) => {
      queryClient.setQueryData(['events', userId], (old: Event[] | undefined) => {
        return old?.filter((e) => e.id !== deletedId) ?? [];
      });
    },
  });

  // Helper to find a single event from the cached list (no extra network request)
  function findEvent(id: string): Event | null {
    const events = queryClient.getQueryData<Event[]>(['events', userId]);
    return events?.find((e) => e.id === id) ?? null;
  }

  // Fallback: fetch a single event directly from the API when not in cache
  function useEvent(id: string | undefined) {
    return useQuery({
      queryKey: ['event', id],
      queryFn: () => fetchJson<Event>(`${API_BASE}/events/${id}`),
      enabled: !!id,
    });
  }

  return {
    events: eventsQuery.data ?? [],
    loading: eventsQuery.isLoading,
    error: eventsQuery.error?.message ?? null,
    refetch: eventsQuery.refetch,
    findEvent,
    useEvent,
    addEvent: (form: EventFormData, imageData?: string) =>
      addEventMutation.mutateAsync({ form, imageData }).then((e) => e as Event),
    updateEvent: (id: string, updates: Partial<EventFormData>) =>
      updateEventMutation.mutateAsync({ id, updates }).then((e) => e as Event),
    deleteEvent: (id: string) => deleteEventMutation.mutateAsync(id),
  };
}
