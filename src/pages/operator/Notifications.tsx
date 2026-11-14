import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bell, Megaphone, ClipboardCheck } from 'lucide-react';
import clsx from 'clsx';
import { supabase, unwrap } from '@/lib/supabase';
import { Button, EmptyState, ErrorState, LoadingBlock, PageHeader, useToast } from '@/components/ui';
import { formatDateTimeUz } from '@/lib/dates';
import { humanError } from '@/lib/uz';

interface N { id: string; kind: string; title: string; message: string; link: string | null; is_read: boolean; created_at: string }

export default function Notifications() {
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const q = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await unwrap(supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100))) as N[],
  });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['notifications'] }); void qc.invalidateQueries({ queryKey: ['notif-unread'] }); };
  const markOne = useMutation({
    mutationFn: async (id: string) => { await unwrap(supabase.from('notifications').update({ is_read: true }).eq('id', id)); },
    onSuccess: refresh,
  });
  const markAll = useMutation({
    mutationFn: async () => { await unwrap(supabase.from('notifications').update({ is_read: true }).eq('is_read', false)); },
    onSuccess: () => { refresh(); toast('success', 'Hammasi o‘qilgan deb belgilandi.'); },
    onError: (e) => toast('error', humanError(e)),
  });
  const unread = (q.data ?? []).filter((n) => !n.is_read).length;

  return (
    <div>
      <PageHeader title="Bildirishnomalar" action={unread > 0 ? <Button variant="outline" size="sm" loading={markAll.isPending} onClick={() => markAll.mutate()}>Hammasini o‘qish</Button> : undefined} />
      {q.isLoading ? <LoadingBlock /> : q.isError ? <ErrorState onRetry={() => void q.refetch()} /> :
        (q.data ?? []).length === 0 ? <EmptyState icon={<Bell className="h-9 w-9" />} title="Hozircha bildirishnomalar yo‘q." /> : (
          <ul className="space-y-2">
            {q.data!.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => { if (!n.is_read) markOne.mutate(n.id); if (n.link && !n.link.startsWith('/admin')) nav(n.link); }}
                  className={clsx('flex w-full gap-3 rounded-2xl border p-4 text-left', n.is_read ? 'border-neutral-200 bg-white' : 'border-yellow-300 bg-brand-soft')}>
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white">
                    {n.kind === 'report' ? <ClipboardCheck className="h-4 w-4" /> : <Megaphone className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2"><span className="font-semibold">{n.title}</span>{!n.is_read && <span className="h-2 w-2 rounded-full bg-ink" aria-label="O‘qilmagan" />}</span>
                    {n.message && <span className="mt-0.5 block text-sm text-neutral-700">{n.message}</span>}
                    <span className="mt-1 block text-xs text-neutral-500">{formatDateTimeUz(n.created_at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
