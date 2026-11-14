import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Bookmark, Clock } from 'lucide-react';
import clsx from 'clsx';
import { supabase, unwrap } from '@/lib/supabase';
import { sanitizeHtml } from '@/lib/sanitize';
import { CoverImage } from '@/components/Media';
import { Badge, DemoBadge, EmptyState, ErrorState, LoadingBlock } from '@/components/ui';
import { formatDateUz } from '@/lib/dates';
import { FEED_SELECT, useBookmarks, type FeedArticle } from './Home';

type Full = FeedArticle & { content: string; category_id: string | null };

export default function ArticleDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { saved, toggle } = useBookmarks();
  const q = useQuery({
    queryKey: ['article', id],
    queryFn: async () => (await unwrap(supabase.from('articles').select(`${FEED_SELECT},content,category_id`).eq('id', id!).eq('status', 'published').maybeSingle())) as unknown as Full | null,
  });
  const related = useQuery({
    queryKey: ['article-related', q.data?.category_id, id],
    enabled: !!q.data,
    queryFn: async () => {
      let query = supabase.from('articles').select(FEED_SELECT).eq('status', 'published').neq('id', id!).order('published_at', { ascending: false }).limit(3);
      if (q.data?.category_id) query = query.eq('category_id', q.data.category_id);
      return (await unwrap(query)) as unknown as FeedArticle[];
    },
  });
  const html = useMemo(() => sanitizeHtml(q.data?.content ?? ''), [q.data?.content]);

  if (q.isLoading) return <LoadingBlock rows={2} />;
  if (q.isError) return <ErrorState onRetry={() => void q.refetch()} />;
  const a = q.data;
  if (!a) return <EmptyState title="Maqola topilmadi." hint="U olib tashlangan yoki hali nashr etilmagan bo‘lishi mumkin." action={<Link to="/" className="font-semibold underline">Bosh sahifa</Link>} />;
  const isSaved = saved.has(a.id);

  return (
    <article>
      <button onClick={() => nav(-1)} className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-ink"><ArrowLeft className="h-4 w-4" /> Orqaga</button>
      <div className="aspect-[16/10] overflow-hidden rounded-2xl bg-neutral-100"><CoverImage path={a.cover_path} alt={a.title} /></div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {a.category && <Badge tone="yellow">{a.category.name}</Badge>}
        {a.is_demo && <DemoBadge />}
        {a.published_at && <span className="text-xs text-neutral-500">{formatDateUz(a.published_at.slice(0, 10))}</span>}
        {a.read_minutes ? <span className="inline-flex items-center gap-1 text-xs text-neutral-500"><Clock className="h-3.5 w-3.5" />{a.read_minutes} daqiqa</span> : null}
      </div>
      <h1 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight">{a.title}</h1>
      <div className="prose-uz mt-2" dangerouslySetInnerHTML={{ __html: html }} />

      <button onClick={() => toggle.mutate({ id: a.id, saved: isSaved })} aria-pressed={isSaved}
        className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white font-semibold hover:bg-neutral-50">
        <Bookmark className={clsx('h-5 w-5', isSaved && 'fill-brand')} /> {isSaved ? 'Saqlangan' : 'Keyinroq o‘qish uchun saqlash'}
      </button>

      {(related.data?.length ?? 0) > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold">Boshqa maqolalar</h2>
          <div className="space-y-3">
            {related.data!.map((r) => (
              <Link key={r.id} to={`/maqola/${r.id}`} className="flex gap-3 rounded-2xl border border-neutral-200 bg-white p-3 hover:bg-neutral-50">
                <div className="h-16 w-20 shrink-0 overflow-hidden rounded-lg"><CoverImage path={r.cover_path} alt="" /></div>
                <div className="min-w-0"><p className="line-clamp-2 font-semibold leading-snug">{r.title}</p>{r.read_minutes ? <p className="mt-1 text-xs text-neutral-500">{r.read_minutes} daqiqa</p> : null}</div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
