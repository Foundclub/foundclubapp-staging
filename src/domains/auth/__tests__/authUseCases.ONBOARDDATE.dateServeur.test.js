/* eslint-disable max-len -- des phrases entieres */
import { getOnboardingViews, USER_ROLES } from '@/domains/auth/authUseCases';
import { storage } from '@/store/appContext';

import { RouteNames } from '@/navigation/routeNames';

// ONBOARDDATE (29/10/2026, decision d'Adel « 3- A ») — tournee 2.6.84 : un entraineur qui avait
// fini son inscription change de telephone et retombe a l'etape 3/5 (photo, club, equipes, toutes
// facultatives). Le drapeau `hasCompletedOnboarding_<id>` ne vit que sur l'appareil.
// Regle : le SERVEUR garde la date de fin (`onboardingCompletedAt`) ; une date OU le drapeau local
// ferment le tunnel. Seul le controle d'age (date de naissance, declaration parentale) rouvre.

jest.mock('../../../store/appContext', () => ({
  storage: { getBoolean: jest.fn(), getString: jest.fn(), set: jest.fn() },
}));

// Un entraineur SANS club ni photo : sur un appareil neuf, sans drapeau, le tunnel le reprend.
const COACH_FINI_AILLEURS = {
  address: { city: 'Montrivage' },
  avatar: null,
  birthdate: '1990-05-12',
  club: null,
  documentId: 'coach-sans-club',
  firstname: 'Julien',
  lastname: 'Marchal',
  myTeams: [],
  onboardingCompletedAt: '2026-10-28T19:02:11.000Z',
  role: { name: USER_ROLES.coach },
  trainedTeams: [],
};

const etapes = (/** @type {any} */ resultat) => (resultat.views || [])
  .filter((/** @type {any} */ vue) => vue.canShow)
  .map((/** @type {any} */ vue) => vue.route);

beforeEach(() => {
  /** @type {any} */ (storage.getBoolean).mockReturnValue(false);
});

describe('ONBOARDDATE — la date du serveur ferme le tunnel, sur tout appareil', () => {
  it('🔴 coach fini ailleurs (date serveur, pas de drapeau ici) : aucune etape', () => {
    expect(etapes(getOnboardingViews(COACH_FINI_AILLEURS))).toEqual([]);
  });

  it('date serveur mais date de naissance manquante : le controle d age rouvre, et lui seul', () => {
    const resultat = getOnboardingViews({ ...COACH_FINI_AILLEURS, birthdate: null });

    expect(etapes(resultat)).toEqual([RouteNames.UserName]);
    expect(resultat.isEntryCheckpoint).toBe(true);
  });

  it('date serveur, moins de 15 ans sans declaration : la declaration parentale, et elle seule', () => {
    const resultat = getOnboardingViews({ ...COACH_FINI_AILLEURS, birthdate: '2012-03-01', parentalDeclarationAccepted: false });

    expect(etapes(resultat)).toEqual([RouteNames.UserParentalDeclaration]);
    expect(resultat.isEntryCheckpoint).toBe(true);
  });

  it('ni date serveur ni drapeau : le tunnel reprend, comme avant', () => {
    const resultat = getOnboardingViews({ ...COACH_FINI_AILLEURS, onboardingCompletedAt: null });

    expect(resultat.isEntryCheckpoint).toBeUndefined();
    expect(etapes(resultat)).toContain(RouteNames.UserAvatar);
  });

  it('le drapeau local seul suffit encore (version d avant le serveur)', () => {
    /** @type {any} */ (storage.getBoolean).mockReturnValue(true);

    expect(etapes(getOnboardingViews({ ...COACH_FINI_AILLEURS, onboardingCompletedAt: null }))).toEqual([]);
  });
});
