import { RouteNames } from '../routeNames';
import { createWebNavigationAdapter } from '../webNavigationAdapter';

// ==========================================================================
// RECETTE-WEB-DIRIGEANT (29/10) — UNE PAGE OUVERTE DIRECTEMENT NE FAIT PLUS
// SORTIR DU SITE AU « RETOUR ».
//
// Constaté sur le site local branché sur la recette (Karim B) : « Modifier le
// club » ou « Assigner un entraîneur » ouverts par un lien, un rechargement ou un
// nouvel onglet ; après « Enregistrer » (200), l'écran fait `goBack()` et le
// navigateur quittait le site (page blanche, ou le site d'où l'on venait).
// `navigate(-1)` remonte l'historique du NAVIGATEUR, pas celui du site.
//
// React Router numérote ses entrées (`history.state.idx`) : 0 = la première
// page du site dans cet onglet. Là, on rentre à l'accueil du site au lieu de
// sortir ; `canGoBack()` dit la même chose aux écrans qui le demandent.
// ==========================================================================

const fabriquer = () => {
  const goBack = jest.fn();
  const replace = jest.fn();
  const adapter = createWebNavigationAdapter({
    currentPath: '/clubs/c1/edit',
    currentRouteName: RouteNames.ClubEdit,
    goBack,
    params: {},
    push: jest.fn(),
    replace,
    setSearchParams: jest.fn(),
  });
  return { adapter, goBack, replace };
};

const historique = (/** @type {any} */ state, length = 2) => {
  Object.defineProperty(window, 'history', {
    configurable: true,
    value: { length, state },
  });
};

const historiqueAvant = Object.getOwnPropertyDescriptor(window, 'history');

afterEach(() => {
  if (historiqueAvant) Object.defineProperty(window, 'history', historiqueAvant);
  else delete (/** @type {any} */ (window)).history;
});

describe('RWDIRIG — retour depuis la première page du site dans l onglet', () => {
  test('🔴 première page (idx 0) : retour = accueil du site, jamais navigate(-1)', () => {
    historique({ idx: 0, key: 'k', usr: null });
    const { adapter, goBack, replace } = fabriquer();

    adapter.goBack();

    expect(goBack).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('/');
  });

  test('🔴 première page (idx 0) : canGoBack dit non, même si le navigateur a un passé', () => {
    historique({ idx: 0, key: 'k', usr: null }, 3);
    const { adapter } = fabriquer();

    expect(adapter.canGoBack()).toBe(false);
  });

  test('🔒 page atteinte dans le site (idx 2) : retour comme avant', () => {
    historique({ idx: 2, key: 'k', usr: null });
    const { adapter, goBack, replace } = fabriquer();

    adapter.goBack();

    expect(goBack).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
    expect(adapter.canGoBack()).toBe(true);
  });

  test('🔒 GO_BACK passe par la même règle', () => {
    historique({ idx: 0, key: 'k', usr: null });
    const { adapter, goBack, replace } = fabriquer();

    adapter.dispatch({ type: 'GO_BACK' });

    expect(goBack).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('/');
  });
});
