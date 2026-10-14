import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Search, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/lib/i18n';
import { useAuth } from '@/hooks/useAuth';
import { Button, Card, ListSkeleton, Notice, PageHeader } from '@/components/ui';
import type { Profile } from '@/types';

export default function AdminStaff() {
  const { tx } = useLang();
  const { user } = useAuth();
  const [staff, setStaff] = useState<Profile[] | null>(null);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Profile[]>([]);

  const load = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name, email, is_staff, created_at').eq('is_staff', true).order('created_at');
    setStaff((data as Profile[]) ?? []);
  };
  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const n = q.trim();
    if (n.length < 3) return setFound([]);
    const t = setTimeout(async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, email, is_staff').or(`email.ilike.%${n}%,full_name.ilike.%${n}%`).eq('is_staff', false).limit(8);
      setFound((data as Profile[]) ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const setStaffFlag = async (p: Profile, value: boolean) => {
    if (!value && p.id === user?.id && !confirm(tx('Remove your own staff access? You will lose the staff panel.', 'మీ సిబ్బంది యాక్సెస్ తీసేయాలా?'))) return;
    const { error } = await supabase.rpc('set_staff_status', { _target_id: p.id, _new_value: value });
    if (error) return toast.error(error.message);
    toast.success(value ? tx(`${p.email} is now staff`, `${p.email} ఇప్పుడు సిబ్బంది`) : tx('Access removed', 'యాక్సెస్ తీసివేయబడింది'));
    setQ('');
    void load();
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title={tx('Staff accounts', 'సిబ్బంది ఖాతాలు')} subtitle={tx('Give an existing account staff access, or remove it.', 'ఉన్న ఖాతాకు సిబ్బంది యాక్సెస్ ఇవ్వండి లేదా తీసేయండి.')} />
      <Notice className="mb-5">
        {tx('New staff register with “Sachivalayam staff” and the staff key, and must enter the key every time they log in. You can also promote an existing account here — they still need the key to log in.', 'కొత్త సిబ్బంది “సచివాలయ సిబ్బంది” ఎంచుకుని సిబ్బంది కీతో నమోదు చేసుకుంటారు; ప్రతి లాగిన్‌కూ కీ అవసరం. ఇక్కడ ఉన్న ఖాతాను కూడా సిబ్బందిగా మార్చవచ్చు — లాగిన్‌కు వారికీ కీ కావాలి.')}
      </Notice>
      <Card className="mb-6 p-5">
        <p className="mb-2 font-semibold">{tx('Add staff', 'సిబ్బందిని జోడించు')}</p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx('Search by email or name', 'ఇమెయిల్ లేదా పేరుతో వెతకండి')} className="h-12 w-full rounded-[var(--radius-field)] border border-line pl-12 pr-4 text-[15px] focus:border-ink focus:outline-none" />
        </div>
        {found.length > 0 && (
          <ul className="mt-2 divide-y divide-line rounded-[12px] border border-line">
            {found.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.full_name ?? '—'}</p>
                  <p className="truncate text-sm text-muted">{p.email}</p>
                </div>
                <Button size="sm" onClick={() => setStaffFlag(p, true)}>{tx('Make staff', 'సిబ్బందిగా చేయి')}</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {staff === null ? (
        <ListSkeleton rows={3} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-paper">
          {staff.map((p) => (
            <li key={p.id} className="flex items-center gap-3 p-4">
              <ShieldCheck className="size-5 shrink-0 text-turmeric-deep" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.full_name ?? '—'} {p.id === user?.id && <span className="text-sm font-normal text-muted">({tx('you', 'మీరు')})</span>}</p>
                <p className="truncate text-sm text-muted">{p.email}</p>
              </div>
              <Button size="sm" variant="outline" className="text-kumkum" onClick={() => setStaffFlag(p, false)}>{tx('Remove', 'తీసేయి')}</Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
