// Round-robin lead segregation for call-center agents.
//
// One FLAT pool of all call-center agents (income/salary bands are NOT used to
// divide leads here — round-robin is the sole divider). Each agent's slot is its
// index in CALL_CENTER_POOL below; the backend then serves only the leads whose
// phone hashes to that slot (hash(phone) % poolSize = slot). The same customer
// always lands with the same agent, across Offer Leads / Selected Lenders / User
// Track and High/Short.
//
// To add / remove / reorder an agent, edit this list. Order matters only in that
// each agent keeps whichever index it has; changing the SIZE re-shards everyone
// (inherent to stateless hashing). Emails are matched case-insensitively against
// the logged-in user (see getCallCenterAgentId).
//
// NOTE (security): like the salary bands, this is COOPERATIVE — the slot is sent
// as a request param from a client with a mock token, so it divides workload but
// is not access control. Real isolation needs real auth (a signed token carrying
// the slot, checked server-side).
import { isCallCenterRole } from './callCenterBands';

export const CALL_CENTER_POOL = [
  'callcenter1@cready.in',
  'callcenter2@cready.in',
  'callcenter3@cready.in',
  'callcenter4@cready.in',
  'callcenter5@cready.in',
  'callcenter6@cready.in',
  'callcenter7@cready.in',
  'callcenter8@cready.in',
  // add more agents here…
];

/**
 * Stable agent id (email) for the logged-in user when they're a call-center pool
 * member, else null. Sent to the backend as `agentId`, which filters the lead
 * list to leads PERSISTENTLY assigned to this agent (lead_assignments) — so the
 * set never reshuffles when the roster changes. Non-members get null → their
 * normal (unfiltered) view.
 *
 * This is the mechanism used by the Offer Leads / Short Offer Leads lists.
 */
export const getCallCenterAgentId = (user) => {
  if (!user || !isCallCenterRole(user.role)) return null;
  const email = String(user.email || '').trim().toLowerCase();
  return CALL_CENTER_POOL.some((e) => e.toLowerCase() === email) ? email : null;
};
