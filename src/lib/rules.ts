/**
 * Eligibility rules, written so a scheme can be judged with partial answers.
 * Each check returns true (meets it), false (fails it) or undefined (we don't
 * know yet). The result is:
 *   eligible — every check true
 *   likely   — none false, some unknown (we list what to confirm)
 *   no       — at least one false (we say which)
 */
import type { FamilyProfile } from '@/lib/profile';

export type Bi = { en: string; te: string };

export interface Rule {
  /** what this rule needs, in plain words — shown when the answer is unknown */
  need: Bi;
  test: (p: FamilyProfile) => boolean | undefined;
  /** why someone fails it */
  fail: Bi;
}

export type Verdict = 'eligible' | 'likely' | 'no';
export interface Judgement {
  verdict: Verdict;
  failed: Bi[];
  confirm: Bi[];
}

export function judge(rules: Rule[], p: FamilyProfile | null): Judgement {
  const failed: Bi[] = [];
  const confirm: Bi[] = [];
  for (const r of rules) {
    const v = p ? r.test(p) : undefined;
    if (v === false) failed.push(r.fail);
    else if (v === undefined) confirm.push(r.need);
  }
  return { verdict: failed.length ? 'no' : confirm.length ? 'likely' : 'eligible', failed, confirm };
}

const has = <T,>(v: T | undefined | null): v is T => v !== undefined && v !== null && (v as unknown) !== '';

/* ── Building blocks ─────────────────────────────────────────────────────── */

