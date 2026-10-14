import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, FileText, Loader2, Paperclip, Send, Share2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/lib/i18n';
import { Timeline, schemeLabel } from '@/components/ApplicationBits';
import { Button, Card, Field, FullPageLoader, Input, Notice, Select, STATUS_META } from '@/components/ui';
import { openFile, timeLabel } from '@/lib/files';
import { cn } from '@/lib/utils';
import type { Application, ApplicationMessage, ApplicationStatus } from '@/types';

const STATUSES: ApplicationStatus[] = ['submitted', 'under_review', 'documents_requested', 'approved', 'rejected'];

export default function AdminApplicationDetail() {
  const { applicationId = '' } = useParams();
  const { lang, tx } = useLang();
  const [app, setApp] = useState<Application | null | undefined>(undefined);
  const [messages, setMessages] = useState<ApplicationMessage[]>([]);
  const [text, setText] = useState('');
  const [doc, setDoc] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const channel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTyping = useRef(0);
  const typingTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let off = false;
    (async () => {
      const [{ data: a }, { data: m }] = await Promise.all([
        supabase.from('applications').select('*, scheme:schemes(*), profile:profiles(full_name, email)').eq('id', applicationId).maybeSingle(),
        supabase.from('application_messages').select('*').eq('application_id', applicationId).order('created_at'),
      ]);
      if (off) return;
      setApp((a as unknown as Application) ?? null);
      setMessages((m as ApplicationMessage[]) ?? []);
    })();
    // Same channel name as the citizen screen so typing indicators reach each other.
    const ch = supabase
      .channel('app-' + applicationId)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'applications', filter: `id=eq.${applicationId}` }, (p) =>
        setApp((prev) => (prev ? { ...prev, ...(p.new as Application), scheme: prev.scheme, profile: prev.profile } : prev)),
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'application_messages', filter: `application_id=eq.${applicationId}` }, (p) => {
        const msg = p.new as ApplicationMessage;
        setMessages((l) => (l.some((x) => x.id === msg.id) ? l : [...l, msg]));
        if (msg.sender_type === 'user') setTyping(false);
      })
      .on('broadcast', { event: 'typing' }, (p) => {
        if ((p.payload as { sender?: string })?.sender !== 'user') return;
        setTyping(true);
        window.clearTimeout(typingTimer.current);
        typingTimer.current = window.setTimeout(() => setTyping(false), 3000);
      })
      .subscribe();
    channel.current = ch;
    return () => {
      off = true;
      supabase.removeChannel(ch);
    };
  }, [applicationId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length, typing]);

  const post = async (row: Partial<ApplicationMessage>) => {
    const { data, error } = await supabase.from('application_messages').insert({ application_id: applicationId, sender_type: 'staff', ...row }).select().single();
    if (error) throw error;
    setMessages((l) => (l.some((x) => x.id === (data as ApplicationMessage).id) ? l : [...l, data as ApplicationMessage]));
  };

  const setStatus = async (s: ApplicationStatus) => {
    if (!app || s === app.status) return;
    if ((s === 'rejected' || s === 'approved') && !confirm(tx(`Mark as ${STATUS_META[s].en}? The citizen will be notified.`, `${STATUS_META[s].te}గా గుర్తించాలా? పౌరుడికి తెలియజేయబడుతుంది.`))) return;
    setBusy('status');
    const { error } = await supabase.from('applications').update({ status: s }).eq('id', app.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    setApp({ ...app, status: s });
    toast.success(tx('Status updated', 'స్థితి మార్చబడింది'));
  };

  const send = async () => {
    if (!text.trim()) return;
    setBusy('msg');
    try {
      await post({ message: text.trim() });
      setText('');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const requestDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doc.trim() || !app) return;
    setBusy('doc');
    try {
      await post({ message: note.trim() || null, is_document_request: true, requested_document_type: doc.trim() });
      if (app.status !== 'documents_requested') {
        const { error } = await supabase.from('applications').update({ status: 'documents_requested' }).eq('id', app.id);
        if (error) throw error;
        setApp({ ...app, status: 'documents_requested' });
      }
      setDoc('');
      setNote('');
      toast.success(tx('Request sent to the citizen', 'పౌరుడికి అభ్యర్థన పంపబడింది'));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const shareToken = async () => {
    if (!app?.token_number) return;
    try {
      await post({
        message: `Your application number is ${app.token_number}. Use it on “Track by number” to check the status anytime.\nమీ దరఖాస్తు నంబర్ ${app.token_number}. “నంబర్‌తో ట్రాక్”లో ఎప్పుడైనా స్థితి చూడవచ్చు.`,
      });
      toast.success(tx('Number shared', 'నంబర్ పంపబడింది'));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (app === undefined) return <FullPageLoader />;
  if (app === null) return <Notice tone="error">{tx('Application not found.', 'దరఖాస్తు కనబడలేదు.')}</Notice>;

  const d = app.applicant_details ?? {};

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/applications" className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> {tx('Applications', 'దరఖాస్తులు')}
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="display text-[26px] leading-tight sm:text-[32px]">{d.full_name || app.profile?.full_name || '—'}</h1>
            <p className="mt-1 text-[15px] text-muted">
              {schemeLabel(app, lang)} · {app.token_number}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={app.status} onChange={(e) => setStatus(e.target.value as ApplicationStatus)} disabled={busy === 'status'} className="h-10 w-auto min-w-[190px] text-sm font-semibold" aria-label={tx('Change status', 'స్థితి మార్చండి')}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{lang === 'te' ? STATUS_META[s].te : STATUS_META[s].en}</option>
              ))}
            </Select>
          </div>
        </div>
        {(app.status === 'submitted' || app.status === 'under_review') && (
          <div className="mt-4 flex flex-wrap gap-2">
            {app.status === 'submitted' && (
              <Button variant="outline" size="sm" onClick={() => setStatus('under_review')}>
                {tx('Start review', 'సమీక్ష ప్రారంభించు')}
              </Button>
            )}
            <Button variant="success" size="sm" onClick={() => setStatus('approved')}>
              {tx('Approve', 'ఆమోదించు')}
            </Button>
            <Button variant="outline" size="sm" className="border-kumkum/30 text-kumkum" onClick={() => setStatus('rejected')}>
              {tx('Reject', 'తిరస్కరించు')}
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="flex flex-col self-start overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <p className="font-semibold">{tx('Conversation with citizen', 'పౌరుడితో సంభాషణ')}</p>
            {app.token_number && (
              <button onClick={shareToken} className="flex items-center gap-1.5 text-sm font-semibold hover:underline">
                <Share2 className="size-4" /> {tx('Send number', 'నంబర్ పంపు')}
              </button>
            )}
          </div>
          <div className="h-[460px] space-y-3 overflow-y-auto bg-mist/60 p-4">
            {messages.length === 0 && <p className="py-16 text-center text-[15px] text-muted">{tx('No messages yet.', 'ఇంకా సందేశాలు లేవు.')}</p>}
            {messages.map((m) => {
              const mine = m.sender_type === 'staff';
              return (
                <div key={m.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
                  <div className={cn('max-w-[85%] rounded-[18px] px-4 py-2.5 text-[15px]', m.is_document_request ? 'rounded-tr-md border-2 border-turmeric bg-paper' : mine ? 'rounded-tr-md bg-ink text-white' : 'rounded-tl-md bg-paper ring-1 ring-line')}>
                    {m.is_document_request && (
                      <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-turmeric-deep">
                        <Paperclip className="size-3.5" /> {tx('Requested', 'అడిగినది')}: {m.requested_document_type}
                      </p>
                    )}
                    {m.message && <p className="whitespace-pre-wrap break-words">{m.message}</p>}
                    {m.file_url && !m.is_document_request && (
                      <button onClick={() => openFile(m.file_url!)} className={cn('mt-1 flex items-center gap-1.5 text-sm underline', mine ? 'text-white/85' : 'text-ink')}>
                        <FileText className="size-3.5" /> {tx('Open file', 'ఫైల్ తెరవండి')}
                      </button>
                    )}
                  </div>
                  <p className="mt-1 px-1 text-xs text-muted">
                    {mine ? tx('Staff', 'సిబ్బంది') : tx('Citizen', 'పౌరుడు')} · {timeLabel(m.created_at, lang)}
                  </p>
                </div>
              );
            })}
            {typing && <p className="text-sm italic text-muted">{tx('Citizen is typing…', 'పౌరుడు టైప్ చేస్తున్నారు…')}</p>}
            <div ref={bottom} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="flex items-center gap-2 border-t border-line p-3"
          >
            <input
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (Date.now() - lastTyping.current > 1500) {
                  lastTyping.current = Date.now();
                  void channel.current?.send({ type: 'broadcast', event: 'typing', payload: { sender: 'staff' } });
                }
              }}
              placeholder={tx('Message the citizen…', 'పౌరుడికి సందేశం…')}
              className="h-11 min-w-0 flex-1 rounded-full border border-line bg-mist px-4 text-[15px] focus:border-ink focus:bg-paper focus:outline-none"
            />
            <button type="submit" disabled={!text.trim() || busy === 'msg'} className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-white disabled:opacity-40" aria-label={tx('Send', 'పంపు')}>
              {busy === 'msg' ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-[18px]" />}
            </button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <form onSubmit={requestDoc} className="space-y-3">
              <p className="font-semibold">{tx('Ask for a document', 'పత్రం అడగండి')}</p>
              <Field label={tx('Document', 'పత్రం')} htmlFor="doc">
                <Input id="doc" list="doc-suggest" value={doc} onChange={(e) => setDoc(e.target.value)} placeholder={tx('e.g. Income certificate (2026)', 'ఉదా. ఆదాయ ధృవపత్రం (2026)')} />
                <datalist id="doc-suggest">
                  {(app.scheme?.required_documents ?? []).map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </Field>
              <Field label={tx('Note to citizen (optional)', 'పౌరుడికి గమనిక (ఐచ్ఛికం)')} htmlFor="note">
                <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <Button type="submit" className="w-full" loading={busy === 'doc'} disabled={!doc.trim()}>
                {tx('Send request', 'అభ్యర్థన పంపు')}
              </Button>
            </form>
          </Card>

          <Card className="p-5">
            <p className="mb-3 font-semibold">{tx('Applicant', 'దరఖాస్తుదారు')}</p>
            <dl className="space-y-2 text-[15px]">
              {d.phone && (
                <div>
                  <dt className="text-sm text-muted">{tx('Mobile', 'మొబైల్')}</dt>
                  <dd>
                    <a href={`tel:${d.phone}`} className="font-medium underline">{d.phone}</a>
                  </dd>
                </div>
              )}
              {app.profile?.email && (
                <div>
                  <dt className="text-sm text-muted">{tx('Email', 'ఇమెయిల్')}</dt>
                  <dd className="break-all">{app.profile.email}</dd>
                </div>
              )}
              {Object.entries(d)
                .filter(([k, v]) => v && !['full_name', 'phone'].includes(k))
                .map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-sm capitalize text-muted">{k.replace(/_/g, ' ')}</dt>
                    <dd className="break-words">{String(v)}</dd>
                  </div>
                ))}
            </dl>
            <p className="mb-2 mt-5 text-sm text-muted">{tx('Documents', 'పత్రాలు')}</p>
            {(app.submitted_documents ?? []).length === 0 ? (
              <p className="text-[15px] text-muted">{tx('None attached', 'జోడించలేదు')}</p>
            ) : (
              <ul className="space-y-1.5">
                {app.submitted_documents.map((x) => (
                  <li key={x.document_type}>
                    <button onClick={() => openFile(x.file_url)} className="flex items-start gap-2 text-left text-[15px] font-medium hover:underline">
                      <FileText className="mt-0.5 size-4 shrink-0 text-muted" /> {x.document_type}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {(app.scheme?.required_documents ?? []).filter((r) => !(app.submitted_documents ?? []).some((x) => x.document_type === r)).length > 0 && (
              <p className="mt-3 text-sm text-amber">
                {tx('Not attached', 'జోడించనివి')}: {(app.scheme?.required_documents ?? []).filter((r) => !(app.submitted_documents ?? []).some((x) => x.document_type === r)).join(', ')}
              </p>
            )}
          </Card>

          <Card className="p-5">
            <p className="mb-4 font-semibold">{tx('Timeline', 'కాలక్రమం')}</p>
            <Timeline application={app} />
          </Card>
        </div>
      </div>
    </div>
  );
}
