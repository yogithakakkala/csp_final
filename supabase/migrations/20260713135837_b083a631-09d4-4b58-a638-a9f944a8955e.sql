
insert into public.sachivalayam_centers (name, name_telugu, address, area, district, latitude, longitude, phone)
values
  ('Bheemunipatnam Sachivalayam', 'భీమునిపట్నం సచివాలయం', 'Bheemunipatnam, Visakhapatnam, Andhra Pradesh 531163', 'Bheemunipatnam', 'Visakhapatnam', 17.892, 83.451, '08933-222001'),
  ('Sabbavaram Sachivalayam', 'సబ్బవరం సచివాలయం', 'Sabbavaram, Visakhapatnam, Andhra Pradesh 531036', 'Sabbavaram', 'Visakhapatnam', 17.782, 83.152, '0891-2870101'),
  ('Anandapuram Sachivalayam', 'ఆనందపురం సచివాలయం', 'Anandapuram, Visakhapatnam, Andhra Pradesh 531173', 'Anandapuram', 'Visakhapatnam', 17.83, 83.29, '0891-2560801'),
  ('Anakapalle Sachivalayam', 'అనకాపల్లి సచివాలయం', 'Anakapalle, Anakapalli District, Andhra Pradesh 531001', 'Anakapalle', 'Anakapalli', 17.691, 83.003, '08924-222001'),
  ('Chodavaram Sachivalayam', 'చోడవరం సచివాలయం', 'Chodavaram, Anakapalli District, Andhra Pradesh 531036', 'Chodavaram', 'Anakapalli', 17.826, 82.876, '08934-222001'),
  ('Narsipatnam Sachivalayam', 'నర్సీపట్నం సచివాలయం', 'Narsipatnam, Anakapalli District, Andhra Pradesh 531116', 'Narsipatnam', 'Anakapalli', 17.667, 82.617, '08931-222001'),
  ('Yelamanchili Sachivalayam', 'యలమంచిలి సచివాలయం', 'Yelamanchili, Anakapalli District, Andhra Pradesh 531055', 'Yelamanchili', 'Anakapalli', 17.553, 82.855, '08932-222001'),
  ('Paravada Sachivalayam', 'పరవాడ సచివాలయం', 'Paravada, Anakapalli District, Andhra Pradesh 531021', 'Paravada', 'Anakapalli', 17.748, 83.099, '08924-222501'),
  ('Atchutapuram Sachivalayam', 'అచ్యుతాపురం సచివాలయం', 'Atchutapuram, Anakapalli District, Andhra Pradesh 531011', 'Atchutapuram', 'Anakapalli', 17.62, 83.08, '08924-222601'),
  ('Nakkapalli Sachivalayam', 'నక్కపల్లి సచివాలయం', 'Nakkapalli, Anakapalli District, Andhra Pradesh 531081', 'Nakkapalli', 'Anakapalli', 17.499, 82.845, '08932-233001'),
  ('Butchayyapeta Sachivalayam', 'బుచ్చయ్యపేట సచివాలయం', 'Butchayyapeta, Anakapalli District, Andhra Pradesh 531011', 'Butchayyapeta', 'Anakapalli', 17.63, 83.13, '08924-222701'),
  ('Kasimkota Sachivalayam', 'కాశింకోట సచివాలయం', 'Kasimkota, Anakapalli District, Andhra Pradesh 531035', 'Kasimkota', 'Anakapalli', 17.646, 82.936, '08924-223001'),
  ('Munagapaka Sachivalayam', 'మునగపాక సచివాలయం', 'Munagapaka, Anakapalli District, Andhra Pradesh 531011', 'Munagapaka', 'Anakapalli', 17.755, 83.03, '08924-223101'),
  ('Padmanabham Sachivalayam', 'పద్మనాభం సచివాలయం', 'Padmanabham, Visakhapatnam, Andhra Pradesh 531019', 'Padmanabham', 'Visakhapatnam', 17.85, 83.24, '0891-2560901'),
  ('Rambilli Sachivalayam', 'రాంబిల్లి సచివాలయం', 'Rambilli, Anakapalli District, Andhra Pradesh 531061', 'Rambilli', 'Anakapalli', 17.573, 83.12, '08924-223201'),
  ('K Kotapadu Sachivalayam', 'కె. కొటపాడు సచివాలయం', 'K Kotapadu, Anakapalli District, Andhra Pradesh 531111', 'K Kotapadu', 'Anakapalli', 17.72, 82.75, '08931-223301'),
  ('Devarapalli Sachivalayam', 'దేవరపల్లి సచివాలయం', 'Devarapalli, Anakapalli District, Andhra Pradesh 531083', 'Devarapalli', 'Anakapalli', 17.44, 82.78, '08932-223401')
on conflict (name) do nothing;

alter table public.sachivalayam_centers
  add column if not exists ward text,
  add column if not exists secretariat_code text;

do $$
begin
  begin
    alter publication supabase_realtime add table public.applications;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.application_messages;
  exception when duplicate_object then null;
  end;
end$$;
alter table public.applications replica identity full;
alter table public.application_messages replica identity full;
