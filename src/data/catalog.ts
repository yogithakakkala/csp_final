/**
 * SachiSeva catalogue — every welfare scheme and Sachivalayam service the app
 * knows about, in English and Telugu, with who qualifies, documents, how and
 * where to apply, and machine-checkable rules.
 *
 * Sources (checked October 2026): AP Grama/Ward Sachivalayam services guide
 * (fees and time limits for services), state scheme guidelines as reported by
 * Deccan Chronicle, The Week, The Hans India, Telugu Post and Vikaspedia. Scheme
 * rules change; every page tells citizens that Sachivalayam staff make the final
 * decision. Update this file when a G.O. changes something.
 *
 * `id`s must match rows in the `schemes` table (applications reference them).
 */
import { R, welfareBasics, type Bi, type Rule } from '@/lib/rules';
import type { FamilyProfile } from '@/lib/profile';

export type Kind = 'scheme' | 'service';
export type Status = 'active' | 'seasonal' | 'announced' | 'retired';
export type Category =
  | 'pension' | 'women' | 'education' | 'farmers' | 'health' | 'housing' | 'livelihood' | 'youth' | 'family'
  | 'certificates' | 'ration' | 'land' | 'civil' | 'utilities';

export interface CatalogItem {
  id: string;
  kind: Kind;
  status: Status;
  category: Category;
  icon: string;
  /** lower = shown first */
  priority: number;
  name: Bi;
  summary: Bi;
  benefit?: Bi;
  /** personalised benefit, e.g. pension amount or ₹15,000 × children */
  benefitFor?: (p: FamilyProfile) => Bi | undefined;
  who: Bi[];
  docs: Bi[];
  steps: Bi[];
  where: Bi;
  fee?: Bi;
  time?: Bi;
  links?: { label: Bi; url: string }[];
  rules: Rule[];
  note?: Bi;
}

export const CATEGORY: Record<Category, Bi & { kind: Kind }> = {
  pension: { en: 'Pensions', te: 'పింఛన్లు', kind: 'scheme' },
  women: { en: 'Women', te: 'మహిళలు', kind: 'scheme' },
  education: { en: 'Education', te: 'విద్య', kind: 'scheme' },
  farmers: { en: 'Farmers', te: 'రైతులు', kind: 'scheme' },
  health: { en: 'Health', te: 'ఆరోగ్యం', kind: 'scheme' },
  housing: { en: 'Housing', te: 'గృహనిర్మాణం', kind: 'scheme' },
  livelihood: { en: 'Workers & livelihood', te: 'కార్మికులు & జీవనోపాధి', kind: 'scheme' },
  youth: { en: 'Youth & jobs', te: 'యువత & ఉద్యోగాలు', kind: 'scheme' },
  family: { en: 'Family & marriage', te: 'కుటుంబం & వివాహం', kind: 'scheme' },
  certificates: { en: 'Certificates', te: 'ధృవపత్రాలు', kind: 'service' },
  ration: { en: 'Rice card', te: 'రేషన్ కార్డు', kind: 'service' },
  land: { en: 'Land & property', te: 'భూమి & ఆస్తి', kind: 'service' },
  civil: { en: 'Birth, death & marriage', te: 'జననం, మరణం & వివాహం', kind: 'service' },
  utilities: { en: 'Electricity, water & health card', te: 'విద్యుత్, నీరు & హెల్త్ కార్డు', kind: 'service' },
};

export const STATUS_LABEL: Record<Status, Bi> = {
  active: { en: 'Open', te: 'అమలులో ఉంది' },
  seasonal: { en: 'Opens in rounds', te: 'దశలవారీగా తెరుస్తారు' },
  announced: { en: 'Announced — not open yet', te: 'ప్రకటించారు — ఇంకా ప్రారంభం కాలేదు' },
  retired: { en: 'Closed', te: 'మూసివేశారు' },
};

/* ── Shared text ─────────────────────────────────────────────────────────── */

const D = {
  aadhaar: { en: 'Aadhaar card', te: 'ఆధార్ కార్డు' },
  riceCard: { en: 'Rice card (white / BPL)', te: 'రేషన్ కార్డు (తెల్ల / BPL)' },
  bank: { en: 'Bank passbook (account linked to Aadhaar)', te: 'బ్యాంకు పాస్‌బుక్ (ఆధార్‌తో లింక్ అయిన ఖాతా)' },
  photo: { en: 'Passport-size photo', te: 'పాస్‌పోర్ట్ సైజు ఫోటో' },
  mobile: { en: 'Mobile number linked to Aadhaar', te: 'ఆధార్‌తో లింక్ అయిన మొబైల్ నంబర్' },
  income: { en: 'Income certificate', te: 'ఆదాయ ధృవపత్రం' },
  caste: { en: 'Caste certificate', te: 'కుల ధృవపత్రం' },
  residence: { en: 'Residence proof', te: 'నివాస రుజువు' },
  age: { en: 'Age proof (SSC memo / birth certificate)', te: 'వయసు రుజువు (SSC మెమో / జనన ధృవపత్రం)' },
  land: { en: 'Pattadar passbook / land records (1-B, Adangal)', te: 'పట్టాదార్ పాస్‌బుక్ / భూ రికార్డులు (1-బి, అడంగల్)' },
};

const atSachivalayam: Bi = { en: 'Your Village / Ward Sachivalayam (Welfare & Education Assistant / Digital Assistant)', te: 'మీ గ్రామ / వార్డు సచివాలయం (సంక్షేమ & విద్యా సహాయకులు / డిజిటల్ అసిస్టెంట్)' };
const atSachOrMeeSeva: Bi = { en: 'Your Village / Ward Sachivalayam or any MeeSeva centre', te: 'మీ గ్రామ / వార్డు సచివాలయం లేదా ఏదైనా మీసేవ కేంద్రం' };

const applySteps = (extra?: Bi): Bi[] => [
  { en: 'Keep the documents below ready (photos on your phone are fine for SachiSeva).', te: 'కింది పత్రాలు సిద్ధంగా ఉంచుకోండి (సచిసేవ కోసం ఫోన్ ఫోటోలు చాలు).' },
  { en: 'Apply here in SachiSeva, or visit your Sachivalayam with the originals.', te: 'ఇక్కడ సచిసేవలో దరఖాస్తు చేయండి, లేదా అసలు పత్రాలతో మీ సచివాలయానికి వెళ్లండి.' },
  ...(extra ? [extra] : []),
  { en: 'Staff verify your details (eKYC / field visit) and approve.', te: 'సిబ్బంది మీ వివరాలు ధృవీకరించి (eKYC / క్షేత్ర పరిశీలన) ఆమోదిస్తారు.' },
  { en: 'Money is paid straight into your Aadhaar-linked bank account (DBT).', te: 'డబ్బు నేరుగా మీ ఆధార్ లింక్ బ్యాంకు ఖాతాలో జమ అవుతుంది (DBT).' },
];

const serviceSteps: Bi[] = [
  { en: 'Request it here in SachiSeva with photos of the documents — or walk in to your Sachivalayam / MeeSeva.', te: 'పత్రాల ఫోటోలతో ఇక్కడ సచిసేవలో అభ్యర్థించండి — లేదా సచివాలయం / మీసేవకు వెళ్లండి.' },
  { en: 'Pay the service fee at the counter and keep the receipt number.', te: 'కౌంటర్‌లో సేవా రుసుము చెల్లించి రసీదు నంబర్ ఉంచుకోండి.' },
  { en: 'Staff verify; you get a message here when it is ready.', te: 'సిబ్బంది ధృవీకరిస్తారు; సిద్ధమైనప్పుడు ఇక్కడ సందేశం వస్తుంది.' },
  { en: 'Collect it or download the e-certificate.', te: 'దాన్ని తీసుకోండి లేదా ఇ-సర్టిఫికేట్ డౌన్‌లోడ్ చేసుకోండి.' },
];

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/* ── Pension amounts by category ─────────────────────────────────────────── */

function pensionFor(p: FamilyProfile): { amount: number; label: Bi } | undefined {
  if (p.disability === 'bedridden' || p.disability === '80_plus') return { amount: 15000, label: { en: 'fully disabled / bedridden', te: 'పూర్తి వికలాంగులు / మంచానికే పరిమితం' } };
  if (p.chronic_illness) return { amount: 10000, label: { en: 'chronic illness (dialysis, thalassemia, CKDU)', te: 'దీర్ఘకాలిక వ్యాధి (డయాలసిస్, తలసేమియా, CKDU)' } };
  if (p.disability === '40_79') return { amount: 6000, label: { en: 'disability 40% or more', te: '40% లేదా ఎక్కువ వైకల్యం' } };
  if (p.age != null && p.age >= 60) return { amount: 4000, label: { en: 'old age (60+)', te: 'వృద్ధాప్యం (60+)' } };
  if (p.marital === 'widow') return { amount: 4000, label: { en: 'widow', te: 'వితంతువు' } };
  if (p.gender === 'transgender') return { amount: 4000, label: { en: 'transgender', te: 'ట్రాన్స్‌జెండర్' } };
  if (p.work === 'weaver' && (p.age ?? 0) >= 50) return { amount: 4000, label: { en: 'weaver (50+)', te: 'నేతన్న (50+)' } };
  if (p.work === 'fisherman' && (p.age ?? 0) >= 50) return { amount: 4000, label: { en: 'fisherman (50+)', te: 'మత్స్యకారుడు (50+)' } };
  if (p.work === 'toddy_tapper' && (p.age ?? 0) >= 50) return { amount: 4000, label: { en: 'toddy tapper (50+)', te: 'కల్లు గీత కార్మికుడు (50+)' } };
  if (p.marital === 'single_woman' && (p.age ?? 0) >= 30) return { amount: 4000, label: { en: 'single woman', te: 'ఒంటరి మహిళ' } };
  return undefined;
}

/* ── Catalogue ───────────────────────────────────────────────────────────── */

