/**
 * One document list for many schemes: "Aadhaar card", "Mother's Aadhaar card"
 * and "Aadhaar (applicant)" are the same thing to upload once.
 */
import { docKey } from '@/lib/docs';
import type { Bi } from '@/lib/rules';
import type { Entry } from '@/lib/schemes';

const CANON: Record<string, Bi> = {
  aadhaar: { en: 'Aadhaar card', te: 'ఆధార్ కార్డు' },
  ration: { en: 'Rice card (white / BPL)', te: 'రేషన్ కార్డు (తెల్ల / BPL)' },
  bank: { en: 'Bank passbook (Aadhaar-linked)', te: 'బ్యాంకు పాస్‌బుక్ (ఆధార్ లింక్)' },
  photo: { en: 'Passport-size photo', te: 'పాస్‌పోర్ట్ సైజు ఫోటో' },
  income: { en: 'Income certificate', te: 'ఆదాయ ధృవపత్రం' },
  caste: { en: 'Caste certificate', te: 'కుల ధృవపత్రం' },
  residence: { en: 'Residence proof', te: 'నివాస రుజువు' },
  birth: { en: 'Age proof (SSC memo / birth certificate)', te: 'వయసు రుజువు (SSC మెమో / జనన ధృవపత్రం)' },
  land: { en: 'Pattadar passbook / land records', te: 'పట్టాదార్ పాస్‌బుక్ / భూ రికార్డులు' },
  disability: { en: 'SADAREM disability certificate', te: 'సదరం వైకల్య ధృవపత్రం' },
  death: { en: 'Death certificate', te: 'మరణ ధృవపత్రం' },
  marriage: { en: 'Marriage certificate', te: 'వివాహ ధృవపత్రం' },
  mobile: { en: 'Mobile number linked to Aadhaar', te: 'ఆధార్‌తో లింక్ అయిన మొబైల్ నంబర్' },
};

/** Things to have with you, not files to upload. */
export const INFO_ONLY = new Set(['mobile']);

export interface CombinedDoc {
  key: string;
  label: Bi;
  /** the exact names each scheme uses, so applications keep their own wording */
  names: { entryId: string; doc: Bi }[];
  /** "(if applicable)" style documents that only some applicants need */
  conditional: boolean;
}

const CONDITIONAL = /\((?:if|for|when|disability|widow|tenant|dialysis|bpl)|— tenant|if applicable/i;

export function combineDocs(entries: Entry[]): CombinedDoc[] {
  const map = new Map<string, CombinedDoc>();
  for (const e of entries) {
    for (const d of e.docs) {
      const key = docKey(d.en);
      const cond = CONDITIONAL.test(d.en);
      const cur = map.get(key);
      if (cur) {
        cur.names.push({ entryId: e.id, doc: d });
        cur.conditional = cur.conditional && cond;
      } else {
        map.set(key, { key, label: CANON[key] ?? d, names: [{ entryId: e.id, doc: d }], conditional: cond });
      }
    }
  }
  // Most-shared documents first; "if applicable" ones last.
  return [...map.values()].sort(
    (a, b) => Number(a.conditional) - Number(b.conditional) || new Set(b.names.map((n) => n.entryId)).size - new Set(a.names.map((n) => n.entryId)).size,
  );
}
