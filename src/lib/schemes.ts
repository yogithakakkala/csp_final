/**
 * Schemes & services, as the app sees them.
 *
 * The bundled catalogue (src/data/catalog.ts) carries the bilingual text,
 * rules and documents. The database decides what exists (applications
 * reference `schemes.id`) and lets staff override the document list or add
 * their own schemes. This file merges the two.
 */
import { useEffect, useState } from 'react';
import { CATALOG, RETIRED_IDS, type CatalogItem, type Category } from '@/data/catalog';
import { R, judge, type Bi, type Judgement, type Rule } from '@/lib/rules';
import type { FamilyProfile } from '@/lib/profile';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Scheme } from '@/types';

export interface Entry extends CatalogItem {
  /** row exists in the database, so applications can be submitted */
  inDb: boolean;
  /** added by staff — not in the bundled catalogue */
  custom: boolean;
  row?: Scheme;
}

const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x.trim() === b[i]?.trim());

function docsFor(item: CatalogItem, row?: Scheme): Bi[] {
  const db = row?.required_documents ?? [];
  if (!db.length || same(db, item.docs.map((d) => d.en))) return item.docs;
  // Staff edited the list — keep their order, reuse Telugu where the text matches.
  const te = new Map(item.docs.map((d) => [d.en.trim(), d.te]));
  return db.map((en) => ({ en, te: te.get(en.trim()) ?? en }));
}

const LEGACY_CATEGORY: Record<string, Category> = {
  Pension: 'pension', Education: 'education', Agriculture: 'farmers', Household: 'women', Transport: 'women',
  Youth: 'youth', Women: 'women', Housing: 'housing', Weavers: 'livelihood', 'SC/ST/BC': 'livelihood',
  Health: 'health', 'SC/ST': 'livelihood', BC: 'livelihood', Minority: 'family',
};

/** Staff-added scheme: turn its simple DB rules into checkable rules. */
function fromRow(row: Scheme): Entry {
  const r = row.eligibility_rules ?? {};
  const rules: Rule[] = [];
  const maxIncome = r.max_annual_income ?? r.max_income;
  if (maxIncome) rules.push(R.annualIncome(maxIncome));
  const min = r.min_age ?? r.age_min;
  const max = r.max_age ?? r.age_max;
  if (min != null || max != null) rules.push(R.ageBetween(min ?? 0, max ?? 120));
  const castes = (r.castes ?? r.caste_categories ?? []) as string[];
  if (castes.length) rules.push(R.caste(castes));
  if (r.gender_female) rules.push(R.female());
  rules.push({
    need: { en: 'staff to confirm the remaining conditions', te: 'మిగతా షరతులను సిబ్బంది నిర్ధారించాలి' },
    test: () => undefined,
    fail: { en: '', te: '' },
  });
  const isService = row.id.startsWith('svc-');
  const description = row.description ?? '';
  return {
    id: row.id,
    kind: isService ? 'service' : 'scheme',
    status: RETIRED_IDS.includes(row.id) ? 'retired' : 'active',
    category: (row.category && LEGACY_CATEGORY[row.category]) || (isService ? 'certificates' : 'family'),
    icon: row.icon || '📋',
    priority: row.priority ?? 60,
    name: { en: row.name || row.id, te: row.name_telugu || row.name || row.id },
    summary: { en: description, te: row.description_telugu || description },
    benefit: row.benefit ? { en: row.benefit, te: row.benefit_telugu || row.benefit } : undefined,
    who: [],
    docs: (row.required_documents ?? []).map((d) => ({ en: d, te: d })),
    steps: [],
    where: { en: 'Your Village / Ward Sachivalayam', te: 'మీ గ్రామ / వార్డు సచివాలయం' },
    rules,
    inDb: true,
    custom: true,
    row,
  };
}

