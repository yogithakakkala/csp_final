import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Camera, Check, CheckCircle2, FileCheck2, Loader2, Upload, XCircle } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useUserDocuments, CONFIRMED } from '@/hooks/useUserDocuments';
import { supabase, safeStorageName, slug, MAX_UPLOAD_MB } from '@/lib/supabase';
import { profileSummary } from '@/lib/profile';
import { canApply, matchSchemes, needsApplication, useCatalog, type Match } from '@/lib/schemes';
import { combineDocs, INFO_ONLY } from '@/lib/combine';
import { docKey, ISSUER } from '@/lib/docs';
import { pick } from '@/data/catalog';
import { VerdictBadge } from '@/components/SchemeBits';
import { Button, ButtonLink, Card, Field, FullPageLoader, Input, Notice, PageHeader, Textarea } from '@/components/ui';
import { cn } from '@/lib/utils';
import AgentWarning from '@/components/AgentWarning';

type Details = { full_name: string; phone: string; address: string; aadhaar_last4: string };
type Result = { id: string; ok: boolean; appId?: string; token?: string | null; error?: string };

export default function ApplyAll() {
  const { lang, tx } = useLang();
  const { user, profile: account } = useAuth();
  const { profile, ready } = useProfile();
  const entries = useCatalog();
  const userDocs = useUserDocuments();

  const [open, setOpen] = useState<Set<string> | null>(null); // schemes with an open application
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [d, setD] = useState<Details>({ full_name: '', phone: '', address: '', aadhaar_last4: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof Details, string>>>({});
  const [files, setFiles] = useState<Record<string, string>>({}); // docKey -> storage path
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);

  const candidates: Match[] = useMemo(
    () => matchSchemes(entries, profile).filter((m) => m.judgement.verdict !== 'no' && m.entry.status !== 'announced' && canApply(m.entry) && needsApplication(m.entry)),
    [entries, profile],
  );

  // Existing open applications + details from the most recent one.
  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase.from('applications').select('scheme_id, status, applicant_details, created_at').eq('user_id', user.id).order('created_at', { ascending: false });
      const rows = (data as { scheme_id: string; status: string; applicant_details: Partial<Details> | null }[]) ?? [];
      setOpen(new Set(rows.filter((r) => r.status !== 'rejected').map((r) => r.scheme_id)));
      const last = rows[0]?.applicant_details ?? {};
      setD((cur) => ({
        full_name: cur.full_name || last.full_name || account?.full_name || '',
        phone: cur.phone || last.phone || '',
        address: cur.address || last.address || '',
        aadhaar_last4: cur.aadhaar_last4 || last.aadhaar_last4 || '',
      }));
    })();
  }, [user, account?.full_name]);

  // Default selection: every scheme you clearly qualify for and haven't applied to.
  useEffect(() => {
    if (picked || !open) return;
    setPicked(new Set(candidates.filter((m) => m.judgement.verdict === 'eligible' && !open.has(m.entry.id)).map((m) => m.entry.id)));
  }, [candidates, open, picked]);

  // Offer documents already saved in "My documents".
  useEffect(() => {
    if (!userDocs.docs.length) return;
    setFiles((cur) => {
      const next = { ...cur };
      for (const u of userDocs.docs) {
        const k = docKey(u.document_type);
        if (!next[k] && u.file_url !== CONFIRMED) next[k] = u.file_url;
      }
      return next;
    });
  }, [userDocs.docs]);

  const selected = candidates.filter((m) => picked?.has(m.entry.id));
  const docs = useMemo(() => combineDocs(selected.map((m) => m.entry)).filter((x) => !INFO_ONLY.has(x.key)), [selected]);

  if (!ready || !open || !picked) return <FullPageLoader />;
  if (!profile) return <Navigate to="/eligible" replace />;

  const toggle = (id: string) =>
    setPicked((cur) => {
      const s = new Set(cur);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  const upload = async (key: string, file: File) => {
    if (!user) return;
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return toast.error(tx(`Larger than ${MAX_UPLOAD_MB} MB. Take a smaller photo.`, `${MAX_UPLOAD_MB} MB కంటే పెద్దది. చిన్న ఫోటో తీయండి.`));
    setBusy(key);
    const path = `${user.id}/common/${slug(key)}-${safeStorageName(file.name)}`;
    const { error } = await supabase.storage.from('applications').upload(path, file, { upsert: true, contentType: file.type || undefined });
    setBusy(null);
    if (error) return toast.error(`${tx('Upload failed', 'అప్‌లోడ్ విఫలమైంది')}: ${error.message}`);
    setFiles((f) => ({ ...f, [key]: path }));
    const label = docs.find((x) => x.key === key)?.label.en ?? key;
    void supabase.from('user_documents').upsert({ user_id: user.id, document_type: label, file_url: path }, { onConflict: 'user_id,document_type' }).then(() => userDocs.reload());
  };

  const validate = () => {
    const e: typeof errors = {};
    if (d.full_name.trim().length < 2) e.full_name = tx('Enter your full name', 'పూర్తి పేరు నమోదు చేయండి');
    if (!/^[6-9]\d{9}$/.test(d.phone.replace(/\D/g, '').slice(-10))) e.phone = tx('Enter a 10-digit mobile number', '10 అంకెల మొబైల్ నంబర్ నమోదు చేయండి');
    if (d.address.trim().length < 5) e.address = tx('Enter your address with village / ward', 'గ్రామం / వార్డుతో చిరునామా నమోదు చేయండి');
    if (d.aadhaar_last4 && !/^\d{4}$/.test(d.aadhaar_last4)) e.aadhaar_last4 = tx('Only the last 4 digits', 'చివరి 4 అంకెలు మాత్రమే');
    setErrors(e);
    if (Object.keys(e).length) document.getElementById(`a-${Object.keys(e)[0]}`)?.focus();
    return !Object.keys(e).length;
  };

  const submitAll = async () => {
    if (!user || !validate() || !selected.length) return;
    const base = {
      full_name: d.full_name.trim(),
      phone: d.phone.replace(/\D/g, '').slice(-10),
      address: d.address.trim(),
      ...(d.aadhaar_last4 ? { aadhaar_last4: d.aadhaar_last4 } : {}),
      ...profileSummary(profile),
      submitted_via: 'Apply for all',
    };
    const out: Result[] = [];
    setProgress({ done: 0, total: selected.length });
    for (const m of selected) {
      const submitted_documents = m.entry.docs
        .map((doc) => ({ document_type: doc.en, file_url: files[docKey(doc.en)] }))
        .filter((x): x is { document_type: string; file_url: string } => !!x.file_url);
      const { data, error } = await supabase
        .from('applications')
        .insert({ user_id: user.id, scheme_id: m.entry.id, status: 'submitted', applicant_details: base, submitted_documents })
        .select('id, token_number')
        .single();
      out.push(error ? { id: m.entry.id, ok: false, error: error.message } : { id: m.entry.id, ok: true, appId: data.id as string, token: (data.token_number as string) ?? null });
      setProgress({ done: out.length, total: selected.length });
    }
    setResults(out);
    setProgress(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (results) {
    const ok = results.filter((r) => r.ok);
    return (
      <div className="mx-auto max-w-2xl">
        <div className="text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-leaf text-white">
            <Check className="size-8" />
          </span>
          <h1 className="display mt-4 text-[28px]">{tx(`${ok.length} applications submitted`, `${ok.length} దరఖాస్తులు సమర్పించబడ్డాయి`)}</h1>
          <p className="mt-2 text-muted">{tx('Your Sachivalayam will review each one. You’ll get updates and any document requests here.', 'మీ సచివాలయం ప్రతిదాన్నీ సమీక్షిస్తుంది. అప్‌డేట్లు, పత్రాల అభ్యర్థనలు ఇక్కడే వస్తాయి.')}</p>
        </div>
        <Card className="mt-6 divide-y divide-line">
          {results.map((r) => {
            const e = entries.find((x) => x.id === r.id)!;
            return (
              <div key={r.id} className="flex items-center gap-3 p-4">
                <span className="text-2xl">{e.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug">{pick(e.name, lang)}</p>
                  {r.ok ? <p className="select-all text-sm text-muted">{r.token}</p> : <p className="text-sm text-kumkum">{r.error}</p>}
                </div>
                {r.ok ? (
                  <Link to={`/my-applications/${r.appId}`} className="text-sm font-semibold underline">
                    {tx('Open', 'తెరవండి')}
                  </Link>
                ) : (
                  <XCircle className="size-5 text-kumkum" />
                )}
              </div>
            );
          })}
        </Card>
        <div className="mt-6 flex justify-center gap-2">
          <ButtonLink to="/my-applications">{tx('My applications', 'నా దరఖాస్తులు')}</ButtonLink>
        </div>
      </div>
    );
  }

  const ready4 = docs.filter((x) => files[x.key]).length;

  return (
    <div className="pb-28 lg:pb-0">
      <PageHeader
        title={tx('Apply for all', 'అన్నింటికీ దరఖాస్తు')}
        subtitle={tx('Pick the schemes, fill your details once and add each document once. We send a separate application for every scheme.', 'పథకాలు ఎంచుకోండి, వివరాలు ఒక్కసారి నింపండి, ప్రతి పత్రం ఒక్కసారి జోడించండి. ప్రతి పథకానికి వేరుగా దరఖాస్తు పంపుతాం.')}
      />

      <AgentWarning compact className="mb-5" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-lg font-semibold">{tx('Schemes', 'పథకాలు')}</h2>
            {candidates.length === 0 ? (
              <Notice>
                {tx('No open scheme matches your answers right now.', 'ప్రస్తుతం మీ జవాబులకు సరిపోయే పథకం లేదు.')}{' '}
                <Link to="/eligible" className="font-semibold underline">{tx('See My schemes', 'నా పథకాలు చూడండి')}</Link>
              </Notice>
            ) : (
              <Card className="divide-y divide-line">
                {candidates.map((m) => {
                  const already = open.has(m.entry.id);
                  const on = picked.has(m.entry.id);
                  return (
                    <label key={m.entry.id} className={cn('flex cursor-pointer items-start gap-3 p-4', already && 'cursor-default opacity-60')}>
                      <input type="checkbox" className="mt-1 size-5 accent-[var(--color-ink)]" checked={on && !already} disabled={already} onChange={() => toggle(m.entry.id)} />
                      <span className="text-2xl leading-none">{m.entry.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold leading-snug">{pick(m.entry.name, lang)}</span>
                        {m.benefit && <span className="block text-sm text-muted">{pick(m.benefit, lang)}</span>}
                        <span className="mt-1.5 flex flex-wrap gap-1.5">
                          {already ? <span className="text-xs font-semibold text-muted">{tx('Already applied', 'ఇప్పటికే దరఖాస్తు చేశారు')}</span> : <VerdictBadge verdict={m.judgement.verdict} />}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </Card>
            )}
          </section>

          <Card className="p-5 sm:p-6">
            <h2 className="text-lg font-semibold">{tx('Your details', 'మీ వివరాలు')}</h2>
            <p className="mt-1 text-sm text-muted">{tx('Your family answers are attached too, so staff don’t ask again.', 'మీ కుటుంబ జవాబులు కూడా జతచేస్తాం, సిబ్బంది మళ్లీ అడగరు.')}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label={tx('Full name (as on Aadhaar)', 'పూర్తి పేరు (ఆధార్‌లో ఉన్నట్లు)')} error={errors.full_name} htmlFor="a-full_name" className="sm:col-span-2">
                <Input id="a-full_name" autoComplete="name" value={d.full_name} onChange={(e) => setD({ ...d, full_name: e.target.value })} />
              </Field>
              <Field label={tx('Mobile number', 'మొబైల్ నంబర్')} error={errors.phone} htmlFor="a-phone">
                <Input id="a-phone" type="tel" inputMode="numeric" autoComplete="tel" value={d.phone} onChange={(e) => setD({ ...d, phone: e.target.value })} />
              </Field>
              <Field label={tx('Aadhaar — last 4 digits', 'ఆధార్ — చివరి 4 అంకెలు')} hint={tx('Optional. Never enter the full number.', 'ఐచ్ఛికం. పూర్తి నంబర్ ఇవ్వకండి.')} error={errors.aadhaar_last4} htmlFor="a-aadhaar_last4">
                <Input id="a-aadhaar_last4" inputMode="numeric" maxLength={4} value={d.aadhaar_last4} onChange={(e) => setD({ ...d, aadhaar_last4: e.target.value.replace(/\D/g, '') })} />
              </Field>
              <Field label={tx('Address', 'చిరునామా')} hint={tx('House no., street, village / ward, mandal, district', 'ఇంటి నం., వీధి, గ్రామం / వార్డు, మండలం, జిల్లా')} error={errors.address} htmlFor="a-address" className="sm:col-span-2">
                <Textarea id="a-address" rows={3} value={d.address} onChange={(e) => setD({ ...d, address: e.target.value })} />
              </Field>
            </div>
          </Card>

          {docs.length > 0 && (
            <Card className="p-5 sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">{tx('Documents — once for all', 'పత్రాలు — అన్నింటికీ ఒక్కసారే')}</h2>
                <span className="text-sm text-muted">{ready4}/{docs.length}</span>
              </div>
              <p className="mt-1 text-sm text-muted">{tx('A clear phone photo is fine. Ones already in My documents are added for you.', 'స్పష్టమైన ఫోన్ ఫోటో చాలు. నా పత్రాలలో ఉన్నవి ఆటోమేటిక్‌గా జతవుతాయి.')}</p>
              <ul className="mt-4 divide-y divide-line">
                {docs.map((x) => {
                  const f = files[x.key];
                  const n = new Set(x.names.map((y) => y.entryId)).size;
                  const issuer = ISSUER[x.key];
                  return (
                    <li key={x.key} className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0">
                      <span className={cn('mt-0.5 grid size-7 shrink-0 place-items-center rounded-full', f ? 'bg-leaf text-white' : 'bg-ink-50 text-ink/40')}>
                        {f ? <Check className="size-4" /> : <span className="size-1.5 rounded-full bg-current" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium leading-snug">{pick(x.label, lang)}</p>
                        <p className="text-xs text-muted">
                          {x.conditional ? tx('only if it applies · ', 'వర్తిస్తే మాత్రమే · ') : ''}
                          {tx(`used in ${n} application${n > 1 ? 's' : ''}`, `${n} దరఖాస్తులలో`)}
                          {f ? (
                            <span className="text-leaf"> · {f.split('/').pop()}</span>
                          ) : issuer ? (
                            ` · ${pick(issuer, lang)}`
                          ) : (
                            ''
                          )}
                        </p>
                      </div>
                      <label className={cn('inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-[10px] px-3 text-sm font-semibold', f ? 'border border-line' : 'bg-ink text-white')}>
                        {busy === x.key ? <Loader2 className="size-4 animate-spin" /> : f ? <Upload className="size-4" /> : <Camera className="size-4" />}
                        {busy === x.key ? tx('Uploading', 'అప్‌లోడ్') : f ? tx('Replace', 'మార్చు') : tx('Add', 'జోడించు')}
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="sr-only"
                          disabled={!!busy}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (file) void upload(x.key, file);
                          }}
                        />
                      </label>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-4 flex items-center gap-2 text-sm text-muted">
                <FileCheck2 className="size-4 shrink-0" />
                {tx('Missing some? You can still submit — staff will ask for anything they need.', 'కొన్ని లేవా? అయినా సమర్పించవచ్చు — అవసరమైతే సిబ్బంది అడుగుతారు.')}
              </p>
            </Card>
          )}
        </div>

        <aside className="hidden lg:block">
          <Card className="sticky top-6 p-5">
            <p className="text-sm text-muted">{tx('Applications to send', 'పంపే దరఖాస్తులు')}</p>
            <p className="display text-[40px] leading-none">{selected.length}</p>
            <p className="mt-2 text-sm text-muted">{tx(`${ready4} of ${docs.length} documents added`, `${docs.length} లో ${ready4} పత్రాలు జోడించారు`)}</p>
            <SubmitButton className="mt-5 w-full" n={selected.length} progress={progress} busy={!!busy} onClick={submitAll} />
          </Card>
        </aside>
      </div>

      <div className="pb-safe fixed inset-x-0 bottom-[64px] z-30 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-semibold">{tx(`${selected.length} selected`, `${selected.length} ఎంచుకున్నారు`)}</span>
            <span className="block text-muted">{tx(`${ready4}/${docs.length} documents`, `${ready4}/${docs.length} పత్రాలు`)}</span>
          </p>
          <SubmitButton n={selected.length} progress={progress} busy={!!busy} onClick={submitAll} />
        </div>
      </div>
    </div>
  );
}

function SubmitButton({ n, progress, busy, onClick, className }: { n: number; progress: { done: number; total: number } | null; busy: boolean; onClick: () => void; className?: string }) {
  const { tx } = useLang();
  return (
    <Button size="lg" className={className} onClick={onClick} loading={!!progress} disabled={busy || n === 0}>
      {progress ? (
        tx(`Sending ${progress.done + 1} of ${progress.total}…`, `${progress.total} లో ${progress.done + 1} పంపుతోంది…`)
      ) : (
        <>
          <CheckCircle2 className="size-5" /> {tx(`Submit ${n}`, `${n} సమర్పించండి`)}
        </>
      )}
    </Button>
  );
}
