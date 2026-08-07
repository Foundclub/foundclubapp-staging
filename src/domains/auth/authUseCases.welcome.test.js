import {
  getOnboardingViews,
  resolveOnboardingExitRoute,
  USER_ROLES,
} from '@/domains/auth/authUseCases';
import { storage } from '@/store/appContext';

import { RouteNames } from '@/navigation/routeNames';

// D23 — defaut ⑤ de la recette du 2026-08-07 : « l'ecran de bienvenue se saute
// tout seul ».
//
// Decision d'Adel du 2026-08-06, mot pour mot : « Bienvenue sort du COMPTEUR
// mais n'est PAS supprime. » Il doit ARRIVER A LA FIN, SANS NUMERO D'ETAPE,
// lancer le tour guide et montrer les offres.
//
// Ce fichier mesure les deux moities du temoin demande par la recette :
//   1. `Welcome` est bien ATTEINT en sortie de tunnel (les 3 parcours pilotes) ;
//   2. il ne porte AUCUN numero d'etape — la meme expression que celle de
//      `PrivateNavigator.getStepNumber` est evaluee ici.
//
// La decision vivait a l'interieur de `useAuth`, donc hors de portee d'un
// test : elle est extraite dans `resolveOnboardingExitRoute`, sans changer
// ni son ordre ni ses sorties.

jest.mock('../../store/appContext', () => ({
  storage: {
    getBoolean: jest.fn(),
    getString: jest.fn(),
    set: jest.fn(),
  },
}));

// Profil complet : il ne reste que la ou les dernieres etapes d'affiliation.
const profilComplet = (role) => ({
  address: 'Marseille',
  avatar: 'avatar.png',
  bestLevel: 'Departemental',
  birthdate: '2000-01-01',
  category: 'Senior',
  documentId: 'user-d23',
  firstname: 'Ada',
  height: 180,
  lastname: 'Test',
  position: 'Pilier',
  preferredSport: 'Rugby',
  role: { name: role },
  section: 'Masculine',
  sportsHistory: [{ club: 'AS Test' }],
  weight: 75,
});

// L'expression EXACTE de `PrivateNavigator.getStepNumber`.
const numeroDEtape = (views, route) => views?.find((view) => view.route === route)?.index || 0;

beforeEach(() => {
  jest.clearAllMocks();
  storage.getBoolean.mockReturnValue(false);
  storage.getString.mockReturnValue(null);
});

describe('Sortie de tunnel — Welcome est ATTEINT (D23 ⑤)', () => {
  it.each([USER_ROLES.player, USER_ROLES.coach, USER_ROLES.president])(
    '%s : la sortie de tunnel mene a Welcome',
    (role) => {
      const { views } = getOnboardingViews(profilComplet(role));

      expect(resolveOnboardingExitRoute({
        hasSeenWelcome: false,
        userDocumentId: 'user-d23',
        views,
      })).toBe(RouteNames.Welcome);
    },
  );

  it.each([USER_ROLES.superAdmin, USER_ROLES.new])(
    '%s : pas de sas, Welcome est deja une etape numerotee de leur parcours',
    (role) => {
      const { views } = getOnboardingViews(profilComplet(role));

      expect(resolveOnboardingExitRoute({
        hasSeenWelcome: false,
        userDocumentId: 'user-d23',
        views,
      })).toBeUndefined();
    },
  );

  it('une fois vu, Welcome ne se represente plus', () => {
    const { views } = getOnboardingViews(profilComplet(USER_ROLES.player));

    expect(resolveOnboardingExitRoute({
      hasSeenWelcome: true,
      userDocumentId: 'user-d23',
      views,
    })).toBeUndefined();
  });

  it('tunnel deja termine (aucune etape) : on ne repousse personne vers Welcome', () => {
    expect(resolveOnboardingExitRoute({
      hasSeenWelcome: false,
      userDocumentId: 'user-d23',
      views: [],
    })).toBeUndefined();
  });

  it('sans utilisateur identifie, pas de sas', () => {
    const { views } = getOnboardingViews(profilComplet(USER_ROLES.player));

    expect(resolveOnboardingExitRoute({
      hasSeenWelcome: false,
      userDocumentId: undefined,
      views,
    })).toBeUndefined();
  });
});

describe('Welcome ne porte AUCUN numero d`etape (D23 ⑤)', () => {
  it.each([USER_ROLES.player, USER_ROLES.coach, USER_ROLES.president])(
    '%s : Welcome n`est dans aucune etape comptee, son numero vaut donc 0',
    (role) => {
      const { views } = getOnboardingViews(profilComplet(role));

      expect(views.map((view) => view.route)).not.toContain(RouteNames.Welcome);
      // `PrivateNavigator.renderStepperIndicator` rend `null` quand ce
      // numero vaut 0 : c'est la, et seulement la, que l'entete reste vide.
      expect(numeroDEtape(views, RouteNames.Welcome)).toBe(0);
    },
  );

  it('les totaux du parcours restent 13 / 5 / 4 / 3 / 13', () => {
    const totaux = [
      USER_ROLES.player,
      USER_ROLES.coach,
      USER_ROLES.president,
      USER_ROLES.superAdmin,
      USER_ROLES.new,
    ].map((role) => getOnboardingViews({ documentId: 'x', role: { name: role } }).totalViews);

    expect(totaux).toEqual([13, 5, 4, 3, 13]);
  });
});
