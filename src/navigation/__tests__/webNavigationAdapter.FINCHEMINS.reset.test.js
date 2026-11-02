import { RouteNames } from '../routeNames';
import { createWebNavigationAdapter } from '../webNavigationAdapter';

// FIN-CHEMINS (02/11, 94) — LA PILE POSÉE PAR `reset` SUR LE SITE.
// Constaté sur la recette (Karim) : après une création, « Plus tard » sur l'affiche revenait à
// l'étape 7 de l'assistant. La création pose [fiche, affiche] ; le site ne gardait que l'affiche.

const fabriquer = () => {
  const appels = [];
  const adapter = createWebNavigationAdapter({
    currentPath: '/events/wizard/recap',
    currentRouteName: RouteNames.EventDetails,
    goBack: jest.fn(),
    params: {},
    push: (/** @type {string} */ chemin) => appels.push(['push', chemin]),
    replace: (/** @type {string} */ chemin) => appels.push(['replace', chemin]),
    setSearchParams: jest.fn(),
  });
  return { adapter, appels };
};

const PILE = {
  index: 1,
  routes: [
    { name: RouteNames.EventDetails, params: { eventId: 'e1', fromEventCreation: true } },
    { name: RouteNames.EventPublishedShowcase, params: { eventId: 'e1' } },
  ],
};

describe('FIN-CHEMINS — reset sur le site', () => {
  test('🔴 deux écrans : celui du dessous reprend l entrée, le visible s empile dessus', () => {
    const { adapter, appels } = fabriquer();
    adapter.reset(PILE);
    expect(appels.map(([geste]) => geste)).toEqual(['replace', 'push']);
    expect(appels[0][1]).toContain('e1');
    expect(appels[0][1]).toContain('fromEventCreation=true');
    expect(appels[1][1]).toContain('/published');
  });

  test('🔴 la même pile par dispatch (CommonActions.reset)', () => {
    const { adapter, appels } = fabriquer();
    adapter.dispatch({ payload: PILE, type: 'RESET' });
    expect(appels.map(([geste]) => geste)).toEqual(['replace', 'push']);
  });

  test('🔒 un seul écran : il remplace, rien ne s empile', () => {
    const { adapter, appels } = fabriquer();
    adapter.reset({ index: 0, routes: [{ name: RouteNames.MyEventList }] });
    expect(appels.map(([geste]) => geste)).toEqual(['replace']);
  });

  test('🔒 l écran visible est le premier de la pile : ce qui suit reste ignoré', () => {
    const { adapter, appels } = fabriquer();
    adapter.reset({ ...PILE, index: 0 });
    expect(appels.map(([geste]) => geste)).toEqual(['replace']);
    expect(appels[0][1]).not.toContain('/published');
  });

  test('🔒 sans écran valable : aucun geste', () => {
    const { adapter, appels } = fabriquer();
    adapter.reset({ index: 0, routes: [] });
    expect(appels).toEqual([]);
  });
});