export const CATALOG: CatalogItem[] = [
  // ════════════════ SCHEMES ════════════════
  {
    id: 'ntr-bharosa-pension',
    kind: 'scheme',
    status: 'active',
    category: 'pension',
    icon: '👵',
    priority: 1,
    name: { en: 'NTR Bharosa Pension', te: 'ఎన్టీఆర్ భరోసా పింఛన్' },
    summary: { en: 'Monthly pension for the elderly, widows, people with disabilities or chronic illness, and other vulnerable groups — paid on the 1st of every month.', te: 'వృద్ధులు, వితంతువులు, వికలాంగులు, దీర్ఘకాలిక రోగులు మరియు ఇతర బలహీన వర్గాలకు నెలవారీ పింఛన్ — ప్రతి నెల 1వ తేదీన.' },
    benefit: { en: '₹4,000 – ₹15,000 a month', te: 'నెలకు ₹4,000 – ₹15,000' },
    benefitFor: (p) => {
      const x = pensionFor(p);
      return x && { en: `${inr(x.amount)}/month (${x.label.en})`, te: `నెలకు ${inr(x.amount)} (${x.label.te})` };
    },
    who: [
      { en: 'Old age 60+, widows, transgender persons: ₹4,000', te: '60+ వృద్ధులు, వితంతువులు, ట్రాన్స్‌జెండర్లు: ₹4,000' },
      { en: 'Weavers, fishermen, toddy tappers (50+), single women: ₹4,000', te: 'నేతన్నలు, మత్స్యకారులు, కల్లు గీత కార్మికులు (50+), ఒంటరి మహిళలు: ₹4,000' },
      { en: 'Disability 40%+ (SADAREM certificate): ₹6,000', te: '40%+ వైకల్యం (సదరం ధృవపత్రం): ₹6,000' },
      { en: 'Dialysis, thalassemia, CKDU patients: ₹10,000', te: 'డయాలసిస్, తలసేమియా, CKDU రోగులు: ₹10,000' },
      { en: 'Fully disabled or bedridden: ₹15,000', te: 'పూర్తి వికలాంగులు / మంచానికే పరిమితమైనవారు: ₹15,000' },
      { en: 'White rice card and the six-step family check (income, land, electricity, vehicle, govt job, income tax, property)', te: 'తెల్ల రేషన్ కార్డు మరియు ఆరు అంచెల కుటుంబ పరిశీలన (ఆదాయం, భూమి, విద్యుత్, వాహనం, ప్రభుత్వ ఉద్యోగం, ఆదాయపు పన్ను, ఆస్తి)' },
    ],
    docs: [D.aadhaar, D.riceCard, D.bank, D.photo, D.age, { en: 'SADAREM disability certificate (disability pension)', te: 'సదరం వైకల్య ధృవపత్రం (వికలాంగ పింఛన్)' }, { en: "Husband's death certificate (widow pension)", te: 'భర్త మరణ ధృవపత్రం (వితంతు పింఛన్)' }, { en: 'Medical certificate (dialysis / thalassemia / CKDU)', te: 'వైద్య ధృవపత్రం (డయాలసిస్ / తలసేమియా / CKDU)' }],
    steps: [
      ...applySteps(),
      { en: 'Pension is handed over at home by Sachivalayam staff on the 1st of each month.', te: 'ప్రతి నెల 1వ తేదీన సచివాలయ సిబ్బంది ఇంటి వద్దే పింఛన్ అందజేస్తారు.' },
    ],
    where: atSachivalayam,
    links: [{ label: { en: 'Check pension status', te: 'పింఛన్ స్థితి చూడండి' }, url: 'https://sspensions.ap.gov.in' }],
    rules: [
      {
        need: { en: 'a pension category (60+, widow, disability, chronic illness, weaver/fisherman 50+…)', te: 'పింఛన్ వర్గం (60+, వితంతువు, వైకల్యం, దీర్ఘకాలిక వ్యాధి, నేతన్న/మత్స్యకారుడు 50+…)' },
        test: (p) => (pensionFor(p) ? true : p.age == null && p.marital == null && p.disability == null ? undefined : false),
        fail: { en: 'Not in a pension category (60+, widow, disability 40%+, chronic illness, weaver/fisherman 50+…)', te: 'పింఛన్ వర్గంలో లేరు (60+, వితంతువు, 40%+ వైకల్యం, దీర్ఘకాలిక వ్యాధి…)' },
      },
      {
        need: { en: 'no other social security pension already', te: 'ఇప్పటికే మరో పింఛన్ లేకపోవడం' },
        test: (p) => (p.other_pension == null ? undefined : !p.other_pension),
        fail: { en: 'Already gets a social security pension', te: 'ఇప్పటికే సామాజిక భద్రత పింఛన్ వస్తోంది' },
      },
      ...welfareBasics(),
    ],
  },
  {
    id: 'talliki-vandanam',
    kind: 'scheme',
    status: 'active',
    category: 'education',
    icon: '👩‍👧',
    priority: 2,
    name: { en: 'Talliki Vandanam', te: 'తల్లికి వందనం' },
    summary: { en: "₹15,000 a year to the mother for every child studying in Class 1 to 12 (government or private school / junior college).", te: '1 నుండి 12వ తరగతి చదువుతున్న ప్రతి బిడ్డకు తల్లికి సంవత్సరానికి ₹15,000 (ప్రభుత్వ లేదా ప్రైవేట్ పాఠశాల / జూనియర్ కళాశాల).' },
    benefit: { en: '₹15,000 a year per school-going child', te: 'పాఠశాలకు వెళ్ళే ప్రతి బిడ్డకు సంవత్సరానికి ₹15,000' },
    benefitFor: (p) => (p.school_children ? { en: `${inr(15000 * p.school_children)} a year (${p.school_children} × ₹15,000)`, te: `సంవత్సరానికి ${inr(15000 * p.school_children)} (${p.school_children} × ₹15,000)` } : undefined),
    who: [
      { en: 'Mothers (or guardians) of children in Class 1–12 in a recognised school or junior college', te: 'గుర్తింపు పొందిన పాఠశాల / జూనియర్ కళాశాలలో 1–12 తరగతి పిల్లల తల్లులు (లేదా సంరక్షకులు)' },
      { en: 'Every child in the family counts — no limit on number of children', te: 'కుటుంబంలోని ప్రతి బిడ్డకూ వర్తిస్తుంది — పిల్లల సంఖ్యపై పరిమితి లేదు' },
      { en: 'Child needs 75% attendance to continue next year', te: 'తర్వాతి సంవత్సరం కొనసాగడానికి బిడ్డకు 75% హాజరు ఉండాలి' },
      { en: 'Rice card and six-step check: income up to ₹10,000/month (village) or ₹12,000 (town), land, electricity under 300 units, no car, no govt job, no income tax, town property under 1,000 sq ft', te: 'రేషన్ కార్డు మరియు ఆరు అంచెల పరిశీలన: ఆదాయం నెలకు ₹10,000 (గ్రామం) / ₹12,000 (పట్టణం) లోపు, భూమి, 300 యూనిట్ల లోపు విద్యుత్, కారు లేకపోవడం, ప్రభుత్వ ఉద్యోగం లేకపోవడం, ఆదాయపు పన్ను లేకపోవడం, పట్టణంలో 1,000 చ.అ. లోపు ఆస్తి' },
      { en: 'ITI, polytechnic and degree students are not covered (they get fee reimbursement)', te: 'ITI, పాలిటెక్నిక్, డిగ్రీ విద్యార్థులకు వర్తించదు (వారికి ఫీజు రీయింబర్స్‌మెంట్)' },
    ],
    docs: [{ en: "Mother's Aadhaar card", te: 'తల్లి ఆధార్ కార్డు' }, { en: "Child's Aadhaar card", te: 'బిడ్డ ఆధార్ కార్డు' }, { en: 'School / college study certificate', te: 'పాఠశాల / కళాశాల స్టడీ సర్టిఫికేట్' }, { en: "Mother's bank passbook (Aadhaar-linked, NPCI-mapped)", te: 'తల్లి బ్యాంకు పాస్‌బుక్ (ఆధార్ లింక్, NPCI మ్యాప్ అయినది)' }, D.riceCard],
    steps: applySteps({ en: 'Most children are added automatically from school records — check the eligible list at your Sachivalayam and complain if a child is missing.', te: 'చాలా మంది పిల్లలు పాఠశాల రికార్డుల నుండి ఆటోమేటిక్‌గా చేర్చబడతారు — సచివాలయంలో అర్హుల జాబితా చూసి, బిడ్డ పేరు లేకపోతే ఫిర్యాదు చేయండి.' }),
    where: atSachivalayam,
    rules: [
      {
        need: { en: 'a child studying in Class 1–12', te: '1–12 తరగతి చదువుతున్న బిడ్డ' },
        test: (p) => (p.school_children == null ? undefined : p.school_children > 0),
        fail: { en: 'No child studying in Class 1–12', te: '1–12 తరగతి చదువుతున్న పిల్లలు లేరు' },
      },
      ...welfareBasics(),
    ],
  },
  {
    id: 'annadata-sukhibhava',
    kind: 'scheme',
    status: 'active',
    category: 'farmers',
    icon: '🌾',
    priority: 3,
    name: { en: 'Annadata Sukhibhava', te: 'అన్నదాత సుఖీభవ' },
    summary: { en: '₹20,000 a year investment support for farmer families — ₹14,000 from the State plus ₹6,000 PM-Kisan — paid in instalments.', te: 'రైతు కుటుంబాలకు సంవత్సరానికి ₹20,000 పెట్టుబడి సాయం — రాష్ట్రం ₹14,000 + పీఎం-కిసాన్ ₹6,000 — విడతలుగా.' },
    benefit: { en: '₹20,000 a year', te: 'సంవత్సరానికి ₹20,000' },
    benefitFor: (p) => (p.work === 'farmer_tenant' ? { en: '₹14,000 a year (State share for tenant farmers)', te: 'సంవత్సరానికి ₹14,000 (కౌలు రైతులకు రాష్ట్ర వాటా)' } : undefined),
    who: [
      { en: 'Land-owning farmers and landless tenant farmers (with a tenancy / CCRC card)', te: 'భూ యజమాని రైతులు మరియు భూమిలేని కౌలు రైతులు (కౌలు / CCRC కార్డుతో)' },
      { en: 'One farmer per family', te: 'కుటుంబానికి ఒక్క రైతు' },
      { en: 'Not for income-tax payers or government employees / pensioners', te: 'ఆదాయపు పన్ను చెల్లింపుదారులు, ప్రభుత్వ ఉద్యోగులు / పింఛనుదారులకు కాదు' },
    ],
    docs: [D.aadhaar, D.land, { en: 'Tenancy (CCRC) card — tenant farmers', te: 'కౌలు (CCRC) కార్డు — కౌలు రైతులు' }, D.bank, D.mobile],
    steps: applySteps({ en: 'Farmers already in PM-Kisan / e-crop booking usually need not apply again — confirm with your Village Agriculture Assistant.', te: 'పీఎం-కిసాన్ / ఈ-క్రాప్ నమోదులో ఉన్న రైతులు మళ్లీ దరఖాస్తు చేయనవసరం లేదు — గ్రామ వ్యవసాయ సహాయకుడితో నిర్ధారించుకోండి.' }),
    where: { en: 'Village Agriculture Assistant at your Sachivalayam / Rythu Seva Kendram', te: 'సచివాలయం / రైతు సేవా కేంద్రంలో గ్రామ వ్యవసాయ సహాయకుడు' },
    links: [{ label: { en: 'Annadata Sukhibhava portal', te: 'అన్నదాత సుఖీభవ పోర్టల్' }, url: 'https://annadathasukhibhava.ap.gov.in' }],
    rules: [
      R.work(['farmer_owner', 'farmer_tenant'], { en: 'farming as your main work (owner or tenant)', te: 'వ్యవసాయం ప్రధాన పని (యజమాని లేదా కౌలు)' }, { en: 'Only for farmers (owners or tenants)', te: 'రైతులకు (యజమాని / కౌలు) మాత్రమే' }),
      R.noTax(),
      R.noGovt(),
    ],
  },
  {
    id: 'deepam-2',
    kind: 'scheme',
    status: 'active',
    category: 'women',
    icon: '🔥',
    priority: 4,
    name: { en: 'Deepam 2.0 — free gas cylinders', te: 'దీపం 2.0 — ఉచిత గ్యాస్ సిలిండర్లు' },
    summary: { en: 'Three free LPG cylinder refills a year (one every four months). You pay at delivery and the full amount comes back to your bank account.', te: 'సంవత్సరానికి మూడు ఉచిత LPG సిలిండర్లు (ప్రతి నాలుగు నెలలకు ఒకటి). డెలివరీ సమయంలో చెల్లిస్తే, మొత్తం డబ్బు మీ బ్యాంకు ఖాతాకు తిరిగి వస్తుంది.' },
    benefit: { en: '3 free cylinders a year', te: 'సంవత్సరానికి 3 ఉచిత సిలిండర్లు' },
    who: [
      { en: 'Families with a white rice card', te: 'తెల్ల రేషన్ కార్డు ఉన్న కుటుంబాలు' },
      { en: 'An LPG connection in a family member’s name, with Aadhaar eKYC done at your gas agency', te: 'కుటుంబ సభ్యుని పేరిట గ్యాస్ కనెక్షన్, గ్యాస్ ఏజెన్సీలో ఆధార్ eKYC పూర్తి అయి ఉండాలి' },
      { en: 'One connection per family', te: 'కుటుంబానికి ఒక్క కనెక్షన్' },
    ],
    docs: [D.aadhaar, D.riceCard, { en: 'LPG consumer number / gas book', te: 'గ్యాస్ కన్స్యూమర్ నంబర్ / గ్యాస్ బుక్' }, D.bank],
    steps: [
      { en: 'Make sure Aadhaar eKYC is done at your gas agency and your bank account is Aadhaar-linked.', te: 'మీ గ్యాస్ ఏజెన్సీలో ఆధార్ eKYC పూర్తయిందని, బ్యాంకు ఖాతా ఆధార్‌తో లింక్ అయిందని నిర్ధారించుకోండి.' },
      { en: 'Book the cylinder as usual (IVRS / app / agency). One free refill in each four-month period.', te: 'ఎప్పటిలాగే సిలిండర్ బుక్ చేయండి (IVRS / యాప్ / ఏజెన్సీ). ప్రతి నాలుగు నెలలకు ఒక ఉచిత రీఫిల్.' },
      { en: 'Pay at delivery — the amount is credited back within about 48 hours.', te: 'డెలివరీ సమయంలో చెల్లించండి — సుమారు 48 గంటల్లో డబ్బు తిరిగి జమ అవుతుంది.' },
      { en: 'Not credited? Raise it at your Sachivalayam or here in SachiSeva.', te: 'జమ కాలేదా? సచివాలయంలో లేదా ఇక్కడ సచిసేవలో ఫిర్యాదు చేయండి.' },
    ],
    where: { en: 'Your gas agency (booking) · Sachivalayam (problems)', te: 'మీ గ్యాస్ ఏజెన్సీ (బుకింగ్) · సచివాలయం (సమస్యలు)' },
    rules: [
      R.riceCard(),
      {
        need: { en: 'an LPG gas connection', te: 'LPG గ్యాస్ కనెక్షన్' },
        test: (p) => p.lpg,
        fail: { en: 'Needs an LPG connection first (apply at a gas agency / PM Ujjwala)', te: 'ముందుగా గ్యాస్ కనెక్షన్ కావాలి (గ్యాస్ ఏజెన్సీ / పీఎం ఉజ్వల)' },
      },
    ],
  },
  {
    id: 'free-bus-travel',
    kind: 'scheme',
    status: 'active',
    category: 'women',
    icon: '🚌',
    priority: 5,
    name: { en: 'Stree Shakti — free bus travel', te: 'స్త్రీ శక్తి — ఉచిత బస్సు ప్రయాణం' },
    summary: { en: 'Free travel for girls, women and transgender persons of Andhra Pradesh in APSRTC Palle Velugu, Ultra Palle Velugu, City Ordinary, Metro Express and Express buses anywhere in the State.', te: 'ఆంధ్రప్రదేశ్ బాలికలు, మహిళలు, ట్రాన్స్‌జెండర్లకు రాష్ట్రంలో ఎక్కడైనా APSRTC పల్లె వెలుగు, అల్ట్రా పల్లె వెలుగు, సిటీ ఆర్డినరీ, మెట్రో ఎక్స్‌ప్రెస్, ఎక్స్‌ప్రెస్ బస్సుల్లో ఉచిత ప్రయాణం.' },
    benefit: { en: 'Free bus travel', te: 'ఉచిత బస్సు ప్రయాణం' },
    who: [
      { en: 'All girls, women and transgender persons living in Andhra Pradesh — no income limit', te: 'ఆంధ్రప్రదేశ్‌లో నివసించే బాలికలు, మహిళలు, ట్రాన్స్‌జెండర్లందరూ — ఆదాయ పరిమితి లేదు' },
      { en: 'Not valid in AC, Super Luxury, Ultra Deluxe, Saptagiri Express, non-stop or interstate buses', te: 'AC, సూపర్ లగ్జరీ, అల్ట్రా డీలక్స్, సప్తగిరి ఎక్స్‌ప్రెస్, నాన్-స్టాప్, అంతర్రాష్ట్ర బస్సుల్లో వర్తించదు' },
    ],
    docs: [{ en: 'Any valid photo ID showing an AP address (Aadhaar, voter ID, ration card)', te: 'AP చిరునామాతో ఏదైనా ఫోటో గుర్తింపు కార్డు (ఆధార్, ఓటర్ ఐడీ, రేషన్ కార్డు)' }],
    steps: [
      { en: 'No application needed. Show your ID to the conductor and take a zero-fare ticket.', te: 'దరఖాస్తు అవసరం లేదు. కండక్టర్‌కు గుర్తింపు కార్డు చూపించి జీరో-ఫేర్ టికెట్ తీసుకోండి.' },
    ],
    where: { en: 'On the bus — no application', te: 'బస్సులోనే — దరఖాస్తు అవసరం లేదు' },
    rules: [
      {
        need: { en: 'a woman, girl or transgender person', te: 'మహిళ, బాలిక లేదా ట్రాన్స్‌జెండర్' },
        test: (p) => (p.gender == null ? undefined : p.gender !== 'male'),
        fail: { en: 'For girls, women and transgender persons', te: 'బాలికలు, మహిళలు, ట్రాన్స్‌జెండర్లకు మాత్రమే' },
      },
    ],
  },
  {
    id: 'ntr-arogya-seva',
    kind: 'scheme',
    status: 'active',
    category: 'health',
    icon: '🏥',
    priority: 6,
    name: { en: 'Dr NTR Vaidya Seva (Aarogyasri)', te: 'డాక్టర్ ఎన్టీఆర్ వైద్య సేవ (ఆరోగ్యశ్రీ)' },
    summary: { en: 'Cashless treatment in network hospitals for thousands of procedures. Rice-card families are covered up to ₹25 lakh; the State is extending cover to all families under its Universal Health Policy.', te: 'నెట్‌వర్క్ ఆసుపత్రుల్లో వేలాది చికిత్సలకు నగదు రహిత వైద్యం. రేషన్ కార్డు కుటుంబాలకు ₹25 లక్షల వరకు; సార్వత్రిక ఆరోగ్య విధానం ద్వారా అన్ని కుటుంబాలకు విస్తరిస్తోంది.' },
    benefit: { en: 'Free treatment up to ₹25 lakh', te: '₹25 లక్షల వరకు ఉచిత వైద్యం' },
    who: [
      { en: 'Families with a white rice card (and a Vaidya Seva / Aarogyasri health card)', te: 'తెల్ల రేషన్ కార్డు కుటుంబాలు (వైద్య సేవ / ఆరోగ్యశ్రీ హెల్త్ కార్డుతో)' },
      { en: 'Other families: cover under the new Universal Health Policy is being rolled out — ask at your Sachivalayam', te: 'ఇతర కుటుంబాలు: కొత్త సార్వత్రిక ఆరోగ్య విధానం అమలవుతోంది — సచివాలయంలో అడగండి' },
    ],
    docs: [D.aadhaar, D.riceCard, { en: 'Vaidya Seva / Aarogyasri health card (see Services)', te: 'వైద్య సేవ / ఆరోగ్యశ్రీ హెల్త్ కార్డు (సేవలు చూడండి)' }, { en: 'Referral from a doctor / PHC (for treatment)', te: 'డాక్టర్ / PHC రిఫరల్ (చికిత్స కోసం)' }],
    steps: [
      { en: 'Get a health card at your Sachivalayam if you do not have one (see the Health card service).', te: 'హెల్త్ కార్డు లేకపోతే సచివాలయంలో పొందండి (హెల్త్ కార్డు సేవ చూడండి).' },
      { en: 'At a network hospital, go to the Aarogyamitra desk with the card and Aadhaar.', te: 'నెట్‌వర్క్ ఆసుపత్రిలో కార్డు, ఆధార్‌తో ఆరోగ్యమిత్ర డెస్క్‌కు వెళ్లండి.' },
      { en: 'Treatment is approved and given without paying.', te: 'చికిత్స ఆమోదించి, డబ్బు చెల్లించకుండానే అందిస్తారు.' },
    ],
    where: { en: 'Network hospitals (Aarogyamitra desk) · health card at Sachivalayam', te: 'నెట్‌వర్క్ ఆసుపత్రులు (ఆరోగ్యమిత్ర డెస్క్) · హెల్త్ కార్డు సచివాలయంలో' },
    links: [{ label: { en: 'Find network hospitals', te: 'నెట్‌వర్క్ ఆసుపత్రులు' }, url: 'https://drntrvaidyaseva.ap.gov.in' }],
    rules: [R.riceCard()],
  },
  {
    id: 'pm-kisan',
    kind: 'scheme',
    status: 'active',
    category: 'farmers',
    icon: '🚜',
    priority: 12,
    name: { en: 'PM-Kisan Samman Nidhi', te: 'పీఎం-కిసాన్ సమ్మాన్ నిధి' },
    summary: { en: 'Central support of ₹6,000 a year to land-owning farmer families in three instalments of ₹2,000. In AP it is paid together with Annadata Sukhibhava.', te: 'భూమి ఉన్న రైతు కుటుంబాలకు కేంద్రం సంవత్సరానికి ₹6,000 — మూడు విడతలుగా ₹2,000. AP లో అన్నదాత సుఖీభవతో కలిసి వస్తుంది.' },
    benefit: { en: '₹6,000 a year', te: 'సంవత్సరానికి ₹6,000' },
    who: [
      { en: 'Families owning cultivable land in their name', te: 'తమ పేరిట సాగు భూమి ఉన్న కుటుంబాలు' },
      { en: 'Not for income-tax payers, government employees, or pensioners getting ₹10,000+/month', te: 'ఆదాయపు పన్ను చెల్లింపుదారులు, ప్రభుత్వ ఉద్యోగులు, ₹10,000+ పింఛనుదారులకు కాదు' },
      { en: 'eKYC and Aadhaar-seeded bank account are mandatory', te: 'eKYC మరియు ఆధార్ లింక్ బ్యాంకు ఖాతా తప్పనిసరి' },
    ],
    docs: [D.aadhaar, D.land, D.bank, D.mobile],
    steps: [
      { en: 'Register at pmkisan.gov.in (Farmer Corner → New Farmer Registration) or through your Village Agriculture Assistant.', te: 'pmkisan.gov.in లో (Farmer Corner → New Farmer Registration) లేదా గ్రామ వ్యవసాయ సహాయకుడి ద్వారా నమోదు చేయండి.' },
      { en: 'Complete eKYC (OTP or biometric).', te: 'eKYC పూర్తి చేయండి (OTP లేదా బయోమెట్రిక్).' },
      { en: 'Land records are verified and instalments start.', te: 'భూ రికార్డులు ధృవీకరించిన తర్వాత విడతలు మొదలవుతాయి.' },
    ],
    where: { en: 'pmkisan.gov.in · Village Agriculture Assistant', te: 'pmkisan.gov.in · గ్రామ వ్యవసాయ సహాయకుడు' },
    links: [{ label: { en: 'PM-Kisan portal', te: 'పీఎం-కిసాన్ పోర్టల్' }, url: 'https://pmkisan.gov.in' }],
    rules: [
      R.work(['farmer_owner'], { en: 'farm land in your name', te: 'మీ పేరిట వ్యవసాయ భూమి' }, { en: 'Only for farmers who own land', te: 'భూమి ఉన్న రైతులకు మాత్రమే' }),
      R.noTax(),
      R.noGovt(),
    ],
  },
  {
    id: 'auto-driver-sevalo',
    kind: 'scheme',
    status: 'active',
    category: 'livelihood',
    icon: '🛺',
    priority: 8,
    name: { en: 'Auto Driver Sevalo (Vahana Mitra)', te: 'ఆటో డ్రైవర్ల సేవలో (వాహన మిత్ర)' },
    summary: { en: '₹15,000 a year to auto, taxi and maxi-cab drivers who own their passenger vehicle, for insurance, repairs and fitness.', te: 'సొంత ప్రయాణికుల వాహనం నడిపే ఆటో, టాక్సీ, మ్యాక్సీ క్యాబ్ డ్రైవర్లకు బీమా, మరమ్మతులు, ఫిట్‌నెస్ కోసం సంవత్సరానికి ₹15,000.' },
    benefit: { en: '₹15,000 a year', te: 'సంవత్సరానికి ₹15,000' },
    who: [
      { en: 'You own and drive the auto / taxi / maxi cab yourself (registered in AP)', te: 'ఆటో / టాక్సీ / మ్యాక్సీ క్యాబ్ మీ పేరిట ఉండి, మీరే నడపాలి (AP లో రిజిస్టర్)' },
      { en: 'Valid AP driving licence; one vehicle per family; goods vehicles and e-rickshaws not covered', te: 'చెల్లుబాటు అయ్యే AP డ్రైవింగ్ లైసెన్స్; కుటుంబానికి ఒక్క వాహనం; సరుకు వాహనాలు, ఇ-రిక్షాలకు వర్తించదు' },
      { en: 'White rice card and the six-step family check', te: 'తెల్ల రేషన్ కార్డు మరియు ఆరు అంచెల కుటుంబ పరిశీలన' },
    ],
    docs: [D.aadhaar, D.riceCard, { en: 'Driving licence', te: 'డ్రైవింగ్ లైసెన్స్' }, { en: 'Vehicle RC (registration certificate)', te: 'వాహన RC (రిజిస్ట్రేషన్ సర్టిఫికేట్)' }, { en: 'Fitness certificate & tax receipt (taxi / maxi cab)', te: 'ఫిట్‌నెస్ సర్టిఫికేట్ & పన్ను రసీదు (టాక్సీ / మ్యాక్సీ క్యాబ్)' }, D.bank],
    steps: applySteps(),
    where: atSachivalayam,
    rules: [
      R.work(['driver_owner'], { en: 'driving your own auto / taxi / maxi cab', te: 'సొంత ఆటో / టాక్సీ / మ్యాక్సీ క్యాబ్ నడపడం' }, { en: 'Only for owner-drivers of autos, taxis and maxi cabs', te: 'సొంత ఆటో / టాక్సీ / మ్యాక్సీ క్యాబ్ డ్రైవర్లకు మాత్రమే' }),
      ...welfareBasics(),
    ],
  },
  {
    id: 'matsyakara-sevalo',
    kind: 'scheme',
    status: 'active',
    category: 'livelihood',
    icon: '🎣',
    priority: 9,
    name: { en: 'Matsyakarula Sevalo', te: 'మత్స్యకారుల సేవలో' },
    summary: { en: '₹20,000 to fishermen families during the annual sea fishing ban (April–June), paid to the bank account.', te: 'వార్షిక సముద్ర వేట నిషేధ కాలంలో (ఏప్రిల్–జూన్) మత్స్యకార కుటుంబాలకు ₹20,000 బ్యాంకు ఖాతాలో.' },
    benefit: { en: '₹20,000 in the fishing-ban period', te: 'వేట నిషేధ కాలంలో ₹20,000' },
    who: [
      { en: 'Fishermen aged 21–60 who depend on sea fishing and are registered with the Fisheries Department', te: 'మత్స్య శాఖలో నమోదైన, సముద్ర వేటపై ఆధారపడిన 21–60 ఏళ్ల మత్స్యకారులు' },
      { en: 'Not for salaried employees or people already getting a pension', te: 'జీతం పొందే ఉద్యోగులు, ఇప్పటికే పింఛన్ పొందేవారికి కాదు' },
    ],
    docs: [D.aadhaar, { en: 'Fisherman ID / Fisheries registration', te: 'మత్స్యకార గుర్తింపు కార్డు / మత్స్య శాఖ నమోదు' }, { en: 'Boat registration (if any)', te: 'పడవ రిజిస్ట్రేషన్ (ఉంటే)' }, D.riceCard, D.bank, D.photo],
    steps: applySteps({ en: 'The Fisheries Assistant at your Sachivalayam verifies boats and crew lists before the ban starts.', te: 'వేట నిషేధానికి ముందు సచివాలయంలోని మత్స్య సహాయకుడు పడవలు, సిబ్బంది జాబితాను ధృవీకరిస్తారు.' }),
    where: { en: 'Fisheries Assistant at your Sachivalayam', te: 'సచివాలయంలో మత్స్య సహాయకుడు' },
    rules: [
      R.work(['fisherman'], { en: 'fishing as your livelihood', te: 'చేపల వేట జీవనోపాధి' }, { en: 'Only for fishermen', te: 'మత్స్యకారులకు మాత్రమే' }),
      R.ageBetween(21, 60),
      { need: { en: 'no pension already', te: 'ఇప్పటికే పింఛన్ లేకపోవడం' }, test: (p) => (p.other_pension == null ? undefined : !p.other_pension), fail: { en: 'Already gets a pension', te: 'ఇప్పటికే పింఛన్ వస్తోంది' } },
      R.noGovt(),
    ],
  },
  {
    id: 'nethanna-bharosa',
    kind: 'scheme',
    status: 'active',
    category: 'livelihood',
    icon: '🧵',
    priority: 10,
    name: { en: 'Nethanna Sevalo (handloom weavers)', te: 'నేతన్నల సేవలో (చేనేత కార్మికులు)' },
    summary: { en: '₹25,000 a year to handloom weaver families who own a loom, plus free power for handlooms and power looms.', te: 'సొంత మగ్గం ఉన్న చేనేత కుటుంబాలకు సంవత్సరానికి ₹25,000, మగ్గాలకు ఉచిత విద్యుత్.' },
    benefit: { en: '₹25,000 a year', te: 'సంవత్సరానికి ₹25,000' },
    who: [
      { en: 'Handloom weaver families who own and work a loom', te: 'సొంత మగ్గం నడిపే చేనేత కుటుంబాలు' },
      { en: 'Registered with the Handlooms & Textiles department', te: 'చేనేత & జౌళి శాఖలో నమోదై ఉండాలి' },
    ],
    docs: [D.aadhaar, { en: 'Weaver ID card / loom geo-tagging details', te: 'నేతన్న గుర్తింపు కార్డు / మగ్గం జియో-ట్యాగింగ్ వివరాలు' }, D.riceCard, D.bank],
    steps: applySteps({ en: 'Your loom is geo-tagged and inspected by Handlooms staff.', te: 'చేనేత సిబ్బంది మీ మగ్గాన్ని జియో-ట్యాగ్ చేసి తనిఖీ చేస్తారు.' }),
    where: atSachivalayam,
    rules: [R.work(['weaver'], { en: 'handloom weaving as your work', te: 'చేనేత మీ పని' }, { en: 'Only for handloom weavers', te: 'చేనేత కార్మికులకు మాత్రమే' }), R.noGovt(), R.noTax()],
  },
  {
    id: 'post-matric-rtf',
    kind: 'scheme',
    status: 'active',
    category: 'education',
    icon: '🎓',
    priority: 7,
    name: { en: 'Fee Reimbursement (Vidya Deevena)', te: 'ఫీజు రీయింబర్స్‌మెంట్ (విద్యా దీవెన)' },
    summary: { en: 'Full tuition fee paid by the State for students in ITI, polytechnic, degree, engineering, medicine, PG and similar courses (convener-quota seats).', te: 'ITI, పాలిటెక్నిక్, డిగ్రీ, ఇంజనీరింగ్, మెడిసిన్, PG వంటి కోర్సుల (కన్వీనర్ కోటా) విద్యార్థులకు పూర్తి ట్యూషన్ ఫీజు రాష్ట్రమే చెల్లిస్తుంది.' },
    benefit: { en: 'Full tuition fee', te: 'పూర్తి ట్యూషన్ ఫీజు' },
    who: [
      { en: 'Family income up to ₹2.5 lakh a year; all communities', te: 'కుటుంబ ఆదాయం సంవత్సరానికి ₹2.5 లక్షల లోపు; అన్ని వర్గాలు' },
      { en: 'Convener-quota admission; 75% attendance', te: 'కన్వీనర్ కోటా ప్రవేశం; 75% హాజరు' },
      { en: 'No govt employee in family, no private car, land under 10 acres wet / 25 dry, town property under 1,500 sq ft, no income tax', te: 'కుటుంబంలో ప్రభుత్వ ఉద్యోగి, సొంత కారు లేకపోవడం; భూమి 10 ఎకరాల మాగాణి / 25 మెట్ట లోపు; పట్టణ ఆస్తి 1,500 చ.అ. లోపు; ఆదాయపు పన్ను లేకపోవడం' },
    ],
    docs: [{ en: "Student's and parent's Aadhaar", te: 'విద్యార్థి మరియు తల్లి/తండ్రి ఆధార్' }, { en: 'Rice card or income certificate', te: 'రేషన్ కార్డు లేదా ఆదాయ ధృవపత్రం' }, { en: 'College admission / convener allotment order', te: 'కళాశాల ప్రవేశం / కన్వీనర్ అలాట్‌మెంట్ ఆర్డర్' }, { en: 'Previous marks memos', te: 'గత మార్కుల మెమోలు' }, D.caste, { en: "Mother's bank passbook", te: 'తల్లి బ్యాంకు పాస్‌బుక్' }],
    steps: [
      { en: 'Apply on the Jnanabhumi portal through your college after admission.', te: 'ప్రవేశం తర్వాత మీ కళాశాల ద్వారా జ్ఞానభూమి పోర్టల్‌లో దరఖాస్తు చేయండి.' },
      { en: 'Complete eKYC / biometric at your Sachivalayam (Welfare & Education Assistant).', te: 'సచివాలయంలో (సంక్షేమ & విద్యా సహాయకుడు) eKYC / బయోమెట్రిక్ పూర్తి చేయండి.' },
      { en: 'Fees are paid quarterly after attendance is verified.', te: 'హాజరు ధృవీకరణ తర్వాత త్రైమాసికంగా ఫీజు చెల్లిస్తారు.' },
    ],
    where: { en: 'Your college + Sachivalayam (eKYC)', te: 'మీ కళాశాల + సచివాలయం (eKYC)' },
    links: [{ label: { en: 'Jnanabhumi portal', te: 'జ్ఞానభూమి పోర్టల్' }, url: 'https://jnanabhumi.ap.gov.in' }],
    rules: [
      { need: { en: 'a student in ITI / polytechnic / degree / PG', te: 'ITI / పాలిటెక్నిక్ / డిగ్రీ / PG విద్యార్థి' }, test: (p) => p.college_student, fail: { en: 'Nobody in the family is in college / ITI / polytechnic', te: 'కుటుంబంలో కళాశాల / ITI / పాలిటెక్నిక్ విద్యార్థి లేరు' } },
      R.annualIncome(250000),
      R.noGovt(),
      R.noCar(),
      R.noTax(),
    ],
  },
  {
    id: 'post-matric-mtf',
    kind: 'scheme',
    status: 'active',
    category: 'education',
    icon: '🏫',
    priority: 13,
    name: { en: 'Hostel & mess charges (Vasathi Deevena)', te: 'హాస్టల్ & భోజన ఖర్చులు (వసతి దీవెన)' },
    summary: { en: 'Yearly help with hostel and food costs for the same college / ITI / polytechnic students who get fee reimbursement.', te: 'ఫీజు రీయింబర్స్‌మెంట్ పొందే కళాశాల / ITI / పాలిటెక్నిక్ విద్యార్థులకు హాస్టల్, భోజన ఖర్చులకు వార్షిక సాయం.' },
    benefit: { en: '₹10,000 – ₹20,000 a year (depends on course)', te: 'సంవత్సరానికి ₹10,000 – ₹20,000 (కోర్సును బట్టి)' },
    who: [{ en: 'Same conditions as Fee Reimbursement', te: 'ఫీజు రీయింబర్స్‌మెంట్‌కు ఉన్న షరతులే' }],
    docs: [{ en: "Student's and parent's Aadhaar", te: 'విద్యార్థి మరియు తల్లి/తండ్రి ఆధార్' }, { en: 'Rice card or income certificate', te: 'రేషన్ కార్డు లేదా ఆదాయ ధృవపత్రం' }, { en: 'College admission proof', te: 'కళాశాల ప్రవేశ రుజువు' }, { en: "Mother's bank passbook", te: 'తల్లి బ్యాంకు పాస్‌బుక్' }],
    steps: [{ en: 'Applied together with Fee Reimbursement on the Jnanabhumi portal.', te: 'జ్ఞానభూమి పోర్టల్‌లో ఫీజు రీయింబర్స్‌మెంట్‌తో కలిపి దరఖాస్తు చేస్తారు.' }],
    where: { en: 'Your college + Sachivalayam (eKYC)', te: 'మీ కళాశాల + సచివాలయం (eKYC)' },
    links: [{ label: { en: 'Jnanabhumi portal', te: 'జ్ఞానభూమి పోర్టల్' }, url: 'https://jnanabhumi.ap.gov.in' }],
    rules: [
      { need: { en: 'a student in ITI / polytechnic / degree / PG', te: 'ITI / పాలిటెక్నిక్ / డిగ్రీ / PG విద్యార్థి' }, test: (p) => p.college_student, fail: { en: 'Nobody in the family is in college / ITI / polytechnic', te: 'కుటుంబంలో కళాశాల / ITI / పాలిటెక్నిక్ విద్యార్థి లేరు' } },
      R.annualIncome(250000),
      R.noGovt(),
      R.noCar(),
      R.noTax(),
    ],
  },
  {
    id: 'pmay-gramin',
    kind: 'scheme',
    status: 'seasonal',
    category: 'housing',
    icon: '🏠',
    priority: 11,
    name: { en: 'Housing for All (PMAY + State)', te: 'అందరికీ ఇళ్లు (PMAY + రాష్ట్రం)' },
    summary: { en: 'Help to build a pucca house for families without one — central PMAY (Gramin / Urban) assistance with State support. New beneficiaries are taken in survey rounds.', te: 'పక్కా ఇల్లు లేని కుటుంబాలకు ఇల్లు కట్టుకోవడానికి సాయం — కేంద్ర PMAY (గ్రామీణ / పట్టణ) మరియు రాష్ట్ర సాయం. కొత్త లబ్ధిదారులను సర్వే దశల్లో తీసుకుంటారు.' },
    benefit: { en: 'Construction assistance (amount depends on PMAY-G / PMAY-U)', te: 'ఇంటి నిర్మాణ సాయం (PMAY-G / PMAY-U ను బట్టి)' },
    who: [
      { en: 'No pucca house anywhere in India in any family member’s name', te: 'దేశంలో ఎక్కడా కుటుంబ సభ్యుల పేరిట పక్కా ఇల్లు లేకపోవడం' },
      { en: 'White rice card and the six-step family check', te: 'తెల్ల రేషన్ కార్డు మరియు ఆరు అంచెల కుటుంబ పరిశీలన' },
    ],
    docs: [D.aadhaar, D.riceCard, { en: 'House site patta / land document', te: 'ఇంటి స్థలం పట్టా / భూమి పత్రం' }, D.income, D.bank, D.photo],
    steps: applySteps({ en: 'The Ward / Village Planning Secretary surveys your site.', te: 'వార్డు / గ్రామ ప్లానింగ్ సెక్రటరీ మీ స్థలాన్ని సర్వే చేస్తారు.' }),
    where: atSachivalayam,
    rules: [
      { need: { en: 'no pucca house', te: 'పక్కా ఇల్లు లేకపోవడం' }, test: (p) => (p.pucca_house == null ? undefined : !p.pucca_house), fail: { en: 'Family already owns a pucca house', te: 'కుటుంబానికి ఇప్పటికే పక్కా ఇల్లు ఉంది' } },
      ...welfareBasics(),
    ],
  },
  {
    id: 'adarana-3',
    kind: 'scheme',
    status: 'seasonal',
    category: 'livelihood',
    icon: '🛠️',
    priority: 14,
    name: { en: 'Adarana 3.0 (tools for artisans)', te: 'ఆదరణ 3.0 (చేతివృత్తుల పనిముట్లు)' },
    summary: { en: 'Subsidised modern tools and equipment (and two-wheelers for toddy tappers) for BC artisans — carpenters, goldsmiths, potters, barbers, washermen, weavers, fishermen and others.', te: 'BC చేతివృత్తుల వారికి — వడ్రంగులు, స్వర్ణకారులు, కుమ్మరులు, నాయీ బ్రాహ్మణులు, రజకులు, నేతన్నలు, మత్స్యకారులు మొదలైనవారికి — సబ్సిడీపై ఆధునిక పనిముట్లు (కల్లు గీత కార్మికులకు ద్విచక్ర వాహనాలు).' },
    benefit: { en: 'Up to 90% subsidy on tools', te: 'పనిముట్లపై 90% వరకు సబ్సిడీ' },
    who: [{ en: 'BC artisans and traditional workers, 18–50 years; applications open in rounds through the BC Corporation', te: '18–50 ఏళ్ల BC చేతివృత్తుల వారు; BC కార్పొరేషన్ ద్వారా దశలవారీగా దరఖాస్తులు' }],
    docs: [D.aadhaar, D.caste, D.riceCard, { en: 'Occupation proof / trade certificate', te: 'వృత్తి రుజువు / ట్రేడ్ సర్టిఫికేట్' }, D.bank, D.photo],
    steps: applySteps({ en: 'Watch for the BC Corporation notification — SachiSeva staff will tell you when the round opens.', te: 'BC కార్పొరేషన్ నోటిఫికేషన్ కోసం చూడండి — దశ తెరిచినప్పుడు సచిసేవ సిబ్బంది తెలియజేస్తారు.' }),
    where: { en: 'Sachivalayam · BC Welfare / BC Corporation office', te: 'సచివాలయం · BC సంక్షేమ / BC కార్పొరేషన్ కార్యాలయం' },
    rules: [
      R.caste(['BC']),
      R.work(['artisan', 'weaver', 'fisherman', 'toddy_tapper', 'construction'], { en: 'a traditional trade (artisan, weaver, fisherman, toddy tapper…)', te: 'సాంప్రదాయ వృత్తి (చేతివృత్తి, చేనేత, మత్స్య, కల్లు గీత…)' }, { en: 'Only for artisans and traditional trades', te: 'చేతివృత్తుల వారికి మాత్రమే' }),
      R.ageBetween(18, 50),
    ],
  },
  {
    id: 'sc-corp-loan',
    kind: 'scheme',
    status: 'seasonal',
    category: 'livelihood',
    icon: '💼',
    priority: 16,
    name: { en: 'SC / ST Corporation self-employment loans', te: 'SC / ST కార్పొరేషన్ స్వయం ఉపాధి రుణాలు' },
    summary: { en: 'Bank loans with a large subsidy to start a small business, vehicle or unit, for SC and ST youth. Opened in rounds by the SC / Tribal Welfare corporations.', te: 'SC, ST యువతకు చిన్న వ్యాపారం, వాహనం లేదా యూనిట్ ప్రారంభించడానికి భారీ సబ్సిడీతో బ్యాంకు రుణాలు. SC / గిరిజన సంక్షేమ కార్పొరేషన్లు దశలవారీగా తెరుస్తాయి.' },
    benefit: { en: 'Subsidised bank loan', te: 'సబ్సిడీ బ్యాంకు రుణం' },
    who: [{ en: 'SC / ST, age 21–50, white rice card, not already helped under a similar scheme', te: 'SC / ST, వయసు 21–50, తెల్ల రేషన్ కార్డు, ఇలాంటి పథకం ఇప్పటికే పొందకపోవడం' }],
    docs: [D.aadhaar, D.caste, D.riceCard, { en: 'Project report / quotation', te: 'ప్రాజెక్ట్ రిపోర్ట్ / కొటేషన్' }, D.bank, D.photo],
    steps: applySteps({ en: 'Selected applicants are referred to a bank for the loan.', te: 'ఎంపికైన వారిని రుణం కోసం బ్యాంకుకు పంపుతారు.' }),
    where: { en: 'Sachivalayam · OBMMS portal when notified', te: 'సచివాలయం · నోటిఫికేషన్ వచ్చినప్పుడు OBMMS పోర్టల్' },
    rules: [R.caste(['SC', 'ST']), R.ageBetween(21, 50), R.riceCard()],
  },
  {
    id: 'bc-corp-loan',
    kind: 'scheme',
    status: 'seasonal',
    category: 'livelihood',
    icon: '🏪',
    priority: 17,
    name: { en: 'BC / EWS Corporation self-employment loans', te: 'BC / EWS కార్పొరేషన్ స్వయం ఉపాధి రుణాలు' },
    summary: { en: 'Subsidised bank loans for BC, Kapu, minority and EWS youth to start a business or buy equipment. Opened in rounds.', te: 'BC, కాపు, మైనారిటీ, EWS యువతకు వ్యాపారం లేదా పరికరాల కోసం సబ్సిడీ బ్యాంకు రుణాలు. దశలవారీగా తెరుస్తారు.' },
    benefit: { en: 'Subsidised bank loan', te: 'సబ్సిడీ బ్యాంకు రుణం' },
    who: [{ en: 'BC / minority / EWS, age 21–50, white rice card', te: 'BC / మైనారిటీ / EWS, వయసు 21–50, తెల్ల రేషన్ కార్డు' }],
    docs: [D.aadhaar, D.caste, D.riceCard, { en: 'Project report / quotation', te: 'ప్రాజెక్ట్ రిపోర్ట్ / కొటేషన్' }, D.bank, D.photo],
    steps: applySteps({ en: 'Selected applicants are referred to a bank for the loan.', te: 'ఎంపికైన వారిని రుణం కోసం బ్యాంకుకు పంపుతారు.' }),
    where: { en: 'Sachivalayam · OBMMS portal when notified', te: 'సచివాలయం · నోటిఫికేషన్ వచ్చినప్పుడు OBMMS పోర్టల్' },
    rules: [R.caste(['BC', 'Minority', 'OC']), R.ageBetween(21, 50), R.riceCard()],
  },
  {
    id: 'ntr-vidyonnathi',
    kind: 'scheme',
    status: 'seasonal',
    category: 'youth',
    icon: '📚',
    priority: 18,
    name: { en: 'NTR Vidyonnathi (civil services coaching)', te: 'ఎన్టీఆర్ విద్యోన్నతి (సివిల్ సర్వీసెస్ కోచింగ్)' },
    summary: { en: 'Free UPSC / APPSC coaching with a stipend for graduates from weaker sections. Notified every year on the Jnanabhumi portal.', te: 'బలహీన వర్గాల పట్టభద్రులకు స్టైపెండ్‌తో ఉచిత UPSC / APPSC కోచింగ్. ఏటా జ్ఞానభూమి పోర్టల్‌లో నోటిఫికేషన్.' },
    benefit: { en: 'Free coaching + stipend', te: 'ఉచిత కోచింగ్ + స్టైపెండ్' },
    who: [{ en: 'Graduates, family income under ₹6 lakh a year; selection by entrance test', te: 'పట్టభద్రులు, కుటుంబ ఆదాయం సంవత్సరానికి ₹6 లక్షల లోపు; ప్రవేశ పరీక్ష ద్వారా ఎంపిక' }],
    docs: [D.aadhaar, { en: 'Degree certificate', te: 'డిగ్రీ సర్టిఫికేట్' }, D.income, D.caste, D.photo],
    steps: [{ en: 'Apply on Jnanabhumi when the notification is out; write the screening test.', te: 'నోటిఫికేషన్ వచ్చినప్పుడు జ్ఞానభూమిలో దరఖాస్తు చేసి స్క్రీనింగ్ పరీక్ష రాయండి.' }],
    where: { en: 'Jnanabhumi portal', te: 'జ్ఞానభూమి పోర్టల్' },
    links: [{ label: { en: 'Jnanabhumi portal', te: 'జ్ఞానభూమి పోర్టల్' }, url: 'https://jnanabhumi.ap.gov.in' }],
    rules: [
      { need: { en: 'a degree', te: 'డిగ్రీ' }, test: (p) => (p.education == null ? undefined : p.education === 'degree' || p.education === 'pg'), fail: { en: 'Needs a degree', te: 'డిగ్రీ ఉండాలి' } },
      R.annualIncome(600000),
    ],
  },
  {
    id: 'ambedkar-overseas',
    kind: 'scheme',
    status: 'seasonal',
    category: 'youth',
    icon: '✈️',
    priority: 19,
    name: { en: 'Ambedkar Overseas Vidya Nidhi', te: 'అంబేద్కర్ ఓవర్సీస్ విద్యా నిధి' },
    summary: { en: 'Financial help for SC / ST students admitted to a Masters or PhD at a recognised foreign university.', te: 'గుర్తింపు పొందిన విదేశీ విశ్వవిద్యాలయంలో మాస్టర్స్ / PhD ప్రవేశం పొందిన SC / ST విద్యార్థులకు ఆర్థిక సాయం.' },
    benefit: { en: 'Up to ₹15 lakh for foreign study', te: 'విదేశీ విద్యకు ₹15 లక్షల వరకు' },
    who: [{ en: 'SC / ST graduates with a foreign university admission, family income under ₹6 lakh a year', te: 'విదేశీ విశ్వవిద్యాలయ ప్రవేశం ఉన్న SC / ST పట్టభద్రులు, కుటుంబ ఆదాయం సంవత్సరానికి ₹6 లక్షల లోపు' }],
    docs: [D.aadhaar, D.caste, D.income, { en: 'Foreign university admission letter', te: 'విదేశీ విశ్వవిద్యాలయ ప్రవేశ పత్రం' }, { en: 'Passport', te: 'పాస్‌పోర్ట్' }, { en: 'Degree marks memos', te: 'డిగ్రీ మార్కుల మెమోలు' }],
    steps: [{ en: 'Apply on Jnanabhumi when notified.', te: 'నోటిఫికేషన్ వచ్చినప్పుడు జ్ఞానభూమిలో దరఖాస్తు చేయండి.' }],
    where: { en: 'Jnanabhumi portal', te: 'జ్ఞానభూమి పోర్టల్' },
    rules: [
      R.caste(['SC', 'ST']),
      { need: { en: 'a degree', te: 'డిగ్రీ' }, test: (p) => (p.education == null ? undefined : p.education === 'degree' || p.education === 'pg'), fail: { en: 'Needs a degree', te: 'డిగ్రీ ఉండాలి' } },
      R.annualIncome(600000),
      { need: { en: 'admission to a foreign university', te: 'విదేశీ విశ్వవిద్యాలయ ప్రవేశం' }, test: () => undefined, fail: { en: '', te: '' } },
    ],
  },
  {
    id: 'aadabidda-nidhi',
    kind: 'scheme',
    status: 'announced',
    category: 'women',
    icon: '👩',
    priority: 20,
    name: { en: 'Aadabidda Nidhi', te: 'ఆడబిడ్డ నిధి' },
    summary: { en: '₹1,500 a month for women aged 18–59. Announced as one of the Super Six; beneficiary verification is in progress and payments have not started yet.', te: '18–59 ఏళ్ల మహిళలకు నెలకు ₹1,500. సూపర్ సిక్స్‌లో భాగంగా ప్రకటించారు; లబ్ధిదారుల ధృవీకరణ జరుగుతోంది, చెల్లింపులు ఇంకా మొదలు కాలేదు.' },
    benefit: { en: '₹1,500 a month (when launched)', te: 'నెలకు ₹1,500 (ప్రారంభమైనప్పుడు)' },
    who: [{ en: 'Women aged 18–59 (final rules not yet published)', te: '18–59 ఏళ్ల మహిళలు (తుది నిబంధనలు ఇంకా ప్రకటించలేదు)' }],
    docs: [D.aadhaar, D.riceCard, D.bank],
    steps: [{ en: 'Not open yet. Keep Aadhaar, rice card and bank details ready; SachiSeva will show it as open once the government starts it.', te: 'ఇంకా ప్రారంభం కాలేదు. ఆధార్, రేషన్ కార్డు, బ్యాంకు వివరాలు సిద్ధంగా ఉంచుకోండి; ప్రభుత్వం ప్రారంభించగానే సచిసేవలో తెరుచుకుంటుంది.' }],
    where: atSachivalayam,
    rules: [R.female(), R.ageBetween(18, 59)],
  },
  {
    id: 'yuva-galam',
    kind: 'scheme',
    status: 'announced',
    category: 'youth',
    icon: '🧑‍💼',
    priority: 21,
    name: { en: 'Nirudyoga Bhruthi (unemployment allowance)', te: 'నిరుద్యోగ భృతి' },
    summary: { en: '₹3,000 a month promised to unemployed youth. Announced; not paid yet. Meanwhile, Mega DSC and skilling programmes are running.', te: 'నిరుద్యోగ యువతకు నెలకు ₹3,000 హామీ. ప్రకటించారు; ఇంకా చెల్లింపులు లేవు. ఈలోగా మెగా DSC, నైపుణ్య శిక్షణ కార్యక్రమాలు నడుస్తున్నాయి.' },
    benefit: { en: '₹3,000 a month (when launched)', te: 'నెలకు ₹3,000 (ప్రారంభమైనప్పుడు)' },
    who: [{ en: 'Unemployed educated youth (final rules not yet published)', te: 'నిరుద్యోగ విద్యావంతులైన యువత (తుది నిబంధనలు ఇంకా లేవు)' }],
    docs: [D.aadhaar, { en: 'Educational certificates', te: 'విద్యార్హత ధృవపత్రాలు' }, D.riceCard, D.bank],
    steps: [{ en: 'Not open yet. Register on the AP Skill Development / Naipunyam portal for jobs and training meanwhile.', te: 'ఇంకా ప్రారంభం కాలేదు. ఈలోగా ఉద్యోగాలు, శిక్షణ కోసం AP నైపుణ్య అభివృద్ధి / నైపుణ్యం పోర్టల్‌లో నమోదు చేసుకోండి.' }],
    where: atSachivalayam,
    rules: [R.work(['unemployed'], { en: 'looking for work', te: 'ఉద్యోగం వెతుకుతున్నారు' }, { en: 'Only for unemployed youth', te: 'నిరుద్యోగ యువతకు మాత్రమే' }), R.ageBetween(18, 35)],
  },
  {
    id: 'chandranna-pelli-kanuka',
    kind: 'scheme',
    status: 'announced',
    category: 'family',
    icon: '💍',
    priority: 22,
    name: { en: 'Chandranna Pelli Kanuka (marriage gift)', te: 'చంద్రన్న పెళ్ళి కానుక' },
    summary: { en: 'One-time marriage assistance for brides from SC, ST, BC, minority and disabled families. Not accepting applications now — check at your Sachivalayam before the wedding.', te: 'SC, ST, BC, మైనారిటీ, వికలాంగ కుటుంబాల వధువులకు ఒకసారి వివాహ సాయం. ప్రస్తుతం దరఖాస్తులు తీసుకోవడం లేదు — వివాహానికి ముందు సచివాలయంలో అడగండి.' },
    benefit: { en: 'One-time marriage assistance', te: 'ఒకసారి వివాహ సాయం' },
    who: [{ en: 'Brides 18+ and grooms 21+ from SC / ST / BC / minority / disabled families, white rice card; register within 60 days of marriage', te: 'SC / ST / BC / మైనారిటీ / వికలాంగ కుటుంబాల 18+ వధువు, 21+ వరుడు, తెల్ల రేషన్ కార్డు; వివాహమైన 60 రోజుల్లో నమోదు' }],
    docs: [{ en: "Bride's and groom's Aadhaar", te: 'వధూవరుల ఆధార్' }, D.caste, D.age, { en: 'Wedding card / marriage certificate', te: 'పెళ్ళి పత్రిక / వివాహ ధృవపత్రం' }, D.riceCard, D.bank],
    steps: [{ en: 'Ask at your Sachivalayam whether applications are open before the wedding.', te: 'వివాహానికి ముందు దరఖాస్తులు తెరిచారా అని సచివాలయంలో అడగండి.' }],
    where: atSachivalayam,
    rules: [R.caste(['SC', 'ST', 'BC', 'Minority']), R.riceCard()],
  },

  // ════════════════ SERVICES ════════════════
  {
    id: 'svc-income-certificate',
    kind: 'service',
    status: 'active',
    category: 'certificates',
    icon: '💰',
    priority: 101,
    name: { en: 'Income certificate', te: 'ఆదాయ ధృవపత్రం' },
    summary: { en: 'Certifies your family’s annual income — needed for scholarships, fee reimbursement, loans and many schemes.', te: 'మీ కుటుంబ వార్షిక ఆదాయాన్ని ధృవీకరిస్తుంది — స్కాలర్‌షిప్‌లు, ఫీజు రీయింబర్స్‌మెంట్, రుణాలు, అనేక పథకాలకు అవసరం.' },
    who: [{ en: 'Any resident of Andhra Pradesh', te: 'ఆంధ్రప్రదేశ్ నివాసులెవరైనా' }],
    docs: [{ en: 'Income proof — pay slip, IT return, or self-declaration', te: 'ఆదాయ రుజువు — జీతం స్లిప్, IT రిటర్న్ లేదా స్వీయ ప్రకటన' }, { en: 'Rice card, voter ID or Aadhaar card', te: 'రేషన్ కార్డు, ఓటర్ ఐడీ లేదా ఆధార్ కార్డు' }],
    steps: serviceSteps,
    where: atSachOrMeeSeva,
    fee: { en: '₹12 (Sachivalayam)', te: '₹12 (సచివాలయం)' },
    time: { en: '7 days', te: '7 రోజులు' },
    rules: [],
  },
  {
    id: 'svc-integrated-certificate',
    kind: 'service',
    status: 'active',
    category: 'certificates',
    icon: '📜',
    priority: 102,
    name: { en: 'Caste certificate (Integrated: caste, nativity & date of birth)', te: 'కుల ధృవపత్రం (ఇంటిగ్రేటెడ్: కులం, స్థానికత, పుట్టిన తేదీ)' },
    summary: { en: 'One certificate showing your community, nativity and date of birth — used for admissions, reservations, jobs and SC/ST/BC schemes.', te: 'మీ వర్గం, స్థానికత, పుట్టిన తేదీ చూపే ఒకే ధృవపత్రం — ప్రవేశాలు, రిజర్వేషన్లు, ఉద్యోగాలు, SC/ST/BC పథకాలకు.' },
    who: [{ en: 'Any resident of Andhra Pradesh', te: 'ఆంధ్రప్రదేశ్ నివాసులెవరైనా' }],
    docs: [{ en: 'SSC marks memo, transfer certificate, or birth extract from municipality / panchayat', te: 'SSC మార్కుల మెమో, టీసీ లేదా మున్సిపాలిటీ / పంచాయతీ జనన నమోదు' }, { en: 'Earlier caste certificate of applicant, parent or family member (if any)', te: 'దరఖాస్తుదారు, తల్లి/తండ్రి లేదా కుటుంబ సభ్యుని పాత కుల ధృవపత్రం (ఉంటే)' }, D.aadhaar],
    steps: serviceSteps,
    where: atSachOrMeeSeva,
    fee: { en: '₹12 (Sachivalayam)', te: '₹12 (సచివాలయం)' },
    time: { en: '30 days', te: '30 రోజులు' },
    rules: [],
  },
  {
    id: 'svc-ews-certificate',
    kind: 'service',
    status: 'active',
    category: 'certificates',
    icon: '📄',
    priority: 103,
    name: { en: 'EWS certificate', te: 'EWS ధృవపత్రం' },
    summary: { en: 'For the 10% Economically Weaker Sections reservation in education and jobs (for communities not under SC/ST/BC).', te: 'విద్య, ఉద్యోగాల్లో 10% ఆర్థికంగా బలహీన వర్గాల (EWS) రిజర్వేషన్ కోసం (SC/ST/BC కాని వర్గాలకు).' },
    who: [{ en: 'OC families with income under ₹8 lakh a year who meet the land and property limits', te: 'సంవత్సర ఆదాయం ₹8 లక్షల లోపు, భూమి / ఆస్తి పరిమితుల్లో ఉన్న OC కుటుంబాలు' }],
    docs: [D.aadhaar, D.income, { en: 'Land / property self-declaration', te: 'భూమి / ఆస్తి స్వీయ ప్రకటన' }, { en: 'SSC memo or date-of-birth proof', te: 'SSC మెమో లేదా పుట్టిన తేదీ రుజువు' }, D.riceCard],
    steps: serviceSteps,
    where: atSachOrMeeSeva,
    note: { en: 'Fee and time limit: confirm at your Sachivalayam.', te: 'రుసుము, గడువు: సచివాలయంలో నిర్ధారించుకోండి.' },
    rules: [],
  },
  {
    id: 'svc-residence-certificate',
    kind: 'service',
    status: 'active',
    category: 'certificates',
    icon: '🏡',
    priority: 104,
    name: { en: 'Residence certificate', te: 'నివాస ధృవపత్రం' },
    summary: { en: 'Proves where you live — for bank accounts, admissions, gas and other connections.', te: 'మీరు ఎక్కడ నివసిస్తున్నారో రుజువు — బ్యాంకు ఖాతా, ప్రవేశాలు, గ్యాస్ మొదలైన కనెక్షన్ల కోసం.' },
    who: [{ en: 'Any resident', te: 'నివాసులెవరైనా' }],
    docs: [{ en: 'Aadhaar with current address', te: 'ప్రస్తుత చిరునామాతో ఆధార్' }, D.riceCard, { en: 'Electricity / water / property tax bill', te: 'విద్యుత్ / నీటి / ఇంటి పన్ను బిల్లు' }, D.photo],
    steps: serviceSteps,
    where: atSachOrMeeSeva,
    note: { en: 'Fee and time limit: confirm at your Sachivalayam.', te: 'రుసుము, గడువు: సచివాలయంలో నిర్ధారించుకోండి.' },
    rules: [],
  },
  {
    id: 'svc-family-member-certificate',
    kind: 'service',
    status: 'active',
    category: 'certificates',
    icon: '👨‍👩‍👧',
    priority: 105,
    name: { en: 'Family member certificate', te: 'కుటుంబ సభ్యుల ధృవపత్రం' },
    summary: { en: 'Lists the legal family members after the head of the family dies — needed for land mutation, bank claims, pensions and compassionate jobs.', te: 'కుటుంబ పెద్ద మరణించిన తర్వాత చట్టబద్ధ కుటుంబ సభ్యుల జాబితా — భూమి మ్యుటేషన్, బ్యాంకు క్లెయిమ్‌లు, పింఛన్, కారుణ్య నియామకాలకు.' },
    who: [{ en: 'Family of a person who has died', te: 'మరణించిన వ్యక్తి కుటుంబ సభ్యులు' }],
    docs: [{ en: 'Death certificate of the family head', te: 'కుటుంబ పెద్ద మరణ ధృవపత్రం' }, { en: 'Aadhaar of all family members', te: 'కుటుంబ సభ్యులందరి ఆధార్' }, D.riceCard, { en: 'Self-declaration / affidavit listing family members', te: 'కుటుంబ సభ్యుల జాబితాతో స్వీయ ప్రకటన / అఫిడవిట్' }],
    steps: [...serviceSteps.slice(0, 2), { en: 'The VRO / Revenue Inspector enquires locally before the Tahsildar issues it.', te: 'తహసీల్దార్ జారీ చేసే ముందు VRO / రెవెన్యూ ఇన్‌స్పెక్టర్ స్థానికంగా విచారిస్తారు.' }, ...serviceSteps.slice(2)],
    where: atSachOrMeeSeva,
    note: { en: 'Fee and time limit: confirm at your Sachivalayam.', te: 'రుసుము, గడువు: సచివాలయంలో నిర్ధారించుకోండి.' },
    rules: [],
  },
  {
    id: 'svc-rice-card-new',
    kind: 'service',
    status: 'active',
    category: 'ration',
    icon: '🍚',
    priority: 106,
    name: { en: 'New rice card', te: 'కొత్త రేషన్ కార్డు' },
    summary: { en: 'Apply for a new family rice card (needed for subsidised rice and most welfare schemes).', te: 'కొత్త కుటుంబ రేషన్ కార్డు కోసం దరఖాస్తు (సబ్సిడీ బియ్యం మరియు చాలా పథకాలకు అవసరం).' },
    who: [{ en: 'Families meeting the six-step check (income, land, electricity, vehicle, govt job, income tax, property)', te: 'ఆరు అంచెల పరిశీలనలో అర్హత ఉన్న కుటుంబాలు (ఆదాయం, భూమి, విద్యుత్, వాహనం, ప్రభుత్వ ఉద్యోగం, ఆదాయపు పన్ను, ఆస్తి)' }],
    docs: [{ en: 'Aadhaar numbers of all family members', te: 'కుటుంబ సభ్యులందరి ఆధార్ నంబర్లు' }, { en: 'Address proof', te: 'చిరునామా రుజువు' }, D.income, { en: 'Age proof (women over 18, men over 21)', te: 'వయసు రుజువు (మహిళలు 18+, పురుషులు 21+)' }, { en: 'Death certificate of spouse (single-member widow cards)', te: 'జీవిత భాగస్వామి మరణ ధృవపత్రం (ఒంటరి వితంతు కార్డు)' }],
    steps: serviceSteps,
    where: atSachivalayam,
    fee: { en: '₹24', te: '₹24' },
    time: { en: '21 days', te: '21 రోజులు' },
    rules: [],
  },
  {
    id: 'svc-rice-card-member',
    kind: 'service',
    status: 'active',
    category: 'ration',
    icon: '➕',
    priority: 107,
    name: { en: 'Add / remove a member on the rice card', te: 'రేషన్ కార్డులో సభ్యుని చేర్పు / తొలగింపు' },
    summary: { en: 'Add a newborn or a new daughter-in-law, remove someone who has died or moved, or split a card.', te: 'నవజాత శిశువు లేదా కొత్త కోడలిని చేర్చడం, మరణించినవారిని / వెళ్లిపోయినవారిని తొలగించడం లేదా కార్డు విభజన.' },
    who: [{ en: 'Existing rice card holders', te: 'ప్రస్తుత రేషన్ కార్డుదారులు' }],
    docs: [{ en: 'Existing rice card', te: 'ప్రస్తుత రేషన్ కార్డు' }, { en: "New member's Aadhaar", te: 'కొత్త సభ్యుని ఆధార్' }, { en: 'Birth certificate (child) / marriage certificate (spouse) / death certificate (removal)', te: 'జనన ధృవపత్రం (బిడ్డ) / వివాహ ధృవపత్రం (జీవిత భాగస్వామి) / మరణ ధృవపత్రం (తొలగింపు)' }],
    steps: serviceSteps,
    where: atSachivalayam,
    note: { en: 'Fee and time limit: confirm at your Sachivalayam.', te: 'రుసుము, గడువు: సచివాలయంలో నిర్ధారించుకోండి.' },
    rules: [],
  },
  {
    id: 'svc-birth-certificate',
    kind: 'service',
    status: 'active',
    category: 'civil',
    icon: '👶',
    priority: 108,
    name: { en: 'Birth certificate', te: 'జనన ధృవపత్రం' },
    summary: { en: 'Copy of a registered birth. Births should be registered within 21 days; late registration needs extra orders.', te: 'నమోదైన జననం ధృవపత్రం. జననం 21 రోజుల్లో నమోదు చేయాలి; ఆలస్య నమోదుకు అదనపు ఉత్తర్వులు అవసరం.' },
    who: [{ en: 'Parents or the person themselves', te: 'తల్లిదండ్రులు లేదా సంబంధిత వ్యక్తి' }],
    docs: [{ en: 'Hospital birth record / discharge summary', te: 'ఆసుపత్రి జనన రికార్డు / డిశ్చార్జ్ సారాంశం' }, { en: "Parents' Aadhaar", te: 'తల్లిదండ్రుల ఆధార్' }, { en: 'Affidavit & non-availability certificate (late registration)', te: 'అఫిడవిట్ & నాన్-అవైలబిలిటీ సర్టిఫికేట్ (ఆలస్య నమోదు)' }],
    steps: serviceSteps,
    where: { en: 'Sachivalayam · Municipality / Gram Panchayat', te: 'సచివాలయం · మున్సిపాలిటీ / గ్రామ పంచాయతీ' },
    fee: { en: '₹12', te: '₹12' },
    time: { en: '7 days', te: '7 రోజులు' },
    rules: [],
  },
  {
    id: 'svc-death-certificate',
    kind: 'service',
    status: 'active',
    category: 'civil',
    icon: '🕊️',
    priority: 109,
    name: { en: 'Death certificate', te: 'మరణ ధృవపత్రం' },
    summary: { en: 'Copy of a registered death — needed for pensions, insurance, property and the family member certificate.', te: 'నమోదైన మరణ ధృవపత్రం — పింఛన్, బీమా, ఆస్తి, కుటుంబ సభ్యుల ధృవపత్రానికి అవసరం.' },
    who: [{ en: 'Family members', te: 'కుటుంబ సభ్యులు' }],
    docs: [{ en: 'Hospital / doctor death record', te: 'ఆసుపత్రి / డాక్టర్ మరణ రికార్డు' }, { en: "Deceased's Aadhaar", te: 'మృతుని ఆధార్' }, { en: "Applicant's Aadhaar", te: 'దరఖాస్తుదారుని ఆధార్' }],
    steps: serviceSteps,
    where: { en: 'Sachivalayam · Municipality / Gram Panchayat', te: 'సచివాలయం · మున్సిపాలిటీ / గ్రామ పంచాయతీ' },
    fee: { en: '₹12', te: '₹12' },
    time: { en: '7 days', te: '7 రోజులు' },
    rules: [],
  },
  {
    id: 'svc-marriage-certificate',
    kind: 'service',
    status: 'active',
    category: 'civil',
    icon: '💒',
    priority: 110,
    name: { en: 'Marriage registration certificate', te: 'వివాహ నమోదు ధృవపత్రం' },
    summary: { en: 'Registers a Hindu marriage and gives the certificate — needed for passports, visas, rice cards and spouse benefits.', te: 'హిందూ వివాహాన్ని నమోదు చేసి ధృవపత్రం ఇస్తారు — పాస్‌పోర్ట్, వీసా, రేషన్ కార్డు, జీవిత భాగస్వామి ప్రయోజనాలకు.' },
    who: [{ en: 'Bride 18+ and groom 21+', te: 'వధువు 18+, వరుడు 21+' }],
    docs: [{ en: 'Wedding invitation card', te: 'పెళ్ళి పత్రిక' }, { en: 'Age proof of both (SSC memo / passport / birth certificate)', te: 'ఇద్దరి వయసు రుజువు (SSC మెమో / పాస్‌పోర్ట్ / జనన ధృవపత్రం)' }, { en: 'Marriage photo', te: 'వివాహ ఫోటో' }, { en: 'Residence proof of both', te: 'ఇద్దరి నివాస రుజువు' }, { en: "Witnesses' Aadhaar (2)", te: 'సాక్షుల ఆధార్ (2)' }],
    steps: serviceSteps,
    where: atSachivalayam,
    fee: { en: '₹212 (same caste) · ₹12 (inter-caste)', te: '₹212 (ఒకే కులం) · ₹12 (కులాంతర)' },
    time: { en: '7 days', te: '7 రోజులు' },
    rules: [],
  },
  {
    id: 'svc-health-card',
    kind: 'service',
    status: 'active',
    category: 'utilities',
    icon: '💳',
    priority: 111,
    name: { en: 'Dr NTR Vaidya Seva (Aarogyasri) health card', te: 'డాక్టర్ ఎన్టీఆర్ వైద్య సేవ (ఆరోగ్యశ్రీ) హెల్త్ కార్డు' },
    summary: { en: 'The card that lets your family get free treatment under Dr NTR Vaidya Seva.', te: 'డాక్టర్ ఎన్టీఆర్ వైద్య సేవ కింద మీ కుటుంబానికి ఉచిత వైద్యం అందించే కార్డు.' },
    who: [{ en: 'Families with a white rice card', te: 'తెల్ల రేషన్ కార్డు ఉన్న కుటుంబాలు' }],
    docs: [{ en: 'Aadhaar cards of all members', te: 'సభ్యులందరి ఆధార్ కార్డులు' }, D.riceCard, { en: 'Family photo', te: 'కుటుంబ ఫోటో' }],
    steps: serviceSteps,
    where: atSachivalayam,
    fee: { en: '₹70', te: '₹70' },
    time: { en: '20 days', te: '20 రోజులు' },
    rules: [],
  },
  {
    id: 'svc-electricity-connection',
    kind: 'service',
    status: 'active',
    category: 'utilities',
    icon: '💡',
    priority: 112,
    name: { en: 'New electricity connection', te: 'కొత్త విద్యుత్ కనెక్షన్' },
    summary: { en: 'Apply for a new domestic power connection through the Sachivalayam.', te: 'సచివాలయం ద్వారా కొత్త గృహ విద్యుత్ కనెక్షన్‌కు దరఖాస్తు.' },
    who: [{ en: 'House owners / occupants', te: 'ఇంటి యజమానులు / నివాసులు' }],
    docs: [{ en: 'ID proof (rice card, PAN, Aadhaar, passport or driving licence)', te: 'గుర్తింపు రుజువు (రేషన్ కార్డు, PAN, ఆధార్, పాస్‌పోర్ట్ లేదా డ్రైవింగ్ లైసెన్స్)' }, { en: 'Proof of ownership / occupancy of the house', te: 'ఇంటి యాజమాన్యం / నివాస రుజువు' }, { en: 'Caste certificate (mandatory for SC / ST free power)', te: 'కుల ధృవపత్రం (SC / ST ఉచిత విద్యుత్‌కు తప్పనిసరి)' }],
    steps: serviceSteps,
    where: atSachivalayam,
    fee: { en: '₹50 user charge + department charges', te: '₹50 వినియోగ రుసుము + శాఖ ఛార్జీలు' },
    time: { en: '7 days (15 days if a line extension is needed)', te: '7 రోజులు (లైన్ విస్తరణ కావాలంటే 15 రోజులు)' },
    rules: [],
  },
  {
    id: 'svc-water-connection',
    kind: 'service',
    status: 'active',
    category: 'utilities',
    icon: '🚰',
    priority: 113,
    name: { en: 'New water tap connection', te: 'కొత్త నీటి కుళాయి కనెక్షన్' },
    summary: { en: 'Domestic drinking-water connection from the municipality / panchayat line.', te: 'మున్సిపాలిటీ / పంచాయతీ లైన్ నుండి గృహ తాగునీటి కనెక్షన్.' },
    who: [{ en: 'House owners', te: 'ఇంటి యజమానులు' }],
    docs: [{ en: 'Site plan showing the pipeline and connection point', te: 'పైప్‌లైన్, కనెక్షన్ పాయింట్ చూపే సైట్ ప్లాన్' }, { en: 'Latest property tax receipt', te: 'తాజా ఇంటి పన్ను రసీదు' }, { en: 'Rice card + income certificate (BPL connection)', te: 'రేషన్ కార్డు + ఆదాయ ధృవపత్రం (BPL కనెక్షన్)' }],
    steps: serviceSteps,
    where: atSachivalayam,
    fee: { en: '₹50 user charge + department charges', te: '₹50 వినియోగ రుసుము + శాఖ ఛార్జీలు' },
    time: { en: '15 days', te: '15 రోజులు' },
    rules: [],
  },
  {
    id: 'svc-land-mutation',
    kind: 'service',
    status: 'active',
    category: 'land',
    icon: '🗺️',
    priority: 114,
    name: { en: 'Land mutation & pattadar passbook (succession)', te: 'భూమి మ్యుటేషన్ & పట్టాదార్ పాస్‌బుక్ (వారసత్వం)' },
    summary: { en: "Change the land record (1-B) and passbook to the heirs' names after the owner dies. Purchases are usually updated automatically after registration.", te: 'యజమాని మరణం తర్వాత భూ రికార్డు (1-బి), పాస్‌బుక్‌ను వారసుల పేరిట మార్చడం. కొనుగోళ్లు సాధారణంగా రిజిస్ట్రేషన్ తర్వాత ఆటోమేటిక్‌గా మారతాయి.' },
    who: [{ en: 'Legal heirs of a land owner', te: 'భూ యజమాని చట్టబద్ధ వారసులు' }],
    docs: [{ en: 'Death certificate of the owner', te: 'యజమాని మరణ ధృవపత్రం' }, { en: 'Family member certificate', te: 'కుటుంబ సభ్యుల ధృవపత్రం' }, D.land, { en: 'Aadhaar of all heirs', te: 'వారసులందరి ఆధార్' }],
    steps: [...serviceSteps.slice(0, 2), { en: 'The VRO enquires in the village and the Tahsildar approves; check the new 1-B on meebhoomi.ap.gov.in.', te: 'VRO గ్రామంలో విచారించి తహసీల్దార్ ఆమోదిస్తారు; కొత్త 1-బిని meebhoomi.ap.gov.in లో చూడండి.' }],
    where: atSachOrMeeSeva,
    links: [{ label: { en: 'MeeBhoomi land records', te: 'మీభూమి భూ రికార్డులు' }, url: 'https://meebhoomi.ap.gov.in' }],
    note: { en: 'Fee and time limit: confirm at your Sachivalayam.', te: 'రుసుము, గడువు: సచివాలయంలో నిర్ధారించుకోండి.' },
    rules: [],
  },
  {
    id: 'svc-land-records',
    kind: 'service',
    status: 'active',
    category: 'land',
    icon: '📗',
    priority: 115,
    name: { en: 'Adangal / 1-B copy', te: 'అడంగల్ / 1-బి కాపీ' },
    summary: { en: 'Certified copy of your land records — for bank loans, crop insurance and court cases. You can also view them free on MeeBhoomi.', te: 'మీ భూ రికార్డుల ధృవీకృత కాపీ — బ్యాంకు రుణాలు, పంట బీమా, కోర్టు కేసులకు. మీభూమిలో ఉచితంగా కూడా చూడవచ్చు.' },
    who: [{ en: 'Land owners', te: 'భూ యజమానులు' }],
    docs: [{ en: 'Survey number and village name', te: 'సర్వే నంబర్ మరియు గ్రామం పేరు' }, D.aadhaar],
    steps: serviceSteps,
    where: atSachOrMeeSeva,
    links: [{ label: { en: 'MeeBhoomi land records', te: 'మీభూమి భూ రికార్డులు' }, url: 'https://meebhoomi.ap.gov.in' }],
    note: { en: 'Fee: confirm at your Sachivalayam / MeeSeva.', te: 'రుసుము: సచివాలయం / మీసేవలో నిర్ధారించుకోండి.' },
    rules: [],
  },
  {
    id: 'svc-encumbrance-certificate',
    kind: 'service',
    status: 'active',
    category: 'land',
    icon: '🔎',
    priority: 116,
    name: { en: 'Encumbrance certificate (EC)', te: 'ఎన్‌కంబరెన్స్ సర్టిఫికేట్ (EC)' },
    summary: { en: 'Shows registered sales, mortgages and transactions on a property — check before buying land or taking a loan.', te: 'ఆస్తిపై నమోదైన అమ్మకాలు, తనఖాలు, లావాదేవీలు చూపిస్తుంది — భూమి కొనే ముందు లేదా రుణం తీసుకునే ముందు చూడండి.' },
    who: [{ en: 'Anyone', te: 'ఎవరైనా' }],
    docs: [{ en: 'Property details (survey / door number, village, period to search)', te: 'ఆస్తి వివరాలు (సర్వే / ఇంటి నంబర్, గ్రామం, వెతకాల్సిన కాలం)' }],
    steps: serviceSteps,
    where: atSachivalayam,
    fee: { en: '₹50', te: '₹50' },
    time: { en: 'Same day if applied before 2 pm, otherwise 3 days', te: 'మధ్యాహ్నం 2 లోపు దరఖాస్తు చేస్తే అదే రోజు, లేకపోతే 3 రోజులు' },
    rules: [],
  },
];

/* ── Lookups ─────────────────────────────────────────────────────────────── */

export const BY_ID = new Map(CATALOG.map((c) => [c.id, c] as const));
export const getItem = (id: string) => BY_ID.get(id);
export const visible = (c: CatalogItem) => c.status !== 'retired';
export const SCHEMES = CATALOG.filter((c) => c.kind === 'scheme' && visible(c)).sort((a, b) => a.priority - b.priority);
export const SERVICES = CATALOG.filter((c) => c.kind === 'service' && visible(c)).sort((a, b) => a.priority - b.priority);

/** Old ids kept in the DB for existing applications but no longer offered. */
export const RETIRED_IDS = ['ap-housing-scheme', 'minority-shaadi-mubarak'];

export const pick = (b: Bi | undefined, lang: 'en' | 'te') => (b ? (lang === 'te' ? b.te : b.en) : '');