export const R = {
  riceCard: (): Rule => ({
    need: { en: 'a white (BPL) rice card', te: 'తెల్ల (BPL) రేషన్ కార్డు' },
    test: (p) => p.rice_card,
    fail: { en: 'Needs a white (BPL) rice card', te: 'తెల్ల (BPL) రేషన్ కార్డు ఉండాలి' },
  }),

  /** Six-step validation used across AP welfare schemes. */
  income: (rural = 10000, urban = 12000): Rule => ({
    need: { en: `family income under ₹${rural.toLocaleString('en-IN')}/month (village) or ₹${urban.toLocaleString('en-IN')} (town)`, te: `కుటుంబ ఆదాయం నెలకు ₹${rural.toLocaleString('en-IN')} (గ్రామం) / ₹${urban.toLocaleString('en-IN')} (పట్టణం) లోపు` },
    test: (p) => (has(p.monthly_income) && has(p.area) ? p.monthly_income <= (p.area === 'urban' ? urban : rural) : undefined),
    fail: { en: `Family income is above ₹${rural.toLocaleString('en-IN')}/month (village) / ₹${urban.toLocaleString('en-IN')} (town)`, te: `కుటుంబ ఆదాయం పరిమితి (గ్రామం ₹${rural.toLocaleString('en-IN')} / పట్టణం ₹${urban.toLocaleString('en-IN')}) కంటే ఎక్కువ` },
  }),
  land: (wet = 3, dry = 10): Rule => ({
    need: { en: `land under ${wet} acres wet / ${dry} acres dry`, te: `భూమి ${wet} ఎకరాల మాగాణి / ${dry} ఎకరాల మెట్ట లోపు` },
    test: (p) => (has(p.wet_acres) && has(p.dry_acres) ? p.wet_acres <= wet && p.dry_acres <= dry && p.wet_acres + p.dry_acres <= dry : undefined),
    fail: { en: `Owns more than ${wet} acres wet or ${dry} acres dry land`, te: `${wet} ఎకరాల మాగాణి లేదా ${dry} ఎకరాల మెట్ట కంటే ఎక్కువ భూమి ఉంది` },
  }),
  electricity: (): Rule => ({
    need: { en: 'electricity use under 300 units a month', te: 'నెలకు 300 యూనిట్ల లోపు విద్యుత్ వినియోగం' },
    test: (p) => (has(p.units) ? p.units !== 'gt300' : undefined),
    fail: { en: 'Uses more than 300 units of electricity a month', te: 'నెలకు 300 యూనిట్ల కంటే ఎక్కువ విద్యుత్ వాడకం' },
  }),
  noCar: (): Rule => ({
    need: { en: 'no private four-wheeler (taxi, tractor, auto are fine)', te: 'సొంత కారు లేకపోవడం (టాక్సీ, ట్రాక్టర్, ఆటో పర్వాలేదు)' },
    test: (p) => (has(p.vehicle) ? p.vehicle !== 'private' : undefined),
    fail: { en: 'Family owns a private four-wheeler', te: 'కుటుంబానికి సొంత కారు ఉంది' },
  }),
  noGovt: (): Rule => ({
    need: { en: 'nobody in the family is a government employee or pensioner', te: 'కుటుంబంలో ప్రభుత్వ ఉద్యోగి / పింఛనుదారు లేకపోవడం' },
    test: (p) => (has(p.govt_in_family) ? !p.govt_in_family : undefined),
    fail: { en: 'Someone in the family is a government employee or pensioner', te: 'కుటుంబంలో ప్రభుత్వ ఉద్యోగి / పింఛనుదారు ఉన్నారు' },
  }),
  noTax: (): Rule => ({
    need: { en: 'nobody in the family pays income tax', te: 'కుటుంబంలో ఎవరూ ఆదాయపు పన్ను చెల్లించకపోవడం' },
    test: (p) => (has(p.income_tax) ? !p.income_tax : undefined),
    fail: { en: 'Someone in the family pays income tax', te: 'కుటుంబంలో ఆదాయపు పన్ను చెల్లించేవారు ఉన్నారు' },
  }),
  noBigProperty: (): Rule => ({
    need: { en: 'no house/property of 1,000 sq ft or more in a town', te: 'పట్టణంలో 1,000 చ.అ. లేదా ఎక్కువ ఆస్తి లేకపోవడం' },
    test: (p) => (has(p.urban_property_1000) ? !p.urban_property_1000 : undefined),
    fail: { en: 'Owns 1,000 sq ft or more of property in a town', te: 'పట్టణంలో 1,000 చ.అ. లేదా ఎక్కువ ఆస్తి ఉంది' },
  }),

  female: (): Rule => ({
    need: { en: 'a woman applicant', te: 'మహిళా దరఖాస్తుదారు' },
    test: (p) => (has(p.gender) ? p.gender === 'female' : undefined),
    fail: { en: 'Only for women', te: 'మహిళలకు మాత్రమే' },
  }),
  ageBetween: (min: number, max: number): Rule => ({
    need: { en: `age ${min}–${max}`, te: `వయసు ${min}–${max}` },
    test: (p) => (has(p.age) ? p.age >= min && p.age <= max : undefined),
    fail: { en: `Age must be ${min}–${max}`, te: `వయసు ${min}–${max} మధ్య ఉండాలి` },
  }),
  caste: (list: string[]): Rule => ({
    need: { en: `${list.join(' / ')} community`, te: `${list.join(' / ')} వర్గం` },
    test: (p) => (has(p.caste) ? list.includes(p.caste) : undefined),
    fail: { en: `Only for ${list.join(', ')}`, te: `${list.join(', ')} వారికి మాత్రమే` },
  }),
  work: (list: string[], need: Bi, fail: Bi): Rule => ({
    need,
    test: (p) => (has(p.work) ? list.includes(p.work) : undefined),
    fail,
  }),
  annualIncome: (max: number): Rule => ({
    need: { en: `family income under ₹${(max / 100000).toLocaleString('en-IN')} lakh a year`, te: `కుటుంబ ఆదాయం సంవత్సరానికి ₹${(max / 100000).toLocaleString('en-IN')} లక్షల లోపు` },
    test: (p) => (has(p.monthly_income) ? p.monthly_income * 12 <= max : undefined),
    fail: { en: `Family income is above ₹${(max / 100000).toLocaleString('en-IN')} lakh a year`, te: `కుటుంబ ఆదాయం సంవత్సరానికి ₹${(max / 100000).toLocaleString('en-IN')} లక్షలు మించింది` },
  }),
};

/** The standard AP "six-step" check, plus a white rice card. */
export function welfareBasics(opts: { riceCard?: boolean; rural?: number; urban?: number } = {}): Rule[] {
  return [
    ...(opts.riceCard === false ? [] : [R.riceCard()]),
    R.income(opts.rural, opts.urban),
    R.land(),
    R.electricity(),
    R.noCar(),
    R.noGovt(),
    R.noTax(),
    R.noBigProperty(),
  ];
}
