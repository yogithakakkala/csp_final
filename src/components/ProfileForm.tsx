import { useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import type { FamilyProfile } from '@/lib/profile';
import { Button, Card, Input, ProgressBar } from '@/components/ui';
import { cn } from '@/lib/utils';

type Opt<T = string> = { value: T; en: string; te: string };
type Q =
  | { key: keyof FamilyProfile; kind: 'choice'; en: string; te: string; hint?: [string, string]; options: Opt[]; show?: (p: FamilyProfile) => boolean }
  | { key: keyof FamilyProfile; kind: 'yesno'; en: string; te: string; hint?: [string, string]; show?: (p: FamilyProfile) => boolean }
  | { key: keyof FamilyProfile; kind: 'number'; en: string; te: string; hint?: [string, string]; suffix?: [string, string]; quick: Opt<number>[]; max: number; show?: (p: FamilyProfile) => boolean };

const STEPS: { en: string; te: string; sub: [string, string]; qs: Q[] }[] = [
  {
    en: 'About you',
    te: 'మీ గురించి',
    sub: ['Answer for the person who will apply.', 'దరఖాస్తు చేసే వ్యక్తి గురించి చెప్పండి.'],
    qs: [
      { key: 'age', kind: 'number', en: 'Age', te: 'వయసు', suffix: ['years', 'సంవత్సరాలు'], max: 110, quick: [] },
      {
        key: 'gender', kind: 'choice', en: 'Gender', te: 'లింగం',
        options: [{ value: 'female', en: 'Woman', te: 'స్త్రీ' }, { value: 'male', en: 'Man', te: 'పురుషుడు' }, { value: 'transgender', en: 'Transgender', te: 'ట్రాన్స్‌జెండర్' }],
      },
      {
        key: 'marital', kind: 'choice', en: 'Marital status', te: 'వైవాహిక స్థితి',
        options: [
          { value: 'married', en: 'Married', te: 'వివాహితులు' },
          { value: 'unmarried', en: 'Not married', te: 'అవివాహితులు' },
          { value: 'widow', en: 'Widow', te: 'వితంతువు' },
          { value: 'single_woman', en: 'Single woman (separated / divorced)', te: 'ఒంటరి మహిళ (విడిపోయిన / విడాకులు)' },
        ],
      },
      {
        key: 'caste', kind: 'choice', en: 'Community', te: 'సామాజిక వర్గం',
        options: [
          { value: 'SC', en: 'SC', te: 'ఎస్సీ' }, { value: 'ST', en: 'ST', te: 'ఎస్టీ' }, { value: 'BC', en: 'BC', te: 'బీసీ' },
          { value: 'Minority', en: 'Minority', te: 'మైనారిటీ' }, { value: 'OC', en: 'OC / general', te: 'ఓసీ / జనరల్' },
        ],
      },
      {
        key: 'work', kind: 'choice', en: 'Main work', te: 'ప్రధాన పని',
        options: [
          { value: 'farmer_owner', en: 'Farmer (own land)', te: 'రైతు (సొంత భూమి)' },
          { value: 'farmer_tenant', en: 'Tenant farmer', te: 'కౌలు రైతు' },
          { value: 'weaver', en: 'Handloom weaver', te: 'చేనేత కార్మికుడు' },
          { value: 'fisherman', en: 'Fisherman', te: 'మత్స్యకారుడు' },
          { value: 'driver_owner', en: 'Auto / taxi / cab owner-driver', te: 'ఆటో / టాక్సీ / క్యాబ్ ఓనర్-డ్రైవర్' },
          { value: 'artisan', en: 'Artisan / traditional craft', te: 'చేతివృత్తి / కుల వృత్తి' },
          { value: 'toddy_tapper', en: 'Toddy tapper', te: 'కల్లు గీత కార్మికుడు' },
          { value: 'construction', en: 'Construction / daily wage', te: 'భవన నిర్మాణ / రోజు కూలీ' },
          { value: 'private', en: 'Private job', te: 'ప్రైవేట్ ఉద్యోగం' },
          { value: 'business', en: 'Own business / shop', te: 'సొంత వ్యాపారం / దుకాణం' },
          { value: 'govt', en: 'Government job', te: 'ప్రభుత్వ ఉద్యోగం' },
          { value: 'student', en: 'Student', te: 'విద్యార్థి' },
          { value: 'unemployed', en: 'Looking for work', te: 'ఉద్యోగం వెతుకుతున్నారు' },
          { value: 'homemaker', en: 'Homemaker', te: 'గృహిణి' },
          { value: 'other', en: 'Other', te: 'ఇతర' },
        ],
      },
      {
        key: 'education', kind: 'choice', en: 'Highest education', te: 'అత్యున్నత విద్య',
        options: [
          { value: 'none', en: 'No schooling', te: 'చదువు లేదు' }, { value: 'below_ssc', en: 'Below 10th', te: '10వ తరగతి లోపు' },
          { value: 'ssc', en: '10th', te: '10వ తరగతి' }, { value: 'inter', en: 'Inter / ITI / diploma', te: 'ఇంటర్ / ITI / డిప్లొమా' },
          { value: 'degree', en: 'Degree', te: 'డిగ్రీ' }, { value: 'pg', en: 'PG', te: 'పీజీ' },
        ],
      },
      {
        key: 'disability', kind: 'choice', en: 'Disability (SADAREM certificate)', te: 'వైకల్యం (సదరం ధృవపత్రం)',
        options: [
          { value: 'none', en: 'None', te: 'లేదు' }, { value: '40_79', en: '40–79%', te: '40–79%' },
          { value: '80_plus', en: '80% or more', te: '80% లేదా ఎక్కువ' }, { value: 'bedridden', en: 'Bedridden', te: 'మంచానికే పరిమితం' },
        ],
      },
      { key: 'chronic_illness', kind: 'yesno', en: 'On dialysis, or has thalassemia / CKDU?', te: 'డయాలసిస్ / తలసేమియా / CKDU ఉందా?' },
    ],
  },
  {
    en: 'Family & home',
    te: 'కుటుంబం & ఇల్లు',
    sub: ['Everyone on the same rice card counts as one family.', 'ఒకే రేషన్ కార్డులో ఉన్నవారంతా ఒక కుటుంబం.'],
    qs: [
      { key: 'area', kind: 'choice', en: 'Where do you live?', te: 'మీరు ఎక్కడ ఉంటారు?', options: [{ value: 'rural', en: 'Village', te: 'గ్రామం' }, { value: 'urban', en: 'Town / city', te: 'పట్టణం / నగరం' }] },
      { key: 'rice_card', kind: 'yesno', en: 'White (BPL) rice card?', te: 'తెల్ల (BPL) రేషన్ కార్డు ఉందా?' },
      {
        key: 'monthly_income', kind: 'number', en: 'Whole family’s income per month', te: 'కుటుంబం మొత్తం నెలవారీ ఆదాయం',
        hint: ['Add up everyone’s earnings. A rough figure is fine.', 'అందరి సంపాదన కలపండి. సుమారుగా చెప్పినా చాలు.'],
        suffix: ['₹ / month', '₹ / నెల'], max: 10000000,
        quick: [
          { value: 5000, en: '₹5,000', te: '₹5,000' }, { value: 10000, en: '₹10,000', te: '₹10,000' },
          { value: 12000, en: '₹12,000', te: '₹12,000' }, { value: 20000, en: '₹20,000', te: '₹20,000' }, { value: 40000, en: '₹40,000+', te: '₹40,000+' },
        ],
      },
      {
        key: 'school_children', kind: 'number', en: 'Children studying in Class 1–12', te: '1–12 తరగతి చదువుతున్న పిల్లలు', max: 12,
        quick: [{ value: 0, en: 'None', te: 'లేరు' }, { value: 1, en: '1', te: '1' }, { value: 2, en: '2', te: '2' }, { value: 3, en: '3', te: '3' }],
      },
      { key: 'college_student', kind: 'yesno', en: 'Anyone in ITI / polytechnic / degree / PG?', te: 'ITI / పాలిటెక్నిక్ / డిగ్రీ / పీజీ చదువుతున్నవారు ఉన్నారా?' },
      { key: 'lpg', kind: 'yesno', en: 'LPG gas connection?', te: 'గ్యాస్ కనెక్షన్ ఉందా?' },
      { key: 'pucca_house', kind: 'yesno', en: 'Own a pucca (concrete) house?', te: 'సొంత పక్కా ఇల్లు ఉందా?' },
      { key: 'other_pension', kind: 'yesno', en: 'Already getting a government pension?', te: 'ఇప్పటికే ప్రభుత్వ పింఛన్ వస్తోందా?' },
    ],
  },
  {
    en: 'Six-step check',
    te: 'ఆరు అంచెల పరిశీలన',
    sub: ['The government checks these for most welfare schemes.', 'చాలా సంక్షేమ పథకాలకు ప్రభుత్వం వీటిని పరిశీలిస్తుంది.'],
    qs: [
      {
        key: 'wet_acres', kind: 'number', en: 'Wet (irrigated) land owned by the family', te: 'కుటుంబానికి ఉన్న మాగాణి భూమి', suffix: ['acres', 'ఎకరాలు'], max: 1000,
        quick: [{ value: 0, en: 'None', te: 'లేదు' }, { value: 1, en: '1', te: '1' }, { value: 3, en: '3', te: '3' }, { value: 5, en: '5+', te: '5+' }],
      },
      {
        key: 'dry_acres', kind: 'number', en: 'Dry land owned by the family', te: 'కుటుంబానికి ఉన్న మెట్ట భూమి', suffix: ['acres', 'ఎకరాలు'], max: 1000,
        quick: [{ value: 0, en: 'None', te: 'లేదు' }, { value: 2, en: '2', te: '2' }, { value: 5, en: '5', te: '5' }, { value: 10, en: '10', te: '10' }, { value: 15, en: '15+', te: '15+' }],
      },
      {
        key: 'units', kind: 'choice', en: 'Electricity used per month', te: 'నెలకు విద్యుత్ వినియోగం', hint: ['See the units on your power bill.', 'కరెంటు బిల్లులో యూనిట్లు చూడండి.'],
        options: [
          { value: 'lt100', en: 'Under 100 units', te: '100 యూనిట్ల లోపు' }, { value: '100_200', en: '100–200', te: '100–200' },
          { value: '200_300', en: '200–300', te: '200–300' }, { value: 'gt300', en: 'Over 300', te: '300 పైగా' },
        ],
      },
      {
        key: 'vehicle', kind: 'choice', en: 'Four-wheeler in the family', te: 'కుటుంబంలో నాలుగు చక్రాల వాహనం',
        options: [
          { value: 'none', en: 'None', te: 'లేదు' }, { value: 'commercial', en: 'Taxi / tractor / auto only', te: 'టాక్సీ / ట్రాక్టర్ / ఆటో మాత్రమే' },
          { value: 'private', en: 'Private car', te: 'సొంత కారు' },
        ],
      },
      { key: 'govt_in_family', kind: 'yesno', en: 'Anyone a government employee or government pensioner?', te: 'కుటుంబంలో ప్రభుత్వ ఉద్యోగి లేదా ప్రభుత్వ పింఛనుదారు ఉన్నారా?', hint: ['Sanitation workers are exempt — answer No.', 'పారిశుధ్య కార్మికులకు మినహాయింపు — లేదు అని ఎంచుకోండి.'] },
      { key: 'income_tax', kind: 'yesno', en: 'Anyone pays income tax?', te: 'ఎవరైనా ఆదాయపు పన్ను చెల్లిస్తారా?' },
      { key: 'urban_property_1000', kind: 'yesno', en: 'Own 1,000 sq ft or more of house / property in a town?', te: 'పట్టణంలో 1,000 చ.అ. లేదా ఎక్కువ ఇల్లు / ఆస్తి ఉందా?' },
    ],
  },
];

export const PROFILE_STEP_COUNT = STEPS.length;

export default function ProfileForm({
  initial,
  onDone,
  saving,
  startStep = 0,
}: {
  initial: FamilyProfile | null;
  onDone: (p: FamilyProfile) => void;
  saving?: boolean;
  startStep?: number;
}) {
  const { tx, lang } = useLang();
  const [p, setP] = useState<FamilyProfile>(() => ({ ...(initial ?? {}) }));
  const [step, setStep] = useState(startStep);
  const s = STEPS[step];
  const qs = useMemo(() => s.qs.filter((q) => !q.show || q.show(p)), [s, p]);
  const answered = qs.filter((q) => p[q.key] !== undefined).length;
  const last = step === STEPS.length - 1;

  const set = (k: keyof FamilyProfile, v: unknown) => setP((cur) => ({ ...cur, [k]: v }));
  const L = (o: { en: string; te: string }) => (lang === 'te' ? o.te : o.en);

  const next = () => {
    if (last) onDone(p);
    else {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold text-ink">
            {tx(`Step ${step + 1} of ${STEPS.length}`, `దశ ${step + 1} / ${STEPS.length}`)}
          </p>
          <p className="text-sm text-muted">{tx(`${answered} of ${qs.length} answered`, `${qs.length} లో ${answered} జవాబిచ్చారు`)}</p>
        </div>
        <ProgressBar value={((step + answered / Math.max(1, qs.length)) / STEPS.length) * 100} className="mt-2" />
        <h2 className="display mt-5 text-[24px] sm:text-[28px]">{L(s)}</h2>
        <p className="mt-1 text-[15px] text-muted">{lang === 'te' ? s.sub[1] : s.sub[0]}</p>
      </div>

      <div className="space-y-3">
        {qs.map((q) => (
          <Card key={q.key} className="p-4 sm:p-5">
            <QuestionLabel q={q} answered={p[q.key] !== undefined} />
            <div className="mt-3">
              {q.kind === 'choice' && (
                <Choices value={p[q.key] as string | undefined} options={q.options.map((o) => ({ value: o.value, label: L(o) }))} onChange={(v) => set(q.key, v)} />
              )}
              {q.kind === 'yesno' && (
                <Choices
                  value={p[q.key] === undefined ? undefined : p[q.key] ? 'y' : 'n'}
                  options={[{ value: 'y', label: tx('Yes', 'అవును') }, { value: 'n', label: tx('No', 'లేదు') }]}
                  onChange={(v) => set(q.key, v === 'y')}
                />
              )}
              {q.kind === 'number' && (
                <NumberQ
                  value={p[q.key] as number | undefined}
                  max={q.max}
                  suffix={q.suffix ? (lang === 'te' ? q.suffix[1] : q.suffix[0]) : undefined}
                  quick={q.quick.map((o) => ({ value: o.value, label: L(o) }))}
                  onChange={(v) => set(q.key, v)}
                  id={`q-${q.key}`}
                />
              )}
            </div>
          </Card>
        ))}
      </div>

      <p className="mt-4 flex items-start gap-2 text-sm text-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-leaf" />
        {tx('Skip anything you are unsure of — we will show it as “confirm at Sachivalayam”. Your answers stay on this phone and in your account only.', 'తెలియనివి వదిలేయండి — “సచివాలయంలో నిర్ధారించండి” అని చూపిస్తాం. మీ జవాబులు ఈ ఫోన్‌లో, మీ ఖాతాలో మాత్రమే ఉంటాయి.')}
      </p>

      <div className="pb-safe sticky bottom-[64px] z-20 -mx-4 mt-4 flex items-center gap-2 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none">
        {step > 0 && (
          <Button variant="outline" onClick={() => setStep(step - 1)} aria-label={tx('Back', 'వెనుకకు')}>
            <ArrowLeft className="size-4" />
          </Button>
        )}
        <Button className="flex-1 sm:flex-none" size="lg" onClick={next} loading={saving}>
          {last ? (
            <>
              <Check className="size-5" /> {tx('Show my schemes', 'నా పథకాలు చూపించు')}
            </>
          ) : (
            <>
              {tx('Next', 'తరువాత')} <ArrowRight className="size-4" />
            </>
          )}
        </Button>
        {!last && (
          <button type="button" onClick={() => onDone(p)} className="ml-auto px-2 text-sm font-semibold text-muted underline-offset-2 hover:text-ink hover:underline">
            {tx('See results now', 'ఇప్పుడే ఫలితాలు')}
          </button>
        )}
      </div>
    </div>
  );
}

function QuestionLabel({ q, answered }: { q: Q; answered: boolean }): ReactNode {
  const { lang } = useLang();
  return (
    <div className="flex items-start gap-2.5">
      <span className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full transition-colors', answered ? 'bg-leaf text-white' : 'border-2 border-ink/15')}>
        {answered && <Check className="size-3" strokeWidth={3} />}
      </span>
      <div>
        <p className="text-[16px] font-semibold leading-snug">{lang === 'te' ? q.te : q.en}</p>
        <p className="text-[13px] text-muted">{lang === 'te' ? q.en : q.te}</p>
        {q.hint && <p className="mt-1 text-[13px] text-muted">{lang === 'te' ? q.hint[1] : q.hint[0]}</p>}
      </div>
    </div>
  );
}

function Choices({ value, options, onChange }: { value: string | undefined; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'min-h-11 rounded-[12px] border px-4 py-2 text-left text-[15px] font-medium transition-colors',
              on ? 'border-ink bg-ink text-white' : 'border-line bg-paper text-ink hover:border-ink/40',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function NumberQ({
  value, onChange, quick, suffix, max, id,
}: { value: number | undefined; onChange: (v: number | undefined) => void; quick: { value: number; label: string }[]; suffix?: string; max: number; id: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-40">
        <Input
          id={id}
          inputMode="decimal"
          value={value ?? ''}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^\d.]/g, '');
            if (!raw) return onChange(undefined);
            const n = Math.min(max, Number(raw));
            onChange(Number.isFinite(n) ? n : undefined);
          }}
          className={suffix ? 'pr-16' : undefined}
        />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">{suffix}</span>}
      </div>
      {quick.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'h-11 rounded-[12px] border px-3.5 text-[15px] font-medium transition-colors',
            value === o.value ? 'border-ink bg-ink text-white' : 'border-line bg-paper hover:border-ink/40',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
