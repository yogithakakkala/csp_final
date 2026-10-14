import type { CertificateService } from '@/types';

// Certificate services — checklist-only, no eligibility form.
export const CERTIFICATE_SERVICES: CertificateService[] = [
  {
    id: 'caste-certificate',
    name: 'Caste Certificate',
    name_telugu: 'కుల ధృవపత్రం',
    icon: '📜',
    required_documents: [
      { en: 'Aadhaar', te: 'ఆధార్' },
      { en: 'Ration card', te: 'రేషన్ కార్డు' },
      { en: "Father / Mother's caste certificate", te: 'తండ్రి / తల్లి కుల ధృవపత్రం' },
      { en: 'Residence certificate', te: 'నివాస ధృవపత్రం' },
      { en: 'Passport photo', te: 'పాస్‌పోర్ట్ ఫోటో' },
    ],
  },
  {
    id: 'income-certificate',
    name: 'Income Certificate',
    name_telugu: 'ఆదాయ ధృవపత్రం',
    icon: '💰',
    required_documents: [
      { en: 'Aadhaar', te: 'ఆధార్' },
      { en: 'Ration card', te: 'రేషన్ కార్డు' },
      { en: 'Employment / business income proof', te: 'ఉద్యోగ / వ్యాపార ఆదాయ రుజువు' },
      { en: 'Self-declaration form', te: 'స్వీయ ప్రకటన ఫారం' },
    ],
  },
  {
    id: 'residence-certificate',
    name: 'Residence Certificate',
    name_telugu: 'నివాస ధృవపత్రం',
    icon: '🏠',
    required_documents: [
      { en: 'Aadhaar (with address)', te: 'ఆధార్ (చిరునామాతో)' },
      { en: 'Ration card', te: 'రేషన్ కార్డు' },
      { en: 'Electricity / water bill', te: 'విద్యుత్ / నీటి బిల్లు' },
      { en: 'Passport photo', te: 'పాస్‌పోర్ట్ ఫోటో' },
    ],
  },
  {
    id: 'birth-certificate',
    name: 'Birth Certificate',
    name_telugu: 'జన్మ ధృవపత్రం',
    icon: '👶',
    required_documents: [
      { en: 'Hospital birth record', te: 'హాస్పిటల్ జనన రికార్డు' },
      { en: "Parents' Aadhaar cards", te: 'తల్లిదండ్రుల ఆధార్ కార్డులు' },
      { en: 'Ration card', te: 'రేషన్ కార్డు' },
      { en: 'Application form', te: 'దరఖాస్తు ఫారం' },
    ],
  },
  {
    id: 'death-certificate',
    name: 'Death Certificate',
    name_telugu: 'మరణ ధృవపత్రం',
    icon: '🕊️',
    required_documents: [
      { en: 'Hospital death record / medical certificate', te: 'హాస్పిటల్ మరణ రికార్డు / వైద్య ధృవపత్రం' },
      { en: "Deceased's Aadhaar", te: 'మృతుని ఆధార్' },
      { en: 'Ration card', te: 'రేషన్ కార్డు' },
      { en: "Applicant's Aadhaar", te: 'దరఖాస్తుదారుని ఆధార్' },
    ],
  },
  {
    id: 'marriage-certificate',
    name: 'Marriage Certificate',
    name_telugu: 'వివాహ ధృవపత్రం',
    icon: '💍',
    required_documents: [
      { en: 'Groom & bride Aadhaar cards', te: 'వరుడు & వధువు ఆధార్ కార్డులు' },
      { en: 'Wedding invitation / photos', te: 'వివాహ ఆహ్వానం / ఫోటోలు' },
      { en: "Witnesses' Aadhaar cards (2)", te: 'సాక్షుల ఆధార్ కార్డులు (2)' },
      { en: 'Ration card', te: 'రేషన్ కార్డు' },
    ],
  },
  {
    id: 'pattadar-passbook',
    name: 'Pattadar Passbook',
    name_telugu: 'పట్టాదార్ పాస్‌బుక్',
    icon: '📗',
    required_documents: [
      { en: 'Aadhaar', te: 'ఆధార్' },
      { en: 'Land records (1-B, Adangal)', te: 'భూ రికార్డులు (1-B, అడంగల్)' },
      { en: 'Ration card', te: 'రేషన్ కార్డు' },
      { en: 'Passport photo', te: 'పాస్‌పోర్ట్ ఫోటో' },
    ],
  },
  {
    id: 'ration-card-new',
    name: 'Ration Card — New',
    name_telugu: 'కొత్త రేషన్ కార్డు',
    icon: '🆕',
    required_documents: [
      { en: 'Aadhaar cards (all family members)', te: 'ఆధార్ కార్డులు (కుటుంబ సభ్యులందరూ)' },
      { en: 'Residence certificate', te: 'నివాస ధృవపత్రం' },
      { en: 'Income certificate', te: 'ఆదాయ ధృవపత్రం' },
      { en: 'Previous ration card cancellation (if applicable)', te: 'పూర్వ రేషన్ కార్డు రద్దు (వర్తిస్తే)' },
      { en: 'Passport photo (head of family)', te: 'పాస్‌పోర్ట్ ఫోటో (కుటుంబ యజమాని)' },
    ],
  },
  {
    id: 'ration-card-add',
    name: 'Ration Card — Member Addition',
    name_telugu: 'సభ్యుని చేర్పు',
    icon: '➕',
    required_documents: [
      { en: 'Existing ration card', te: 'ప్రస్తుత రేషన్ కార్డు' },
      { en: "New member's Aadhaar", te: 'కొత్త సభ్యుని ఆధార్' },
      { en: 'Birth certificate (if infant)', te: 'జనన ధృవపత్రం (శిశువు అయితే)' },
      { en: 'Marriage certificate (if by marriage)', te: 'వివాహ ధృవపత్రం (వివాహం ద్వారా అయితే)' },
    ],
  },
];
