#!/usr/bin/env node
/**
 * Imports every Sachivalayam / Village-Ward Secretariat / Panchayat office and
 * every MeeSeva / Aadhaar centre mapped on OpenStreetMap across Andhra Pradesh
 * into your Supabase tables. Safe to re-run: rows are upserted on `osm_id`, and
 * your manually-entered centres (osm_id = null) are never touched.
 *
 *   1. Run supabase/migrations/20261014000000_vercel_hardening.sql (adds osm_id)
 *   2. SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run import:centers
 *      (or put them in .env — this script reads it)
 *
 * Options:  --dry-run   just print counts      --district=Guntur   one district only
 */
import { readFileSync, existsSync } from 'node:fs';

// Tiny .env reader so no extra dependency is needed.
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const URL_ = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY = process.argv.includes('--dry-run');
const DISTRICT = (process.argv.find((a) => a.startsWith('--district=')) || '').split('=')[1];

if (!DRY && (!URL_ || !KEY)) {
  console.error('Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY first. Use --dry-run to test without them.');
  process.exit(1);
}

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const areaSel = DISTRICT
  ? `area["ISO3166-2"="IN-AP"]->.ap; area["name"~"^${DISTRICT}",i]["boundary"="administrative"](area.ap)->.a;`
  : `area["ISO3166-2"="IN-AP"]->.a;`;

const QUERY = `[out:json][timeout:300];
${areaSel}
(
  nwr(area.a)["name"~"sachiv|secretariat|సచివాలయ|panchayat office|panchayat bhavan|panchayath|పంచాయతీ కార్యాలయ",i];
  nwr(area.a)["name:te"~"సచివాలయ|పంచాయతీ"];
  nwr(area.a)["amenity"="townhall"];
  nwr(area.a)["office"="government"]["name"~"ward|village|grama|gram|mandal|tahsil|tehsil|revenue|municipal",i];
  nwr(area.a)["name"~"mee ?-?seva|మీ ?సేవ|e-?seva|aadhaa?r (seva|kendra|center|centre)|common service cent",i];
  nwr(area.a)["office"="government"]["government"="citizen_services"];
);
out center tags;`;

const MEESEVA_RE = /mee\s?-?seva|మీ\s?సేవ|మీసేవ|e-?seva|aadhaa?r|ఆధార్|common service|digital seva/i;

function classify(t) {
  const n = `${t.name ?? ''} ${t['name:en'] ?? ''} ${t['name:te'] ?? ''}`;
  if (MEESEVA_RE.test(n) || t.government === 'citizen_services') return 'meeseva';
  if (/sachiv|secretariat|సచివాలయ|panchayat|పంచాయతీ/i.test(n) || t.amenity === 'townhall') return 'sachivalayam';
  if (t.office === 'government') return 'sachivalayam';
  return null;
}

async function overpass() {
  for (const ep of ENDPOINTS) {
    try {
      process.stdout.write(`Querying ${ep} … `);
      const res = await fetch(ep, { method: 'POST', body: new URLSearchParams({ data: QUERY }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      console.log(`${json.elements.length} elements`);
      return json.elements;
    } catch (e) {
      console.log(`failed (${e.message})`);
    }
  }
  throw new Error('All Overpass endpoints failed — try again in a few minutes.');
}

async function upsert(table, rows) {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const res = await fetch(`${URL_}/rest/v1/${table}?on_conflict=osm_id`, {
      method: 'POST',
      headers: {
        apikey: KEY,
        authorization: `Bearer ${KEY}`,
        'content-type': 'application/json',
        prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      const text = await res.text();
      if (text.includes('osm_id')) throw new Error(`${table}: column osm_id missing — run supabase/migrations/20261014000000_vercel_hardening.sql first.`);
      throw new Error(`${table}: ${res.status} ${text.slice(0, 300)}`);
    }
    process.stdout.write(`  ${table}: ${Math.min(i + 500, rows.length)}/${rows.length}\r`);
  }
  console.log();
}

let elements;
try {
  elements = await overpass();
} catch (e) {
  console.error(`\n${e.message}\nCheck your internet connection (OpenStreetMap's Overpass API must be reachable) and try again.`);
  process.exit(1);
}
const sach = [];
const mee = [];
const seen = new Set();
for (const el of elements) {
  const t = el.tags || {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) continue;
  const kind = classify(t);
  if (!kind) continue;
  const osm_id = `${el.type}/${el.id}`;
  if (seen.has(osm_id)) continue;
  seen.add(osm_id);
  const name = (t['name:en'] || t.name || (kind === 'meeseva' ? 'MeeSeva centre' : 'Sachivalayam')).slice(0, 200);
  const locality = t['addr:suburb'] || t['addr:village'] || t['addr:hamlet'] || t['addr:city'] || '';
  const address =
    [t['addr:housenumber'], t['addr:street'], locality, t['addr:district'], t['addr:postcode']].filter(Boolean).join(', ') ||
    `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  const row = {
    osm_id,
    name,
    name_telugu: t['name:te'] || (/[ఀ-౿]/.test(t.name ?? '') ? t.name : name),
    address,
    area: locality || t['addr:district'] || 'Andhra Pradesh',
    district: t['addr:district'] || DISTRICT || 'Andhra Pradesh',
    latitude: lat,
    longitude: lng,
    phone: t.phone || t['contact:phone'] || null,
  };
  if (kind === 'meeseva') mee.push({ ...row, services: [] });
  else sach.push(row);
}

console.log(`Found ${sach.length} secretariats / panchayat offices and ${mee.length} MeeSeva / Aadhaar centres.`);
if (DRY) {
  console.log('Dry run — nothing written. Sample:', sach[0], mee[0]);
  process.exit(0);
}
await upsert('sachivalayam_centers', sach);
await upsert('meeseva_centers', mee);
console.log('Done. The Find a centre page will now show these from your database (with staff busy levels).');
