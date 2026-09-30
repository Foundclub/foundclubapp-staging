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
import { buildWebPath } from '@/navigation/webRoutes';

import { navigateToSearchHub } from '../searchRouteHelpers';

describe('navigateToSearchHub', () => {
  it('vise HomeTab > Search > SearchHub — les trois niveaux, pas deux', () => {
    const navigation = { navigate: jest.fn() };

    navigateToSearchHub(navigation, 'clubs');

    expect(navigation.navigate).toHaveBeenCalledTimes(1);
    // RETOUR-ONGLET-2 : la forme imbriquee est celle d'`allerDansLOnglet`, avec `pop` aux
    // deux niveaux qui empilent. Sans lui, depuis un ecran de la RACINE (l'assistant
    // d'equipe, la page de succes d'abonnement), React Navigation 7 EMPILAIT un second
    // HomeTab (preuve : navigation/__tests__/retourOnglet2.pileRacine.test.js, F2).
    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.HomeTab, {
      params: {
        params: { activeType: 'clubs' },
        pop: true,
        screen: RouteNames.SearchHub,
      },
      screen: RouteNames.Search,
    }, { pop: true });
  });

  it('🌐 le SITE ne voit pas `pop` : l adresse est la meme qu avant RETOUR-ONGLET-2', () => {
    // TeamWizardName et SubscriptionSuccess sont aussi des pages du site ; son
    // adaptateur ignore le troisieme argument de navigate, et l'adresse ne se
    // construit qu'a partir de screen/params : `pop` ne doit pas y fuir.
    const navigation = { navigate: jest.fn() };
    const autres = { query: 'smuc' };

    navigateToSearchHub(navigation, 'clubs', autres);
    const [route, parametres] = navigation.navigate.mock.calls[0];

    // Meme ordre de cles qu'avant (les autres parametres, puis le type) : l'adresse
    // les ecrit dans cet ordre.
    expect(buildWebPath(route, parametres)).toBe(buildWebPath(RouteNames.HomeTab, {
      params: { params: { ...autres, activeType: 'clubs' }, screen: RouteNames.SearchHub },
      screen: RouteNames.Search,
    }));
    expect(buildWebPath(route, parametres)).not.toContain('pop');
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
