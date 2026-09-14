import {
  BOOT_REQUEST_BLOCKED_CODE,
  BOOT_REQUEST_NO_SESSION_CODE,
} from '@/services/bootRequestGuard';

import { isInSentryExceptionsAllowList } from './sentryAllowList';

// ---------------------------------------------------------------------------
// Lot SENTRY1 — pourquoi ce fichier existe
//
// Les intercepteurs de reponse (client.native.js:88, client.web.js:86) rejettent
// la charge DEBALLEE `error.response.data.error`, jamais l'erreur axios. Une
// erreur applicative Strapi arrive donc au capteur Sentry sous la forme
// `{ status, name, message, details }` — SANS `isAxiosError` et SANS `response`.
//
// Preuve de production (Sentry REACT-NATIVE-2, evenement
// 2942ddd2f8c94fcc899e0a8560cf2925 du 2026-09-05) — titre de l'incident :
//   « Object captured as exception with keys: details, message, name, status »
//   __serialized__ = {
//     details: { code: 'EVENT_FIND_ERROR',
//                error: 'This sport is not supported for match statistics' },
//     message: 'This sport is not supported for match statistics',
//     name: 'BadRequestError', status: 400 }
//
// La liste blanche ne lisait que `error.response.data.code` et
// `error.response.status` : DEUX chemins qui n'existent pas sur cette forme.
// ---------------------------------------------------------------------------

// Forme reelle vue par le capteur : charge Strapi deballee par l'intercepteur.
const unwrappedStrapiError = (status, overrides = {}) => ({
  details: {},
  message: 'Erreur',
  name: 'BadRequestError',
  status,
  ...overrides,
});

// Forme axios brute, conservee pour les chemins qui ne passent pas par l'intercepteur.
const axiosError = (status, data = {}) => ({
  isAxiosError: true,
  response: { data, status },
});

const query = (...queryKey) => ({ queryKey });

// Le refus exact observe en production sur EventDetails (REACT-NATIVE-2).
const refusAvecCode = () => unwrappedStrapiError(400, {
  details: { code: 'EVENT_FIND_ERROR', error: 'This sport is not supported for match statistics' },
  message: 'This sport is not supported for match statistics',
});

// Le MEME refus metier sur /teams/:id/performance-stats : team.ts:1472 n'a aucun
// try/catch, donc la ValidationError remonte au gestionnaire par defaut de
// Strapi, qui ne pose AUCUN code. Mesure du 2026-09-05, journaux de production.
const refusSansCode = () => unwrappedStrapiError(400, {
  details: {},
  message: 'This sport is not supported for match statistics',
  name: 'ValidationError',
});

describe('T3 — 401 reste filtre (comportement existant, non regresse)', () => {
  test('sous la forme deballee de l intercepteur', () => {
    expect(isInSentryExceptionsAllowList(unwrappedStrapiError(401))).toBe(true);
  });

  test('sous la forme axios brute', () => {
    expect(isInSentryExceptionsAllowList(axiosError(401))).toBe(true);
  });
});

