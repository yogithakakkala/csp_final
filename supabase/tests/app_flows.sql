-- Integration test: every database operation SachiSeva performs, run as the
-- right role, with row-level security on. Any failed expectation aborts.
-- Run against a database built from supabase/schema.sql.
\set ON_ERROR_STOP 1
\set QUIET 1

create or replace function pg_temp.act(_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(_uid, ''), false);
  if _uid is null then execute 'set role anon'; else execute 'set role authenticated'; end if;
end $$;

create or replace function pg_temp.expect_fail(_sql text, _what text) returns void language plpgsql as $$
begin
  begin
    execute _sql;
  exception when others then
    raise notice 'PASS (blocked as expected): % — %', _what, sqlerrm;
    return;
  end;
  raise exception 'FAIL: % was allowed', _what;
end $$;

create or replace function pg_temp.check(_ok boolean, _what text) returns void language plpgsql as $$
begin
  if not coalesce(_ok, false) then raise exception 'FAIL: %', _what; end if;
  raise notice 'PASS: %', _what;
end $$;

-- ── Sign-up (auth trigger creates profiles) ────────────────────────────────
reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'lakshmi@example.com', '{"full_name":"Lakshmi Devi"}'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'suresh@example.com',  '{"full_name":"Suresh Babu"}'),
  ('aaaaaaaa-0000-0000-0000-000000000009', 'staff@example.com',   '{"full_name":"Ravi Staff"}');
