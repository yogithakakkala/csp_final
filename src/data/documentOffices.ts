import type { DocumentOffice } from '@/types';

export const DOCUMENT_OFFICES_SEED: DocumentOffice[] = [
  { id: 'doc-aadhaar', document_type: 'Aadhaar Card', issuing_office_type: 'Aadhaar Seva Kendra', notes: null },
  {
    id: 'doc-caste',
    document_type: 'Caste Certificate',
    issuing_office_type: 'Tahsildar Office / MeeSeva Center',
    notes: null,
  },
  { id: 'doc-income', document_type: 'Income Certificate', issuing_office_type: 'Tahsildar Office', notes: null },
  { id: 'doc-ration', document_type: 'Ration Card', issuing_office_type: 'Sachivalayam Center', notes: null },
  {
    id: 'doc-residence',
    document_type: 'Residence Certificate',
    issuing_office_type: 'Tahsildar Office / MeeSeva Center',
    notes: null,
  },
  {
    id: 'doc-birth',
    document_type: 'Birth Certificate',
    issuing_office_type: 'Municipal Corporation / Gram Panchayat Office',
    notes: null,
  },
];

export const COMMON_DOCUMENTS = [
  { en: 'Aadhaar Card', te: 'ఆధార్ కార్డు' },
  { en: 'Ration Card', te: 'రేషన్ కార్డు' },
  { en: 'Caste Certificate', te: 'కుల ధృవీకరణ పత్రం' },
  { en: 'Income Certificate', te: 'ఆదాయ ధృవీకరణ పత్రం' },
  { en: 'Residence Certificate', te: 'నివాస ధృవీకరణ పత్రం' },
  { en: 'Birth Certificate', te: 'జనన ధృవీకరణ పత్రం' },
  { en: 'Bank passbook (Aadhaar-linked)', te: 'బ్యాంకు పాస్‌బుక్ (ఆధార్ లింక్)' },
  { en: 'Passport-size photo', te: 'పాస్‌పోర్ట్ సైజు ఫోటో' },
  { en: 'Pattadar passbook / land records', te: 'పట్టాదార్ పాస్‌బుక్ / భూ రికార్డులు' },
  { en: 'SADAREM disability certificate', te: 'సదరం వైకల్య ధృవపత్రం' },
];
