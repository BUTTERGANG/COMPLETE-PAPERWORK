// Debug: fetch a CEM planner by event id, run extractPlannerFields, print all fields.
import { extractPlannerFields } from './cem-planner';
import fs from 'fs';
const EVENT_ID = process.argv[2] || '3175517';
const tok = JSON.parse(fs.readFileSync(process.env.HOME + '/.secrets/complete-paperwork-cem-token.json', 'utf8'));
(async () => {
  const body = new URLSearchParams({
    grant_type: 'refresh_token', client_id: tok.clientId, refresh_token: tok.refreshToken,
    scope: 'https://completewedo.onmicrosoft.com/cb9ed8f3-97d2-4b57-bb8e-904c4a1a3dc8/data.read openid offline_access',
  });
  const r = await fetch('https://completewedo.b2clogin.com/completewedo.onmicrosoft.com/b2c_1a_signin_only/oauth2/v2.0/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const j = await r.json();
  if (j.refresh_token) { tok.refreshToken = j.refresh_token; fs.writeFileSync(process.env.HOME + '/.secrets/complete-paperwork-cem-token.json', JSON.stringify(tok, null, 1), { mode: 0o600 }); }
  const resp = await fetch('https://complete-webapi-prod.azurewebsites.net/api/events/' + EVENT_ID + '/planner', { headers: { Authorization: 'Bearer ' + j.access_token } });
  const pl = await resp.json();
  const f = extractPlannerFields(pl);
  for (const [k, v] of Object.entries(f)) {
    if (k === 'planner_notes') continue;
    if (v && typeof v === 'object' && Object.values(v as Record<string, unknown>).every(x => x === null || (Array.isArray(x) && x.length === 0))) continue;
    console.log(k + ':', JSON.stringify(v));
  }
  console.log('--- notes ---');
  console.log(f.planner_notes);
})();