import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileSearch, RefreshCw } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { Timeline } from '@/components/ApplicationBits';
import { Button, Card, EmptyState, Notice, PageHeader, StatusBadge } from '@/components/ui';
import type { ApplicationStatus, PublicApplicationLookup } from '@/types';

type Cert = { token_number: string; certificate_type: string; status: 'pending' | 'ready' | 'collected'; citizen_name: string; requested_at: string; updated_at: string };
type Result =
  | { kind: 'app'; data: PublicApplicationLookup; history: { status: string; changed_at: string }[] | null }
  | { kind: 'cert'; data: Cert }
  | { kind: 'none' };

const CERT_META = {
  pending: { en: 'Being processed', te: 'ప్రాసెస్‌లో ఉంది', cls: 'bg-ink-50 text-ink', hint: { en: 'We’ll update this when it’s ready to collect.', te: 'తీసుకోవడానికి సిద్ధమైనప్పుడు ఇక్కడ అప్‌డేట్ అవుతుంది.' } },
  ready: { en: 'Ready to collect', te: 'తీసుకోవడానికి సిద్ధం', cls: 'bg-leaf-50 text-leaf', hint: { en: 'Visit your Sachivalayam with Aadhaar and this token.', te: 'ఆధార్ మరియు ఈ టోకెన్‌తో మీ సచివాలయానికి వెళ్లండి.' } },
  collected: { en: 'Collected', te: 'తీసుకున్నారు', cls: 'bg-mist text-muted', hint: { en: 'This certificate has been handed over.', te: 'ఈ ధృవపత్రం అందజేయబడింది.' } },
};

async function lookup(raw: string): Promise<Result> {
  const token = raw.trim().toUpperCase();
  if (!token) return { kind: 'none' };
  if (!token.startsWith('SC-')) {
    const { data } = await supabase.rpc('lookup_application_by_token', { _token: token });
    const row = (Array.isArray(data) ? data[0] : data) as PublicApplicationLookup | undefined;
    if (row) {
      const h = await supabase.rpc('lookup_application_history', { _token: token });
      return { kind: 'app', data: row, history: h.error ? null : ((h.data as { status: string; changed_at: string }[]) ?? []) };
    }
  }
  let cert: Cert | undefined;
  const r = await supabase.rpc('lookup_certificate_by_token', { _token: token });
  if (!r.error) cert = (Array.isArray(r.data) ? r.data[0] : r.data) as Cert | undefined;
  else {
    // Older databases (before the v2 migration) allowed reading the table directly.
    const { data } = await supabase.from('certificate_requests').select('token_number, certificate_type, status, citizen_name, requested_at, updated_at').ilike('token_number', token).maybeSingle();
    cert = (data as Cert) ?? undefined;
  }
  return cert ? { kind: 'cert', data: cert } : { kind: 'none' };
}

