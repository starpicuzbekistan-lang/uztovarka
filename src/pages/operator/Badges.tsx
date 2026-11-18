import { Link } from 'react-router-dom';
import { ArrowLeft, Award, Trophy } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useOperatorAchievements } from '@/lib/earnedBadges';
import { BadgeEarnedRow, BadgeExplanation } from '@/components/BadgeVisuals';
import { Card, EmptyState, ErrorState, LoadingBlock, PageHeader } from '@/components/ui';
import { humanError } from '@/lib/uz';

export default function OperatorBadgesPage() {
  const {profile}=useAuth();
  const q=useOperatorAchievements(profile?.id);
  return <div className="space-y-4">
    <PageHeader title="Mening badgelarim" subtitle="Siz qo‘lga kiritgan yutuqlar va e’tiroflar"
      back={<Link to="/profil" className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-600 hover:text-ink">
        <ArrowLeft size={17}/> Profilga qaytish
      </Link>}/>
    <Card className="space-y-3 border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-sm font-bold"><Trophy size={18} className="text-amber-700"/> Qo‘lga kiritilgan badgelar</span>
        <span className="rounded-xl bg-white px-3 py-1.5 text-xl font-extrabold text-ink">{q.data?.length??'—'}</span>
      </div>
      <p className="text-sm text-amber-950/80">Sizning har bir yutug‘ingiz ortida haqiqiy mehnat bor. Bu yo‘ldan faxrlaning!</p>
      <BadgeExplanation/>
    </Card>
    {q.isLoading&&<LoadingBlock rows={3}/>}
    {q.isError&&<ErrorState message={humanError(q.error)} onRetry={()=>void q.refetch()}/>}
    {q.data?.length===0&&<EmptyState title="Hozircha badge yo‘q"
      hint="Mehnatingiz va natijalaringiz e’tirof etiladi. Birinchi badge ham albatta keladi!"
      icon={<Award className="h-10 w-10"/>}/>}
    {q.data&&q.data.length>0&&<div className="space-y-3">
      {q.data.map(item=><BadgeEarnedRow key={item.code} item={item}/>)}
    </div>}
  </div>;
}
