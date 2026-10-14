import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessagesSquare } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/lib/i18n';
import { EmptyState, ListSkeleton, PageHeader, Tabs } from '@/components/ui';
import { schemeLabel } from '@/components/ApplicationBits';
import { timeLabel } from '@/lib/files';
import type { Application, ApplicationMessage } from '@/types';

interface Thread {
  app: Application;
  last: ApplicationMessage;
  waiting: boolean;
}

export default function AdminInbox() {
  const { lang, tx } = useLang();
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [tab, setTab] = useState<'waiting' | 'all'>('waiting');

  const load = async () => {
    const { data: msgs } = await supabase.from('application_messages').select('*').order('created_at', { ascending: false }).limit(1000);
    const latest = new Map<string, ApplicationMessage>();
    for (const m of (msgs as ApplicationMessage[]) ?? []) if (!latest.has(m.application_id)) latest.set(m.application_id, m);
    const ids = [...latest.keys()];
    if (!ids.length) return setThreads([]);
    const { data: apps } = await supabase.from('applications').select('id, status, scheme_id, token_number, applicant_details, created_at, updated_at, scheme:schemes(name, name_telugu)').in('id', ids);
    const byId = new Map(((apps as unknown as Application[]) ?? []).map((a) => [a.id, a]));
    setThreads(
      ids
        .filter((id) => byId.has(id))
        .map((id) => ({ app: byId.get(id)!, last: latest.get(id)!, waiting: latest.get(id)!.sender_type === 'user' })),
    );
  };

  useEffect(() => {
    void load();
    const ch = supabase.channel('admin-inbox').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'application_messages' }, () => void load()).subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const list = (threads ?? []).filter((t) => tab === 'all' || t.waiting);

  return (
    <div>
      <PageHeader title={tx('Messages', 'సందేశాలు')} subtitle={tx('Conversations where the citizen wrote last are waiting for a reply.', 'పౌరుడు చివరగా రాసిన సంభాషణలు సమాధానం కోసం వేచి ఉన్నాయి.')} />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'waiting', label: tx('Needs reply', 'సమాధానం కావాలి'), count: (threads ?? []).filter((t) => t.waiting).length },
          { value: 'all', label: tx('All', 'అన్నీ'), count: threads?.length ?? 0 },
        ]}
      />
      <div className="mt-4">
        {threads === null ? (
          <ListSkeleton />
        ) : list.length === 0 ? (
          <EmptyState icon={<MessagesSquare className="size-5" />} title={tab === 'waiting' ? tx('All caught up', 'అన్నీ పూర్తయ్యాయి') : tx('No conversations yet', 'ఇంకా సంభాషణలు లేవు')} />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-paper">
            {list.map(({ app, last, waiting }) => (
              <li key={app.id}>
                <Link to={`/admin/applications/${app.id}`} className="flex items-start gap-4 p-4 hover:bg-mist">
                  <span className={`mt-2 size-2.5 shrink-0 rounded-full ${waiting ? 'bg-turmeric-deep' : 'bg-transparent'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate font-semibold">{app.applicant_details?.full_name ?? '—'}</p>
                      <span className="shrink-0 text-xs text-muted">{timeLabel(last.created_at, lang)}</span>
                    </div>
                    <p className="truncate text-sm text-muted">{schemeLabel(app, lang)} · {app.token_number}</p>
                    <p className="mt-1 truncate text-[15px]">
                      {last.sender_type === 'staff' && <span className="text-muted">{tx('You: ', 'మీరు: ')}</span>}
                      {last.is_document_request ? `${tx('Requested', 'అడిగినది')}: ${last.requested_document_type}` : last.message ?? tx('(file)', '(ఫైల్)')}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
