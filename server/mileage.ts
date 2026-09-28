interface Logger {
  error: (msg: string) => void;
}

const logger: Logger = { error: () => {} };

// Commute legs the DJ tracks for gas/reimbursement:
//   1. miles_to_office — home → office (one-way, the fixed daily commute)
//   2. miles_to_event  — office → venue → office (the event roundtrip)
// Computed via free, keyless services: Nominatim (geocode) + OSRM (route).

const HOME = '13862 Carolina Court, Fishers, IN 46038';
const OFFICE = 'REDACTED Ave, Indianapolis, IN 46237';

// Verified coordinates (fallback if geocoding is unreachable, so mileage
// never blocks an event save).
const FALLBACK_HOME = { lat: 39.9904971, lon: -85.9879764 };
const FALLBACK_OFFICE = { lat: 39.6410039, lon: -86.0827659 };

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=';
const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving/';
const METERS_PER_MILE = 1609.344;

interface Coords {
  lat: number;
  lon: number;
}

// In-memory geocode cache — venue addresses repeat, Nominatim is 1 req/s.
const geocodeCache = new Map<string, Coords | null>();
let geocodeQueue: Promise<void> = Promise.resolve();

const round1 = (meters: number) => Math.round((meters / METERS_PER_MILE) * 10) / 10;

async function geocode(address: string): Promise<Coords | null> {
  const key = address.trim().toLowerCase();
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;
  try {
    // Serialize requests to honor Nominatim's 1 req/s ToS.
    const previous = geocodeQueue;
    const turn = (async () => {
      await previous;
      return new Promise((r) => setTimeout(r, 1100));
    })();
    geocodeQueue = turn.then(() => {});
    await turn;
    const resp = await fetch(NOMINATIM_URL + encodeURIComponent(address), {
      headers: { 'User-Agent': 'complete-paperwork/1.0 (DJ mileage tracker)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const results = (await resp.json()) as { lat: string; lon: string }[];
    const coords = results.length
      ? { lat: Number(results[0].lat), lon: Number(results[0].lon) }
      : null;
    geocodeCache.set(key, coords);
    return coords;
  } catch (e) {
    logger.error(e instanceof Error ? `geocode failed for "${address}": ${e.message}` : 'geocode failed');
    return null;
  }
}

async function resolveHome(): Promise<Coords> {
  return (await geocode(HOME)) ?? FALLBACK_HOME;
}

async function resolveOffice(): Promise<Coords> {
  return (await geocode(OFFICE)) ?? FALLBACK_OFFICE;
}

// OSRM route distance in meters for waypoints in order, driving mode.
async function routeMeters(points: Coords[]): Promise<number | null> {
  const coordStr = points.map((p) => `${p.lon},${p.lat}`).join(';');
  try {
    const resp = await fetch(`${OSRM_URL}${coordStr}?overview=false`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = (await resp.json()) as { code?: string; routes?: { distance: number }[] };
    if (data.code !== 'Ok' || !data.routes?.length) throw new Error(`OSRM code ${data.code}`);
    return data.routes[0].distance;
  } catch (e) {
    logger.error(e instanceof Error ? `OSRM failed: ${e.message}` : 'OSRM failed');
    return null;
  }
}

export interface EventMileage {
  miles_to_office: number | null;
  miles_to_event: number | null;
}

// Fixed commute leg — home → office. The home/office pair never changes, so
// compute it once per process and reuse.
let officeLegCache: Promise<number | null> | null = null;
function officeLeg(): Promise<number | null> {
  if (!officeLegCache) {
    officeLegCache = (async () => {
      const [home, office] = await Promise.all([resolveHome(), resolveOffice()]);
      const meters = await routeMeters([home, office]);
      return meters == null ? null : round1(meters);
    })();
  }
  return officeLegCache;
}

/**
 * Mileage for an event with the given venue address.
 * Returns { miles_to_office, miles_to_event }; either may be null if
 * geocoding/routing is unavailable. Never throws — callers save the event
 * regardless and mileage fills in when the route services respond.
 */
export async function computeEventMileage(venueAddress: string): Promise<EventMileage> {
  const toOffice = await officeLeg();
  let toEvent: number | null = null;

  const office = await resolveOffice();
  const venue = await geocode(venueAddress);
  if (venue) {
    // Roundtrip: office → venue → office.
    const meters = await routeMeters([office, venue, office]);
    if (meters != null) toEvent = round1(meters);
  }

  return { miles_to_office: toOffice, miles_to_event: toEvent };
}
