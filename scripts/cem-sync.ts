/**
 * cem-sync.ts — sync scheduled events from the Complete Weddings + Events
 * portal (completeeventmanager.com) into COMPLETE-PAPERWORK.
 *
 * Auth: reuses the MSAL refresh token captured from the logged-in browser
 * session (stored at ~/.secrets/complete-paperwork-cem-token.json, value never
 * printed). Each run refreshes its own access token; the refresh token rotates
 * and is persisted back.
 *
 * What it syncs per event: client name, date, times, hours, venue
 * (name/address → mileage auto-computed by the server), status, schedule
 * notes, planning/booking sheet links. PAY FIELDS ARE NEVER TOUCHED — the
 * portal only knows the client-facing invoice (totalOwed); DJ pay is manual.
 *
 * Matching: by cem_service_id (unique). Existing rows get PUT-updated;
 * missing rows get POST-created. Rows are keyed to the dev-user so they show
 * in the local app.
 *
 * Run: pnpm cem-sync   (needs NEONDB or DATABASE_URL for the API server,
 *                       and the API server running on API_PORT or :3000)
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { extractPlannerFields, type CemPlanner } from './cem-planner';

const TOKEN_FILE = path.join(os.homedir(), '.secrets', 'complete-paperwork-cem-token.json');
const API_BASE = `http://127.0.0.1:${process.env.API_PORT || 3000}`;
const CEM_API = 'https://complete-webapi-prod.azurewebsites.net/api';

interface TokenFile {
  clientId: string;
  refreshToken: string;
  tenant: string;
  policy: string;
  contactId?: number;
  savedAt?: string;
}

interface StaffAssignment {
  eventId: number;
  eventServiceId: number;
  eventName: string;
  eventDate: string;
  eventType: string;
  departmentName: string;
  productName: string;
  status: string;
  startTime: string;
  endTime: string;
  totalHours: number | null;
  scheduleNote: string | null;
  isPrimaryStaff: boolean;
  hasContactedClient: boolean;
  planningSheetLink: string;
  bookingSheetLink: string;
  franchiseId: number;
}

interface CemEvent {
  id: number;
  name: string;
  type: string;
  date: string;
  franchiseId: number;
  location?: {
    name?: string;
    address?: string;
    city?: string;
    state?: string;
  };
}

async function getAccessToken(tok: TokenFile): Promise<string> {
  const scope =
    'https://completewedo.onmicrosoft.com/cb9ed8f3-97d2-4b57-bb8e-904c4a1a3dc8/data.read ' +
    'https://completewedo.onmicrosoft.com/cb9ed8f3-97d2-4b57-bb8e-904c4a1a3dc8/data.write openid offline_access';
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: tok.clientId,
    refresh_token: tok.refreshToken,
    scope,
  });
  const resp = await fetch(
    `https://completewedo.b2clogin.com/${tok.tenant}/${tok.policy}/oauth2/v2.0/token`,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body },
  );
  const json = (await resp.json()) as { access_token?: string; refresh_token?: string; error?: string; error_description?: string };
  if (!json.access_token) {
    throw new Error(`token refresh failed (${resp.status}): ${json.error} — ${json.error_description?.slice(0, 120)}`);
  }
  if (json.refresh_token) {
    tok.refreshToken = json.refresh_token;
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tok, null, 1), { mode: 0o600 });
  }
  return json.access_token;
}

async function cemGet<T>(path: string, token: string): Promise<T> {
  const resp = await fetch(`${CEM_API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) throw new Error(`CEM ${path} -> HTTP ${resp.status}`);
  return (await resp.json()) as T;
}

// 1900-01-01T19:30:00 -> 19:30
function timeOfDay(iso: string | null): string | null {
  if (!iso) return null;
  const m = iso.match(/T(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : null;
}

// Portal status -> app status. Booked + future = upcoming, past = completed.
function appStatus(a: StaffAssignment): 'upcoming' | 'completed' | 'cancelled' {
  if (a.status.toLowerCase() === 'cancelled') return 'cancelled';
  const past = new Date(a.eventDate) < new Date(new Date().toDateString());
  return past ? 'completed' : 'upcoming';
}

function mapAssignment(a: StaffAssignment, ev?: CemEvent) {
  return {
    cem_event_id: a.eventId,
    cem_service_id: a.eventServiceId,
    client_name: a.eventName,
    event_date: a.eventDate,
    event_type: (a.eventType || '').toLowerCase() || null,
    start_time: timeOfDay(a.startTime),
    end_time: timeOfDay(a.endTime),
    booked_hours: a.totalHours ?? null,
    status: appStatus(a),
    venue_name: ev?.location?.name ?? null,
    venue_address: ev?.location?.address ?? null,
    special_instructions: a.scheduleNote || null,
    notes: `Planning sheet: ${a.planningSheetLink}\nBooking sheet: ${a.bookingSheetLink}`,
    cem_synced_at: new Date().toISOString(),
  };
}

async function appRequest(path: string, method: string, body?: unknown): Promise<{ status: number; json?: unknown }> {
  const resp = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = resp.status === 204 ? undefined : await resp.json().catch(() => undefined);
  return { status: resp.status, json };
}

async function main() {
  if (!fs.existsSync(TOKEN_FILE)) {
    throw new Error(`No CEM token file at ${TOKEN_FILE} — log into the portal in Brave and run the token capture first.`);
  }
  const tok = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')) as TokenFile;
  console.log('→ refreshing portal token…');
  const token = await getAccessToken(tok);

  // Who am I on the portal?
  const contactId = tok.contactId;
  if (!contactId) throw new Error('contactId missing from token file — re-run the token capture (it now stores it).');

  console.log(`→ fetching staff assignments for contact ${contactId}…`);
  const assignments = await cemGet<StaffAssignment[]>(`/staff-assignments?employeeContactId=${contactId}`, token);
  console.log(`   ${assignments.length} scheduled event(s)`);

  // Event details (venue) — one GET per unique event, cached in-run.
  const venueCache = new Map<number, CemEvent>();
  const existingResp = await appRequest('/api/events', 'GET');
  const existingList = (existingResp.json as { id: string; cem_service_id?: number | null }[]) || [];
  let created = 0, updated = 0, failed = 0;

  for (const a of assignments) {
    try {
      let ev = venueCache.get(a.eventId);
      if (!ev) {
        ev = await cemGet<CemEvent>(`/events/${a.eventId}`, token);
        venueCache.set(a.eventId, ev);
      }
      let fields = mapAssignment(a, ev);

      // Planning sheet answers → typed fields (contacts, times, songs, party…)
      try {
        const planner = await cemGet<CemPlanner>(`/events/${a.eventId}/planner`, token);
        const pf = extractPlannerFields(planner);
        const plannerNotes = typeof pf.planner_notes === 'string' ? pf.planner_notes : '';
        delete pf.planner_notes;
        const links = typeof fields.notes === 'string' ? fields.notes : '';
        fields = {
          ...fields,
          ...pf,
          notes: [links, plannerNotes].filter(Boolean).join('\n\n'),
        };
      } catch (e) {
        console.log(`   · planner unavailable for ${a.eventName} (${e instanceof Error ? e.message : '?'}) — syncing base fields only`);
      }

      // Match existing local event by cem_service_id
      const match = existingList.find((e) => e.cem_service_id === a.eventServiceId);

      if (match) {
        const r = await appRequest(`/api/events/${match.id}`, 'PUT', fields);
        if (r.status === 200) { updated += 1; console.log(`   = updated  ${a.eventName} (${a.eventDate})`); }
        else { failed += 1; console.log(`   ! update failed ${a.eventName}: HTTP ${r.status}`, JSON.stringify(r.json)); }
      } else {
        const r = await appRequest('/api/events', 'POST', fields);
        if (r.status === 201) { created += 1; console.log(`   + created  ${a.eventName} (${a.eventDate})`); }
        else { failed += 1; console.log(`   ! create failed ${a.eventName}: HTTP ${r.status}`, JSON.stringify(r.json)); }
      }
    } catch (e) {
      failed += 1;
      console.log(`   ! ${a.eventName}: ${e instanceof Error ? e.message : 'unknown error'}`);
    }
  }

  console.log(`\nsync done — created ${created}, updated ${updated}, failed ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('cem-sync failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});