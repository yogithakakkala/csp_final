import { useEffect, useState } from 'react';
import { Check, Clock, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { Application, ApplicationStatus, ApplicationStatusHistory } from '@/types';

const ORDER: ApplicationStatus[] = ['submitted', 'under_review', 'documents_requested', 'approved'];

/** Four-segment progress used on list rows. */
export function MiniProgress({ status }: { status: ApplicationStatus }) {
  const idx = status === 'rejected' ? 3 : status === 'visit_required' ? 2 : ORDER.indexOf(status);
  return (
    <div className="flex w-full max-w-[220px] gap-1" aria-hidden>
      {ORDER.map((_, i) => (
        <span
          key={i}
          className={cn(
            'h-1.5 flex-1 rounded-full',
            i < idx ? 'bg-ink' : i === idx ? (status === 'rejected' ? 'bg-kumkum' : status === 'approved' ? 'bg-leaf' : 'bg-turmeric') : 'bg-ink-100',
          )}
        />
      ))}
    </div>
  );
}

function fmt(iso: string, lang: 'en' | 'te') {
  return new Date(iso).toLocaleString(lang === 'te' ? 'te-IN' : 'en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

function gap(a: string, b: string, lang: 'en' | 'te') {
  const ms = Math.max(0, new Date(b).getTime() - new Date(a).getTime());
  const d = Math.floor(ms / 86400000);
  const h = Math.floor(ms / 3600000);
  if (d >= 1) return lang === 'te' ? `${d} రోజుల తర్వాత` : `${d} day${d > 1 ? 's' : ''} later`;
  if (h >= 1) return lang === 'te' ? `${h} గంటల తర్వాత` : `${h}h later`;
  return null;
}

const LABEL: Record<string, { en: string; te: string; hint?: { en: string; te: string } }> = {
  submitted: { en: 'Application submitted', te: 'దరఖాస్తు సమర్పించబడింది' },
  under_review: { en: 'Under review at Sachivalayam', te: 'సచివాలయంలో సమీక్షలో ఉంది' },
  documents_requested: { en: 'Documents requested', te: 'పత్రాలు అడిగారు' },
  visit_required: { en: 'Visit your Sachivalayam to verify', te: 'ధృవీకరణకు మీ సచివాలయానికి వెళ్లండి', hint: { en: 'Take your original documents. Staff will check them in person.', te: 'అసలు పత్రాలు తీసుకెళ్లండి. సిబ్బంది స్వయంగా పరిశీలిస్తారు.' } },
  approved: { en: 'Approved', te: 'ఆమోదించబడింది' },
  rejected: { en: 'Rejected', te: 'తిరస్కరించబడింది' },
  final: { en: 'Decision', te: 'నిర్ణయం', hint: { en: 'Usually 7–30 days after submitting, depending on the scheme.', te: 'పథకాన్ని బట్టి సాధారణంగా సమర్పించిన 7–30 రోజుల్లో.' } },
};

type Step = { key: string; when?: string; state: 'done' | 'current' | 'todo' | 'bad'; note?: string | null };

/** Vertical step timeline built from application_status_history. Pass `history` to skip fetching (public tracker). */
export function Timeline({ application, history: given }: { application: Pick<Application, 'id' | 'status' | 'created_at'>; history?: Pick<ApplicationStatusHistory, 'status' | 'changed_at' | 'document_requested'>[] }) {
  const { lang } = useLang();
  const [history, setHistory] = useState(given ?? []);

  useEffect(() => {
    if (given) {
      setHistory(given);
      return;
    }
    let off = false;
    supabase
      .from('application_status_history')
      .select('status, changed_at, document_requested')
      .eq('application_id', application.id)
      .order('changed_at')
      .then(({ data }) => !off && setHistory((data as ApplicationStatusHistory[]) ?? []));
    const ch = supabase
      .channel('hist-' + application.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'application_status_history', filter: `application_id=eq.${application.id}` }, (p) =>
        setHistory((h) => [...h, p.new as ApplicationStatusHistory]),
      )
      .subscribe();
    return () => {
      off = true;
      supabase.removeChannel(ch);
    };
  }, [application.id, given]);

  const last = (s: string) => [...history].reverse().find((h) => h.status === s);
  const st = application.status;
  const terminal = st === 'approved' || st === 'rejected';
  const docsSeen = !!last('documents_requested') || st === 'documents_requested';

  const steps: Step[] = [{ key: 'submitted', when: last('submitted')?.changed_at ?? application.created_at, state: 'done' }];
  steps.push({
    key: 'under_review',
    when: last('under_review')?.changed_at,
    state: st === 'under_review' ? 'current' : st === 'submitted' ? 'todo' : 'done',
  });
  if (docsSeen)
    steps.push({
      key: 'documents_requested',
      when: last('documents_requested')?.changed_at,
      state: st === 'documents_requested' ? 'current' : 'done',
      note: last('documents_requested')?.document_requested,
    });
  if (last('visit_required') || st === 'visit_required')
    steps.push({ key: 'visit_required', when: last('visit_required')?.changed_at, state: st === 'visit_required' ? 'current' : 'done' });
  if (terminal) steps.push({ key: st, when: last(st)?.changed_at, state: st === 'rejected' ? 'bad' : 'done' });
  else steps.push({ key: 'final', state: 'todo' });
  if (st === 'submitted') steps[0].state = 'current';

  return (
    <ol className="relative">
      {steps.map((s, i) => {
        const l = LABEL[s.key];
        const prevWhen = steps[i - 1]?.when;
        const g = s.when && prevWhen ? gap(prevWhen, s.when, lang) : null;
        const isLast = i === steps.length - 1;
        return (
          <li key={s.key} className="relative flex gap-4 pb-6 last:pb-0">
            {!isLast && <span className={cn('absolute left-[15px] top-8 h-[calc(100%-24px)] w-0.5', s.state === 'done' ? 'bg-ink' : 'bg-ink-100')} aria-hidden />}
            <span
              className={cn(
                'relative z-[1] grid size-8 shrink-0 place-items-center rounded-full',
                s.state === 'done' && (s.key === 'approved' ? 'bg-leaf text-white' : 'bg-ink text-white'),
                s.state === 'current' && 'pulse-ring bg-turmeric text-ink',
                s.state === 'bad' && 'bg-kumkum text-white',
                s.state === 'todo' && 'border-2 border-ink-100 bg-paper text-ink/30',
              )}
            >
              {s.state === 'bad' ? <X className="size-4" /> : s.state === 'current' ? <Clock className="size-4" /> : s.state === 'done' ? <Check className="size-4" /> : <span className="size-1.5 rounded-full bg-current" />}
            </span>
            <div className="min-w-0 pt-1">
              <p className={cn('font-semibold leading-tight', s.state === 'todo' ? 'text-ink/40' : 'text-ink')}>{lang === 'te' ? l.te : l.en}</p>
              {s.when ? (
                <p className="mt-0.5 text-sm text-muted">
                  {fmt(s.when, lang)}
                  {g && <span className="text-muted/80"> · {g}</span>}
                </p>
              ) : s.state === 'current' ? (
                <p className="mt-0.5 text-sm text-muted">{lang === 'te' ? 'ఇప్పుడు ఇక్కడ ఉంది' : 'In progress now'}</p>
              ) : l.hint ? (
                <p className="mt-0.5 text-sm text-muted">{lang === 'te' ? l.hint.te : l.hint.en}</p>
              ) : null}
              {s.note && <p className="mt-1 inline-block rounded-md bg-amber-50 px-2 py-0.5 text-sm font-medium text-amber">{s.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function schemeLabel(app: Pick<Application, 'scheme' | 'scheme_id'>, lang: 'en' | 'te') {
  if (!app.scheme) return app.scheme_id;
  return lang === 'te' ? app.scheme.name_telugu || app.scheme.name : app.scheme.name;
}

export function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}
