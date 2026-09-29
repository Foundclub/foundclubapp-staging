import {
  canDeclareLatePresence,
  isArrivalTrackingEnabled,
  isRsvpEnabled,
} from './presenceRule';

// LOT POINTAGE (decisions d Adel du 29/09) — LA REGLE COTE APP, A UN SEUL ENDROIT.
// Miroir de `admin/src/api/event/utils/presence-rule.js` : deux options par
// evenement (NULL = cochee) et la porte « je passe en present » du « pas
// renseigne ». Ecrits ROUGES contre app `8d017cd6` (le module n existait pas).

const HEURE = 60 * 60 * 1000;
const MAINTENANT = Date.UTC(2026, 8, 29, 12, 0, 0);

const matchDHier = (surcharges = {}) => ({
  date: new Date(MAINTENANT - 20 * HEURE).toISOString(),
  documentId: 'match-hier',
  eventFormat: 'single',
  ...surcharges,
});

const pasRenseigne = (surcharges = {}) => ({
  event: matchDHier(),
  hasPendingRequest: false,
  isConvenedMember: true,
  isMissing: false,
  isParticipating: false,
  myAttendanceStatus: null,
  now: MAINTENANT,
  ...surcharges,
});

test('POINTAGE-app/1 — un evenement d AVANT le lot (champ absent ou NULL) a les deux options cochees', () => {
  expect(isRsvpEnabled({})).toBe(true);
  expect(isRsvpEnabled({ rsvpEnabled: null })).toBe(true);
  expect(isRsvpEnabled({ rsvpEnabled: false })).toBe(false);
  expect(isArrivalTrackingEnabled({})).toBe(true);
  expect(isArrivalTrackingEnabled({ arrivalTrackingEnabled: null })).toBe(true);
  expect(isArrivalTrackingEnabled({ arrivalTrackingEnabled: false })).toBe(false);
  expect(isRsvpEnabled(null)).toBe(true);
});

test('POINTAGE-app/2 — le lendemain, un membre qui n a RIEN repondu peut passer present', () => {
  expect(canDeclareLatePresence(pasRenseigne())).toBe(true);
});

test('POINTAGE-app/3 — la porte reste fermee a tous les autres', () => {
  expect(canDeclareLatePresence(pasRenseigne({ isParticipating: true }))).toBe(false);
  expect(canDeclareLatePresence(pasRenseigne({ isMissing: true }))).toBe(false);
  expect(canDeclareLatePresence(pasRenseigne({ hasPendingRequest: true }))).toBe(false);
  expect(canDeclareLatePresence(pasRenseigne({ isConvenedMember: false }))).toBe(false);
  expect(canDeclareLatePresence(pasRenseigne({ myAttendanceStatus: 'no_show' }))).toBe(false);
  expect(canDeclareLatePresence(pasRenseigne({ event: matchDHier({ rsvpEnabled: false }) }))).toBe(false);
  expect(canDeclareLatePresence(pasRenseigne({ event: matchDHier({ eventFormat: 'stage_day' }) }))).toBe(false);
  expect(canDeclareLatePresence(pasRenseigne({ event: matchDHier({ league_match: { id: 1 } }) }))).toBe(false);
});

test('POINTAGE-app/4 — AVANT le debut, ce n est pas « apres coup » : les boutons habituels suffisent', () => {
  const demain = matchDHier({ date: new Date(MAINTENANT + 20 * HEURE).toISOString() });

  expect(canDeclareLatePresence(pasRenseigne({ event: demain }))).toBe(false);
});
