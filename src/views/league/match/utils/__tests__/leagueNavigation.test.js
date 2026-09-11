import { navigateToLeagueStackScreen } from '@/views/league/match/utils/leagueNavigation';

/**
 * NAVMORTE (2026-09-11) -- ouvrir un ecran de la pile LEAGUE d ou qu on soit.
 *
 * Les ecrans LeagueMatchDetails et SquadDetails sont montes DEUX fois : dans la
 * pile LEAGUE (onglet LEAGUE) et sur la pile RACINE. Depuis la racine, un appel
 * direct vers MatchStatsEditor, PlayerMatchResponse ou MatchHistoryScreen n etait
 * traite par aucun navigateur : le bouton ne faisait RIEN.
 *
 * Ce que ce filet garantit :
 *   1. dans la pile LEAGUE, l appel reste DIRECT -- rien ne change la ou ca marchait ;
 *   2. ailleurs, on passe par le tableau de bord, puis par l onglet LEAGUE ;
 *   3. si personne ne porte la route, on le dit (faux) au lieu de se taire.
 */

/**
 * Un navigateur reduit a ce que lit l utilitaire.
 * @param {string[]} routeNames les routes qu il porte
 * @param {object} [parent] son navigateur parent
 * @returns {{ getParent: Function, getState: Function, navigate: jest.Mock }} le double
 */
const navigateur = (routeNames, parent = undefined) => ({
  getParent: () => parent,
  getState: () => ({ routeNames }),
  navigate: jest.fn(),
});

describe('navigateToLeagueStackScreen', () => {
  it('dans la pile LEAGUE, appelle l ecran EN DIRECT (comportement inchange)', () => {
    const racine = navigateur(['HomeTab', 'LeagueHomeTab']);
    const pileLeague = navigateur(
      ['LeagueHome', 'LeagueMatchDetails', 'MatchStatsEditor'],
      racine,
    );

    const pris = navigateToLeagueStackScreen(pileLeague, 'MatchStatsEditor', { matchId: 'm1' });

    expect(pris).toBe(true);
    expect(pileLeague.navigate).toHaveBeenCalledWith('MatchStatsEditor', { matchId: 'm1' });
    expect(racine.navigate).not.toHaveBeenCalled();
  });

  it('dans les onglets LEAGUE, passe par le tableau de bord', () => {
    const onglets = navigateur(['LeagueDashboard', 'LeagueMatchTab']);

    expect(navigateToLeagueStackScreen(onglets, 'MatchHistoryScreen')).toBe(true);

    expect(onglets.navigate).toHaveBeenCalledWith('LeagueDashboard', {
      params: undefined,
      screen: 'MatchHistoryScreen',
    });
  });

  it('depuis la RACINE, passe par l onglet LEAGUE puis le tableau de bord', () => {
    // C est le cas qui ne faisait RIEN : le bouton reprend vie.
    const racine = navigateur(['HomeTab', 'LeagueHomeTab', 'LeagueMatchDetails']);

    const pris = navigateToLeagueStackScreen(racine, 'PlayerMatchResponse', { matchId: 'm1' });

    expect(pris).toBe(true);
    expect(racine.navigate).toHaveBeenCalledWith('LeagueHomeTab', {
      params: { params: { matchId: 'm1' }, screen: 'PlayerMatchResponse' },
      screen: 'LeagueDashboard',
    });
  });

  it('rend faux, sans rien appeler, quand aucun navigateur ne porte la route', () => {
    const isole = navigateur(['HomeTab']);

    expect(navigateToLeagueStackScreen(isole, 'MatchStatsEditor')).toBe(false);
    expect(isole.navigate).not.toHaveBeenCalled();
  });

  it('tient debout sans navigation ni route', () => {
    expect(navigateToLeagueStackScreen(undefined, 'MatchStatsEditor')).toBe(false);
    expect(navigateToLeagueStackScreen(navigateur(['LeagueHomeTab']), '')).toBe(false);
  });
});
