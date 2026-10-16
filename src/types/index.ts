export type Lang = 'en' | 'te';

export type Caste = 'SC' | 'ST' | 'BC' | 'OC' | 'Minority' | 'EWS' | 'Disabled';
export type Gender = 'male' | 'female';
export type EducationLevel = 'below_ssc' | 'ssc' | 'intermediate' | 'degree' | 'pg';
export type RationCardType = 'white' | 'yellow' | 'pink' | 'none';
export type PensionType = 'old_age' | 'widow' | 'disabled' | 'weaver' | 'fisherman' | 'single_woman';
export type Occupation = 'toddy_tapper' | 'artisan' | 'weaver' | 'fisherman' | 'other';

export interface EligibilityRules {
  requires_ap_resident?: boolean;
  gender_female?: boolean;
  min_age?: number;
  max_age?: number;
  max_annual_income?: number;
  max_monthly_income?: number;
  disallow_govt_employee?: boolean;
  disallow_pucca_house?: boolean;
  requires_no_pucca_house?: boolean;
  pension_types?: PensionType[];
  min_disability_pct?: number;
  ration_card_types?: RationCardType[];
  disallow_lpg?: boolean;
  castes?: Caste[];
  min_education?: EducationLevel;
  requires_registered_farmer?: boolean;
  requires_registered_weaver?: boolean;
  disallow_income_tax_payer?: boolean;
  requires_unemployed?: boolean;
  disallow_enrolled_other_scheme?: boolean;
  requires_child_in_school?: boolean;
  requires_foreign_admission?: boolean;
  occupations?: Occupation[];
  // Legacy fields still accepted (offline seed / admin)
  land_max_acres?: number;
  age_min?: number;
  age_max?: number;
  max_income?: number;
  caste_categories?: string[];
  other_conditions?: string[];
}

export type SchemeCategory =
  | 'Pension'
  | 'Education'
  | 'Agriculture'
  | 'Household'
  | 'Transport'
  | 'Youth'
  | 'Women'
  | 'Housing'
  | 'Weavers'
  | 'SC/ST/BC'
  | 'Health'
  | 'SC/ST'
  | 'BC'
  | 'Minority';

export interface Scheme {
  id: string;
  name: string;
  name_telugu: string;
  description: string;
  description_telugu?: string;
  required_documents: string[];
  eligibility_rules: EligibilityRules;
  category?: SchemeCategory;
  icon?: string;
  benefit?: string;
  benefit_telugu?: string;
  pension_type_benefits?: Partial<Record<PensionType, { amount: string; amount_te: string }>>;
  priority?: number; // lower = shown first (Super 6 = 1..6)
  created_at?: string;
}

export interface CertificateService {
  id: string;
  name: string;
  name_telugu: string;
  icon: string;
  required_documents: { en: string; te: string }[];
}

export type ApplicationStatus =
  | 'submitted'
  | 'under_review'
  | 'documents_requested'
  | 'approved'
  | 'rejected';

export interface SubmittedDocument {
  document_type: string;
  file_url: string;
}

export interface ApplicantDetails {
  full_name?: string;
  phone?: string;
  address?: string;
  income?: string;
  [key: string]: string | undefined;
}

export interface Application {
  id: string;
  user_id: string;
  scheme_id: string;
  status: ApplicationStatus;
  applicant_details: ApplicantDetails;
  submitted_documents: SubmittedDocument[];
  token_number?: string | null;
  created_at: string;
  updated_at: string;
  scheme?: Scheme;
  profile?: { full_name: string | null; email: string | null };
}

export interface PublicApplicationLookup {
  token_number: string;
  status: ApplicationStatus;
  scheme_id: string;
  scheme_name: string | null;
  applicant_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface SachivalayamCenter {
  id: string;
  name: string;
  name_telugu: string;
  address: string;
  area: string;
  district: string;
  latitude: number;
  longitude: number;
  phone: string;
  busy_level?: 'low' | 'moderate' | 'busy';
  busy_updated_at?: string;
  busy_note?: string | null;
}

export interface MeesevaCenter {
  id: string;
  name: string;
  name_telugu: string;
  address: string;
  area: string | null;
  district: string | null;
  latitude: number;
  longitude: number;
  phone: string | null;
  services: string[];
}

export type CertificateStatus = 'pending' | 'ready' | 'collected';

export interface CertificateRequest {
  id: string;
  token_number: string;
  citizen_name: string;
  certificate_type: string;
  status: CertificateStatus;
  requested_at: string;
  updated_at: string;
  notes?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
}

export interface DocumentOffice {
  id: string;
  document_type: string;
  issuing_office_type: string;
  notes?: string | null;
}

export interface UserDocument {
  id: string;
  user_id: string;
  document_type: string;
  file_url: string;
  uploaded_at: string;
}

export interface ApplicationMessage {
  id: string;
  application_id: string;
  sender_type: 'user' | 'staff';
  message: string | null;
  file_url: string | null;
  is_document_request: boolean;
  requested_document_type: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  is_staff: boolean;
  full_name: string | null;
  email: string | null;
  created_at?: string;
}

export type GrievanceStatus = 'raised' | 'acknowledged' | 'resolved';

export interface Grievance {
  id: string;
  application_id: string;
  user_id: string;
  reason: string | null;
  status: GrievanceStatus;
  raised_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  admin_response: string | null;
}

export interface ApplicationStatusHistory {
  id: string;
  application_id: string;
  status: ApplicationStatus;
  changed_at: string;
  changed_by_staff: boolean;
  note: string | null;
  document_requested: string | null;
}

export interface ApplicationDraft {
  id: string;
  user_id: string;
  scheme_id: string;
  draft_data: Record<string, unknown>;
  completion_percentage: number;
  created_at: string;
  updated_at: string;
  scheme?: Scheme;
}
