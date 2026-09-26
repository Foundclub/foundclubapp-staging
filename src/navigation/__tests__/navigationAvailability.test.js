import {
  hasRouteInNavigationTree,
  navigateToStackScreenOrScreen,
} from '@/navigation/navigationAvailability';

/**
 * NAVMORTE (2026-09-11) -- caracterisation d une aide EXISTANTE, jamais testee et
 * jamais appelee jusqu ici, sur laquelle reposent desormais les boutons des ecrans
 * montes a la RACINE (installations, LEAGUE).
 *
 * Un ecran de la racine qui vise un ecran vivant dans une pile (ClubStack,
 * TeamStack, onglet LEAGUE) doit nommer la pile : `navigate` remonte vers les
 * parents, il ne descend jamais chez un voisin -- sinon le bouton ne fait RIEN.
 * Et le meme ecran monte DANS la pile doit continuer a marcher : c est ce que
 * garantit le passage par la pile quand elle est a portee.
 */

/**
 * Un navigateur reduit a ce que lit l aide.
 * @param {string[]} routeNames les routes qu il porte
 * @param {object} [parent] son navigateur parent
 * @returns {{ getParent: Function, getState: Function, navigate: jest.Mock }} le double
 */
const navigateur = (routeNames, parent = undefined) => ({
  getParent: () => parent,
  getState: () => ({ routeNames }),
  navigate: jest.fn(),
});

/** La cible du bouton « Voir le planning » des installations. */
const VERS_LE_PLANNING = { params: { clubId: 'c1' }, screen: 'Club', stack: 'ClubStack' };

describe('hasRouteInNavigationTree', () => {
  it('trouve une route chez un ancetre', () => {
    const racine = navigateur(['HomeTab', 'ClubStack']);
    const pile = navigateur(['FacilityList'], racine);

    expect(hasRouteInNavigationTree(pile, 'ClubStack')).toBe(true);
  });

  it('rend faux quand aucun ancetre ne porte la route', () => {
    expect(hasRouteInNavigationTree(navigateur(['HomeTab']), 'ClubStack')).toBe(false);
  });

  it('tient debout sans getState ni getParent (double de test minimal)', () => {
    expect(hasRouteInNavigationTree({ navigate: jest.fn() }, 'ClubStack')).toBe(false);
  });
});

describe('navigateToStackScreenOrScreen', () => {
  it('depuis la racine, passe PAR LA PILE : c est ce qui rend le bouton vivant', () => {
    const racine = navigateur(['HomeTab', 'ClubStack', 'FacilityList']);

    navigateToStackScreenOrScreen(racine, VERS_LE_PLANNING);

    expect(racine.navigate).toHaveBeenCalledWith('ClubStack', {
      params: { clubId: 'c1' },
      screen: 'Club',
    });
  });

  it('depuis l interieur de la pile, passe aussi par elle -- elle est a portee', () => {
    const racine = navigateur(['HomeTab', 'ClubStack']);
    const pile = navigateur(['Club', 'FacilityList'], racine);

    navigateToStackScreenOrScreen(pile, VERS_LE_PLANNING);

    expect(pile.navigate).toHaveBeenCalledWith('ClubStack', {
      params: { clubId: 'c1' },
      screen: 'Club',
    });
  });

  it('sans la pile a portee, retombe sur l appel direct', () => {
    const pile = navigateur(['Club', 'FacilityList']);

    navigateToStackScreenOrScreen(pile, VERS_LE_PLANNING);

    expect(pile.navigate).toHaveBeenCalledWith('Club', { clubId: 'c1' });
  });

  it('porte une imbrication a DEUX niveaux (onglet LEAGUE, sa pile, l ecran)', () => {
    const racine = navigateur(['HomeTab', 'LeagueHomeTab']);

    navigateToStackScreenOrScreen(racine, {
      params: { params: { matchId: 'm1' }, screen: 'MatchStatsEditor' },
      screen: 'LeagueDashboard',
      stack: 'LeagueHomeTab',
    });

    expect(racine.navigate).toHaveBeenCalledWith('LeagueHomeTab', {
      params: { params: { matchId: 'm1' }, screen: 'MatchStatsEditor' },
      screen: 'LeagueDashboard',
    });
  });
});

// RECHERCHE-UNIQUE (25/09) — SUR LE SITE, L'ADAPTATEUR SE DONNE LUI-MÊME POUR PARENT.
// `createWebNavigationAdapter` rend `getParent: () => parentNavigation || adapter` : sans
// parent, il se rend LUI-MÊME. La remontée de `hasRouteInNavigationTree` ne trouvait donc
// jamais de fin : un appui sur une carte de club (ClubListContent) figeait l'onglet du
// navigateur (banc du 25/09 : clic bloqué sur « performing click action », page morte).
describe('sur le site : l adaptateur web est son propre parent', () => {
  const { createWebNavigationAdapter } = jest.requireActual('@/navigation/webNavigationAdapter');

  const adaptateurCompte = () => {
    const push = jest.fn();
    const adaptateur = createWebNavigationAdapter({ currentRouteName: 'SearchHub', push, replace: jest.fn() });
    const getParentReel = adaptateur.getParent;
    let appels = 0;
    // Garde-fou du TÉMOIN (pas du code) : sans lui, un rouge ne s'afficherait jamais —
    // la boucle synchrone bloquerait jest pour toujours.
    adaptateur.getParent = () => {
      appels += 1;
      if (appels > 1000) throw new Error('BOUCLE SANS FIN : getParent appelé plus de 1000 fois');
      return getParentReel();
    };
    return { adaptateur, push };
  };

  it('✅ hasRouteInNavigationTree s arrête et répond faux', () => {
    const { adaptateur } = adaptateurCompte();

    expect(hasRouteInNavigationTree(adaptateur, 'ClubStack')).toBe(false);
  });

  it('✅ une carte de club mène à l écran Club (/clubs/c1), sans figer la page', () => {
    const { adaptateur, push } = adaptateurCompte();

    navigateToStackScreenOrScreen(adaptateur, VERS_LE_PLANNING);

    // buildWebPath recopie aussi le paramètre en requête (/clubs/c1?clubId=c1) : comportement existant.
    expect(push.mock.calls[0][0].split('?')[0]).toBe('/clubs/c1');
  });
});
