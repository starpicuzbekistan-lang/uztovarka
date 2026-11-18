import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, ShieldCheck, Trash2 } from 'lucide-react';
import { BADGE_CATALOG, SPECIAL_BADGE_CODES, type SpecialBadgeCode } from '@/lib/badgeCatalog';
import { type SpecialBadgeRow } from '@/lib/earnedBadges';
import { supabase, unwrap } from '@/lib/supabase';
import { humanError } from '@/lib/uz';
import { formatDateUz } from '@/lib/dates';
import {
  Button, Card, ConfirmDialog, ErrorState, Field, LoadingBlock,
  Notice, Select, Textarea, useToast,
} from '@/components/ui';

type Operator = {id:string;full_name:string};

export default function SpecialBadgesAdmin() {
  const qc=useQueryClient();
  const toast=useToast();
  const [operatorId,setOperatorId]=useState('');
  const [badgeCode,setBadgeCode]=useState<SpecialBadgeCode>('sales_machine');
  const [reason,setReason]=useState('');
  const [busy,setBusy]=useState(false);
  const [toRevoke,setToRevoke]=useState<SpecialBadgeCode|null>(null);

  const operators=useQuery({
    queryKey:['admin-special-badge-operators'],
    queryFn:async()=>await unwrap(supabase.from('profiles')
      .select('id,full_name').eq('role','operator').order('full_name')) as Operator[],
  });
  const awarded=useQuery({
    queryKey:['admin-special-awards',operatorId],
    enabled:!!operatorId,
    queryFn:async()=>await unwrap(supabase.from('operator_special_badges')
      .select('operator_id,badge_code,reason,awarded_at,revoked_at')
      .eq('operator_id',operatorId).is('revoked_at',null)
      .order('awarded_at',{ascending:false})) as SpecialBadgeRow[],
  });
  const owned=new Set((awarded.data??[]).map(b=>b.badge_code));
  const refresh=async()=>{
    await Promise.all([
      qc.invalidateQueries({queryKey:['admin-special-awards']}),
      qc.invalidateQueries({queryKey:['operator-achievements']}),
    ]);
  };
  async function grant(e:FormEvent){
    e.preventDefault();
    if(!operatorId)return toast('error','Operatorni tanlang.');
    if(owned.has(badgeCode))return toast('error','Bu badge operatorga allaqachon berilgan.');
    if(reason.trim().length<3||reason.trim().length>500)return toast('error','Mukofot sababini 3–500 ta belgida yozing.');
    setBusy(true);
    try {
      await unwrap(supabase.rpc('admin_manage_special_badge',{
        p_operator:operatorId,p_badge_code:badgeCode,p_reason:reason.trim(),p_action:'grant'
      }));
      setReason('');
      await refresh();
      toast('success',`${BADGE_CATALOG[badgeCode].title} badge berildi.`);
    }catch(err){toast('error',humanError(err));}finally{setBusy(false);}
  }
  async function revoke(){
    if(!operatorId||!toRevoke)return;
    setBusy(true);
    try{
      await unwrap(supabase.rpc('admin_manage_special_badge',{
        p_operator:operatorId,p_badge_code:toRevoke,p_reason:'',p_action:'revoke'
      }));
      await refresh();
      toast('success','Maxsus badge bekor qilindi.');
    }catch(err){toast('error',humanError(err));}
    finally{setBusy(false);setToRevoke(null);}
  }

  return <Card className="space-y-4 p-4 sm:p-5">
    <div className="flex items-center gap-2">
      <Award className="h-5 w-5 text-amber-600"/>
      <h2 className="font-bold">Maxsus badgelarni boshqarish</h2>
    </div>
    <Notice tone="info">
      Bu 10 ta maxsus badge <b>avtomatik berilmaydi</b>. Faqat administrator operatorga
      asosli mukofot sifatida beradi yoki bekor qiladi. Boshqa avtomatik badgelarga ta’sir qilmaydi.
    </Notice>
    {operators.isLoading&&<LoadingBlock rows={1}/>}
    {operators.isError&&<ErrorState message={humanError(operators.error)} onRetry={()=>void operators.refetch()}/>}
    <Field label="Operator">
      <Select value={operatorId} onChange={e=>setOperatorId(e.target.value)}>
        <option value="">Operatorni tanlang</option>
        {(operators.data??[]).map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}
      </Select>
    </Field>
    {operatorId&&<>
      <form onSubmit={grant} className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 sm:p-4">
        <div className="flex items-center gap-2 font-bold"><ShieldCheck size={18} className="text-amber-600"/>Badge berish</div>
        <Field label="Maxsus badge turi">
          <Select value={badgeCode} onChange={e=>setBadgeCode(e.target.value as SpecialBadgeCode)}>
            {SPECIAL_BADGE_CODES.map(code=><option key={code} value={code}>
              {BADGE_CATALOG[code].title}{owned.has(code)?' — berilgan':''}
            </option>)}
          </Select>
        </Field>
        <p className="text-xs text-neutral-600">{BADGE_CATALOG[badgeCode].why}</p>
        <Field label="Nega aynan shu operatorga berilmoqda?">
          <Textarea value={reason} maxLength={500} rows={3} onChange={e=>setReason(e.target.value)}
            placeholder="Operatorning aniq yutug‘i yoki jamoaga qo‘shgan hissasi..." />
        </Field>
        <Button type="submit" disabled={busy||owned.has(badgeCode)||awarded.isError} loading={busy} className="w-full">
          <Award size={17}/> Badge berish
        </Button>
      </form>

      <div className="space-y-2">
        <h3 className="font-semibold">Operatorga berilgan maxsus badgelar</h3>
        {awarded.isLoading&&<LoadingBlock rows={2}/>}
        {awarded.isError&&<ErrorState message="Badgelar yuklanmadi. 014 SQL migratsiyasini tekshiring." onRetry={()=>void awarded.refetch()}/>}
        {awarded.data?.length===0&&<p className="rounded-xl bg-neutral-50 p-3 text-sm text-neutral-500">Maxsus badge hali berilmagan.</p>}
        {(awarded.data??[]).map(b=>{
          const meta=BADGE_CATALOG[b.badge_code as SpecialBadgeCode];
          if(!meta)return null;
          const Icon=meta.icon;
          return <div key={b.badge_code} className="flex items-start gap-3 rounded-xl border border-neutral-200 p-3">
            <div className={`shrink-0 rounded-xl p-2.5 ${meta.bg}`}><Icon size={21} className={meta.iconColor}/></div>
            <div className="min-w-0 flex-1">
              <p className="font-bold">{meta.title}</p>
              <p className="mt-1 text-xs text-neutral-600">{b.reason}</p>
              <p className="mt-1 text-xs text-neutral-400">{formatDateUz(b.awarded_at.slice(0,10))}</p>
            </div>
            <Button type="button" variant="ghost" size="sm" aria-label={`${meta.title} badge ni bekor qilish`} onClick={()=>setToRevoke(b.badge_code as SpecialBadgeCode)}>
              <Trash2 size={17} className="text-red-600"/>
            </Button>
          </div>;
        })}
      </div>
    </>}
    <ConfirmDialog open={!!toRevoke} danger title="Badgeni bekor qilish"
      message={`“${toRevoke?BADGE_CATALOG[toRevoke].title:''}” operator profilidan olib tashlanadi. Uni qayta berish mumkin.`}
      confirmLabel="Bekor qilish" onClose={()=>setToRevoke(null)} onConfirm={revoke}/>
  </Card>;
}