function build(rows: Scheme[] | null): Entry[] {
  const byId = new Map((rows ?? []).map((r) => [r.id, r] as const));
  const out: Entry[] = CATALOG.filter((c) => c.status !== 'retired').map((c) => {
    const row = byId.get(c.id);
    return { ...c, docs: docsFor(c, row), inDb: rows ? !!row : true, custom: false, row };
  });
  const known = new Set(CATALOG.map((c) => c.id));
  for (const row of rows ?? []) if (!known.has(row.id)) out.push(fromRow(row));
  return out.sort((a, b) => a.priority - b.priority || a.name.en.localeCompare(b.name.en));
}

let cache: Entry[] | null = null;
let inflight: Promise<Entry[]> | null = null;
let dbOk: boolean | null = null;

/** The bundled catalogue immediately; the merged list once the DB answers. */
export function getCatalog(): Entry[] {
  return cache ?? build(null);
}

export function loadCatalog(force = false): Promise<Entry[]> {
  if (cache && !force) return Promise.resolve(cache);
  if (inflight && !force) return inflight;
  if (!isSupabaseConfigured) return Promise.resolve(getCatalog());
  inflight = (async () => {
    const { data, error } = await supabase.from('schemes').select('*');
    if (error || !data || data.length === 0) {
      dbOk = false;
      return getCatalog();
    }
    dbOk = true;
    cache = build(data as Scheme[]);
    window.dispatchEvent(new Event('sachiseva:catalog'));
    return cache;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export const catalogFromDb = () => dbOk;

export function invalidateSchemes() {
  cache = null;
}

export function findEntry(id: string): Entry | undefined {
  return getCatalog().find((e) => e.id === id);
}

/** Live catalogue for components. */
export function useCatalog(): Entry[] {
  const [list, setList] = useState<Entry[]>(getCatalog);
  useEffect(() => {
    let alive = true;
    void loadCatalog().then((l) => alive && setList(l));
    const on = () => setList(getCatalog());
    window.addEventListener('sachiseva:catalog', on);
    return () => {
      alive = false;
      window.removeEventListener('sachiseva:catalog', on);
    };
  }, []);
  return list;
}

/* ── Matching ─────────────────────────────────────────────────────────── */

export interface Match {
  entry: Entry;
  judgement: Judgement;
  benefit?: Bi;
}

export const canApply = (e: Entry) => e.inDb && (e.status === 'active' || e.status === 'seasonal');

/** Benefits used without any application (show the card, no Apply button). */
const NO_APPLICATION = new Set(['free-bus-travel']);
export const needsApplication = (e: Entry) => !NO_APPLICATION.has(e.id);
export const detailPath = (e: { id: string; kind: 'scheme' | 'service' }) => `/${e.kind === 'service' ? 'services' : 'schemes'}/${e.id}`;

/** Every scheme judged against a family profile, best matches first. */
export function matchSchemes(entries: Entry[], p: FamilyProfile | null): Match[] {
  const order = { eligible: 0, likely: 1, no: 2 } as const;
  return entries
    .filter((e) => e.kind === 'scheme' && e.status !== 'retired')
    .map((entry) => {
      const judgement = judge(entry.rules, p);
      const benefit = (p && entry.benefitFor?.(p)) || entry.benefit;
      return { entry, judgement, benefit };
    })
    .sort((a, b) => order[a.judgement.verdict] - order[b.judgement.verdict] || a.entry.priority - b.entry.priority);
}

/* ── Legacy shape (admin pages) ───────────────────────────────────────── */

export function toScheme(e: Entry): Scheme {
  return {
    ...(e.row ?? {}),
    id: e.id,
    name: e.name.en,
    name_telugu: e.name.te,
    description: e.summary.en,
    description_telugu: e.summary.te,
    required_documents: e.docs.map((d) => d.en),
    eligibility_rules: e.row?.eligibility_rules ?? {},
    icon: e.icon,
    benefit: e.benefit?.en,
    benefit_telugu: e.benefit?.te,
    priority: e.priority,
  } as Scheme;
}

export function getCachedSchemes(): Scheme[] {
  return getCatalog().map(toScheme);
}

export async function loadSchemes(force = false): Promise<Scheme[]> {
  return (await loadCatalog(force)).map(toScheme);
}
