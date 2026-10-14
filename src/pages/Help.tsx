import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { PageHeader } from '@/components/ui';
import ListenButton from '@/components/ListenButton';
import { cn } from '@/lib/utils';

const FAQ: { q: [string, string]; a: [string, string]; link?: [string, string, string] }[] = [
  {
    q: ['What is a Sachivalayam?', 'సచివాలయం అంటే ఏమిటి?'],
    a: ['A Grama or Ward Sachivalayam is the government office closest to your home. It handles welfare schemes, certificates and most citizen services for your village or ward.', 'గ్రామ లేదా వార్డు సచివాలయం మీ ఇంటికి దగ్గరి ప్రభుత్వ కార్యాలయం. సంక్షేమ పథకాలు, ధృవపత్రాలు, చాలా పౌర సేవలు అక్కడే.'],
    link: ['/nearest-center', 'Find yours', 'మీదాన్ని కనుగొనండి'],
  },
  {
    q: ['How do I know which schemes I can get?', 'నాకు ఏ పథకాలు వస్తాయో ఎలా తెలుసుకోవాలి?'],
    a: ['Open My schemes and answer the family questions once (skip any you are unsure of). You’ll see every scheme you qualify for, ones to confirm, your benefit, and one combined document list. Then use Apply for all.', '“నా పథకాలు” తెరిచి కుటుంబ ప్రశ్నలకు ఒక్కసారి జవాబివ్వండి (తెలియనివి వదిలేయవచ్చు). అర్హత ఉన్న ప్రతి పథకం, నిర్ధారించాల్సినవి, మీ ప్రయోజనం, ఒకే పత్రాల జాబితా కనిపిస్తాయి. తర్వాత “అన్నింటికీ దరఖాస్తు” వాడండి.'],
    link: ['/eligible', 'My schemes', 'నా పథకాలు'],
  },
  {
    q: ['How do I apply?', 'ఎలా దరఖాస్తు చేయాలి?'],
    a: ['Open a scheme, tap Apply, fill in your details and add photos of your documents. Your progress saves while you type, so you can stop and come back later.', 'పథకం తెరిచి దరఖాస్తు నొక్కండి, వివరాలు నింపి పత్రాల ఫోటోలు జోడించండి. టైప్ చేస్తుండగానే సేవ్ అవుతుంది — తర్వాత కొనసాగించవచ్చు.'],
    link: ['/schemes', 'All schemes', 'అన్ని పథకాలు'],
  },
  {
    q: ['Where is my application now?', 'నా దరఖాస్తు ఇప్పుడు ఎక్కడ ఉంది?'],
    a: ['Open Applications and tap it to see each step with dates. Anyone can also check with the application number on Track by number — no login needed.', '“దరఖాస్తులు”లో దాన్ని నొక్కితే ప్రతి దశ తేదీలతో కనిపిస్తుంది. “నంబర్‌తో ట్రాక్”లో లాగిన్ లేకుండా కూడా చూడవచ్చు.'],
    link: ['/track', 'Track by number', 'నంబర్‌తో ట్రాక్'],
  },
  {
    q: ['Staff asked for a document. What do I do?', 'సిబ్బంది పత్రం అడిగారు. ఏం చేయాలి?'],
    a: ['Open the application. A yellow box at the top shows exactly what they need with an Upload button. You can also message staff there.', 'దరఖాస్తు తెరవండి. పైన పసుపు పెట్టెలో వారికి ఏం కావాలో, అప్‌లోడ్ బటన్‌తో కనిపిస్తుంది. అక్కడే సిబ్బందికి సందేశం పంపవచ్చు.'],
  },
  {
    q: ['There has been no update for a long time', 'చాలా రోజులుగా అప్‌డేట్ లేదు'],
    a: ['After 7 days without an update, an Escalate button appears on the application. It alerts the officer, and you’re notified when they respond.', '7 రోజులు అప్‌డేట్ లేకపోతే దరఖాస్తుపై “ఫిర్యాదు చేయి” బటన్ వస్తుంది. అధికారికి హెచ్చరిక వెళ్తుంది, స్పందించగానే మీకు తెలుస్తుంది.'],
  },
  {
    q: ['I don’t have a document', 'నా దగ్గర పత్రం లేదు'],
    a: ['My documents tells you where each one is issued. Most certificates come from a MeeSeva centre or your Sachivalayam.', '“నా పత్రాలు” ప్రతి పత్రం ఎక్కడ ఇస్తారో చెబుతుంది. చాలా ధృవపత్రాలు మీసేవ లేదా సచివాలయంలో.'],
    link: ['/documents', 'My documents', 'నా పత్రాలు'],
  },
  {
    q: ['I forgot my password', 'పాస్‌వర్డ్ మర్చిపోయాను'],
    a: ['Use Reset password on the login screen. We’ll email you a link to set a new one.', 'లాగిన్ స్క్రీన్‌లో “పాస్‌వర్డ్ మర్చిపోయారా?” నొక్కండి. కొత్త పాస్‌వర్డ్ కోసం లింక్ ఇమెయిల్ చేస్తాం.'],
    link: ['/forgot-password', 'Reset password', 'పాస్‌వర్డ్ రీసెట్'],
  },
  {
    q: ['Is my information safe?', 'నా సమాచారం సురక్షితమేనా?'],
    a: ['Your documents are private. Only you and the staff handling your application can open them. Never type your full Aadhaar number anywhere in the app.', 'మీ పత్రాలు ప్రైవేట్. మీరు, మీ దరఖాస్తు చూసే సిబ్బంది మాత్రమే తెరవగలరు. యాప్‌లో ఎక్కడా పూర్తి ఆధార్ నంబర్ టైప్ చేయకండి.'],
  },
];

