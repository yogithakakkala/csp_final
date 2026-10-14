
do $$ begin
  alter table public.sachivalayam_centers add constraint sachivalayam_centers_name_key unique (name);
exception when duplicate_object then null;
end $$;

insert into public.sachivalayam_centers (name, name_telugu, address, area, district, latitude, longitude, phone)
values
  ('Siripuram Sachivalayam', 'సిరిపురం సచివాలయం', 'Siripuram, Visakhapatnam, Andhra Pradesh 530003', 'Visakhapatnam (Main City)', 'Visakhapatnam', 17.7245, 83.3038, '0891-2560123'),
  ('Dwaraka Nagar Sachivalayam', 'ద్వారకా నగర్ సచివాలయం', 'Dwaraka Nagar, Visakhapatnam, Andhra Pradesh 530016', 'Visakhapatnam (Main City)', 'Visakhapatnam', 17.7266, 83.307, '0891-2560201'),
  ('MVP Colony Sachivalayam', 'ఎం.వి.పి. కాలనీ సచివాలయం', 'MVP Colony, Visakhapatnam, Andhra Pradesh 530017', 'Visakhapatnam (Main City)', 'Visakhapatnam', 17.7419, 83.3199, '0891-2560214'),
  ('Sheela Nagar Sachivalayam', 'షీలా నగర్ సచివాలయం', 'Sheela Nagar, Visakhapatnam, Andhra Pradesh 530012', 'Sheela Nagar', 'Visakhapatnam', 17.718533, 83.198379, '0891-2560452'),
  ('BHPV Township Sachivalayam (Sheela Nagar)', 'బి.హెచ్.పి.వి టౌన్‌షిప్ సచివాలయం (షీలా నగర్)', 'BHPV Township, Sheela Nagar, Visakhapatnam, Andhra Pradesh 530012', 'Sheela Nagar', 'Visakhapatnam', 17.705, 83.19, '0891-2560460'),
  ('New Gajuwaka Sachivalayam (Ward 64)', 'న్యూ గాజువాక సచివాలయం (వార్డు 64)', 'New Gajuwaka, Visakhapatnam, Andhra Pradesh 530026', 'Gajuwaka', 'Visakhapatnam', 17.687, 83.21, '0891-2560446'),
  ('Old Gajuwaka Sachivalayam', 'పాత గాజువాక సచివాలయం', 'Old Gajuwaka, Visakhapatnam, Andhra Pradesh 530026', 'Gajuwaka', 'Visakhapatnam', 17.695, 83.205, '0891-2560447'),
  ('Pedagantyada Sachivalayam', 'పెదగంట్యాడ సచివాలయం', 'Pedagantyada, Visakhapatnam, Andhra Pradesh 530026', 'Gajuwaka', 'Visakhapatnam', 17.675, 83.215, '0891-2560448'),
  ('Kailasapuram Sachivalayam', 'కైలాసపురం సచివాలయం', 'Kailasapuram, Gajuwaka, Visakhapatnam, Andhra Pradesh 530011', 'Gajuwaka', 'Visakhapatnam', 17.69, 83.22, '0891-2560449'),
  ('Kurmannapalem Sachivalayam', 'కూర్మన్నపాలెం సచివాలయం', '31-29-8/3, Kurmannapalem, Visakhapatnam, Andhra Pradesh 530046', 'Kurmannapalem', 'Visakhapatnam', 17.685, 83.1675, '0891-2560410'),
  ('Nathayyapalem Sachivalayam (Kurmannapalem)', 'నాథయ్యపాలెం సచివాలయం (కూర్మన్నపాలెం)', 'Nathayyapalem, Kurmannapalem, Visakhapatnam, Andhra Pradesh 530046', 'Kurmannapalem', 'Visakhapatnam', 17.68, 83.16, '0891-2560411'),
  ('Gopalapatnam Sachivalayam', 'గోపాలపట్నం సచివాలయం', 'Gopalapatnam, Visakhapatnam, Andhra Pradesh 530027', 'Visakhapatnam (Main City)', 'Visakhapatnam', 17.735, 83.215, '0891-2560501'),
  ('Malkapuram Sachivalayam', 'మల్కాపురం సచివాలయం', 'Malkapuram, Visakhapatnam, Andhra Pradesh 530011', 'Visakhapatnam (Main City)', 'Visakhapatnam', 17.699, 83.265, '0891-2560502'),
  ('Autonagar Sachivalayam', 'ఆటోనగర్ సచివాలయం', 'Autonagar, Visakhapatnam, Andhra Pradesh 530012', 'Gajuwaka', 'Visakhapatnam', 17.67, 83.245, '0891-2560503'),
  ('Duvvada Sachivalayam', 'దువ్వాడ సచివాలయం', 'Duvvada, Visakhapatnam, Andhra Pradesh 530046', 'Kurmannapalem', 'Visakhapatnam', 17.655, 83.145, '0891-2560504'),
  ('Simhachalam Sachivalayam', 'సింహాచలం సచివాలయం', 'Simhachalam, Visakhapatnam, Andhra Pradesh 530028', 'Visakhapatnam (Main City)', 'Visakhapatnam', 17.765, 83.245, '0891-2560505'),
  ('Marripalem Sachivalayam', 'మర్రిపాలెం సచివాలయం', 'Marripalem, Visakhapatnam, Andhra Pradesh 530018', 'Visakhapatnam (Main City)', 'Visakhapatnam', 17.708, 83.285, '0891-2560506'),
  ('Akkayyapalem Sachivalayam', 'అక్కయ్యపాలెం సచివాలయం', 'Akkayyapalem, Visakhapatnam, Andhra Pradesh 530016', 'Visakhapatnam (Main City)', 'Visakhapatnam', 17.735, 83.295, '0891-2560507'),
  ('Seethammadhara Sachivalayam', 'సీతమ్మధార సచివాలయం', 'Seethammadhara, Visakhapatnam, Andhra Pradesh 530013', 'Visakhapatnam (Main City)', 'Visakhapatnam', 17.7365, 83.312, '0891-2560508'),
  ('Maddilapalem Sachivalayam', 'మద్దిలపాలెం సచివాలయం', 'Maddilapalem, Visakhapatnam, Andhra Pradesh 530013', 'Visakhapatnam (Main City)', 'Visakhapatnam', 17.7395, 83.316, '0891-2560509'),
  ('Chinna Waltair Sachivalayam', 'చిన్న వాల్తేరు సచివాలయం', 'Chinna Waltair, Visakhapatnam, Andhra Pradesh 530017', 'Visakhapatnam (Main City)', 'Visakhapatnam', 17.7215, 83.328, '0891-2560510'),
  ('Pandurangapuram Sachivalayam', 'పాండురంగాపురం సచివాలయం', 'Pandurangapuram, Visakhapatnam, Andhra Pradesh 530003', 'Visakhapatnam (Main City)', 'Visakhapatnam', 17.7145, 83.325, '0891-2560511'),
  ('Jagadamba Center Sachivalayam', 'జగదాంబ సెంటర్ సచివాలయం', 'Jagadamba Junction, Visakhapatnam, Andhra Pradesh 530020', 'Visakhapatnam (Main City)', 'Visakhapatnam', 17.7085, 83.298, '0891-2560512'),
  ('Poorna Market Sachivalayam', 'పూర్ణా మార్కెట్ సచివాలయం', 'Poorna Market, Visakhapatnam, Andhra Pradesh 530001', 'Visakhapatnam (Main City)', 'Visakhapatnam', 17.7055, 83.295, '0891-2560513'),
  ('Kancharapalem Sachivalayam', 'కంచరపాలెం సచివాలయం', 'Kancharapalem, Visakhapatnam, Andhra Pradesh 530008', 'Visakhapatnam (Main City)', 'Visakhapatnam', 17.716, 83.276, '0891-2560514'),
  ('NAD Kotha Road Sachivalayam', 'ఎన్.ఏ.డి కొత్త రోడ్ సచివాలయం', 'NAD Kotha Road, Visakhapatnam, Andhra Pradesh 530009', 'Visakhapatnam (Main City)', 'Visakhapatnam', 17.745, 83.245, '0891-2560515'),
  ('Thatichetlapalem Sachivalayam', 'తాటిచెట్లపాలెం సచివాలయం', 'Thatichetlapalem, Visakhapatnam, Andhra Pradesh 530018', 'Visakhapatnam (Main City)', 'Visakhapatnam', 17.712, 83.288, '0891-2560516'),
  ('Madhurawada Sachivalayam', 'మధురవాడ సచివాలయం', 'Madhurawada, Visakhapatnam, Andhra Pradesh 530041', 'Madhurawada', 'Visakhapatnam', 17.802, 83.381, '0891-2560601'),
  ('Rushikonda Sachivalayam', 'రుషికొండ సచివాలయం', 'Rushikonda, Visakhapatnam, Andhra Pradesh 530045', 'Madhurawada', 'Visakhapatnam', 17.784, 83.383, '0891-2560602'),
  ('Yendada Sachivalayam', 'ఎండాడ సచివాలయం', 'Yendada, Visakhapatnam, Andhra Pradesh 530045', 'Madhurawada', 'Visakhapatnam', 17.774, 83.354, '0891-2560603'),
  ('Kommadi Sachivalayam', 'కొమ్మాడి సచివాలయం', 'Kommadi, Visakhapatnam, Andhra Pradesh 530048', 'Madhurawada', 'Visakhapatnam', 17.812, 83.365, '0891-2560604'),
  ('Arilova Sachivalayam', 'అరిలోవ సచివాలయం', 'Arilova, Visakhapatnam, Andhra Pradesh 530040', 'Madhurawada', 'Visakhapatnam', 17.768, 83.322, '0891-2560605'),
  ('Pendurthi Sachivalayam', 'పెందుర్తి సచివాలయం', 'Pendurthi, Visakhapatnam, Andhra Pradesh 531173', 'Pendurthi', 'Visakhapatnam', 17.782, 83.228, '0891-2560701'),
  ('Vepagunta Sachivalayam', 'వేపగుంట సచివాలయం', 'Vepagunta, Visakhapatnam, Andhra Pradesh 530047', 'Pendurthi', 'Visakhapatnam', 17.765, 83.225, '0891-2560702')
on conflict (name) do nothing;
