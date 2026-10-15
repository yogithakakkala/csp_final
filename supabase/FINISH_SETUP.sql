-- SachiSeva: finish database setup (staff key 4040, scheme catalogue, centres).
-- Paste all of this into Supabase → SQL Editor → Run. Safe to run once.

alter table public.profiles add column if not exists eligibility_profile jsonb;
grant update (full_name, eligibility_profile) on public.profiles to authenticated;
-- ══════════════════════════════════════════════════════════════════════════
-- SachiSeva — staff key checked inside the database.
-- Staff must type the staff key to register AND to log in. The key lives in a
-- table nobody can read through the API; the app only calls claim_staff().
-- Default key: 4040. Change it any time in the SQL editor:
--   update public.app_secrets set value = 'new-key' where name = 'staff_key';
-- Safe to re-run.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.app_secrets (name text primary key, value text not null);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;
insert into public.app_secrets (name, value) values ('staff_key', '4040') on conflict (name) do nothing;

-- Failed attempts, so a 4-digit key can't be guessed by trying them all.
create table if not exists public.staff_key_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  at timestamptz not null default now()
);
create index if not exists staff_key_attempts_user_at on public.staff_key_attempts (user_id, at);
alter table public.staff_key_attempts enable row level security;
revoke all on public.staff_key_attempts from anon, authenticated;

