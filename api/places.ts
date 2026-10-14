/**
 * POST /api/places — OPTIONAL. Uses Google Places (Text Search, New) to find
 * Sachivalayams and MeeSeva centres near a point. Google's listings are the most
 * complete source for AP offices, so when GOOGLE_MAPS_API_KEY is set the
 * "Find a centre" page merges these with OpenStreetMap and your database.
 *
 * Env: GOOGLE_MAPS_API_KEY  (Google Cloud → enable "Places API (New)" → create key;
 *      restrict it to the Places API). Without it this returns {configured:false}
 *      and the app uses OpenStreetMap + your database only.
 */

type Kind = 'sachivalayam' | 'meeseva';

const QUERIES: Record<Kind, string[]> = {
  sachivalayam: ['Grama Ward Sachivalayam', 'Village Secretariat'],
  meeseva: ['MeeSeva centre', 'Aadhaar centre'],
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': status === 200 ? 'public, max-age=600' : 'no-store' },
  });

interface GPlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  nationalPhoneNumber?: string;
  businessStatus?: string;
}

async function search(key: string, textQuery: string, lat: number, lng: number, radius: number): Promise<GPlace[]> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.businessStatus',
    },
    body: JSON.stringify({
      textQuery,
      pageSize: 20,
      languageCode: 'en',
      regionCode: 'IN',
      locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius } },
    }),
  });
  if (!res.ok) throw new Error(`Places ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { places?: GPlace[] };
  return data.places ?? [];
}

export async function POST(request: Request): Promise<Response> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return json({ configured: false, places: [] });

  const body = (await request.json().catch(() => ({}))) as { lat?: number; lng?: number; radiusKm?: number };
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  // Andhra Pradesh plus a margin; refuse anything else so the key can't be abused.
  if (!(lat > 12 && lat < 20.5 && lng > 76 && lng < 85.5)) return json({ error: 'Outside Andhra Pradesh' }, 400);
  const radius = Math.min(50000, Math.max(2000, (Number(body.radiusKm) || 10) * 1000));

  try {
    const kinds = Object.keys(QUERIES) as Kind[];
    const results = await Promise.all(
      kinds.flatMap((kind) => QUERIES[kind].map(async (q) => (await search(key, q, lat, lng, radius)).map((p) => ({ p, kind })))),
    );
    const seen = new Set<string>();
    const places = results
      .flat()
      .filter(({ p }) => p.location && p.businessStatus !== 'CLOSED_PERMANENTLY' && !seen.has(p.id) && seen.add(p.id))
      .map(({ p, kind }) => {
        const name = p.displayName?.text ?? '';
        // A text search for "Aadhaar centre" can return a sachivalayam and vice versa — classify by name.
        const k: Kind = /mee\s?seva|aadhaa?r|e-?seva|common service/i.test(name) ? 'meeseva' : /sachiv|secretariat|panchayat/i.test(name) ? 'sachivalayam' : kind;
        return {
          id: `g-${p.id}`,
          kind: k,
          name,
          address: p.formattedAddress ?? '',
          latitude: p.location!.latitude,
          longitude: p.location!.longitude,
          phone: p.nationalPhoneNumber ?? null,
        };
      });
    return json({ configured: true, places });
  } catch (err) {
    console.error('[places]', (err as Error).message);
    return json({ configured: true, error: 'Google Places request failed', places: [] }, 502);
  }
}

export function GET(): Response {
  return json({ configured: Boolean(process.env.GOOGLE_MAPS_API_KEY) });
}
