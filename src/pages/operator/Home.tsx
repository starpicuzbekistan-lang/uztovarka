import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, Clock, Pin } from 'lucide-react';
import clsx from 'clsx';
import { supabase, unwrap } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthContext';
import { CoverImage } from '@/components/Media';
import { Badge, Chip, DemoBadge, EmptyState, ErrorState, LoadingBlock, useToast } from '@/components/ui';
import { formatDateUz } from '@/lib/dates';
import { humanError } from '@/lib/uz';

export interface FeedArticle {
  id: string; title: string; excerpt: string | null; cover_path: string | null; pinned: boolean; read_minutes: number | null;
  published_at: string | null; is_demo: boolean; category: { name: string } | null;
}

export const FEED_SELECT = 'id,title,excerpt,cover_path,pinned,read_minutes,published_at,is_demo,category:article_categories(name)';

export function useBookmarks() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({
    queryKey: ['bookmarks', profile?.id],
    enabled: !!profile,
    queryFn: async () => new Set((await unwrap(supabase.from('article_bookmarks').select('article_id')) as { article_id: string }[]).map((r) => r.article_id)),
  });
  const toggle = useMutation({
    mutationFn: async ({ id, saved }: { id: string; saved: boolean }) => {
      if (saved) await unwrap(supabase.from('article_bookmarks').delete().eq('article_id', id).eq('user_id', profile!.id));
      else await unwrap(supabase.from('article_bookmarks').insert({ article_id: id, user_id: profile!.id }));
    },
    onSuccess: (_d, v) => { void qc.invalidateQueries({ queryKey: ['bookmarks'] }); toast('success', v.saved ? 'Saqlanganlardan olib tashlandi.' : 'Maqola saqlandi.'); },
    onError: (e) => toast('error', humanError(e)),
  });
  return { saved: q.data ?? new Set<string>(), toggle };
}

export default function Home() {
  const [onlySaved, setOnlySaved] = useState(false);
  const { saved, toggle } = useBookmarks();
  const q = useQuery({
    queryKey: ['feed'],
    queryFn: async () =>
      (await unwrap(
        supabase.from('articles').select(FEED_SELECT).eq('status', 'published')
          .order('pinned', { ascending: false }).order('sort_order', { ascending: false }).order('published_at', { ascending: false }),
      )) as unknown as FeedArticle[],
  });

  const list = (q.data ?? []).filter((a) => !onlySaved || saved.has(a.id));

  return (
    <div>
      <Link to="/vazifalar" className="mb-4 flex min-h-14 items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-950 shadow-sm">
        <span>📋 Menejer vazifalari</span><span className="text-xs">Vazifalarni ko‘rish →</span>
      </Link>
      <div className="mb-4 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <Chip active={!onlySaved} onClick={() => setOnlySaved(false)}>Barchasi</Chip>
        <Chip active={onlySaved} onClick={() => setOnlySaved(true)}>Saqlanganlar</Chip>
      </div>

      {q.isLoading ? <LoadingBlock rows={3} /> : q.isError ? <ErrorState onRetry={() => void q.refetch()} /> :
        list.length === 0 ? (
          <EmptyState title={onlySaved ? 'Saqlangan maqolalar yo‘q.' : 'Hozircha maqolalar mavjud emas.'} hint={onlySaved ? 'Maqolani saqlash uchun belgi tugmasini bosing.' : undefined} />
        ) : (
          <div className="space-y-5">
            {list.map((a) => (
              <article key={a.id} className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-card">
                <Link to={`/maqola/${a.id}`} className="block aspect-[16/10] bg-neutral-100" aria-label={a.title}>
                  <CoverImage path={a.cover_path} alt={a.title} />
                </Link>
                <div className="p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {a.category && <Badge tone="yellow">{a.category.name}</Badge>}
                    {a.pinned && <Badge tone="dark"><Pin className="h-3 w-3" /> Muhim</Badge>}
                    {a.is_demo && <DemoBadge />}
                  </div>
                  <Link to={`/maqola/${a.id}`}><h2 className="text-lg font-bold leading-snug">{a.title}</h2></Link>
                  {a.excerpt && <p className="mt-1.5 line-clamp-3 text-sm text-neutral-600">{a.excerpt}</p>}
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-neutral-500">
                      {a.published_at && <span>{formatDateUz(a.published_at.slice(0, 10))}</span>}
                      {a.read_minutes ? <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{a.read_minutes} daqiqa</span> : null}
                    </div>
                    <button onClick={() => toggle.mutate({ id: a.id, saved: saved.has(a.id) })}
                      aria-label={saved.has(a.id) ? 'Saqlanganlardan olib tashlash' : 'Keyinroq o‘qish uchun saqlash'} aria-pressed={saved.has(a.id)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-neutral-100">
                      <Bookmark className={clsx('h-5 w-5', saved.has(a.id) && 'fill-brand text-ink')} />
                    </button>
                  </div>
                  <Link to={`/maqola/${a.id}`} className="mt-3 flex min-h-11 items-center justify-center rounded-xl bg-ink text-[15px] font-semibold text-white hover:bg-ink-soft">Batafsil o‘qish</Link>
                </div>
              </article>
            ))}
          </div>
        )}
    </div>
  );
}
