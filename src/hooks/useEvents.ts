import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import type { Event, EventFormData } from '../types/event';

export function useEvents() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const eventsQuery = useQuery({
    queryKey: ['events', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user!.id)
        .order('event_date', { ascending: false });
      if (error) throw error;
      return data as Event[];
    },
    enabled: !!user,
  });

  const addEventMutation = useMutation({
    mutationFn: async ({ form, imageFile }: { form: EventFormData; imageFile?: File }) => {
      if (!user) throw new Error('Not authenticated');
      let paperwork_image_url = null;
      if (imageFile) {
        const fileName = `${user.id}/${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('paperwork')
          .upload(fileName, imageFile);
        if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);
        paperwork_image_url = fileName;
      }
      const { data, error } = await supabase
        .from('events')
        .insert({ ...form, user_id: user.id, paperwork_image_url })
        .select()
        .single();
      if (error) throw error;
      return data as Event;
    },
    onSuccess: (newEvent) => {
      // Optimistically prepend to the cached list
      queryClient.setQueryData(['events', user?.id], (old: Event[] | undefined) => {
        return [newEvent, ...(old ?? [])];
      });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<EventFormData> }) => {
      const { data, error } = await supabase
        .from('events')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Event;
    },
    onSuccess: (updatedEvent) => {
      // Update the cached list in-place
      queryClient.setQueryData(['events', user?.id], (old: Event[] | undefined) => {
        return old?.map((e) => (e.id === updatedEvent.id ? updatedEvent : e)) ?? [];
      });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      // Fetch the event first to get the storage path for cleanup
      const event = queryClient.getQueryData<Event[]>(['events', user?.id])
        ?.find((e) => e.id === id);
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
      // Clean up the associated storage file if it exists
      if (event?.paperwork_image_url) {
        await supabase.storage.from('paperwork').remove([event.paperwork_image_url]);
      }
    },
    onSuccess: (_data, deletedId) => {
      queryClient.setQueryData(['events', user?.id], (old: Event[] | undefined) => {
        return old?.filter((e) => e.id !== deletedId) ?? [];
      });
    },
  });

  // Helper to find a single event from the cached list (no extra network request)
  function findEvent(id: string): Event | null {
    const events = queryClient.getQueryData<Event[]>(['events', user?.id]);
    return events?.find((e) => e.id === id) ?? null;
  }

  // Fallback: fetch a single event directly from Supabase when not in cache
  function useEvent(id: string | undefined) {
    return useQuery({
      queryKey: ['event', id],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('id', id!)
          .single();
        if (error) throw error;
        return data as Event;
      },
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
    addEvent: (form: EventFormData, imageFile?: File) =>
      addEventMutation.mutateAsync({ form, imageFile }).then((e) => e as Event),
    updateEvent: (id: string, updates: Partial<EventFormData>) =>
      updateEventMutation.mutateAsync({ id, updates }).then((e) => e as Event),
    deleteEvent: (id: string) => deleteEventMutation.mutateAsync(id),
  };
}
