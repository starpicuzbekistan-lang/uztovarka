import { useAuth } from '@/auth/AuthContext';
import { PageHeader } from '@/components/ui';
import SupportChatPanel from '@/components/SupportChatPanel';

export default function OperatorSupportChat(){
 const {profile}=useAuth();
 return <div className="space-y-4">
  <PageHeader title="Admin bilan aloqa" subtitle="Savol va muammolaringizni bevosita adminga yozing." />
  {profile&&<SupportChatPanel operatorId={profile.id}/>}
 </div>;
}