-- true  → key correct; the signed-in account is (now) staff
-- false → wrong key (counted; 5 wrong tries in 15 minutes locks the account out for a while)
create or replace function public.claim_staff(_key text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _secret text;
begin
  if _uid is null then raise exception 'not signed in'; end if;
  if coalesce(btrim(_key), '') = '' then return null; end if;  -- used by the System check
  if (select count(*) from public.staff_key_attempts where user_id = _uid and at > now() - interval '15 minutes') >= 5 then
    raise exception 'too many attempts — try again in 15 minutes';
  end if;
  select value into _secret from public.app_secrets where name = 'staff_key';
  if _secret is null or coalesce(btrim(_key), '') <> _secret then
    insert into public.staff_key_attempts (user_id) values (_uid);
    return false;
  end if;
  delete from public.staff_key_attempts where user_id = _uid;
  update public.profiles set is_staff = true where id = _uid;
  if not found then
    insert into public.profiles (id, is_staff) values (_uid, true) on conflict (id) do update set is_staff = true;
  end if;
  return true;
end $$;

revoke execute on function public.claim_staff(text) from public, anon;
grant execute on function public.claim_staff(text) to authenticated;

-- Citizens could create their own profile row with is_staff = true if the
-- sign-up trigger hadn't made one yet; only allow the harmless columns.
revoke insert on public.profiles from authenticated;
grant insert (id, full_name, email) on public.profiles to authenticated;
insert into public.schemes (id, name, name_telugu, description, required_documents) values
  ('ntr-bharosa-pension', 'NTR Bharosa Pension', 'ఎన్టీఆర్ భరోసా పింఛన్', 'Monthly pension for the elderly, widows, people with disabilities or chronic illness, and other vulnerable groups — paid on the 1st of every month.', array['Aadhaar card', 'Rice card (white / BPL)', 'Bank passbook (account linked to Aadhaar)', 'Passport-size photo', 'Age proof (SSC memo / birth certificate)', 'SADAREM disability certificate (disability pension)', 'Husband''s death certificate (widow pension)', 'Medical certificate (dialysis / thalassemia / CKDU)']::text[]),
  ('talliki-vandanam', 'Talliki Vandanam', 'తల్లికి వందనం', '₹15,000 a year to the mother for every child studying in Class 1 to 12 (government or private school / junior college).', array['Mother''s Aadhaar card', 'Child''s Aadhaar card', 'School / college study certificate', 'Mother''s bank passbook (Aadhaar-linked, NPCI-mapped)', 'Rice card (white / BPL)']::text[]),
  ('annadata-sukhibhava', 'Annadata Sukhibhava', 'అన్నదాత సుఖీభవ', '₹20,000 a year investment support for farmer families — ₹14,000 from the State plus ₹6,000 PM-Kisan — paid in instalments.', array['Aadhaar card', 'Pattadar passbook / land records (1-B, Adangal)', 'Tenancy (CCRC) card — tenant farmers', 'Bank passbook (account linked to Aadhaar)', 'Mobile number linked to Aadhaar']::text[]),
  ('deepam-2', 'Deepam 2.0 — free gas cylinders', 'దీపం 2.0 — ఉచిత గ్యాస్ సిలిండర్లు', 'Three free LPG cylinder refills a year (one every four months). You pay at delivery and the full amount comes back to your bank account.', array['Aadhaar card', 'Rice card (white / BPL)', 'LPG consumer number / gas book', 'Bank passbook (account linked to Aadhaar)']::text[]),
  ('free-bus-travel', 'Stree Shakti — free bus travel', 'స్త్రీ శక్తి — ఉచిత బస్సు ప్రయాణం', 'Free travel for girls, women and transgender persons of Andhra Pradesh in APSRTC Palle Velugu, Ultra Palle Velugu, City Ordinary, Metro Express and Express buses anywhere in the State.', array['Any valid photo ID showing an AP address (Aadhaar, voter ID, ration card)']::text[]),
  ('ntr-arogya-seva', 'Dr NTR Vaidya Seva (Aarogyasri)', 'డాక్టర్ ఎన్టీఆర్ వైద్య సేవ (ఆరోగ్యశ్రీ)', 'Cashless treatment in network hospitals for thousands of procedures. Rice-card families are covered up to ₹25 lakh; the State is extending cover to all families under its Universal Health Policy.', array['Aadhaar card', 'Rice card (white / BPL)', 'Vaidya Seva / Aarogyasri health card (see Services)', 'Referral from a doctor / PHC (for treatment)']::text[]),
  ('post-matric-rtf', 'Fee Reimbursement (Vidya Deevena)', 'ఫీజు రీయింబర్స్‌మెంట్ (విద్యా దీవెన)', 'Full tuition fee paid by the State for students in ITI, polytechnic, degree, engineering, medicine, PG and similar courses (convener-quota seats).', array['Student''s and parent''s Aadhaar', 'Rice card or income certificate', 'College admission / convener allotment order', 'Previous marks memos', 'Caste certificate', 'Mother''s bank passbook']::text[]),
  ('auto-driver-sevalo', 'Auto Driver Sevalo (Vahana Mitra)', 'ఆటో డ్రైవర్ల సేవలో (వాహన మిత్ర)', '₹15,000 a year to auto, taxi and maxi-cab drivers who own their passenger vehicle, for insurance, repairs and fitness.', array['Aadhaar card', 'Rice card (white / BPL)', 'Driving licence', 'Vehicle RC (registration certificate)', 'Fitness certificate & tax receipt (taxi / maxi cab)', 'Bank passbook (account linked to Aadhaar)']::text[]),
  ('matsyakara-sevalo', 'Matsyakarula Sevalo', 'మత్స్యకారుల సేవలో', '₹20,000 to fishermen families during the annual sea fishing ban (April–June), paid to the bank account.', array['Aadhaar card', 'Fisherman ID / Fisheries registration', 'Boat registration (if any)', 'Rice card (white / BPL)', 'Bank passbook (account linked to Aadhaar)', 'Passport-size photo']::text[]),
  ('nethanna-bharosa', 'Nethanna Sevalo (handloom weavers)', 'నేతన్నల సేవలో (చేనేత కార్మికులు)', '₹25,000 a year to handloom weaver families who own a loom, plus free power for handlooms and power looms.', array['Aadhaar card', 'Weaver ID card / loom geo-tagging details', 'Rice card (white / BPL)', 'Bank passbook (account linked to Aadhaar)']::text[]),
  ('pmay-gramin', 'Housing for All (PMAY + State)', 'అందరికీ ఇళ్లు (PMAY + రాష్ట్రం)', 'Help to build a pucca house for families without one — central PMAY (Gramin / Urban) assistance with State support. New beneficiaries are taken in survey rounds.', array['Aadhaar card', 'Rice card (white / BPL)', 'House site patta / land document', 'Income certificate', 'Bank passbook (account linked to Aadhaar)', 'Passport-size photo']::text[]),
  ('pm-kisan', 'PM-Kisan Samman Nidhi', 'పీఎం-కిసాన్ సమ్మాన్ నిధి', 'Central support of ₹6,000 a year to land-owning farmer families in three instalments of ₹2,000. In AP it is paid together with Annadata Sukhibhava.', array['Aadhaar card', 'Pattadar passbook / land records (1-B, Adangal)', 'Bank passbook (account linked to Aadhaar)', 'Mobile number linked to Aadhaar']::text[]),
  ('post-matric-mtf', 'Hostel & mess charges (Vasathi Deevena)', 'హాస్టల్ & భోజన ఖర్చులు (వసతి దీవెన)', 'Yearly help with hostel and food costs for the same college / ITI / polytechnic students who get fee reimbursement.', array['Student''s and parent''s Aadhaar', 'Rice card or income certificate', 'College admission proof', 'Mother''s bank passbook']::text[]),
  ('adarana-3', 'Adarana 3.0 (tools for artisans)', 'ఆదరణ 3.0 (చేతివృత్తుల పనిముట్లు)', 'Subsidised modern tools and equipment (and two-wheelers for toddy tappers) for BC artisans — carpenters, goldsmiths, potters, barbers, washermen, weavers, fishermen and others.', array['Aadhaar card', 'Caste certificate', 'Rice card (white / BPL)', 'Occupation proof / trade certificate', 'Bank passbook (account linked to Aadhaar)', 'Passport-size photo']::text[]),
  ('sc-corp-loan', 'SC / ST Corporation self-employment loans', 'SC / ST కార్పొరేషన్ స్వయం ఉపాధి రుణాలు', 'Bank loans with a large subsidy to start a small business, vehicle or unit, for SC and ST youth. Opened in rounds by the SC / Tribal Welfare corporations.', array['Aadhaar card', 'Caste certificate', 'Rice card (white / BPL)', 'Project report / quotation', 'Bank passbook (account linked to Aadhaar)', 'Passport-size photo']::text[]),
  ('bc-corp-loan', 'BC / EWS Corporation self-employment loans', 'BC / EWS కార్పొరేషన్ స్వయం ఉపాధి రుణాలు', 'Subsidised bank loans for BC, Kapu, minority and EWS youth to start a business or buy equipment. Opened in rounds.', array['Aadhaar card', 'Caste certificate', 'Rice card (white / BPL)', 'Project report / quotation', 'Bank passbook (account linked to Aadhaar)', 'Passport-size photo']::text[]),
  ('ntr-vidyonnathi', 'NTR Vidyonnathi (civil services coaching)', 'ఎన్టీఆర్ విద్యోన్నతి (సివిల్ సర్వీసెస్ కోచింగ్)', 'Free UPSC / APPSC coaching with a stipend for graduates from weaker sections. Notified every year on the Jnanabhumi portal.', array['Aadhaar card', 'Degree certificate', 'Income certificate', 'Caste certificate', 'Passport-size photo']::text[]),
  ('ambedkar-overseas', 'Ambedkar Overseas Vidya Nidhi', 'అంబేద్కర్ ఓవర్సీస్ విద్యా నిధి', 'Financial help for SC / ST students admitted to a Masters or PhD at a recognised foreign university.', array['Aadhaar card', 'Caste certificate', 'Income certificate', 'Foreign university admission letter', 'Passport', 'Degree marks memos']::text[]),
  ('aadabidda-nidhi', 'Aadabidda Nidhi', 'ఆడబిడ్డ నిధి', '₹1,500 a month for women aged 18–59. Announced as one of the Super Six; beneficiary verification is in progress and payments have not started yet.', array['Aadhaar card', 'Rice card (white / BPL)', 'Bank passbook (account linked to Aadhaar)']::text[]),
  ('yuva-galam', 'Nirudyoga Bhruthi (unemployment allowance)', 'నిరుద్యోగ భృతి', '₹3,000 a month promised to unemployed youth. Announced; not paid yet. Meanwhile, Mega DSC and skilling programmes are running.', array['Aadhaar card', 'Educational certificates', 'Rice card (white / BPL)', 'Bank passbook (account linked to Aadhaar)']::text[]),
  ('chandranna-pelli-kanuka', 'Chandranna Pelli Kanuka (marriage gift)', 'చంద్రన్న పెళ్ళి కానుక', 'One-time marriage assistance for brides from SC, ST, BC, minority and disabled families. Not accepting applications now — check at your Sachivalayam before the wedding.', array['Bride''s and groom''s Aadhaar', 'Caste certificate', 'Age proof (SSC memo / birth certificate)', 'Wedding card / marriage certificate', 'Rice card (white / BPL)', 'Bank passbook (account linked to Aadhaar)']::text[]),
  ('svc-income-certificate', 'Income certificate', 'ఆదాయ ధృవపత్రం', 'Certifies your family’s annual income — needed for scholarships, fee reimbursement, loans and many schemes.', array['Income proof — pay slip, IT return, or self-declaration', 'Rice card, voter ID or Aadhaar card']::text[]),
  ('svc-integrated-certificate', 'Caste certificate (Integrated: caste, nativity & date of birth)', 'కుల ధృవపత్రం (ఇంటిగ్రేటెడ్: కులం, స్థానికత, పుట్టిన తేదీ)', 'One certificate showing your community, nativity and date of birth — used for admissions, reservations, jobs and SC/ST/BC schemes.', array['SSC marks memo, transfer certificate, or birth extract from municipality / panchayat', 'Earlier caste certificate of applicant, parent or family member (if any)', 'Aadhaar card']::text[]),
  ('svc-ews-certificate', 'EWS certificate', 'EWS ధృవపత్రం', 'For the 10% Economically Weaker Sections reservation in education and jobs (for communities not under SC/ST/BC).', array['Aadhaar card', 'Income certificate', 'Land / property self-declaration', 'SSC memo or date-of-birth proof', 'Rice card (white / BPL)']::text[]),
  ('svc-residence-certificate', 'Residence certificate', 'నివాస ధృవపత్రం', 'Proves where you live — for bank accounts, admissions, gas and other connections.', array['Aadhaar with current address', 'Rice card (white / BPL)', 'Electricity / water / property tax bill', 'Passport-size photo']::text[]),
  ('svc-family-member-certificate', 'Family member certificate', 'కుటుంబ సభ్యుల ధృవపత్రం', 'Lists the legal family members after the head of the family dies — needed for land mutation, bank claims, pensions and compassionate jobs.', array['Death certificate of the family head', 'Aadhaar of all family members', 'Rice card (white / BPL)', 'Self-declaration / affidavit listing family members']::text[]),
  ('svc-rice-card-new', 'New rice card', 'కొత్త రేషన్ కార్డు', 'Apply for a new family rice card (needed for subsidised rice and most welfare schemes).', array['Aadhaar numbers of all family members', 'Address proof', 'Income certificate', 'Age proof (women over 18, men over 21)', 'Death certificate of spouse (single-member widow cards)']::text[]),
  ('svc-rice-card-member', 'Add / remove a member on the rice card', 'రేషన్ కార్డులో సభ్యుని చేర్పు / తొలగింపు', 'Add a newborn or a new daughter-in-law, remove someone who has died or moved, or split a card.', array['Existing rice card', 'New member''s Aadhaar', 'Birth certificate (child) / marriage certificate (spouse) / death certificate (removal)']::text[]),
  ('svc-birth-certificate', 'Birth certificate', 'జనన ధృవపత్రం', 'Copy of a registered birth. Births should be registered within 21 days; late registration needs extra orders.', array['Hospital birth record / discharge summary', 'Parents'' Aadhaar', 'Affidavit & non-availability certificate (late registration)']::text[]),
  ('svc-death-certificate', 'Death certificate', 'మరణ ధృవపత్రం', 'Copy of a registered death — needed for pensions, insurance, property and the family member certificate.', array['Hospital / doctor death record', 'Deceased''s Aadhaar', 'Applicant''s Aadhaar']::text[]),
  ('svc-marriage-certificate', 'Marriage registration certificate', 'వివాహ నమోదు ధృవపత్రం', 'Registers a Hindu marriage and gives the certificate — needed for passports, visas, rice cards and spouse benefits.', array['Wedding invitation card', 'Age proof of both (SSC memo / passport / birth certificate)', 'Marriage photo', 'Residence proof of both', 'Witnesses'' Aadhaar (2)']::text[]),
  ('svc-health-card', 'Dr NTR Vaidya Seva (Aarogyasri) health card', 'డాక్టర్ ఎన్టీఆర్ వైద్య సేవ (ఆరోగ్యశ్రీ) హెల్త్ కార్డు', 'The card that lets your family get free treatment under Dr NTR Vaidya Seva.', array['Aadhaar cards of all members', 'Rice card (white / BPL)', 'Family photo']::text[]),
  ('svc-electricity-connection', 'New electricity connection', 'కొత్త విద్యుత్ కనెక్షన్', 'Apply for a new domestic power connection through the Sachivalayam.', array['ID proof (rice card, PAN, Aadhaar, passport or driving licence)', 'Proof of ownership / occupancy of the house', 'Caste certificate (mandatory for SC / ST free power)']::text[]),
  ('svc-water-connection', 'New water tap connection', 'కొత్త నీటి కుళాయి కనెక్షన్', 'Domestic drinking-water connection from the municipality / panchayat line.', array['Site plan showing the pipeline and connection point', 'Latest property tax receipt', 'Rice card + income certificate (BPL connection)']::text[]),
  ('svc-land-mutation', 'Land mutation & pattadar passbook (succession)', 'భూమి మ్యుటేషన్ & పట్టాదార్ పాస్‌బుక్ (వారసత్వం)', 'Change the land record (1-B) and passbook to the heirs'' names after the owner dies. Purchases are usually updated automatically after registration.', array['Death certificate of the owner', 'Family member certificate', 'Pattadar passbook / land records (1-B, Adangal)', 'Aadhaar of all heirs']::text[]),
  ('svc-land-records', 'Adangal / 1-B copy', 'అడంగల్ / 1-బి కాపీ', 'Certified copy of your land records — for bank loans, crop insurance and court cases. You can also view them free on MeeBhoomi.', array['Survey number and village name', 'Aadhaar card']::text[]),
  ('svc-encumbrance-certificate', 'Encumbrance certificate (EC)', 'ఎన్‌కంబరెన్స్ సర్టిఫికేట్ (EC)', 'Shows registered sales, mortgages and transactions on a property — check before buying land or taking a loan.', array['Property details (survey / door number, village, period to search)']::text[])
on conflict (id) do update set
  name = excluded.name,
  name_telugu = excluded.name_telugu,
  description = excluded.description,
  required_documents = excluded.required_documents;
;

-- Centres
-- ─────────── MeeSeva centres (Visakhapatnam seed) ───────────
INSERT INTO public.meeseva_centers (name, name_telugu, address, area, district, latitude, longitude, phone, services) VALUES
('MeeSeva Center Service Road Gajuwaka','మీసేవ కేంద్రం సర్వీస్ రోడ్ గాజువాక','D.No 7-7-2/3, Service Road, Opposite Electrical Sub Station, Near Auto Nagar Bus Stop, Chattivanipalem, Gajuwaka, Visakhapatnam 530012','Gajuwaka','Visakhapatnam',17.7030,83.2125,'0891-2345613',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card']),
('New Gajuwaka MeeSeva Center','న్యూ గాజువాక మీసేవ కేంద్రం','New Gajuwaka Main Road, Near Bus Stand, New Gajuwaka, Visakhapatnam 530026','Gajuwaka','Visakhapatnam',17.6875,83.2015,'9440119789',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card','Birth Certificate']),
('Pedagantyada MeeSeva Center','పేడగంట్యాడ మీసేవ కేంద్రం','Pedagantyada Junction, Near Padmavathi Theatre, Gajuwaka, Visakhapatnam 530026','Gajuwaka','Visakhapatnam',17.6820,83.2060,'9154320518',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','PAN Card']),
('Botcha Square MeeSeva Center','బొట్చా స్క్వేర్ మీసేవ కేంద్రం','Door No 39-6-71, Kapparada Village, Opposite Birla Junction, Murali Nagar, Visakhapatnam 530012','Gajuwaka','Visakhapatnam',17.7090,83.2100,'9100797270',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card']),
('Ukkunagaram MeeSeva Center','ఉక్కునగరం మీసేవ కేంద్రం','Near Steel Plant Gate-1, Ukkunagaram Township, Visakhapatnam 530031','Steel Plant','Visakhapatnam',17.6350,83.2010,'9393111452',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Residence Certificate']),
('Akkireddy Palem MeeSeva Center','అక్కిరెడ్డి పాలెం మీసేవ కేంద్రం','Akkireddy Palem Main Road, Gajuwaka, Visakhapatnam 530012','Auto Nagar','Visakhapatnam',17.7120,83.2070,'8686086194',ARRAY['Caste Certificate','Income Certificate','Aadhaar Enrolment','Aadhaar Update','Birth Certificate']),
('Sramika Nagar MeeSeva Center','శ్రమిక నగర్ మీసేవ కేంద్రం','Sramika Nagar Main Road, Old Gajuwaka, Visakhapatnam 530026','Old Gajuwaka','Visakhapatnam',17.7070,83.2090,'7396172223',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','PAN Card']),
('HPCL Colony MeeSeva Center','హెచ్పిసిఎల్ కాలనీ మీసేవ కేంద్రం','HPCL Colony, Near Petroleum Township, Gajuwaka, Visakhapatnam 530026','Gajuwaka','Visakhapatnam',17.6980,83.2050,'9885523089',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card']),
('Dwaraka Nagar MeeSeva Center','ద్వారకా నగర్ మీసేవ కేంద్రం','Dwaraka Nagar, Visakhapatnam 530016','Dwaraka Nagar','Visakhapatnam',17.7231,83.3012,'0891-2560201',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card','Residence Certificate','Birth Certificate','Death Certificate','PAN Card']),
('Lakshmi Enterprises MeeSeva Dwaraka Nagar','లక్ష్మి ఎంటర్‌ప్రైజెస్ మీసేవ','Door No 47-10-17, Varanasi Majestic Building, 2nd Lane, Near Siri Digital, Opposite Pizza Hut, Dwaraka Nagar, Visakhapatnam 530016','Dwaraka Nagar','Visakhapatnam',17.7225,83.3018,'8686086193',ARRAY['Aadhaar Enrolment','Aadhaar Update','PAN Card','Income Certificate','Caste Certificate']),
('Akkayyapalem MeeSeva Center','అక్కాయపాలెం మీసేవ కేంద్రం','Behind HDFC Bank, Abid Nagar, Akkayyapalem, Visakhapatnam 530016','Akkayyapalem','Visakhapatnam',17.7310,83.3075,'9154320516',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card','Birth Certificate']),
('Siripuram MeeSeva Center','సిరిపురం మీసేవ కేంద్రం','Siripuram Junction, Near RTC Complex, Visakhapatnam 530003','Siripuram','Visakhapatnam',17.7137,83.2984,'0891-2560202',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card','Residence Certificate']),
('MVP Colony MeeSeva Center','ఎంవిపి కాలనీ మీసేవ కేంద్రం','MVP Colony Sector-11, Near PM Palem, Visakhapatnam 530017','MVP Colony','Visakhapatnam',17.7436,83.3280,'0891-2560203',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Birth Certificate','Death Certificate','PAN Card']),
('Srinagar MeeSeva Center','శ్రీనగర్ మీసేవ కేంద్రం','Sri Akshaya Aadhaar Cards, Srinagar Colony, Visakhapatnam 530012','Srinagar','Visakhapatnam',17.7140,83.2950,'0891-6626737',ARRAY['Aadhaar Enrolment','Aadhaar Update','PAN Card','Income Certificate','Caste Certificate']),
('Madhurawada MeeSeva Center','మధురవాడ మీసేవ కేంద్రం','18-11, Krishna Nagar Road, Near ABC Construction, Madhurawada, Visakhapatnam 530048','Madhurawada','Visakhapatnam',17.7845,83.3742,'7013347588',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card','Residence Certificate']),
('Prahladapuram MeeSeva Center','ప్రహ్లాదాపురం మీసేవ కేంద్రం','16-77/2, Beside Apollo Pharmacy, Simhachalam Road, Prahladapuram, Visakhapatnam 530027','Prahladapuram','Visakhapatnam',17.7540,83.3120,'7396172222',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Birth Certificate','PAN Card']),
('Gajuwaka Circle MeeSeva Aadhaar Center','గాజువాక సర్కిల్ ఆధార్ మీసేవ','Kumar Aadhaar Card, Gajuwaka Circle, Visakhapatnam 530026','Gajuwaka','Visakhapatnam',17.6985,83.2160,'0891-5548579',ARRAY['Aadhaar Enrolment','Aadhaar Update','PAN Card']),
('Daba Gardens MeeSeva Center','దాబా గార్డెన్స్ మీసేవ కేంద్రం','CBM Compound Road, Daba Gardens, Visakhapatnam 530020','Daba Gardens','Visakhapatnam',17.7056,83.3048,'0891-2797952',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card','Birth Certificate','Death Certificate']),
('Spring Road MeeSeva Center','స్ప్రింగ్ రోడ్ మీసేవ కేంద్రం','MB Aadhaar Card Services, Spring Road, Near Collector Office, Visakhapatnam 530002','Main City','Visakhapatnam',17.7200,83.2950,'9440119787',ARRAY['Aadhaar Enrolment','Aadhaar Update','PAN Card','Income Certificate']),
('Waltair Uplands MeeSeva Center','వాల్టేర్ అప్‌ల్యాండ్స్ మీసేవ కేంద్రం','Waltair Main Road, Waltair Uplands, Visakhapatnam 530003','Waltair','Visakhapatnam',17.7210,83.3180,'0891-2560204',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card','Residence Certificate']),
('Venkojipalem MeeSeva Center','వెంకోజీపాలెం మీసేవ కేంద్రం','IAM Cards, Venkojipalem Main Road, Visakhapatnam 530024','Venkojipalem','Visakhapatnam',17.7165,83.2875,'8977797878',ARRAY['Aadhaar Enrolment','Aadhaar Update','PAN Card','Income Certificate','Caste Certificate']),
('Kommadi MeeSeva Center','కొమ్మాడి మీసేవ కేంద్రం','Kommadi Village Junction, Visakhapatnam 530048','Kommadi','Visakhapatnam',17.7780,83.3590,'9885523090',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card']),
('Bheemunipatnam MeeSeva Center','భీముని పట్నం మీసేవ కేంద్రం','Maha E-Seva Kendra, Thagarapuvalasa, Bheemunipatnam, Visakhapatnam 531163','Bheemunipatnam','Visakhapatnam',17.8892,83.4520,'08933225082',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card','Birth Certificate']),
('Gajuwaka Mandal MeeSeva Center Official','గాజువాక మండల్ మీసేవ కేంద్రం','Gajuwaka Mandal Office Road, Gajuwaka, Visakhapatnam 530026','Gajuwaka','Visakhapatnam',17.7000,83.2167,'0891-2560450',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card','Residence Certificate','Birth Certificate','Death Certificate','Land Records']),
('Kapparada Village MeeSeva Center','కప్పరాడ గ్రామం మీసేవ కేంద్రం','Kapparada Village Main Road, Near Birla Temple Junction, Visakhapatnam 530026','Gajuwaka','Visakhapatnam',17.7095,83.2085,'9100797271',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card']),
('Vadlapudi MeeSeva Center','వడ్లపూడి మీసేవ కేంద్రం','Vadlapudi Junction, Near Kanithi Colony, Visakhapatnam 530046','Vadlapudi','Visakhapatnam',17.6780,83.1730,'9533164862',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card','Birth Certificate']),
('Yathapalem MeeSeva Center','యత్రపాలెం మీసేవ కేంద్రం','China Yathapalem Road, Near Duvvada Railway Station, Visakhapatnam 530046','Duvvada','Visakhapatnam',17.7090,83.1680,'7013347589',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','PAN Card']),
('Kondayyavalasa MeeSeva Center','కొండయ్యవలస మీసేవ కేంద్రం','Kondayyavalasa Village Road, Duvvada, Visakhapatnam 530046','Duvvada','Visakhapatnam',17.7115,83.1660,'9849667576',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card']),
('Narava MeeSeva Center','నరవ మీసేవ కేంద్రం','Narava Village Junction, Near VSEZ, Visakhapatnam 530046','Duvvada','Visakhapatnam',17.7235,83.1715,'9440119790',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card']),
('Mindi MeeSeva Center','మిండి మీసేవ కేంద్రం','Mindi Village, Near Port Area, Visakhapatnam 530012','Mindi','Visakhapatnam',17.7150,83.2800,'9154320519',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card']),
('Arilova MeeSeva Center','అరిలోవ మీసేవ కేంద్రం','Arilova Main Road, Ward-1, Visakhapatnam 530040','Arilova','Visakhapatnam',17.7540,83.2600,'8686086195',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card','Birth Certificate']),
('Simhachalam MeeSeva Center','సింహాచలం మీసేవ కేంద్రం','Simhachalam Road, Prahladapuram, Visakhapatnam 530027','Simhachalam','Visakhapatnam',17.7630,83.2710,'7396172224',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Birth Certificate','Residence Certificate']),
('Gambheeram MeeSeva Center','గంభీరం మీసేవ కేంద్రం','Gambheeram Road, Near Gambheeram Junction, Visakhapatnam 530027','Gambheeram','Visakhapatnam',17.7680,83.2800,'9393111453',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card']),
('Pendurthi MeeSeva Center','పెండూర్తి మీసేవ కేంద్రం','Pendurthi Mandal Office Road, Pendurthi, Visakhapatnam 531173','Pendurthi','Visakhapatnam',17.8280,83.2320,'9885523091',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card','Birth Certificate','Land Records']),
('Gopalapatnam MeeSeva Center','గోపాలపట్నం మీసేవ కేంద్రం','Gopalapatnam Main Road, Near Bus Stand, Visakhapatnam 530027','Gopalapatnam','Visakhapatnam',17.7730,83.3080,'9154320520',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card','Birth Certificate']),
('Appughar MeeSeva Center','అప్పుఘర్ మీసేవ కేంద్రం','Near Appughar, Beach Road, Visakhapatnam 530023','Beach Road','Visakhapatnam',17.7210,83.3380,'0891-2560205',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card','Residence Certificate']),
('Seethammadhara MeeSeva Center','సీతమ్మధార మీసేవ కేంద్రం','Seethammadhara Junction, Visakhapatnam 530013','Seethammadhara','Visakhapatnam',17.7390,83.3210,'9440119791',ARRAY['Caste Certificate','Income Certificate','Aadhaar Update','Ration Card','Birth Certificate','PAN Card']),
('Visakhapatnam Tahsildar Office MeeSeva','విశాఖపట్నం తహసీల్దార్ కార్యాలయం మీసేవ','Visakhapatnam Tahsildar Office, District Collectorate Premises, Visakhapatnam 530001','Main City','Visakhapatnam',17.6880,83.2162,'0891-2560100',ARRAY['Caste Certificate','Income Certificate','Residence Certificate','Land Records','Birth Certificate','Death Certificate','Aadhaar Update','Ration Card']);
INSERT INTO public.sachivalayam_centers (name, name_telugu, address, area, district, latitude, longitude, phone) VALUES
('Siripuram Sachivalayam','సిరిపురం సచివాలయం','Siripuram, Visakhapatnam, Andhra Pradesh 530003','Visakhapatnam (Main City)','Visakhapatnam',17.7245,83.3038,'0891-2560123'),
('Dwaraka Nagar Sachivalayam','ద్వారకా నగర్ సచివాలయం','Dwaraka Nagar, Visakhapatnam, Andhra Pradesh 530016','Visakhapatnam (Main City)','Visakhapatnam',17.7266,83.307,'0891-2560201'),
('MVP Colony Sachivalayam','ఎం.వి.పి. కాలనీ సచివాలయం','MVP Colony, Visakhapatnam, Andhra Pradesh 530017','Visakhapatnam (Main City)','Visakhapatnam',17.7419,83.3199,'0891-2560214'),
('Sheela Nagar Sachivalayam','షీలా నగర్ సచివాలయం','Sheela Nagar, Visakhapatnam, Andhra Pradesh 530012','Sheela Nagar','Visakhapatnam',17.718533,83.198379,'0891-2560452'),
('BHPV Township Sachivalayam (Sheela Nagar)','బి.హెచ్.పి.వి టౌన్‌షిప్ సచివాలయం (షీలా నగర్)','BHPV Township, Sheela Nagar, Visakhapatnam, Andhra Pradesh 530012','Sheela Nagar','Visakhapatnam',17.705,83.19,'0891-2560460'),
('New Gajuwaka Sachivalayam (Ward 64)','న్యూ గాజువాక సచివాలయం (వార్డు 64)','New Gajuwaka, Visakhapatnam, Andhra Pradesh 530026','Gajuwaka','Visakhapatnam',17.687,83.21,'0891-2560446'),
('Old Gajuwaka Sachivalayam','పాత గాజువాక సచివాలయం','Old Gajuwaka, Visakhapatnam, Andhra Pradesh 530026','Gajuwaka','Visakhapatnam',17.695,83.205,'0891-2560447'),
('Pedagantyada Sachivalayam','పెదగంట్యాడ సచివాలయం','Pedagantyada, Visakhapatnam, Andhra Pradesh 530026','Gajuwaka','Visakhapatnam',17.675,83.215,'0891-2560448'),
('Kailasapuram Sachivalayam','కైలాసపురం సచివాలయం','Kailasapuram, Gajuwaka, Visakhapatnam, Andhra Pradesh 530011','Gajuwaka','Visakhapatnam',17.69,83.22,'0891-2560449'),
('Kurmannapalem Sachivalayam','కూర్మన్నపాలెం సచివాలయం','31-29-8/3, Kurmannapalem, Visakhapatnam, Andhra Pradesh 530046','Kurmannapalem','Visakhapatnam',17.685,83.1675,'0891-2560410'),
('Nathayyapalem Sachivalayam (Kurmannapalem)','నాథయ్యపాలెం సచివాలయం (కూర్మన్నపాలెం)','Nathayyapalem, Kurmannapalem, Visakhapatnam, Andhra Pradesh 530046','Kurmannapalem','Visakhapatnam',17.68,83.16,'0891-2560411'),
('Gopalapatnam Sachivalayam','గోపాలపట్నం సచివాలయం','Gopalapatnam, Visakhapatnam, Andhra Pradesh 530027','Visakhapatnam (Main City)','Visakhapatnam',17.735,83.215,'0891-2560501'),
('Malkapuram Sachivalayam','మల్కాపురం సచివాలయం','Malkapuram, Visakhapatnam, Andhra Pradesh 530011','Visakhapatnam (Main City)','Visakhapatnam',17.699,83.265,'0891-2560502'),
('Autonagar Sachivalayam','ఆటోనగర్ సచివాలయం','Autonagar, Visakhapatnam, Andhra Pradesh 530012','Gajuwaka','Visakhapatnam',17.67,83.245,'0891-2560503'),
('Duvvada Sachivalayam','దువ్వాడ సచివాలయం','Duvvada, Visakhapatnam, Andhra Pradesh 530046','Kurmannapalem','Visakhapatnam',17.655,83.145,'0891-2560504'),
('Simhachalam Sachivalayam','సింహాచలం సచివాలయం','Simhachalam, Visakhapatnam, Andhra Pradesh 530028','Visakhapatnam (Main City)','Visakhapatnam',17.765,83.245,'0891-2560505'),
('Marripalem Sachivalayam','మర్రిపాలెం సచివాలయం','Marripalem, Visakhapatnam, Andhra Pradesh 530018','Visakhapatnam (Main City)','Visakhapatnam',17.708,83.285,'0891-2560506'),
('Akkayyapalem Sachivalayam','అక్కయ్యపాలెం సచివాలయం','Akkayyapalem, Visakhapatnam, Andhra Pradesh 530016','Visakhapatnam (Main City)','Visakhapatnam',17.735,83.295,'0891-2560507'),
('Seethammadhara Sachivalayam','సీతమ్మధార సచివాలయం','Seethammadhara, Visakhapatnam, Andhra Pradesh 530013','Visakhapatnam (Main City)','Visakhapatnam',17.7365,83.312,'0891-2560508'),
('Maddilapalem Sachivalayam','మద్దిలపాలెం సచివాలయం','Maddilapalem, Visakhapatnam, Andhra Pradesh 530013','Visakhapatnam (Main City)','Visakhapatnam',17.7395,83.316,'0891-2560509'),
('Chinna Waltair Sachivalayam','చిన్న వాల్తేరు సచివాలయం','Chinna Waltair, Visakhapatnam, Andhra Pradesh 530017','Visakhapatnam (Main City)','Visakhapatnam',17.7215,83.328,'0891-2560510'),
('Pandurangapuram Sachivalayam','పాండురంగాపురం సచివాలయం','Pandurangapuram, Visakhapatnam, Andhra Pradesh 530003','Visakhapatnam (Main City)','Visakhapatnam',17.7145,83.325,'0891-2560511'),
('Jagadamba Center Sachivalayam','జగదాంబ సెంటర్ సచివాలయం','Jagadamba Junction, Visakhapatnam, Andhra Pradesh 530020','Visakhapatnam (Main City)','Visakhapatnam',17.7085,83.298,'0891-2560512'),
('Poorna Market Sachivalayam','పూర్ణా మార్కెట్ సచివాలయం','Poorna Market, Visakhapatnam, Andhra Pradesh 530001','Visakhapatnam (Main City)','Visakhapatnam',17.7055,83.295,'0891-2560513'),
('Kancharapalem Sachivalayam','కంచరపాలెం సచివాలయం','Kancharapalem, Visakhapatnam, Andhra Pradesh 530008','Visakhapatnam (Main City)','Visakhapatnam',17.716,83.276,'0891-2560514'),
('NAD Kotha Road Sachivalayam','ఎన్.ఏ.డి కొత్త రోడ్ సచివాలయం','NAD Kotha Road, Visakhapatnam, Andhra Pradesh 530009','Visakhapatnam (Main City)','Visakhapatnam',17.745,83.245,'0891-2560515'),
('Thatichetlapalem Sachivalayam','తాటిచెట్లపాలెం సచివాలయం','Thatichetlapalem, Visakhapatnam, Andhra Pradesh 530018','Visakhapatnam (Main City)','Visakhapatnam',17.712,83.288,'0891-2560516'),
('Madhurawada Sachivalayam','మధురవాడ సచివాలయం','Madhurawada, Visakhapatnam, Andhra Pradesh 530041','Madhurawada','Visakhapatnam',17.802,83.381,'0891-2560601'),
('Rushikonda Sachivalayam','రుషికొండ సచివాలయం','Rushikonda, Visakhapatnam, Andhra Pradesh 530045','Madhurawada','Visakhapatnam',17.784,83.383,'0891-2560602'),
('Yendada Sachivalayam','ఎండాడ సచివాలయం','Yendada, Visakhapatnam, Andhra Pradesh 530045','Madhurawada','Visakhapatnam',17.774,83.354,'0891-2560603'),
('Kommadi Sachivalayam','కొమ్మాడి సచివాలయం','Kommadi, Visakhapatnam, Andhra Pradesh 530048','Madhurawada','Visakhapatnam',17.812,83.365,'0891-2560604'),
('Arilova Sachivalayam','అరిలోవ సచివాలయం','Arilova, Visakhapatnam, Andhra Pradesh 530040','Madhurawada','Visakhapatnam',17.768,83.322,'0891-2560605'),
('Pendurthi Sachivalayam','పెందుర్తి సచివాలయం','Pendurthi, Visakhapatnam, Andhra Pradesh 531173','Pendurthi','Visakhapatnam',17.782,83.228,'0891-2560701'),
('Vepagunta Sachivalayam','వేపగుంట సచివాలయం','Vepagunta, Visakhapatnam, Andhra Pradesh 530047','Pendurthi','Visakhapatnam',17.765,83.225,'0891-2560702'),
('Bheemunipatnam Sachivalayam','భీమునిపట్నం సచివాలయం','Bheemunipatnam, Visakhapatnam, Andhra Pradesh 531163','Bheemunipatnam','Visakhapatnam',17.892,83.451,'08933-222001'),
('Sabbavaram Sachivalayam','సబ్బవరం సచివాలయం','Sabbavaram, Visakhapatnam, Andhra Pradesh 531036','Sabbavaram','Visakhapatnam',17.782,83.152,'0891-2870101'),
('Anandapuram Sachivalayam','ఆనందపురం సచివాలయం','Anandapuram, Visakhapatnam, Andhra Pradesh 531173','Anandapuram','Visakhapatnam',17.83,83.29,'0891-2560801'),
('Anakapalle Sachivalayam','అనకాపల్లి సచివాలయం','Anakapalle, Anakapalli District, Andhra Pradesh 531001','Anakapalle','Anakapalli',17.691,83.003,'08924-222001'),
('Chodavaram Sachivalayam','చోడవరం సచివాలయం','Chodavaram, Anakapalli District, Andhra Pradesh 531036','Chodavaram','Anakapalli',17.826,82.876,'08934-222001'),
('Narsipatnam Sachivalayam','నర్సీపట్నం సచివాలయం','Narsipatnam, Anakapalli District, Andhra Pradesh 531116','Narsipatnam','Anakapalli',17.667,82.617,'08931-222001'),
('Yelamanchili Sachivalayam','యలమంచిలి సచివాలయం','Yelamanchili, Anakapalli District, Andhra Pradesh 531055','Yelamanchili','Anakapalli',17.553,82.855,'08932-222001'),
('Paravada Sachivalayam','పరవాడ సచివాలయం','Paravada, Anakapalli District, Andhra Pradesh 531021','Paravada','Anakapalli',17.748,83.099,'08924-222501'),
('Atchutapuram Sachivalayam','అచ్యుతాపురం సచివాలయం','Atchutapuram, Anakapalli District, Andhra Pradesh 531011','Atchutapuram','Anakapalli',17.62,83.08,'08924-222601'),
('Nakkapalli Sachivalayam','నక్కపల్లి సచివాలయం','Nakkapalli, Anakapalli District, Andhra Pradesh 531081','Nakkapalli','Anakapalli',17.499,82.845,'08932-233001'),
('Butchayyapeta Sachivalayam','బుచ్చయ్యపేట సచివాలయం','Butchayyapeta, Anakapalli District, Andhra Pradesh 531011','Butchayyapeta','Anakapalli',17.63,83.13,'08924-222701'),
('Kasimkota Sachivalayam','కాశింకోట సచివాలయం','Kasimkota, Anakapalli District, Andhra Pradesh 531035','Kasimkota','Anakapalli',17.646,82.936,'08924-223001'),
('Munagapaka Sachivalayam','మునగపాక సచివాలయం','Munagapaka, Anakapalli District, Andhra Pradesh 531011','Munagapaka','Anakapalli',17.755,83.03,'08924-223101'),
('Padmanabham Sachivalayam','పద్మనాభం సచివాలయం','Padmanabham, Visakhapatnam, Andhra Pradesh 531019','Padmanabham','Visakhapatnam',17.85,83.24,'0891-2560901'),
('Rambilli Sachivalayam','రాంబిల్లి సచివాలయం','Rambilli, Anakapalli District, Andhra Pradesh 531061','Rambilli','Anakapalli',17.573,83.12,'08924-223201'),
('K Kotapadu Sachivalayam','కె. కొటపాడు సచివాలయం','K Kotapadu, Anakapalli District, Andhra Pradesh 531111','K Kotapadu','Anakapalli',17.72,82.75,'08931-223301'),
('Devarapalli Sachivalayam','దేవరపల్లి సచివాలయం','Devarapalli, Anakapalli District, Andhra Pradesh 531083','Devarapalli','Anakapalli',17.44,82.78,'08932-223401');

INSERT INTO public.meeseva_centers (name, name_telugu, address, area, district, latitude, longitude, phone, services) VALUES
('Siripuram MeeSeva','సిరిపురం మీసేవ','Siripuram Main Rd, Visakhapatnam 530003','Visakhapatnam','Visakhapatnam',17.7248,83.3040,'0891-2755001', ARRAY['Aadhaar','Income Certificate','Caste Certificate','Ration Card','Birth Certificate','Death Certificate']),
('Dwaraka Nagar MeeSeva','ద్వారకా నగర్ మీసేవ','Dwaraka Nagar, Visakhapatnam 530016','Visakhapatnam','Visakhapatnam',17.7268,83.3072,'0891-2755010', ARRAY['Aadhaar','Income Certificate','Land Records','Ration Card']),
('MVP Colony MeeSeva','ఎం.వి.పి. కాలనీ మీసేవ','MVP Colony Sector 5, Visakhapatnam 530017','Visakhapatnam','Visakhapatnam',17.7421,83.3201,'0891-2755020', ARRAY['Aadhaar','Passport','Income Certificate','Caste Certificate','Driving License']),
('Gajuwaka MeeSeva','గాజువాక మీసేవ','Main Rd, Gajuwaka, Visakhapatnam 530026','Gajuwaka','Visakhapatnam',17.6870,83.2100,'0891-2755030', ARRAY['Aadhaar','Ration Card','Income Certificate','EWS Certificate']),
('Madhurawada MeeSeva','మధురవాడ మీసేవ','Madhurawada, Visakhapatnam 530041','Madhurawada','Visakhapatnam',17.8100,83.3700,'0891-2755040', ARRAY['Aadhaar','Passport','Income Certificate','Land Records']),
('Anakapalle MeeSeva','అనకాపల్లి మీసేవ','Anakapalle Town, Andhra Pradesh 531001','Anakapalle','Anakapalle',17.6912,83.0000,'08924-227001', ARRAY['Aadhaar','Ration Card','Caste Certificate','Birth Certificate','Death Certificate']),
('Pendurthi MeeSeva','పెందుర్తి మీసేవ','Pendurthi, Visakhapatnam 531173','Pendurthi','Visakhapatnam',17.8180,83.2050,'0891-2755050', ARRAY['Aadhaar','Ration Card','Income Certificate']),
('Bheemili MeeSeva','భీమిలి మీసేవ','Bheemunipatnam, Visakhapatnam 531163','Bheemili','Visakhapatnam',17.8905,83.4470,'0891-2755060', ARRAY['Aadhaar','Land Records','Birth Certificate','Marriage Certificate']);