export default function Help() {
  const { lang, tx } = useLang();
  const [open, setOpen] = useState<number | null>(0);
  const i = lang === 'te' ? 1 : 0;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={tx('Help', 'సహాయం')} subtitle={tx('How to find every scheme you qualify for, the documents you need, and how to apply. Still stuck? Ask SachiBot or visit your Sachivalayam.', 'అర్హత ఉన్న అన్ని పథకాలు, కావలసిన పత్రాలు, దరఖాస్తు విధానం. ఇంకా సందేహమా? సచిబాట్‌ను అడగండి లేదా సచివాలయానికి వెళ్లండి.')} />
      <ul className="divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-paper">
        {FAQ.map((f, n) => (
          <li key={n}>
            <button onClick={() => setOpen(open === n ? null : n)} className="flex w-full items-center justify-between gap-3 p-5 text-left" aria-expanded={open === n}>
              <span className="text-[17px] font-semibold">{f.q[i]}</span>
              <ChevronDown className={cn('size-5 shrink-0 text-muted transition-transform', open === n && 'rotate-180')} />
            </button>
            {open === n && (
              <div className="-mt-1 animate-rise px-5 pb-5">
                <p className="max-w-[65ch] text-[15px] leading-relaxed text-ink/85">{f.a[i]}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {f.link && (
                    <Link to={f.link[0]} className="font-semibold underline decoration-turmeric decoration-2 underline-offset-2">
                      {lang === 'te' ? f.link[2] : f.link[1]}
                    </Link>
                  )}
                  <ListenButton text={`${f.q[i]}. ${f.a[i]}`} />
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-6 rounded-[18px] bg-ink-50 p-5 text-[15px]">
        <p className="font-semibold">{tx('About SachiSeva', 'సచిసేవ గురించి')}</p>
        <p className="mt-1 text-muted">
          {tx('A community service project to cut unnecessary trips to the Sachivalayam. It is not an official government website; final decisions are always made by Sachivalayam officials.', 'అనవసర సచివాలయ ప్రయాణాలు తగ్గించేందుకు ఒక సమాజ సేవా ప్రాజెక్ట్. ఇది అధికారిక ప్రభుత్వ వెబ్‌సైట్ కాదు; అంతిమ నిర్ణయాలు సచివాలయ అధికారులవే.')}
        </p>
      </div>
    </div>
  );
}
