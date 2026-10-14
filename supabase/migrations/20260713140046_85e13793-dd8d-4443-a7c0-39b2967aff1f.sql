
CREATE TABLE IF NOT EXISTS public.meeseva_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_telugu text NOT NULL,
  address text NOT NULL,
  area text,
  district text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  phone text,
  services text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.meeseva_centers TO anon, authenticated;
GRANT ALL ON public.meeseva_centers TO service_role;
ALTER TABLE public.meeseva_centers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read meeseva_centers" ON public.meeseva_centers FOR SELECT USING (true);
CREATE POLICY "Staff manage meeseva_centers" ON public.meeseva_centers FOR ALL
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

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
