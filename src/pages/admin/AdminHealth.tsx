import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, CircleAlert, Loader2, RotateCw, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useLang } from '@/lib/i18n';
import { askSachiBot } from '@/lib/chat';
import { geocode, searchOsmCenters } from '@/lib/places';
import { Button, Card, PageHeader } from '@/components/ui';
import { cn } from '@/lib/utils';

type State = 'ok' | 'warn' | 'fail' | 'running';
interface Result {
  state: State;
  detail: string;
  fix?: string;
}
interface Check {
  id: string;
  group: string;
  label: string;
  run: () => Promise<Result>;
}

const MIGRATION = 'Run supabase/migrations/20261014000000_vercel_hardening.sql in the Supabase SQL editor.';
const ok = (detail: string): Result => ({ state: 'ok', detail });
const warn = (detail: string, fix?: string): Result => ({ state: 'warn', detail, fix });
const fail = (detail: string, fix?: string): Result => ({ state: 'fail', detail, fix });

async function count(table: string) {
  const { count: n, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (error) throw new Error(error.message);
  return n ?? 0;
}

function buildChecks(uid: string): Check[] {
  const tables = ['profiles', 'schemes', 'applications', 'application_messages', 'application_status_history', 'application_drafts', 'grievances', 'user_documents', 'sachivalayam_centers', 'meeseva_centers', 'certificate_requests'];
  return [
    {
      id: 'db',
      group: 'Database',
      label: 'Connection to Supabase',
      run: async () => {
        const n = await count('schemes');
        return n > 0 ? ok(`${n} schemes in the database`) : warn('Connected, but there are no schemes', 'Run supabase/schema.sql on a new project.');
      },
    },
    {
      id: 'tables',
      group: 'Database',
      label: 'All tables reachable',
      run: async () => {
        const missing: string[] = [];
        await Promise.all(tables.map((t) => count(t).catch(() => missing.push(t))));
        return missing.length ? fail(`Missing or blocked: ${missing.join(', ')}`, 'Run supabase/schema.sql (new project) or the migrations.') : ok(`${tables.length} tables`);
      },
    },
    {
      id: 'v2',
      group: 'Database',
      label: 'v2 upgrade applied (security fixes, tracking, import)',
      run: async () => {
        const probes = await Promise.all([
          supabase.rpc('lookup_certificate_by_token', { _token: 'SC-0000-00000' }),
          supabase.rpc('lookup_application_history', { _token: 'APP-0000-000000' }),
          supabase.from('sachivalayam_centers').select('osm_id').limit(1),
        ]);
        const bad = probes.filter((p) => p.error).map((p) => p.error!.message);
        return bad.length ? fail(bad[0], MIGRATION) : ok('Hardening migration is installed');
      },
    },
    {
      id: 'rpc',
      group: 'Database',
      label: 'Public tracking by application number',
      run: async () => {
        const { error } = await supabase.rpc('lookup_application_by_token', { _token: 'APP-0000-000000' });
        return error ? fail(error.message, MIGRATION) : ok('lookup_application_by_token works');
      },
    },
    {
      id: 'storage',
      group: 'Database',
      label: 'Document storage bucket',
      run: async () => {
        const { error } = await supabase.storage.from('applications').list(uid, { limit: 1 });
        if (error) return fail(error.message, /bucket/i.test(error.message) ? MIGRATION : 'Check Storage → Policies in Supabase.');
        return ok('Bucket "applications" exists and is readable by staff');
      },
    },
    {
      id: 'realtime',
      group: 'Database',
      label: 'Live updates (realtime)',
      run: () =>
        new Promise<Result>((resolve) => {
          const ch = supabase.channel('health-' + Date.now());
          const timer = setTimeout(() => {
            supabase.removeChannel(ch);
            resolve(fail('Could not subscribe within 8 seconds', 'Supabase → Database → Replication: enable realtime for applications, application_messages, grievances, sachivalayam_centers.'));
          }, 8000);
          ch.on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, () => {}).subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              clearTimeout(timer);
              supabase.removeChannel(ch);
              resolve(ok('Connected'));
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              clearTimeout(timer);
              supabase.removeChannel(ch);
              resolve(fail(`Realtime ${status}`, 'Check Realtime is enabled for the project.'));
            }
          });
        }),
    },
    {
      id: 'centres',
      group: 'Centres',
      label: 'Centres in your database',
      run: async () => {
        const [s, m] = await Promise.all([count('sachivalayam_centers'), count('meeseva_centers')]);
        const imported = await supabase.from('sachivalayam_centers').select('*', { count: 'exact', head: true }).not('osm_id', 'is', null);
        const n = imported.count ?? 0;
        if (n > 0) return ok(`${s} Sachivalayams (${n} imported from OpenStreetMap), ${m} MeeSeva`);
        return warn(`${s} Sachivalayams, ${m} MeeSeva — all-AP import not run yet`, 'Optional: run `npm run import:centers` (see README). Live map search works without it.');
      },
    },
    {
      id: 'osm',
      group: 'Centres',
      label: 'Live map search (OpenStreetMap)',
      run: async () => {
        const list = await searchOsmCenters({ lat: 16.5062, lng: 80.648 }, 5);
        return list.length ? ok(`${list.length} centres found around Vijayawada`) : warn('Answered, but found nothing', 'Try again in a minute — the public server may be busy.');
      },
    },
    {
      id: 'geocode',
      group: 'Centres',
      label: 'Village / town search',
      run: async () => {
        const hits = await geocode('Guntur', 'en');
        return hits.length ? ok(`“Guntur” → ${hits[0].label}, ${hits[0].sub}`) : fail('No result for “Guntur”');
      },
    },
    {
      id: 'google',
      group: 'Centres',
      label: 'Google Places (optional, extra accuracy)',
      run: async () => {
        const r = await fetch('/api/places').then((x) => x.json()).catch(() => null) as { configured?: boolean } | null;
        if (!r) return fail('/api/places did not answer', 'Redeploy on Vercel.');
        if (!r.configured) return warn('Not configured', 'Optional: add GOOGLE_MAPS_API_KEY in Vercel (Places API (New) enabled).');
        const res = await fetch('/api/places', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lat: 16.5062, lng: 80.648, radiusKm: 5 }) });
        const d = (await res.json()) as { places?: unknown[]; error?: string };
        return res.ok ? ok(`${d.places?.length ?? 0} places around Vijayawada`) : fail(d.error ?? `HTTP ${res.status}`, 'Check the key is valid and Places API (New) is enabled.');
      },
    },
    {
      id: 'ai-config',
      group: 'SachiBot',
      label: 'AI key configured',
      run: async () => {
        const r = (await fetch('/api/chat').then((x) => x.json()).catch(() => null)) as { configured?: boolean; provider?: string; model?: string } | null;
        if (!r) return fail('/api/chat did not answer', 'Redeploy on Vercel.');
        return r.configured ? ok(`${r.provider} · ${r.model}`) : fail('No AI key set — SachiBot only gives saved answers', 'Add GEMINI_API_KEY in Vercel → Settings → Environment Variables, then redeploy.');
      },
    },
    {
      id: 'ai-live',
      group: 'SachiBot',
      label: 'AI answers a real question',
      run: async () => {
        const t0 = performance.now();
        const { text, offline } = await askSachiBot([{ role: 'user', content: 'In one sentence: what is a Sachivalayam?' }], 'en', () => {});
        const ms = Math.round(performance.now() - t0);
        return offline ? fail('The AI did not reply; the saved-answer fallback was used', 'Check the key in Vercel, then open Vercel → Logs and look for “[chat]”.') : ok(`Replied in ${(ms / 1000).toFixed(1)} s: “${text.slice(0, 90)}${text.length > 90 ? '…' : ''}”`);
      },
    },
    {
      id: 'staff',
      group: 'Accounts',
      label: 'Staff key for staff login & sign-up',
      run: async () => {
        const { error } = await supabase.rpc('claim_staff', { _key: '' });
        if (!error) return ok('Checked in the database (default key 4040 — change it with: update public.app_secrets set value = \'…\' where name = \'staff_key\')');
        const r = (await fetch('/api/claim-staff').then((x) => x.json()).catch(() => null)) as { configured?: boolean } | null;
        return warn(
          'Database staff-key check missing',
          `Run supabase/migrations/20261015010000_staff_key.sql.${r?.configured ? ' Until then the Vercel fallback is used.' : ''}`,
        );
      },
    },
    {
      id: 'staffcount',
      group: 'Accounts',
      label: 'Staff accounts',
      run: async () => {
        const { count: n, error } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_staff', true);
        if (error) throw new Error(error.message);
        return ok(`${n ?? 0} staff account${n === 1 ? '' : 's'}`);
      },
    },
  ];
}

