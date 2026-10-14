import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Camera, Check, CheckCircle2, Copy, FileCheck2, Loader2, MapPin, RotateCcw, Trash2, Upload } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { supabase, safeStorageName, slug, MAX_UPLOAD_MB } from '@/lib/supabase';
import { canApply, findEntry, loadCatalog, type Entry } from '@/lib/schemes';
import { pick } from '@/data/catalog';
import { useProfile } from '@/hooks/useProfile';
import { profileSummary } from '@/lib/profile';
import { docKey, ISSUER } from '@/lib/docs';
import { COMMON_DOCUMENTS } from '@/data/documentOffices';
import { useAuth } from '@/hooks/useAuth';
import { useUserDocuments, CONFIRMED } from '@/hooks/useUserDocuments';
import { Button, ButtonLink, Card, Field, Input, Notice, ProgressBar, Textarea, FullPageLoader } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { SubmittedDocument } from '@/types';

type Details = { full_name: string; phone: string; address: string; income: string; aadhaar_last4: string };
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const EMPTY: Details = { full_name: '', phone: '', address: '', income: '', aadhaar_last4: '' };

export default function SchemeApply() {
  const { schemeId = '' } = useParams();
  const [params] = useSearchParams();
  const { lang, tx } = useLang();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const userDocs = useUserDocuments();

  const { profile: family } = useProfile();
  const [scheme, setScheme] = useState<Entry | undefined>(() => findEntry(schemeId));
  const [schemeChecked, setSchemeChecked] = useState(!!scheme);
  const [details, setDetails] = useState<Details>(() => ({
    ...EMPTY,
    full_name: params.get('full_name') || '',
    phone: params.get('phone') || '',
    address: params.get('address') || '',
    income: params.get('income') || '',
  }));
  const [uploaded, setUploaded] = useState<SubmittedDocument[]>([]);
  const [busyDoc, setBusyDoc] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [restored, setRestored] = useState<string | null>(null);
  const [save, setSave] = useState<{ state: SaveState; at?: Date }>({ state: 'idle' });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof Details, string>>>({});
  const [done, setDone] = useState<{ id: string; token: string | null } | null>(null);
  const [existing, setExisting] = useState<{ id: string; status: string; token_number: string | null } | null>(null);
  const draftLoaded = useRef(false);

  useEffect(() => {
    loadCatalog().then((list) => {
      setScheme(list.find((s) => s.id === schemeId));
      setSchemeChecked(true);
    });
  }, [schemeId]);

  // Prefill name from profile, restore any saved draft, and check for an open application.
  useEffect(() => {
    if (!user || draftLoaded.current) return;
    draftLoaded.current = true;
    (async () => {
      const [{ data: draft }, { data: apps }] = await Promise.all([
        supabase.from('application_drafts').select('*').eq('user_id', user.id).eq('scheme_id', schemeId).maybeSingle(),
        supabase.from('applications').select('id, status, token_number').eq('user_id', user.id).eq('scheme_id', schemeId).neq('status', 'rejected').limit(1),
      ]);
      if (apps && apps[0]) setExisting(apps[0] as typeof existing);
      if (draft?.draft_data) {
        const d = draft.draft_data as { details?: Partial<Details>; uploaded?: SubmittedDocument[] };
        setDetails((cur) => ({ ...cur, ...Object.fromEntries(Object.entries(d.details ?? {}).filter(([, v]) => v)) }));
        setUploaded(d.uploaded ?? []);
        setRestored(draft.updated_at as string);
      } else if (profile?.full_name) {
        setDetails((cur) => (cur.full_name ? cur : { ...cur, full_name: profile.full_name ?? '' }));
      }
    })();
  }, [user, schemeId, profile?.full_name]);

  useEffect(() => {
    if (family?.monthly_income != null) setDetails((cur) => (cur.income ? cur : { ...cur, income: String(family.monthly_income! * 12) }));
  }, [family?.monthly_income]);

  const docs = useMemo(() => (scheme?.docs ?? []).map((d) => d.en), [scheme]);
  const docLabel = (en: string) => pick(scheme?.docs.find((d) => d.en === en), lang) || en;
  const completion = useMemo(() => {
    const fields: (keyof Details)[] = ['full_name', 'phone', 'address'];
    const f = fields.filter((k) => details[k].trim()).length;
    const d = docs.filter((doc) => uploaded.some((u) => u.document_type === doc)).length;
    return Math.round(((f + d) / Math.max(1, fields.length + docs.length)) * 100);
  }, [details, uploaded, docs]);

  const saveDraft = useCallback(async () => {
    if (!user || !scheme) return;
    setSave({ state: 'saving' });
    const { error } = await supabase.from('application_drafts').upsert(
      { user_id: user.id, scheme_id: scheme.id, draft_data: { details, uploaded }, completion_percentage: completion },
      { onConflict: 'user_id,scheme_id' },
    );
    setSave(error ? { state: 'error' } : { state: 'saved', at: new Date() });
  }, [user, scheme, details, uploaded, completion]);

  // Autosave 2.5s after the last change.
  useEffect(() => {
    if (!touched || done) return;
    const t = window.setTimeout(() => void saveDraft(), 2500);
    return () => window.clearTimeout(t);
  }, [details, uploaded, touched, done, saveDraft]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (touched && !done && save.state !== 'saved') e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [touched, done, save.state]);

  const set = (k: keyof Details, v: string) => {
    setTouched(true);
    setErrors((e) => ({ ...e, [k]: undefined }));
    setDetails((d) => ({ ...d, [k]: v }));
  };

  const attach = (doc: string, file_url: string) => {
    setTouched(true);
    setUploaded((list) => [...list.filter((u) => u.document_type !== doc), { document_type: doc, file_url }]);
  };

  const upload = async (doc: string, file: File) => {
    if (!user || !scheme) return;
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      toast.error(tx(`That file is larger than ${MAX_UPLOAD_MB} MB. Take a smaller photo.`, `ఫైల్ ${MAX_UPLOAD_MB} MB కంటే పెద్దది. చిన్న ఫోటో తీయండి.`));
      return;
    }
    setBusyDoc(doc);
    const path = `${user.id}/${scheme.id}/${slug(doc)}-${safeStorageName(file.name)}`;
    const { error } = await supabase.storage.from('applications').upload(path, file, { upsert: true, contentType: file.type || undefined });
    setBusyDoc(null);
    if (error) {
      toast.error(
        /bucket/i.test(error.message)
          ? tx('Uploads are not set up yet (storage bucket missing). Ask the site admin.', 'అప్‌లోడ్ సెటప్ కాలేదు. అడ్మిన్‌ను అడగండి.')
          : `${tx('Upload failed', 'అప్‌లోడ్ విఫలమైంది')}: ${error.message}`,
      );
      return;
    }
    attach(doc, path);
    // Also keep it in "My documents" so the next application can reuse it.
    const canonical = COMMON_DOCUMENTS.find((c) => docKey(c.en) === docKey(doc))?.en ?? doc;
    void supabase.from('user_documents').upsert({ user_id: user.id, document_type: canonical, file_url: path }, { onConflict: 'user_id,document_type' }).then(() => userDocs.reload());
    toast.success(tx('Uploaded', 'అప్‌లోడ్ అయింది'));
  };

  const startOver = async () => {
    if (!user || !scheme) return;
    await supabase.from('application_drafts').delete().eq('user_id', user.id).eq('scheme_id', scheme.id);
    setDetails({ ...EMPTY, full_name: profile?.full_name ?? '' });
    setUploaded([]);
    setRestored(null);
    setTouched(false);
    setSave({ state: 'idle' });
  };

  const validate = () => {
    const e: typeof errors = {};
    if (details.full_name.trim().length < 2) e.full_name = tx('Enter your full name', 'పూర్తి పేరు నమోదు చేయండి');
    if (!/^[6-9]\d{9}$/.test(details.phone.replace(/\D/g, '').slice(-10))) e.phone = tx('Enter a 10-digit mobile number', '10 అంకెల మొబైల్ నంబర్ నమోదు చేయండి');
    if (details.address.trim().length < 5) e.address = tx('Enter your address with village / ward', 'గ్రామం / వార్డుతో చిరునామా నమోదు చేయండి');
    if (details.aadhaar_last4 && !/^\d{4}$/.test(details.aadhaar_last4)) e.aadhaar_last4 = tx('Only the last 4 digits', 'చివరి 4 అంకెలు మాత్రమే');
    setErrors(e);
    if (Object.keys(e).length) document.getElementById(`f-${Object.keys(e)[0]}`)?.focus();
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!user || !scheme || !validate()) return;
    setSubmitting(true);
    const applicant_details = {
      full_name: details.full_name.trim(),
      phone: details.phone.replace(/\D/g, '').slice(-10),
      address: details.address.trim(),
      ...(details.income ? { income: details.income } : {}),
      ...(details.aadhaar_last4 ? { aadhaar_last4: details.aadhaar_last4 } : {}),
      ...profileSummary(family),
    };
    const { data, error } = await supabase
      .from('applications')
      .insert({ user_id: user.id, scheme_id: scheme.id, status: 'submitted', applicant_details, submitted_documents: uploaded })
      .select('id, token_number')
      .single();
    setSubmitting(false);
    if (error) {
      toast.error(`${tx('Could not submit', 'సమర్పించలేకపోయాం')}: ${error.message}`);
      return;
    }
    void supabase.from('application_drafts').delete().eq('user_id', user.id).eq('scheme_id', scheme.id);
    setDone({ id: data.id as string, token: (data.token_number as string) ?? null });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!schemeChecked) return <FullPageLoader />;
  if (!scheme)
    return (
      <Notice tone="error">
        {tx('We couldn’t find that scheme.', 'ఆ పథకం కనబడలేదు.')}{' '}
        <Link to="/schemes" className="font-semibold underline">
          {tx('See all schemes', 'అన్ని పథకాలు చూడండి')}
        </Link>
      </Notice>
    );

  const name = pick(scheme.name, lang);
  const isService = scheme.kind === 'service';

  if (!canApply(scheme))
    return (
      <Notice tone="warn">
        {scheme.status === 'announced'
          ? tx(`${scheme.name.en} has been announced but applications have not opened yet.`, `${scheme.name.te} ప్రకటించారు కానీ దరఖాస్తులు ఇంకా ప్రారంభం కాలేదు.`)
          : tx('Online applications for this are not set up yet — apply at your Sachivalayam.', 'దీనికి ఆన్‌లైన్ దరఖాస్తు ఇంకా అందుబాటులో లేదు — సచివాలయంలో దరఖాస్తు చేయండి.')}{' '}
        <Link to={`/${isService ? 'services' : 'schemes'}/${scheme.id}`} className="font-semibold underline">
          {tx('See details', 'వివరాలు చూడండి')}
        </Link>
      </Notice>
    );

  if (done)
    return (
      <div className="mx-auto max-w-xl py-4 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-leaf text-white">
          <Check className="size-8" />
        </span>
        <h1 className="display mt-5 text-[28px]">{tx('Application submitted', 'దరఖాస్తు సమర్పించబడింది')}</h1>
        <p className="mt-2 text-muted">
          {tx(`Your Sachivalayam will review your ${scheme.name.en} application. If they need anything else, they’ll message you here.`, `మీ సచివాలయం మీ ${scheme.name.te} దరఖాస్తును సమీక్షిస్తుంది. ఇంకేమైనా కావాలంటే ఇక్కడే సందేశం పంపుతారు.`)}
        </p>
        {done.token && (
          <Card className="mx-auto mt-6 max-w-sm p-5">
            <p className="text-sm text-muted">{tx('Your application number', 'మీ దరఖాస్తు నంబర్')}</p>
            <p className="display mt-1 select-all text-[26px] tracking-wide">{done.token}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                void navigator.clipboard?.writeText(done.token!);
                toast.success(tx('Copied', 'కాపీ అయింది'));
              }}
            >
              <Copy className="size-4" /> {tx('Copy number', 'నంబర్ కాపీ')}
            </Button>
            <p className="mt-3 text-xs text-muted">{tx('Write it down — anyone can check the status with it, no login needed.', 'దీన్ని రాసుకోండి — లాగిన్ లేకుండా స్థితి చూడవచ్చు.')}</p>
          </Card>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={() => navigate(`/my-applications/${done.id}`)}>{tx('Follow this application', 'ఈ దరఖాస్తు చూడండి')}</Button>
          <ButtonLink to="/eligible" variant="outline">
            {tx('Apply for another', 'మరొకదానికి దరఖాస్తు')}
          </ButtonLink>
        </div>
      </div>
    );

  const missing = docs.filter((d) => !uploaded.some((u) => u.document_type === d));

  return (
    <form onSubmit={submit} noValidate className="pb-24">
      <div className="mb-6">
        <Link to={`/${isService ? 'services' : 'schemes'}/${scheme.id}`} className="text-sm font-medium text-muted hover:text-ink">
          ← {isService ? tx('Service details', 'సేవ వివరాలు') : tx('Scheme details', 'పథకం వివరాలు')}
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-4xl">{scheme.icon}</span>
          <div>
            <h1 className="display text-[26px] leading-tight sm:text-[32px]">{name}</h1>
            {(scheme.benefit || scheme.fee) && <p className="text-[15px] text-muted">{pick((family && scheme.benefitFor?.(family)) || scheme.benefit || scheme.fee, lang)}</p>}
          </div>
        </div>
      </div>

      {existing && (
        <Notice tone="warn" className="mb-4">
          {tx('You already have an application for this scheme', 'ఈ పథకానికి మీకు ఇప్పటికే దరఖాస్తు ఉంది')} ({existing.token_number}).{' '}
          <Link to={`/my-applications/${existing.id}`} className="font-semibold underline">
            {tx('Open it', 'దాన్ని తెరవండి')}
          </Link>
        </Notice>
      )}
      {restored && (
        <Notice className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <span>
            {tx('We restored your saved progress from', 'మీ సేవ్ చేసిన పురోగతిని తిరిగి తెచ్చాం:')} {new Date(restored).toLocaleString(lang === 'te' ? 'te-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' })}.
          </span>
          <button type="button" onClick={startOver} className="flex items-center gap-1 text-sm font-semibold underline">
            <RotateCcw className="size-3.5" /> {tx('Start over', 'మళ్లీ మొదలు')}
          </button>
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <h2 className="text-lg font-semibold">{tx('Your details', 'మీ వివరాలు')}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label={tx('Full name (as on Aadhaar)', 'పూర్తి పేరు (ఆధార్‌లో ఉన్నట్లు)')} error={errors.full_name} htmlFor="f-full_name" className="sm:col-span-2">
                <Input id="f-full_name" autoComplete="name" value={details.full_name} onChange={(e) => set('full_name', e.target.value)} />
              </Field>
              <Field label={tx('Mobile number', 'మొబైల్ నంబర్')} error={errors.phone} htmlFor="f-phone">
                <Input id="f-phone" type="tel" inputMode="numeric" autoComplete="tel" placeholder="98xxxxxx10" value={details.phone} onChange={(e) => set('phone', e.target.value)} />
              </Field>
              <Field label={tx('Aadhaar — last 4 digits', 'ఆధార్ — చివరి 4 అంకెలు')} hint={tx('Optional. Never enter the full number.', 'ఐచ్ఛికం. పూర్తి నంబర్ ఇవ్వకండి.')} error={errors.aadhaar_last4} htmlFor="f-aadhaar_last4">
                <Input id="f-aadhaar_last4" inputMode="numeric" maxLength={4} value={details.aadhaar_last4} onChange={(e) => set('aadhaar_last4', e.target.value.replace(/\D/g, ''))} />
              </Field>
              <Field label={tx('Address', 'చిరునామా')} hint={tx('House no., street, village / ward, mandal, district', 'ఇంటి నం., వీధి, గ్రామం / వార్డు, మండలం, జిల్లా')} error={errors.address} htmlFor="f-address" className="sm:col-span-2">
                <Textarea id="f-address" rows={3} autoComplete="street-address" value={details.address} onChange={(e) => set('address', e.target.value)} />
              </Field>
              <Field label={tx('Annual family income (₹)', 'వార్షిక కుటుంబ ఆదాయం (₹)')} hint={tx('Optional', 'ఐచ్ఛికం')} htmlFor="f-income">
                <Input id="f-income" inputMode="numeric" value={details.income} onChange={(e) => set('income', e.target.value.replace(/[^\d]/g, ''))} />
              </Field>
            </div>
          </Card>

          {docs.length > 0 && (
            <Card className="p-5 sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">{tx('Documents', 'పత్రాలు')}</h2>
                <span className="text-sm text-muted">
                  {docs.length - missing.length}/{docs.length} {tx('added', 'జోడించారు')}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted">{tx('A clear phone photo is fine. PDF also works.', 'స్పష్టమైన ఫోన్ ఫోటో చాలు. PDF కూడా పనిచేస్తుంది.')}</p>
              <ul className="mt-4 divide-y divide-line">
                {docs.map((doc) => {
                  const up = uploaded.find((u) => u.document_type === doc);
                  const saved = userDocs.find(doc);
                  const reusable = !up && saved && saved.file_url !== CONFIRMED ? saved : null;
                  const issuer = ISSUER[docKey(doc)];
                  return (
                    <li key={doc} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex items-start gap-3">
                        <span className={cn('mt-0.5 grid size-7 shrink-0 place-items-center rounded-full', up ? 'bg-leaf text-white' : 'bg-ink-50 text-ink/40')}>
                          {up ? <Check className="size-4" /> : <span className="size-1.5 rounded-full bg-current" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium leading-snug">{docLabel(doc)}</p>
                          {up ? (
                            <p className="mt-0.5 truncate text-sm text-leaf">{up.file_url.split('/').pop()}</p>
                          ) : issuer ? (
                            <p className="mt-0.5 text-sm text-muted">
                              {tx('Don’t have it? Get it at', 'లేదా? ఇక్కడ పొందండి:')} {lang === 'te' ? issuer.te : issuer.en}
                            </p>
                          ) : null}
                          {reusable && (
                            <button type="button" onClick={() => attach(doc, reusable.file_url)} className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-leaf-50 px-3 py-1 text-sm font-semibold text-leaf">
                              <FileCheck2 className="size-4" /> {tx('Use the one in My documents', 'నా పత్రాల్లోనిది వాడండి')}
                            </button>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {up && (
                            <button type="button" onClick={() => setUploaded((l) => l.filter((u) => u.document_type !== doc))} className="grid size-10 place-items-center rounded-full text-muted hover:bg-kumkum-50 hover:text-kumkum" aria-label={tx('Remove', 'తీసేయండి')}>
                              <Trash2 className="size-4" />
                            </button>
                          )}
                          <label className={cn('inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-[10px] px-3 text-sm font-semibold', up ? 'border border-line' : 'bg-ink text-white')}>
                            {busyDoc === doc ? <Loader2 className="size-4 animate-spin" /> : up ? <Upload className="size-4" /> : <Camera className="size-4" />}
                            {busyDoc === doc ? tx('Uploading', 'అప్‌లోడ్') : up ? tx('Replace', 'మార్చు') : tx('Add', 'జోడించు')}
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              className="sr-only"
                              disabled={!!busyDoc}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                e.target.value = '';
                                if (f) void upload(doc, f);
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {missing.length > 0 && (
                <p className="mt-4 flex items-center gap-2 rounded-[12px] bg-mist p-3 text-sm text-muted">
                  <MapPin className="size-4 shrink-0" />
                  <span>
                    {tx('You can submit without every document — staff will ask for anything they need.', 'అన్ని పత్రాలు లేకుండా కూడా సమర్పించవచ్చు — అవసరమైతే సిబ్బంది అడుగుతారు.')}{' '}
                    <Link to="/nearest-center?tab=meeseva" className="font-semibold text-ink underline">
                      {tx('Find a MeeSeva centre', 'మీసేవ కేంద్రం కనుగొనండి')}
                    </Link>
                  </span>
                </p>
              )}
            </Card>
          )}
        </div>

        {/* Summary rail */}
        <aside className="hidden lg:block">
          <Card className="sticky top-6 p-5">
            <p className="text-sm text-muted">{tx('Ready', 'సిద్ధం')}</p>
            <p className="display text-[36px] leading-none">{completion}%</p>
            <ProgressBar value={completion} className="mt-3" />
            <SaveStatus save={save} touched={touched} />
            <Button type="submit" size="lg" className="mt-5 w-full" loading={submitting} disabled={!!busyDoc}>
              <CheckCircle2 className="size-5" /> {tx('Submit application', 'దరఖాస్తు సమర్పించండి')}
            </Button>
          </Card>
        </aside>
      </div>

      {/* Sticky mobile bar */}
      <div className="pb-safe fixed inset-x-0 bottom-[64px] z-30 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="font-semibold">{completion}%</span>
              <SaveStatus save={save} touched={touched} compact />
            </div>
            <ProgressBar value={completion} className="mt-1.5" />
          </div>
          <Button type="submit" loading={submitting} disabled={!!busyDoc}>
            {tx('Submit', 'సమర్పించు')}
          </Button>
        </div>
      </div>
    </form>
  );
}

function SaveStatus({ save, touched, compact }: { save: { state: SaveState; at?: Date }; touched: boolean; compact?: boolean }) {
  const { tx, lang } = useLang();
  if (!touched && save.state === 'idle') return compact ? null : <p className="mt-3 text-sm text-muted">{tx('Your progress saves automatically.', 'మీ పురోగతి ఆటోమేటిక్‌గా సేవ్ అవుతుంది.')}</p>;
  const text =
    save.state === 'saving'
      ? tx('Saving…', 'సేవ్ అవుతోంది…')
      : save.state === 'saved' && save.at
        ? `${tx('Saved', 'సేవ్ అయింది')} ${save.at.toLocaleTimeString(lang === 'te' ? 'te-IN' : 'en-IN', { hour: 'numeric', minute: '2-digit' })}`
        : save.state === 'error'
          ? tx('Not saved — check internet', 'సేవ్ కాలేదు — ఇంటర్నెట్ చూడండి')
          : tx('Unsaved changes', 'సేవ్ చేయని మార్పులు');
  return <p className={cn(compact ? 'truncate text-xs' : 'mt-3 text-sm', save.state === 'error' ? 'text-kumkum' : 'text-muted')}>{text}</p>;
}
