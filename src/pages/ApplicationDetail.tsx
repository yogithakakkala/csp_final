import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, Building2, Camera, Copy, FileText, Loader2, MapPin, Paperclip, Send } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { supabase, safeStorageName, slug, MAX_UPLOAD_MB } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useUnreadUpdates } from '@/hooks/useUnreadUpdates';
import { Timeline, schemeLabel } from '@/components/ApplicationBits';
import { Card, FullPageLoader, Notice, StatusBadge } from '@/components/ui';
import { cn } from '@/lib/utils';
import { openFile, timeLabel } from '@/lib/files';
import type { Application, ApplicationMessage } from '@/types';

export default function ApplicationDetail() {
  const { applicationId = '' } = useParams();
  const { lang, tx } = useLang();
  const { user } = useAuth();
  const { markSeen } = useUnreadUpdates();
  const [app, setApp] = useState<Application | null | undefined>(undefined);
  const [messages, setMessages] = useState<ApplicationMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [staffTyping, setStaffTyping] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const channel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimer = useRef<number | undefined>(undefined);
  const lastTyping = useRef(0);

  useEffect(() => {
    let off = false;
    (async () => {
      const [{ data: a }, { data: m }] = await Promise.all([
        supabase.from('applications').select('*, scheme:schemes(*)').eq('id', applicationId).maybeSingle(),
        supabase.from('application_messages').select('*').eq('application_id', applicationId).order('created_at'),
      ]);
      if (off) return;
      setApp((a as unknown as Application) ?? null);
      setMessages((m as ApplicationMessage[]) ?? []);
    })();
    const ch = supabase
      .channel('app-' + applicationId)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'applications', filter: `id=eq.${applicationId}` }, (p) =>
        setApp((prev) => (prev ? { ...prev, ...(p.new as Application), scheme: prev.scheme } : prev)),
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'application_messages', filter: `application_id=eq.${applicationId}` }, (p) => {
        const msg = p.new as ApplicationMessage;
        setMessages((list) => (list.some((x) => x.id === msg.id) ? list : [...list, msg]));
        if (msg.sender_type === 'staff') setStaffTyping(false);
      })
      .on('broadcast', { event: 'typing' }, (p) => {
        if ((p.payload as { sender?: string })?.sender !== 'staff') return;
        setStaffTyping(true);
        window.clearTimeout(typingTimer.current);
        typingTimer.current = window.setTimeout(() => setStaffTyping(false), 3000);
      })
      .subscribe();
    channel.current = ch;
    return () => {
      off = true;
      supabase.removeChannel(ch);
    };
  }, [applicationId]);

  useEffect(() => {
    if (app) markSeen(applicationId);
  }, [applicationId, app?.updated_at, messages.length, markSeen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length, staffTyping]);

  const pending = useMemo(() => {
    if (app?.status !== 'documents_requested') return null;
    const req = [...messages].reverse().find((m) => m.is_document_request && m.requested_document_type);
    if (!req) return null;
    const after = messages.some((m) => m.sender_type === 'user' && m.file_url && m.created_at > req.created_at);
    return after ? null : req;
  }, [messages, app?.status]);

  const send = async () => {
    const body = text.trim();
    if (!body || !app) return;
    setSending(true);
    const { data, error } = await supabase.from('application_messages').insert({ application_id: app.id, sender_type: 'user', message: body }).select().single();
    setSending(false);
    if (error) return toast.error(error.message);
    setText('');
    setMessages((l) => (l.some((x) => x.id === (data as ApplicationMessage).id) ? l : [...l, data as ApplicationMessage]));
  };

  const upload = async (docType: string, file: File) => {
    if (!user || !app) return;
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return toast.error(tx(`File is over ${MAX_UPLOAD_MB} MB`, `ఫైల్ ${MAX_UPLOAD_MB} MB కంటే పెద్దది`));
    setUploading(true);
    try {
      const path = `${user.id}/${app.scheme_id}/${slug(docType)}-${safeStorageName(file.name)}`;
      const { error } = await supabase.storage.from('applications').upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (error) throw error;
      const rpc = await supabase.rpc('citizen_add_submitted_document', { _application_id: app.id, _document_type: docType, _file_url: path });
      if (rpc.error) throw rpc.error;
      const { data } = await supabase
        .from('application_messages')
        .insert({ application_id: app.id, sender_type: 'user', message: `${tx('Uploaded', 'అప్‌లోడ్ చేశాను')}: ${docType}`, file_url: path })
        .select()
        .single();
      if (data) setMessages((l) => [...l, data as ApplicationMessage]);
      setApp((a) => (a ? { ...a, submitted_documents: [...(a.submitted_documents ?? []).filter((d) => d.document_type !== docType), { document_type: docType, file_url: path }] } : a));
      toast.success(tx('Document sent to staff', 'పత్రం సిబ్బందికి పంపబడింది'));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  if (app === undefined) return <FullPageLoader />;
  if (app === null)
    return (
      <Notice tone="error">
        {tx('This application was not found.', 'ఈ దరఖాస్తు కనబడలేదు.')}{' '}
        <Link to="/my-applications" className="font-semibold underline">
          {tx('Back to applications', 'దరఖాస్తులకు తిరిగి')}
        </Link>
      </Notice>
    );

  const details = Object.entries(app.applicant_details ?? {}).filter(([, v]) => v);
  const LABELS: Record<string, [string, string]> = {
    full_name: ['Name', 'పేరు'],
    phone: ['Mobile', 'మొబైల్'],
    address: ['Address', 'చిరునామా'],
    income: ['Annual income', 'వార్షిక ఆదాయం'],
    aadhaar_last4: ['Aadhaar (last 4)', 'ఆధార్ (చివరి 4)'],
  };

  return (
    <div className="space-y-6">
      <div>
        <Link to="/my-applications" className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> {tx('All applications', 'అన్ని దరఖాస్తులు')}
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="display text-[26px] leading-tight sm:text-[32px]">{schemeLabel(app, lang)}</h1>
            {app.token_number && (
              <button
                onClick={() => {
                  void navigator.clipboard?.writeText(app.token_number!);
                  toast.success(tx('Number copied', 'నంబర్ కాపీ అయింది'));
                }}
                className="mt-1 inline-flex items-center gap-1.5 text-[15px] font-medium text-muted hover:text-ink"
              >
                {app.token_number} <Copy className="size-3.5" />
              </button>
            )}
          </div>
          <StatusBadge status={app.status} lang={lang} />
        </div>
      </div>

      {app.status === 'visit_required' && (
        <div className="rounded-[18px] border-2 border-[#7a44c9] bg-[#f6f1fd] p-5">
          <div className="flex items-start gap-3">
            <Building2 className="mt-0.5 size-6 shrink-0 text-[#5b2a9e]" />
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold">{tx('Visit your Sachivalayam to verify', 'ధృవీకరణకు మీ సచివాలయానికి వెళ్లండి')}</p>
              <p className="mt-1 text-[15px] text-muted">
                {tx('Take your original documents and this application number. Staff will check them in person.', 'మీ అసలు పత్రాలు, ఈ దరఖాస్తు నంబర్ తీసుకెళ్లండి. సిబ్బంది స్వయంగా పరిశీలిస్తారు.')}
              </p>
              <Link to="/nearest-center?near=1" className="mt-4 inline-flex h-11 items-center gap-2 rounded-[12px] bg-ink px-5 font-semibold text-white">
                <MapPin className="size-4" /> {tx('Find my Sachivalayam', 'నా సచివాలయం కనుగొనండి')}
              </Link>
            </div>
          </div>
        </div>
      )}

      {pending && (
        <div className="rounded-[18px] border-2 border-turmeric bg-turmeric-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-6 shrink-0 text-turmeric-deep" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{tx('Staff need this document from you', 'సిబ్బందికి ఈ పత్రం కావాలి')}</p>
              <p className="mt-1 text-lg font-semibold">{pending.requested_document_type}</p>
              {pending.message && <p className="mt-1 text-[15px] text-muted">“{pending.message}”</p>}
              <label className="mt-4 inline-flex h-11 cursor-pointer items-center gap-2 rounded-[12px] bg-ink px-5 font-semibold text-white">
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
                {uploading ? tx('Uploading…', 'అప్‌లోడ్ అవుతోంది…') : tx('Upload document', 'పత్రం అప్‌లోడ్ చేయండి')}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="sr-only"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) void upload(pending.requested_document_type!, f);
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Messages */}
        <Card className="flex flex-col self-start overflow-hidden lg:order-1">
          <div className="border-b border-line px-5 py-3.5">
            <p className="font-semibold">{tx('Messages with your Sachivalayam', 'మీ సచివాలయంతో సందేశాలు')}</p>
          </div>
          <div className="h-[420px] space-y-3 overflow-y-auto bg-mist/60 p-4" aria-live="polite">
            {messages.length === 0 && (
              <p className="py-16 text-center text-[15px] text-muted">{tx('No messages yet. Ask staff a question below.', 'ఇంకా సందేశాలు లేవు. కింద సిబ్బందిని అడగండి.')}</p>
            )}
            {messages.map((m) => {
              const mine = m.sender_type === 'user';
              return (
                <div key={m.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
                  <div
                    className={cn(
                      'max-w-[85%] rounded-[18px] px-4 py-2.5 text-[15px]',
                      m.is_document_request ? 'rounded-tl-md border-2 border-turmeric bg-paper' : mine ? 'rounded-tr-md bg-ink text-white' : 'rounded-tl-md bg-paper ring-1 ring-line',
                    )}
                  >
                    {m.is_document_request && (
                      <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-turmeric-deep">
                        <Paperclip className="size-3.5" /> {tx('Document requested', 'పత్రం అడిగారు')}: {m.requested_document_type}
                      </p>
                    )}
                    {m.message && <p className="whitespace-pre-wrap break-words">{m.message}</p>}
                    {m.file_url && !m.is_document_request && (
                      <button onClick={() => openFile(m.file_url!)} className={cn('mt-1 flex items-center gap-1.5 text-sm underline', mine ? 'text-white/85' : 'text-ink')}>
                        <FileText className="size-3.5" /> {m.file_url.split('/').pop()}
                      </button>
                    )}
                  </div>
                  <p className="mt-1 px-1 text-xs text-muted">
                    {mine ? tx('You', 'మీరు') : tx('Sachivalayam staff', 'సచివాలయ సిబ్బంది')} · {timeLabel(m.created_at, lang)}
                  </p>
                </div>
              );
            })}
            {staffTyping && <p className="text-sm italic text-muted">{tx('Staff are typing…', 'సిబ్బంది టైప్ చేస్తున్నారు…')}</p>}
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
                  void channel.current?.send({ type: 'broadcast', event: 'typing', payload: { sender: 'user' } });
                }
              }}
              placeholder={tx('Write to staff…', 'సిబ్బందికి రాయండి…')}
              className="h-11 min-w-0 flex-1 rounded-full border border-line bg-mist px-4 text-[15px] focus:border-ink focus:bg-paper focus:outline-none"
              maxLength={1000}
            />
            <button type="submit" disabled={!text.trim() || sending} className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-white disabled:opacity-40" aria-label={tx('Send', 'పంపు')}>
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-[18px]" />}
            </button>
          </form>
        </Card>

        <div className="space-y-6 lg:order-2">
          <Card className="p-5">
            <p className="mb-4 font-semibold">{tx('Progress', 'పురోగతి')}</p>
            <Timeline application={app} />
          </Card>
          <Card className="p-5">
            <p className="mb-3 font-semibold">{tx('What you sent', 'మీరు పంపినవి')}</p>
            <dl className="space-y-2 text-[15px]">
              {details.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-sm text-muted">{LABELS[k] ? tx(LABELS[k][0], LABELS[k][1]) : k.replace(/_/g, ' ')}</dt>
                  <dd className="break-words">{String(v)}</dd>
                </div>
              ))}
            </dl>
            <p className="mb-2 mt-5 text-sm text-muted">{tx('Documents', 'పత్రాలు')}</p>
            {(app.submitted_documents ?? []).length === 0 ? (
              <p className="text-[15px] text-muted">{tx('None attached', 'జోడించలేదు')}</p>
            ) : (
              <ul className="space-y-1.5">
                {app.submitted_documents.map((d) => (
                  <li key={d.document_type}>
                    <button onClick={() => openFile(d.file_url)} className="flex items-start gap-2 text-left text-[15px] hover:underline">
                      <FileText className="mt-0.5 size-4 shrink-0 text-muted" /> {d.document_type}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
