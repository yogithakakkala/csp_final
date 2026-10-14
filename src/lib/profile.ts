/**
 * The family profile: answered once, used everywhere (eligibility for every
 * scheme, pre-filling forms). Mirrors the questions behind Andhra Pradesh's
 * "six-step" welfare validation (income, land, electricity, four-wheeler,
 * government job / pension, income tax, urban property).
 *
 * Every field is optional — an unanswered question makes a scheme "likely"
 * instead of "eligible", never "not eligible".
 */
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export type Gender = 'female' | 'male' | 'transgender';
export type Marital = 'married' | 'unmarried' | 'widow' | 'single_woman';
export type Caste = 'SC' | 'ST' | 'BC' | 'OC' | 'Minority';
export type Area = 'rural' | 'urban';
export type Disability = 'none' | '40_79' | '80_plus' | 'bedridden';
export type Education = 'none' | 'below_ssc' | 'ssc' | 'inter' | 'degree' | 'pg';
export type Work =
  | 'farmer_owner'
  | 'farmer_tenant'
  | 'weaver'
  | 'fisherman'
  | 'driver_owner'
  | 'artisan'
  | 'toddy_tapper'
  | 'construction'
  | 'govt'
  | 'private'
  | 'business'
  | 'student'
  | 'unemployed'
  | 'homemaker'
  | 'other';
export type Units = 'lt100' | '100_200' | '200_300' | 'gt300';
export type Vehicle = 'none' | 'commercial' | 'private';

export interface FamilyProfile {
  // About the person
  name?: string;
  age?: number;
  gender?: Gender;
  marital?: Marital;
  caste?: Caste;
  disability?: Disability;
  chronic_illness?: boolean; // dialysis, thalassemia, CKDU
  education?: Education;
  work?: Work;
  // Family & home
  area?: Area;
  rice_card?: boolean; // white / BPL rice card
  monthly_income?: number; // whole family, ₹ per month
  school_children?: number; // classes 1–12
  college_student?: boolean; // anyone in degree / diploma / ITI / polytechnic
  lpg?: boolean;
  pucca_house?: boolean;
  // Six-step validation
  wet_acres?: number;
  dry_acres?: number;
  units?: Units;
  vehicle?: Vehicle;
  govt_in_family?: boolean; // govt employee or govt pensioner (sanitation workers excepted)
  income_tax?: boolean;
  urban_property_1000?: boolean; // owns ≥1000 sq ft built-up in a town/city
  other_pension?: boolean; // already gets a social security pension
  updated_at?: string;
}

export const PROFILE_FIELDS: (keyof FamilyProfile)[] = [
  'age', 'gender', 'marital', 'caste', 'disability', 'chronic_illness', 'education', 'work',
  'area', 'rice_card', 'monthly_income', 'school_children', 'college_student', 'lpg', 'pucca_house',
  'wet_acres', 'dry_acres', 'units', 'vehicle', 'govt_in_family', 'income_tax', 'urban_property_1000', 'other_pension',
];

const LS = 'sachiseva:family-profile:v1';

export function readLocalProfile(): FamilyProfile | null {
  try {
    const raw = localStorage.getItem(LS);
    return raw ? (JSON.parse(raw) as FamilyProfile) : null;
  } catch {
    return null;
  }
}

function writeLocal(p: FamilyProfile | null) {
  try {
    if (p) localStorage.setItem(LS, JSON.stringify(p));
    else localStorage.removeItem(LS);
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event('sachiseva:profile'));
}

/** Loads the signed-in user's saved profile (falls back to this device's copy). */
export async function loadProfile(uid: string | null): Promise<FamilyProfile | null> {
  const local = readLocalProfile();
  if (!uid || !isSupabaseConfigured) return local;
  const { data, error } = await supabase.from('profiles').select('eligibility_profile').eq('id', uid).maybeSingle();
  const remote = !error ? ((data?.eligibility_profile as FamilyProfile | null) ?? null) : null;
  if (remote && (!local || (remote.updated_at ?? '') >= (local.updated_at ?? ''))) {
    writeLocal(remote);
    return remote;
  }
  // A guest answered on this phone before signing up — keep their answers.
  if (local && (!remote || (local.updated_at ?? '') > (remote.updated_at ?? ''))) void saveProfile(local, uid);
  return local;
}

export async function saveProfile(p: FamilyProfile, uid: string | null): Promise<FamilyProfile> {
  const stamped = { ...p, updated_at: new Date().toISOString() };
  writeLocal(stamped);
  if (uid && isSupabaseConfigured) {
    const { error } = await supabase.from('profiles').update({ eligibility_profile: stamped }).eq('id', uid);
    if (error) console.warn('[profile] not synced (run the catalog migration):', error.message);
  }
  return stamped;
}

export function clearLocalProfile() {
  writeLocal(null);
}

/** The answers staff need to verify, as plain "label: value" pairs for applicant_details. */
export function profileSummary(p: FamilyProfile | null): Record<string, string> {
  if (!p) return {};
  const yn = (v?: boolean) => (v == null ? undefined : v ? 'yes' : 'no');
  const out: Record<string, string | undefined> = {
    age: p.age != null ? String(p.age) : undefined,
    gender: p.gender,
    marital_status: p.marital?.replace('_', ' '),
    community: p.caste,
    occupation: p.work?.replace('_', ' '),
    area: p.area === 'urban' ? 'town / city' : p.area === 'rural' ? 'village' : undefined,
    white_rice_card: yn(p.rice_card),
    family_income_per_month: p.monthly_income != null ? `₹${p.monthly_income.toLocaleString('en-IN')}` : undefined,
    children_in_school: p.school_children != null ? String(p.school_children) : undefined,
    land_wet_dry_acres: p.wet_acres != null || p.dry_acres != null ? `${p.wet_acres ?? '?'} wet / ${p.dry_acres ?? '?'} dry` : undefined,
    disability: p.disability && p.disability !== 'none' ? p.disability.replace('_', '–').replace('plus', '+') + (p.disability === 'bedridden' ? '' : '%') : undefined,
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v)) as Record<string, string>;
}

export function answeredCount(p: FamilyProfile | null) {
  if (!p) return 0;
  return PROFILE_FIELDS.filter((f) => p[f] !== undefined && p[f] !== null && (p[f] as unknown) !== '').length;
}
