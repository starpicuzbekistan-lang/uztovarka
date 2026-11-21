import { useQuery } from '@tanstack/react-query';
import { supabase, unwrap } from './supabase';
import { tashkentToday } from './dates';
export type Period = 'day'|'week'|'month';
export type TeamOperator = { operator_id:string;full_name:string;avatar_url:string|null;employee_id:string|null;is_active:boolean;today_accepted:number;period_accepted:number;worked_days:number;green_days:number;yellow_days:number;red_days:number;pending_reports:number;absent_days:number;leave_days:number;days_off:number;last_report_date:string|null;last_report_status:string|null;gold_verified:boolean };
export type Trend = { day:string;approved_accepted:number;approved_reports:number;awaiting_reports:number };
export type Task = {id:string;manager_id:string;operator_id:string;title:string;description:string;category:'training'|'improvement'|'general'|'meeting';priority:'low'|'normal'|'high';status:'todo'|'in_progress'|'review'|'completed';due_at:string;recurrence:'none'|'weekly'|'monthly';created_at:string;completed_at:string|null;updated_at:string};
export type TeamSetting={manager_id:string;name:string;target_accepted:number};
export type TaskComment={id:string;task_id:string;author_id:string;body:string;created_at:string};
export type NoticeRow={id:string;title:string;message:string;published_at:string|null};
export function dates(period:Period,today=tashkentToday()):{from:string;to:string}{
 if(period==='day')return {from:today,to:today};
 if(period==='month')return {from:today.slice(0,7)+'-01',to:today};
 const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);
 return {from:d.toISOString().slice(0,10),to:today};
}
export function useTeam(from:string,to:string){return useQuery({queryKey:['manager-team',from,to],queryFn:async()=>await unwrap(supabase.rpc('manager_team_kpi',{p_from:from,p_to:to})) as TeamOperator[],refetchInterval:60000});}
export function useTrend(from:string,to:string){return useQuery({queryKey:['manager-trend',from,to],queryFn:async()=>await unwrap(supabase.rpc('manager_daily_trend',{p_from:from,p_to:to})) as Trend[],refetchInterval:60000});}
export function useTasks(){return useQuery({queryKey:['manager-tasks'],queryFn:async()=>await unwrap(supabase.from('manager_tasks').select('*').order('due_at').limit(500)) as Task[],refetchInterval:45000});}
export function useTeamSetting(id?:string){return useQuery({queryKey:['manager-setting',id],enabled:!!id,queryFn:async()=>((await unwrap(supabase.from('manager_teams').select('manager_id,name,target_accepted').eq('manager_id',id!))) as TeamSetting[])[0]??null});}
export function useNotices(){return useQuery({queryKey:['manager-notices'],queryFn:async()=>await unwrap(supabase.from('announcements').select('id,title,message,published_at').eq('status','published').order('published_at',{ascending:false}).limit(5)) as NoticeRow[]});}
export const categories={training:'Trening',improvement:'Samaradorlik',general:'Umumiy',meeting:'Uchrashuv'} as const;
export const priorities={low:'Past',normal:'O‘rta',high:'Yuqori'} as const;
export const statuses={todo:'Boshlanmagan',in_progress:'Jarayonda',review:'Tekshiruvda',completed:'Bajarildi'} as const;
export const overdue=(t:Task)=>t.status!=='completed'&&new Date(t.due_at).getTime()<Date.now();
export const dateTime=(d:string)=>new Date(d).toLocaleString('uz-UZ',{timeZone:'Asia/Tashkent',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
