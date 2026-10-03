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

test('POINTAGE-app/1 — evenement d AVANT le lot (champ absent / NULL) : options cochees', () => {
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
  const surUn = (evenement) => canDeclareLatePresence(
    pasRenseigne({ event: matchDHier(evenement) }),
  );
  expect(surUn({ rsvpEnabled: false })).toBe(false);
  expect(surUn({ eventFormat: 'stage_day' })).toBe(false);
  expect(surUn({ league_match: { id: 1 } })).toBe(false);
});

test('POINTAGE-app/4 — AVANT le debut, ce n est pas « apres coup »', () => {
  const demain = matchDHier({ date: new Date(MAINTENANT + 20 * HEURE).toISOString() });

  expect(canDeclareLatePresence(pasRenseigne({ event: demain }))).toBe(false);
});

// STATS-FIX2 · POINT 5 (tournee T10, ecran 1) — « Tu n as pas repondu… Je passe en present »
// etait epingle sur un match du 05/09, un mois plus tard. La porte du « pas renseigne » reste
// ouverte APRES l evenement (decision d Adel « reponse B », 29/09), mais le temps de l apres-match
// seulement : 72 h, la fenetre « chaude » des rappels d apres-match du serveur
// (match-stats-report.ts, HOT_WINDOW_HOURS), comptee depuis le debut.
test('STATS-FIX2/5 — 🔴 un mois apres, « Je passe en present » n est plus propose', () => {
  const ilYAUnMois = matchDHier({ date: new Date(MAINTENANT - 27 * 24 * HEURE).toISOString() });

  expect(canDeclareLatePresence(pasRenseigne({ event: ilYAUnMois }))).toBe(false);
});

test('STATS-FIX2/5 — la porte tient 72 h apres le debut, pas une de plus', () => {
  const debutIlYA = (heures) => matchDHier({
    date: new Date(MAINTENANT - heures * HEURE).toISOString(),
  });

  expect(canDeclareLatePresence(pasRenseigne({ event: debutIlYA(1) }))).toBe(true);
  expect(canDeclareLatePresence(pasRenseigne({ event: debutIlYA(71) }))).toBe(true);
  expect(canDeclareLatePresence(pasRenseigne({ event: debutIlYA(72) }))).toBe(true);
  expect(canDeclareLatePresence(pasRenseigne({ event: debutIlYA(73) }))).toBe(false);
});
