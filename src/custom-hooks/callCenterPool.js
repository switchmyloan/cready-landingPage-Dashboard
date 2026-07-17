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
// the logged-in user (see getRoundRobin).
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
  // add more agents here…
];

/**
 * Round-robin descriptor for the logged-in user, or null when the user isn't a
 * call-center agent OR isn't listed in the pool (those fall back to their normal
 * view / salary band). Shape: { rrSlot, rrTotal }.
 */
export const getRoundRobin = (user) => {
  if (!user || !isCallCenterRole(user.role)) return null;
  const email = String(user.email || '').trim().toLowerCase();
  const slot = CALL_CENTER_POOL.findIndex((e) => e.toLowerCase() === email);
  if (slot < 0) return null;
  return { rrSlot: slot, rrTotal: CALL_CENTER_POOL.length };
};