describe('T1 — le refus metier « ce sport n a pas de statistiques » ne part plus', () => {
  test('avec son code, depuis la requete des statistiques de match', () => {
    expect(
      isInSentryExceptionsAllowList(refusAvecCode(), query('eventMatchStats', 'evt-1', 'team-1')),
    ).toBe(true);
  });

  test('SANS code, depuis la requete des statistiques d equipe', () => {
    expect(
      isInSentryExceptionsAllowList(refusSansCode(), query('teamPerformanceStats', 'team-1')),
    ).toBe(true);
  });

  test('idem pour les deux requetes LEAGUE, meme service, meme refus', () => {
    expect(
      isInSentryExceptionsAllowList(refusAvecCode(), query('leagueMatchStats', 'm-1', 'team-1')),
    ).toBe(true);
    expect(
      isInSentryExceptionsAllowList(refusSansCode(), query('leagueTeamPerformanceStats', 'team-1')),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T2 — LE GARDE-FOU QUI COMPTE LE PLUS.
// `EVENT_FIND_ERROR` n'est PAS un refus metier : c'est le code FOURRE-TOUT du
// controleur d'evenements. Il sort aussi du `catch` general de `getMyPlanning`
// (admin/src/api/event/controllers/event.ts:2137) et de celui de
// `getTournamentDashboard` (event.ts:3043). Le filtrer PAR CODE rendrait
// invisible un vrai plantage du planning — exactement ce que ce lot doit eviter.
// ---------------------------------------------------------------------------
describe('T2 — ce qui doit TOUJOURS partir a Sentry', () => {
  test('le MEME code EVENT_FIND_ERROR venant d une AUTRE requete (planning) part', () => {
    expect(
      isInSentryExceptionsAllowList(refusAvecCode(), query('planning', 'me')),
    ).toBe(false);
  });

  test('un 400 sans code connu part', () => {
    expect(isInSentryExceptionsAllowList(unwrappedStrapiError(400))).toBe(false);
    expect(isInSentryExceptionsAllowList(axiosError(400))).toBe(false);
  });

  test('un 500 part, MEME sur une requete a refus metier declare', () => {
    expect(
      isInSentryExceptionsAllowList(unwrappedStrapiError(500), query('eventMatchStats', 'evt-1')),
    ).toBe(false);
    const refus503 = unwrappedStrapiError(503);
    expect(isInSentryExceptionsAllowList(refus503, query('teamPerformanceStats', 'team-1')))
      .toBe(false);
  });

  test('un 403 part (le lot SENTRY1 le CORRIGE, il ne le cache pas)', () => {
    expect(isInSentryExceptionsAllowList(unwrappedStrapiError(403))).toBe(false);
  });

  test('une panne reseau franche part', () => {
    expect(isInSentryExceptionsAllowList({ message: 'Network Error' })).toBe(false);
    expect(isInSentryExceptionsAllowList(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Lot VA1 — un 403 sur une LECTURE est un etat attendu, pas un defaut.
//
// Preuve de production (Sentry REACT-NATIVE-2 et -1, 14/09) : 167 evenements
// « captureQueryError » pour 14 utilisateurs, TOUS
//   __serialized__ = { details: {}, message: 'Forbidden', name: 'ForbiddenError', status: 403 }
// dont la build publique 2.6.43+1301, ecran TeamDetails :
//   GET /api/teams/:id/performance-stats -> 403.
// L'utilisateur, lui, ne voyait rien. L'ecran doit le dire ; Sentry n'a rien a
// en apprendre.
// ---------------------------------------------------------------------------
describe('VA1 — un refus 403 sur une requete de lecture ne part plus', () => {
  const refusDeRole = () => unwrappedStrapiError(403, {
    details: {},
    message: 'Forbidden',
    name: 'ForbiddenError',
  });

  test('LE CAS DE PRODUCTION : TeamDetails, statistiques de performance', () => {
    expect(
      isInSentryExceptionsAllowList(refusDeRole(), query('teamPerformanceStats', 'team-1')),
    ).toBe(true);
  });

  test('quelle que soit la famille de requete (fiche equipe, club, club omnisport)', () => {
    expect(isInSentryExceptionsAllowList(refusDeRole(), query('team', 'team-1'))).toBe(true);
    expect(isInSentryExceptionsAllowList(refusDeRole(), query('club', 'club-1'))).toBe(true);
    expect(isInSentryExceptionsAllowList(axiosError(403), query('multisport-clubs'))).toBe(true);
  });

  test('un refus de politique avec son code (non-membre) ne part pas non plus', () => {
    const refusPolitique = unwrappedStrapiError(403, {
      details: { code: 'TEAM_MEMBER_POLICY_ERROR' },
      message: 'User is not a member of organizer or invited teams',
      name: 'PolicyError',
    });
    expect(isInSentryExceptionsAllowList(refusPolitique, query('teamStats', 'team-1'))).toBe(true);
  });

  test('GARDE-FOU : un 403 qui DEGUISE une panne serveur part toujours', () => {
    // admin/src/api/team/policies/is-team-member.ts : le `catch` general
    // ressort une panne de lecture en PolicyError (403) avec ce code-la.
    const panneDeguisee = unwrappedStrapiError(403, {
      details: { code: 'INTERNAL_SERVER_ERROR', message: 'connection terminated' },
      message: 'Error in is-team-member policy',
      name: 'PolicyError',
    });
    expect(isInSentryExceptionsAllowList(panneDeguisee, query('teamStats', 'team-1')))
      .toBe(false);
  });

  test('GARDE-FOU : un 403 hors requete de lecture (aucune query) part toujours', () => {
    expect(isInSentryExceptionsAllowList(refusDeRole())).toBe(false);
    const pasUneQuery = { queryKey: 'pas-un-tableau' };
    expect(isInSentryExceptionsAllowList(refusDeRole(), pasUneQuery)).toBe(false);
  });

  test('GARDE-FOU : un 500 et un 404 sur la meme requete partent toujours', () => {
    const equipe = query('team', 'team-1');
    expect(isInSentryExceptionsAllowList(unwrappedStrapiError(500), equipe)).toBe(false);
    expect(isInSentryExceptionsAllowList(unwrappedStrapiError(404), equipe)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Les DEUX seuls codes filtres par code seul : les refus que l'app se prononce
// A ELLE-MEME, sans reseau (bootRequestGuard.js). Par construction ils ne
// peuvent jamais signaler un defaut serveur.
// ---------------------------------------------------------------------------
describe('les refus locaux de l app ne sont pas des defauts', () => {
  test('BOOT_REQUEST_NO_SESSION est filtre', () => {
    expect(isInSentryExceptionsAllowList({
      code: BOOT_REQUEST_NO_SESSION_CODE,
      message: 'Appel ignore',
      name: 'BootRequestNoSessionError',
      status: 0,
    })).toBe(true);
  });

  test('BOOT_REQUEST_BLOCKED est filtre', () => {
    expect(isInSentryExceptionsAllowList({
      code: BOOT_REQUEST_BLOCKED_CODE,
      status: 0,
    })).toBe(true);
  });
});