select pg_temp.check((select count(*) = 3 from public.profiles where email like '%@example.com'), 'profile row created for each sign-up');
select pg_temp.check((select full_name = 'Lakshmi Devi' and not is_staff from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'profile has name, not staff');
-- what /api/claim-staff does with the service role
update public.profiles set is_staff = true where id = 'aaaaaaaa-0000-0000-0000-000000000009';

-- ── Staff key (login & sign-up) ─────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000004', 'newstaff@example.com', '{"full_name":"New Staff"}');
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000004');
select pg_temp.expect_fail('select * from public.app_secrets', 'reading the staff key');
select pg_temp.check(public.claim_staff('1234') = false, 'wrong staff key refused');
select pg_temp.check((select not is_staff from public.profiles where id = auth.uid()), 'wrong key does not grant staff');
select pg_temp.check(public.claim_staff(' 4040 ') = true, 'staff key 4040 accepted');
select pg_temp.check((select is_staff from public.profiles where id = auth.uid()), 'right key grants staff');
select pg_temp.check(public.claim_staff('4040') = true, 'existing staff pass the key check at login');
select pg_temp.check(public.claim_staff('1') is false and public.claim_staff('2') is false and public.claim_staff('3') is false and public.claim_staff('5') is false and public.claim_staff('6') is false, 'five wrong keys');
select pg_temp.expect_fail($$select public.claim_staff('4040')$$, 'a sixth try within 15 minutes (locked)');
select pg_temp.expect_fail($$insert into public.profiles (id, is_staff) values (gen_random_uuid(), true)$$, 'citizen inserting a staff profile');
select pg_temp.act(null);
select pg_temp.expect_fail($$select public.claim_staff('4040')$$, 'anonymous staff-key check');
reset role;

-- ── Anonymous visitor ──────────────────────────────────────────────────────
select pg_temp.act(null);
select pg_temp.check((select count(*) >= 21 from public.schemes), 'anon can read schemes');
select pg_temp.check((select count(*) > 0 from public.sachivalayam_centers), 'anon can read sachivalayam centres');
select pg_temp.check((select count(*) > 0 from public.meeseva_centers), 'anon can read MeeSeva centres');
select pg_temp.check((select count(*) = 0 from public.applications), 'anon sees no applications');
select pg_temp.expect_fail('select * from public.certificate_requests', 'anon reading certificate requests');

-- ── Citizen: profile ───────────────────────────────────────────────────────
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.check((select count(*) = 1 from public.profiles), 'citizen sees only own profile');
update public.profiles set full_name = 'Lakshmi Devi Konda' where id = auth.uid();
select pg_temp.expect_fail($$update public.profiles set is_staff = true where id = auth.uid()$$, 'citizen making themselves staff');
-- "Answer once" family profile (My schemes)
update public.profiles set eligibility_profile = '{"age":64,"gender":"female","rice_card":true,"monthly_income":8000}' where id = auth.uid();
select pg_temp.check((select eligibility_profile->>'age' = '64' from public.profiles where id = auth.uid()), 'citizen saves family profile');
select pg_temp.check((select count(*) >= 16 from public.schemes where id like 'svc-%'), 'Sachivalayam services are in the catalogue');

-- "Apply for all": several applications in one go, including a service request
insert into public.applications (user_id, scheme_id, status, applicant_details, submitted_documents) values
  (auth.uid(), 'svc-income-certificate', 'submitted', '{"full_name":"Lakshmi","submitted_via":"Apply for all"}', '[]'),
  (auth.uid(), 'talliki-vandanam', 'submitted', '{"full_name":"Lakshmi","submitted_via":"Apply for all"}', '[{"document_type":"Aadhaar card","file_url":"x/common/aadhaar.jpg"}]');
select pg_temp.check((select count(*) = 2 from public.applications where applicant_details->>'submitted_via' = 'Apply for all' and token_number is not null), 'apply-for-all creates numbered applications');
reset role;
delete from public.applications where applicant_details->>'submitted_via' = 'Apply for all';
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');

-- ── Citizen: draft autosave (PostgREST upsert = insert … on conflict do update) ─
insert into public.application_drafts (user_id, scheme_id, draft_data, completion_percentage)
values (auth.uid(), 'deepam-2', '{"details":{"full_name":"L"}}', 20)
on conflict (user_id, scheme_id) do update set draft_data = excluded.draft_data, completion_percentage = excluded.completion_percentage;
insert into public.application_drafts (user_id, scheme_id, draft_data, completion_percentage)
values (auth.uid(), 'deepam-2', '{"details":{"full_name":"Lakshmi"}}', 60)
on conflict (user_id, scheme_id) do update set draft_data = excluded.draft_data, completion_percentage = excluded.completion_percentage;
select pg_temp.check((select completion_percentage = 60 from public.application_drafts where scheme_id = 'deepam-2'), 'draft autosave upsert updates in place');

-- ── Citizen: document upload to storage (own folder only) ──────────────────
insert into storage.objects (bucket_id, name) values ('applications', 'aaaaaaaa-0000-0000-0000-000000000001/deepam-2/aadhaar-x.jpg');
select pg_temp.expect_fail($$insert into storage.objects (bucket_id, name) values ('applications', 'aaaaaaaa-0000-0000-0000-000000000002/steal.jpg')$$, 'upload into another citizen''s folder');
select pg_temp.check((select count(*) = 1 from storage.objects), 'citizen can read own uploads');

-- ── Citizen: My documents (upsert on user_id, document_type) ────────────────
insert into public.user_documents (user_id, document_type, file_url) values (auth.uid(), 'Aadhaar Card', 'confirmed-by-user')
on conflict (user_id, document_type) do update set file_url = excluded.file_url;
insert into public.user_documents (user_id, document_type, file_url) values (auth.uid(), 'Aadhaar Card', 'aaaaaaaa-0000-0000-0000-000000000001/user-docs/a.jpg')
on conflict (user_id, document_type) do update set file_url = excluded.file_url;
select pg_temp.check((select count(*) = 1 and max(file_url) like '%a.jpg' from public.user_documents), 'my-documents upsert keeps one row per document');

-- ── Citizen: submit application (tries to self-approve) ────────────────────
insert into public.applications (user_id, scheme_id, status, applicant_details, submitted_documents)
values (auth.uid(), 'deepam-2', 'approved', '{"full_name":"Lakshmi Devi Konda","phone":"9876543210"}',
        '[{"document_type":"Aadhaar","file_url":"aaaaaaaa-0000-0000-0000-000000000001/deepam-2/aadhaar-x.jpg"}]');
select pg_temp.check((select status = 'submitted' from public.applications where scheme_id = 'deepam-2'), 'self-approval forced back to submitted');
select pg_temp.check((select token_number ~ '^APP-\d{4}-\d{6}$' from public.applications where scheme_id = 'deepam-2'), 'application number generated (APP-YYYY-NNNNNN)');
select pg_temp.check((select count(*) = 0 from public.application_drafts where scheme_id = 'deepam-2'), 'draft removed after submitting');
select pg_temp.check((select count(*) = 1 from public.application_status_history), 'timeline starts with "submitted"');
select pg_temp.check((select scheme->>'name' is not null from (select to_jsonb(s) as scheme from public.applications a join public.schemes s on s.id = a.scheme_id) x), 'application joins its scheme');
select pg_temp.expect_fail($$insert into public.applications (user_id, scheme_id) values ('aaaaaaaa-0000-0000-0000-000000000002', 'deepam-2')$$, 'applying on someone else''s behalf');
update public.applications set status = 'approved';
select pg_temp.check((select status = 'submitted' from public.applications where scheme_id = 'deepam-2'), 'citizen cannot change status');

-- ── Citizen: messages ──────────────────────────────────────────────────────
insert into public.application_messages (application_id, sender_type, message) select id, 'user', 'When will it be done?' from public.applications;
select pg_temp.expect_fail($$insert into public.application_messages (application_id, sender_type, message) select id, 'staff', 'Approved!' from public.applications$$, 'citizen posting as staff');
select pg_temp.expect_fail($$insert into public.application_messages (application_id, sender_type, is_document_request, requested_document_type) select id, 'user', true, 'x' from public.applications$$, 'citizen posting a document request');

-- ── Second citizen sees nothing of the first ───────────────────────────────
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000002');
select pg_temp.check((select count(*) = 0 from public.applications), 'other citizen cannot see the application');
select pg_temp.check((select count(*) = 0 from public.application_messages), 'other citizen cannot see the messages');
select pg_temp.check((select count(*) = 0 from public.application_status_history), 'other citizen cannot see the timeline');
select pg_temp.check((select count(*) = 0 from storage.objects), 'other citizen cannot see the documents');
select pg_temp.check((select count(*) = 0 from public.user_documents), 'other citizen cannot see my-documents');

-- ── Tracking by number (login required) ────────────────────────────────────
select pg_temp.act(null);
reset role;
select set_config('test.token', (select token_number from public.applications limit 1), false);
select pg_temp.act(null);
select pg_temp.expect_fail($q$select * from public.lookup_application_by_token(current_setting('test.token'))$q$, 'logged-out visitor tracking by number');
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000002');
select pg_temp.check((select applicant_name = 'Lakshmi' from public.lookup_application_by_token(lower(current_setting('test.token')))), 'tracker finds application (case-insensitive), first name only');
select pg_temp.check((select count(*) = 1 from public.lookup_application_history(current_setting('test.token'))), 'tracker shows the timeline');

-- ── Staff ──────────────────────────────────────────────────────────────────
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000009');
select pg_temp.check((select count(*) = 1 from public.applications a join public.profiles p on p.id = a.user_id), 'staff see applications with applicant profile');
select pg_temp.check((select count(*) = 1 from storage.objects), 'staff can open citizen documents');
insert into public.application_messages (application_id, sender_type, is_document_request, requested_document_type, message)
  select id, 'staff', true, 'Ration card (White / Yellow)', 'Please upload' from public.applications;
update public.applications set status = 'documents_requested';
select pg_temp.check((select changed_by_staff and document_requested = 'Ration card (White / Yellow)' from public.application_status_history where status = 'documents_requested'), 'timeline records staff action and requested document');
update public.applications set status = 'under_review';
select pg_temp.check((select count(*) = 3 from public.application_status_history), 'each status change adds a timeline step');

-- citizen uploads the requested document through the RPC
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
select public.citizen_add_submitted_document((select id from public.applications), 'Ration card (White / Yellow)', 'aaaaaaaa-0000-0000-0000-000000000001/deepam-2/ration.jpg');
select pg_temp.check((select jsonb_array_length(submitted_documents) = 2 from public.applications), 'requested document attached to application');
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000002');
select pg_temp.expect_fail($$select public.citizen_add_submitted_document((select id from public.applications limit 1), 'x', 'y')$$, 'attaching documents to someone else''s application');

-- grievances
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.grievances (application_id, user_id, reason) select id, auth.uid(), 'No update' from public.applications;
select pg_temp.expect_fail($$insert into public.grievances (application_id, user_id) select id, auth.uid() from public.applications$$, 'second open grievance on the same application');
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000009');
update public.grievances set status = 'acknowledged', acknowledged_at = now();
update public.grievances set status = 'resolved', resolved_at = now(), admin_response = 'Done';
select pg_temp.check((select status = 'resolved' from public.grievances), 'staff acknowledge and resolve grievance');
update public.applications set status = 'approved';
select pg_temp.check((select status = 'approved' from public.applications), 'staff approve application');
select pg_temp.check((select count(*) = 1 from public.application_messages where sender_type = 'staff' and message like 'Your application is approved. Please visit your nearby Sachivalayam%'), 'approval sends the applicant a message to visit the Sachivalayam');

-- centres: crowd level, add, edit
update public.sachivalayam_centers set busy_level = 'low', busy_updated_at = now(), busy_note = 'Quiet' where id = (select id from public.sachivalayam_centers limit 1);
update public.sachivalayam_centers set busy_level = 'busy', busy_updated_at = now() where id in (select id from public.sachivalayam_centers limit 3);
select pg_temp.expect_fail($$update public.sachivalayam_centers set busy_level = 'less'$$, 'old "less" crowd value (the v1 bug)');
insert into public.sachivalayam_centers (name, name_telugu, address, area, district, latitude, longitude) values ('Test Ward Sachivalayam', 'టెస్ట్', 'Addr', 'Area', 'NTR', 16.5, 80.6);
insert into public.sachivalayam_centers (name, name_telugu, address, area, district, latitude, longitude) values ('Test Ward Sachivalayam', 'టెస్ట్', 'Addr 2', 'Area', 'Guntur', 16.3, 80.4);
select pg_temp.check(true, 'two centres may share a name (needed for the all-AP import)');
insert into public.meeseva_centers (name, name_telugu, address, latitude, longitude, services) values ('Test MeeSeva', 'టెస్ట్', 'Addr', 16.5, 80.6, array['Income Certificate']);

-- schemes
insert into public.schemes (id, name, name_telugu, description, required_documents, eligibility_rules)
values ('test-scheme', 'Test', 'టెస్ట్', 'd', array['Aadhaar'], '{"max_annual_income":100000}')
on conflict (id) do update set eligibility_rules = excluded.eligibility_rules;
delete from public.schemes where id = 'test-scheme';
select pg_temp.expect_fail($$delete from public.schemes where id = 'deepam-2'$$, 'deleting a scheme that has applications');

-- certificates
insert into public.certificate_requests (token_number, citizen_name, certificate_type, status, contact_phone) values ('SC-2026-12345', 'Ramesh Kumar', 'Income Certificate', 'pending', '9999999999');
update public.certificate_requests set status = 'ready';
select pg_temp.check((select count(*) = 1 from public.certificate_requests), 'staff manage certificate requests');

-- staff accounts
select public.set_staff_status('aaaaaaaa-0000-0000-0000-000000000002', true);
select public.set_staff_status('aaaaaaaa-0000-0000-0000-000000000002', false);
select pg_temp.check((select count(*) = 4 from public.profiles where email like '%@example.com'), 'staff see all profiles');

select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect_fail($$select public.set_staff_status('aaaaaaaa-0000-0000-0000-000000000001', true)$$, 'citizen calling set_staff_status');
update public.sachivalayam_centers set busy_note = 'hack';
select pg_temp.check((select count(*) = 0 from public.sachivalayam_centers where busy_note = 'hack'), 'citizen cannot edit centres');
select pg_temp.check((select count(*) = 0 from public.certificate_requests), 'citizen cannot list certificate requests');

select pg_temp.check((select status = 'ready' and citizen_name = 'Ramesh' from public.lookup_certificate_by_token('sc-2026-12345')), 'certificate tracked by token (logged in), first name only');
select pg_temp.act(null);
select pg_temp.expect_fail($$select * from public.lookup_certificate_by_token('sc-2026-12345')$$, 'logged-out visitor tracking a certificate');

reset role;
select 'ALL CHECKS PASSED' as result;