export default function Tracker() {
  const { lang, tx } = useLang();
  const [params, setParams] = useSearchParams();
  const [token, setToken] = useState(params.get('token') ?? '');
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const active = useRef('');

  const run = useCallback(async (t: string, silent = false) => {
    active.current = t;
    if (!silent) setLoading(true);
    const r = await lookup(t);
    if (active.current !== t) return;
    setResult(r);
    setCheckedAt(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = params.get('token');
    if (t) {
      setToken(t.toUpperCase());
      void run(t);
    }
  }, [params, run]);

  // Refresh quietly every 30 s while a result is shown.
  useEffect(() => {
    if (!result || result.kind === 'none') return;
    const id = window.setInterval(() => void run(active.current, true), 30000);
    return () => window.clearInterval(id);
  }, [result, run]);

  const te = lang === 'te';

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={tx('Track by number', 'నంబర్‌తో ట్రాక్ చేయండి')}
        subtitle={tx('Enter an application number (APP-…) or a certificate token (SC-…). No login needed.', 'దరఖాస్తు నంబర్ (APP-…) లేదా ధృవపత్ర టోకెన్ (SC-…) నమోదు చేయండి. లాగిన్ అవసరం లేదు.')}
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (token.trim()) setParams({ token: token.trim().toUpperCase() });
        }}
        className="flex gap-2"
      >
        <input
          value={token}
          onChange={(e) => setToken(e.target.value.toUpperCase())}
          placeholder="APP-2026-000123"
          className="h-14 min-w-0 flex-1 rounded-[14px] border border-line bg-paper px-4 text-lg font-semibold tracking-wide placeholder:font-normal placeholder:text-muted/60 focus:border-ink focus:outline-none focus:ring-4 focus:ring-ink/10"
          aria-label={tx('Application number', 'దరఖాస్తు నంబర్')}
          autoCapitalize="characters"
        />
        <Button type="submit" size="lg" className="h-14" loading={loading}>
          {tx('Check', 'చూడండి')}
        </Button>
      </form>

      <div className="mt-6">
        {result?.kind === 'none' && (
          <EmptyState
            icon={<FileSearch className="size-5" />}
            title={tx('Nothing found for that number', 'ఆ నంబర్‌కు ఏమీ కనబడలేదు')}
            body={tx('Check every letter and digit. The number is on your submission screen and in the message from staff.', 'ప్రతి అక్షరం, అంకె సరిచూడండి. నంబర్ సమర్పణ స్క్రీన్‌లో, సిబ్బంది సందేశంలో ఉంటుంది.')}
          />
        )}

        {result?.kind === 'app' && (
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-5">
              <div>
                <p className="text-sm text-muted">{result.data.token_number}</p>
                <p className="mt-0.5 text-xl font-semibold">{result.data.scheme_name ?? result.data.scheme_id}</p>
                {result.data.applicant_name && <p className="text-[15px] text-muted">{result.data.applicant_name}</p>}
              </div>
              <StatusBadge status={result.data.status as ApplicationStatus} lang={lang} />
            </div>
            <div className="p-5">
              <Timeline
                application={{ id: result.data.token_number, status: result.data.status as ApplicationStatus, created_at: result.data.created_at }}
                history={(result.history ?? [{ status: result.data.status, changed_at: result.data.updated_at }]).map((h) => ({ ...h, status: h.status as ApplicationStatus, document_requested: null }))}
              />
            </div>
            <Footer checkedAt={checkedAt} onRefresh={() => run(active.current)} />
          </Card>
        )}

        {result?.kind === 'cert' && (
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3 p-5">
              <div>
                <p className="text-sm text-muted">{result.data.token_number}</p>
                <p className="mt-0.5 text-xl font-semibold">{result.data.certificate_type}</p>
                <p className="text-[15px] text-muted">{result.data.citizen_name}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-sm font-semibold ${CERT_META[result.data.status].cls}`}>{te ? CERT_META[result.data.status].te : CERT_META[result.data.status].en}</span>
            </div>
            <div className="px-5 pb-5">
              <Notice tone={result.data.status === 'ready' ? 'success' : 'info'}>{te ? CERT_META[result.data.status].hint.te : CERT_META[result.data.status].hint.en}</Notice>
              <p className="mt-3 text-sm text-muted">
                {tx('Requested', 'అభ్యర్థించిన తేదీ')}: {new Date(result.data.requested_at).toLocaleDateString(te ? 'te-IN' : 'en-IN', { dateStyle: 'medium' })}
              </p>
            </div>
            <Footer checkedAt={checkedAt} onRefresh={() => run(active.current)} />
          </Card>
        )}
      </div>
    </div>
  );
}

function Footer({ checkedAt, onRefresh }: { checkedAt: Date | null; onRefresh: () => void }) {
  const { tx, lang } = useLang();
  return (
    <div className="flex items-center justify-between border-t border-line bg-mist px-5 py-3 text-sm text-muted">
      <span className="flex items-center gap-2">
        <span className="size-2 animate-pulse rounded-full bg-leaf" />
        {tx('Updates automatically', 'ఆటోమేటిక్‌గా అప్‌డేట్ అవుతుంది')}
        {checkedAt && ` · ${checkedAt.toLocaleTimeString(lang === 'te' ? 'te-IN' : 'en-IN', { hour: 'numeric', minute: '2-digit' })}`}
      </span>
      <button onClick={onRefresh} className="grid size-8 place-items-center rounded-full hover:bg-paper" aria-label="Refresh">
        <RefreshCw className="size-4" />
      </button>
    </div>
  );
}
