/**
 * Scheme forms name documents loosely ("Aadhaar (mother)", "Caste certificate (SC)")
 * while the checklist uses canonical names ("Aadhaar Card"). Reduce both to a key
 * so "do I already have this?" works across the app.
 */
const KEYS: [RegExp, string][] = [
  // Order matters: "Bank passbook (Aadhaar linked)" is a bank document, not Aadhaar.
  [/pattadar|land record|land ownership|adangal/i, 'land'],
  [/bank|passbook/i, 'bank'],
  [/mobile number/i, 'mobile'],
  [/ration|rice card/i, 'ration'],
  [/caste/i, 'caste'],
  [/income cert|income proof|income certificate/i, 'income'],
  [/residen|domicile|nativity/i, 'residence'],
  [/death/i, 'death'],
  [/birth|age proof/i, 'birth'],
  [/photo/i, 'photo'],
  [/marriage/i, 'marriage'],
  [/disab/i, 'disability'],
  [/pan card|\bpan\b/i, 'pan'],
  [/aadhaar|aadhar|ఆధార్/i, 'aadhaar'],
];

export function docKey(name: string): string {
  for (const [re, key] of KEYS) if (re.test(name)) return key;
  return name.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z]+/g, ' ').trim();
}

/** MeeSeva service names that issue a given document key. */
export const SERVICE_FOR_KEY: Record<string, string[]> = {
  aadhaar: ['Aadhaar Update', 'Aadhaar Enrolment', 'Aadhaar'],
  caste: ['Caste Certificate'],
  income: ['Income Certificate'],
  residence: ['Residence Certificate'],
  birth: ['Birth Certificate'],
  death: ['Death Certificate'],
  ration: ['Ration Card'],
  land: ['Land Records'],
  pan: ['PAN Card'],
  marriage: ['Marriage Certificate'],
};

/** Where each document is issued, in both languages. */
export const ISSUER: Record<string, { en: string; te: string }> = {
  aadhaar: { en: 'Aadhaar Seva Kendra or a MeeSeva centre', te: 'ఆధార్ సేవా కేంద్రం లేదా మీసేవ' },
  ration: { en: 'Your village / ward Sachivalayam', te: 'మీ గ్రామ / వార్డు సచివాలయం' },
  caste: { en: 'Sachivalayam, MeeSeva or Tahsildar office', te: 'సచివాలయం, మీసేవ లేదా తహసీల్దార్ కార్యాలయం' },
  income: { en: 'Sachivalayam, MeeSeva or Tahsildar office', te: 'సచివాలయం, మీసేవ లేదా తహసీల్దార్ కార్యాలయం' },
  residence: { en: 'Sachivalayam or MeeSeva centre', te: 'సచివాలయం లేదా మీసేవ కేంద్రం' },
  birth: { en: 'Municipal office / Gram Panchayat, or MeeSeva', te: 'మున్సిపల్ కార్యాలయం / గ్రామ పంచాయతీ లేదా మీసేవ' },
  death: { en: 'Municipal office / Gram Panchayat, or MeeSeva', te: 'మున్సిపల్ కార్యాలయం / గ్రామ పంచాయతీ లేదా మీసేవ' },
  bank: { en: 'Any bank branch (link it to Aadhaar)', te: 'ఏదైనా బ్యాంకు శాఖ (ఆధార్‌తో లింక్ చేయండి)' },
  land: { en: 'Sachivalayam (VRO) or MeeSeva', te: 'సచివాలయం (VRO) లేదా మీసేవ' },
  photo: { en: 'Any photo studio', te: 'ఏదైనా ఫోటో స్టూడియో' },
};
