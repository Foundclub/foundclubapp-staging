import { RouteNames } from '../routeNames';
import { buildWebPath } from '../webRoutes';

// FINITIONS16 · POINT 15 (tournee T15, photos SITE_S06 et SITE_S10) — sur le site, la feuille de
// match et « Matchs en attente » d'un match de CLUB basculaient sur la barre de la League
// (« League · Squad · Matchs ») et l'adresse gardait « :matchId » en clair
// (`/league/matches/:matchId/pending-stats`). Les trois ecrans de stats de match avaient des
// adresses de la League : le site choisit sa barre a l'adresse (`/league…`), et un match de club
// passe un `eventId`, jamais le `matchId` que l'adresse attendait. Des adresses NEUTRES, sans
// parametre a remplir : l'evenement ou le match de League voyagent en parametres. ROUGE avant.

const ECRANS = [
  RouteNames.MatchStatsEditor,
  RouteNames.PendingMatchStats,
  RouteNames.PlayerMatchResponse,
];

describe('FINITIONS16 15 — les stats de match ont une adresse a elles, hors de la League', () => {
  test('🔴 aucune des trois adresses n est sous « /league »', () => {
    ECRANS.forEach((ecran) => {
      expect([ecran, buildWebPath(ecran).startsWith('/league')]).toEqual([ecran, false]);
    });
  });

  test('🔴 un match de club (eventId) : pas de « :matchId » en clair, l evenement voyage', () => {
    ECRANS.forEach((ecran) => {
      const adresse = buildWebPath(ecran, {
        eventId: 'e460', sourceType: 'event', teamId: 'senior',
      });
      expect([ecran, adresse.includes(':')]).toEqual([ecran, false]);
      expect(adresse).toContain('eventId=e460');
    });
  });

  test('🔒 un match de League (matchId) garde son match dans l adresse', () => {
    const adresse = buildWebPath(RouteNames.MatchStatsEditor, {
      matchId: 'm1', sourceType: 'league',
    });
    expect(adresse).toContain('matchId=m1');
    expect(adresse).not.toContain(':');
  });
});
