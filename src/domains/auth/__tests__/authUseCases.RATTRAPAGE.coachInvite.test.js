/* eslint-disable max-len -- des phrases entieres */
import { getOnboardingViews, USER_ROLES } from '@/domains/auth/authUseCases';
import { storage } from '@/store/appContext';

import { RouteNames } from '@/navigation/routeNames';

// RATTRAPAGE (10/11/2026, Adel « 172 C ») — un coach CREE PAR SON DIRIGEANT (« Ajouter un coach »,
// date de naissance facultative) arrive sans date. A sa prochaine ouverture, l'app lui demande sa
// date avant tout le reste (le point de controle d'entree, registre des mineurs ligne 10), et
// seulement elle. Sous 15 ans, la declaration parentale suit ; sous 13 ans, le serveur refuse
// (meme chemin qu'a l'inscription).

jest.mock('../../../store/appContext', () => ({
  storage: { getBoolean: jest.fn(), getString: jest.fn(), set: jest.fn() },
}));

const COACH_INVITE = {
  address: null,
  avatar: null,
  birthdate: null,
  club: { documentId: 'club-1' },
  documentId: 'coach-invite',
  firstname: 'Karim',
  lastname: 'Benali',
  myTeams: [],
  onboardingCompletedAt: null,
  role: { name: USER_ROLES.coach },
  trainedTeams: [{ documentId: 'u13' }],
};

const etapes = (/** @type {any} */ resultat) => (resultat.views || [])
  .filter((/** @type {any} */ vue) => vue.canShow)
  .map((/** @type {any} */ vue) => vue.route);

beforeEach(() => {
  /** @type {any} */ (storage.getBoolean).mockReturnValue(false);
});

describe('RATTRAPAGE 172 C — le coach invite donne sa date a sa prochaine ouverture', () => {
  it('premiere ouverture : « Qui es-tu ? » (la date) d abord ; ville et photo ensuite, facultatives', () => {
    // « Qui es-tu ? » n'a pas de « Passer » (TUNNELREPRISE) : la date ne s'evite pas.
    expect(etapes(getOnboardingViews(COACH_INVITE))).toEqual([
      RouteNames.UserName, RouteNames.UserAddress, RouteNames.UserAvatar,
    ]);
  });

  it('inscription deja finie ailleurs (date serveur) : la date, et elle seule', () => {
    const resultat = getOnboardingViews({ ...COACH_INVITE, onboardingCompletedAt: '2026-11-07T10:00:00.000Z' });

    expect(etapes(resultat)).toEqual([RouteNames.UserName]);
    expect(resultat.isEntryCheckpoint).toBe(true);
  });

  it('une date qui le dit mineur de moins de 15 ans : la declaration parentale suit, comme a l inscription', () => {
    const resultat = getOnboardingViews({ ...COACH_INVITE, birthdate: '2012-03-01', onboardingCompletedAt: '2026-11-07T10:00:00.000Z', parentalDeclarationAccepted: false });

    expect(etapes(resultat)).toEqual([RouteNames.UserParentalDeclaration]);
  });

  it('une date d adulte : plus rien ne lui est demande', () => {
    expect(etapes(getOnboardingViews({ ...COACH_INVITE, birthdate: '1990-05-12', onboardingCompletedAt: '2026-11-07T10:00:00.000Z' }))).toEqual([]);
  });
});
