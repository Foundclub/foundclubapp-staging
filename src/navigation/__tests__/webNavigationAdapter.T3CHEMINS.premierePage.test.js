import { RouteNames } from '../routeNames';
import { createWebNavigationAdapter } from '../webNavigationAdapter';

// T3-CHEMINS (03/11) — LE RETOUR D'UNE PREMIÈRE PAGE. Rouge avant : ouverte par son adresse, une
// page de saisie revenait toujours à l'accueil (`/`), pas à l'écran dont elle dépend. Seul un écran
// dont l'adresse donne le parent sans ambiguïté a son repli ; les autres gardent `/`.

const fabriquer = (/** @type {string} */ routeName, params = {}) => {
  const goBack = jest.fn();
  const replace = jest.fn();
  const adapter = createWebNavigationAdapter({
    currentPath: '/ici',
    currentRouteName: routeName,
    goBack,
    params,
    push: jest.fn(),
    replace,
    setSearchParams: jest.fn(),
  });
  return { adapter, goBack, replace };
};

const historiqueAvant = Object.getOwnPropertyDescriptor(window, 'history');
const historique = (/** @type {any} */ state) => {
  Object.defineProperty(window, 'history', {
    configurable: true,
    value: { length: 2, state },
  });
};

afterEach(() => {
  if (historiqueAvant) Object.defineProperty(window, 'history', historiqueAvant);
});

test.each([
  [RouteNames.ProfileEdit, {}, '/profile'],
  [RouteNames.ChildEdit, {}, '/profile/children'],
  [RouteNames.ClubEdit, { clubId: 'c1' }, '/clubs/c1'],
  [RouteNames.AddCoach, { clubId: 'c1' }, '/clubs/c1'],
  [RouteNames.AddClubManager, { clubId: 'c1' }, '/clubs/c1'],
  [RouteNames.TeamEdit, { teamId: 't1' }, '/teams/t1'],
  [RouteNames.EventEdit, { eventId: 'e1' }, '/events/e1'],
  [RouteNames.TournamentSettingsEdit, { eventId: 'e1' }, '/events/e1'],
  [RouteNames.CollectiviteInstallationForm, { collectiviteId: 'v1' }, '/collectivite/v1/installations'],
  [RouteNames.CollectiviteFermeture, { collectiviteId: 'v1' }, '/collectivite/v1'],
])('première page de %s : retour à son parent', (routeName, params, attendu) => {
  historique({ idx: 0 });
  const { adapter, goBack, replace } = fabriquer(routeName, params);
  adapter.goBack();
  expect(replace.mock.calls[0][0]).toBe(attendu);
  expect(goBack).not.toHaveBeenCalled();
});

test('sans l identifiant du parent dans l adresse : l accueil, jamais une adresse cassée', () => {
  historique({ idx: 0 });
  const { adapter, replace } = fabriquer(RouteNames.ClubEdit, {});
  adapter.goBack();
  expect(replace).toHaveBeenCalledWith('/');
});

test('un écran sans parent connu : l accueil, comme avant', () => {
  historique({ idx: 0 });
  const { adapter, replace } = fabriquer(RouteNames.EventWizardType, {});
  adapter.goBack();
  expect(replace).toHaveBeenCalledWith('/');
});

test('hors première page : le vrai retour du navigateur', () => {
  historique({ idx: 3 });
  const { adapter, goBack, replace } = fabriquer(RouteNames.ClubEdit, { clubId: 'c1' });
  adapter.goBack();
  expect(goBack).toHaveBeenCalled();
  expect(replace).not.toHaveBeenCalled();
});
