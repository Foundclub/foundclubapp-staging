/**
 * R06 — verrou sur la FORME de navigation vers l'onglet Rechercher.
 *
 * Le defaut corrige le 2026-08-01 : deux appelants ecrivaient
 *   navigate(RouteNames.Search, { screen: RouteNames.SearchClubs })
 * soit DEUX niveaux. Or `Search` est un ONGLET, monte dans `HomeTab`, donc un
 * cran plus bas que le navigateur racine. Depuis un ecran pousse sur la racine
 * (l'assistant d'equipe : TeamStack est monte dans PrivateNavigator, d'ou
 * l'absence de barre d'onglets a l'ecran), aucune route `Search` n'existe a ce
 * niveau : React Navigation n'echoue pas bruyamment, il ne fait RIEN. Le bouton
 * « Rechercher mon club » paraissait donc inerte, alors que le bouton voisin
 * « Je ne trouve pas mon club » fonctionnait — parce que SA cible, `ClubStack`,
 * est bien montee sur la racine.
 *
 * Ce test fige les TROIS niveaux. Il redevient rouge si quelqu'un « simplifie »
 * l'imbrication, ce qui reproduirait exactement le bouton mort.
 */
import { RouteNames } from '@/navigation/routeNames';

import { navigateToSearchHub } from '../searchRouteHelpers';

describe('navigateToSearchHub', () => {
  it('vise HomeTab > Search > SearchHub — les trois niveaux, pas deux', () => {
    const navigation = { navigate: jest.fn() };

    navigateToSearchHub(navigation, 'clubs');

    expect(navigation.navigate).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.HomeTab, {
      params: {
        params: { activeType: 'clubs' },
        screen: RouteNames.SearchHub,
      },
      screen: RouteNames.Search,
    });
  });

  it('ne vise JAMAIS RouteNames.Search au premier niveau (le defaut R06)', () => {
    const navigation = { navigate: jest.fn() };

    navigateToSearchHub(navigation, 'clubs');

    const [premierArgument] = navigation.navigate.mock.calls[0];
    expect(premierArgument).not.toBe(RouteNames.Search);
    expect(premierArgument).toBe(RouteNames.HomeTab);
  });

  it('retombe sur « events » quand le type est absent ou farfelu', () => {
    const navigation = { navigate: jest.fn() };

    navigateToSearchHub(navigation);
    expect(navigation.navigate.mock.calls[0][1].params.params.activeType).toBe('events');

    navigation.navigate.mockClear();
    navigateToSearchHub(navigation, 'nawak');
    expect(navigation.navigate.mock.calls[0][1].params.params.activeType).toBe('events');
  });

  it('transmet les parametres additionnels sans ecraser activeType', () => {
    const navigation = { navigate: jest.fn() };

    navigateToSearchHub(navigation, 'clubs', { activeType: 'events', query: 'smuc' });

    const { params } = navigation.navigate.mock.calls[0][1].params;
    expect(params.query).toBe('smuc');
    expect(params.activeType).toBe('clubs');
  });
});