export default function AdminHealth() {
  const { tx } = useLang();
  const { user } = useAuth();
  const [results, setResults] = useState<Record<string, Result>>({});
  const [running, setRunning] = useState(false);
  const checks = buildChecks(user?.id ?? 'x');

  const runAll = useCallback(async () => {
    setRunning(true);
    setResults(Object.fromEntries(buildChecks(user?.id ?? 'x').map((c) => [c.id, { state: 'running', detail: '' } as Result])));
    await Promise.all(
      buildChecks(user?.id ?? 'x').map(async (c) => {
        let r: Result;
        try {
          r = await c.run();
        } catch (e) {
          r = fail((e as Error).message);
        }
        setResults((x) => ({ ...x, [c.id]: r }));
      }),
    );
    setRunning(false);
  }, [user?.id]);

  useEffect(() => {
    void runAll();
  }, [runAll]);

  const states = Object.values(results);
  const fails = states.filter((r) => r.state === 'fail').length;
  const warns = states.filter((r) => r.state === 'warn').length;
  const groups = [...new Set(checks.map((c) => c.group))];

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={tx('System check', 'సిస్టమ్ తనిఖీ')}
        subtitle={tx('Tests the live site: database, storage, live updates, centre search and SachiBot.', 'లైవ్ సైట్‌ను పరీక్షిస్తుంది: డేటాబేస్, స్టోరేజ్, లైవ్ అప్‌డేట్‌లు, కేంద్రాల శోధన, సచిబాట్.')}
        action={
          <Button variant="outline" size="sm" onClick={runAll} loading={running}>
            {!running && <RotateCw className="size-4" />} {tx('Run again', 'మళ్లీ పరీక్షించు')}
          </Button>
        }
      />
      {!running && states.length > 0 && (
        <div className={cn('mb-5 rounded-[16px] p-4 font-semibold', fails ? 'bg-kumkum-50 text-kumkum' : warns ? 'bg-amber-50 text-amber' : 'bg-leaf-50 text-leaf')}>
          {fails ? `${fails} problem${fails > 1 ? 's' : ''} to fix` : warns ? `Working — ${warns} optional item${warns > 1 ? 's' : ''}` : 'Everything is working'}
        </div>
      )}
      <div className="space-y-6">
        {groups.map((g) => (
          <Card key={g} className="overflow-hidden">
            <p className="border-b border-line bg-mist px-5 py-2.5 text-sm font-semibold text-muted">{g}</p>
            <ul className="divide-y divide-line">
              {checks
                .filter((c) => c.group === g)
                .map((c) => {
                  const r = results[c.id];
                  return (
                    <li key={c.id} className="flex gap-3 px-5 py-3.5">
                      <span className="mt-0.5">
                        {!r || r.state === 'running' ? (
                          <Loader2 className="size-5 animate-spin text-muted" />
                        ) : r.state === 'ok' ? (
                          <CheckCircle2 className="size-5 text-leaf" />
                        ) : r.state === 'warn' ? (
                          <CircleAlert className="size-5 text-amber" />
                        ) : (
                          <XCircle className="size-5 text-kumkum" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{c.label}</p>
                        {r?.detail && <p className="break-words text-sm text-muted">{r.detail}</p>}
                        {r?.fix && r.state !== 'ok' && <p className="mt-1 text-sm font-medium text-ink">→ {r.fix}</p>}
                      </div>
                    </li>
                  );
                })}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
