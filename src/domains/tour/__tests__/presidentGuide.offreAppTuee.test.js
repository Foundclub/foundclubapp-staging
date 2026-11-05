import * as authUseCases from '@/domains/auth/authUseCases';
import { PRESIDENT_GUIDE } from '@/domains/tour/presidentGuide';
import { storage } from '@/store/appContext';

// L10 (05/11) : dirigeant, app tuée sur l'écran d'offre après « Club créé ». « Bienvenue » ne
// revient pas : à la relance, seule la carte de l'accueil peut proposer le guide, et elle lit
// `offerSince`. Sans date, elle ne s'affiche pas : c'est la décision 3, à poser le jour du départ.

jest.mock('@/store/appContext', () => ({
  storage: { getBoolean: jest.fn(), getString: jest.fn(), set: jest.fn() },
}));

const mockSettings = { offerSince: null };
jest.mock('@/domains/tour/presidentGuideSettings', () => {
  const { PRESIDENT_GUIDE_SETTINGS } = jest.requireActual('@/domains/tour/presidentGuideSettings');
  const settings = new Proxy({ ...PRESIDENT_GUIDE_SETTINGS }, {
    get: (target, key) => (key === 'offerSince' ? mockSettings.offerSince : target[key]),
  });
  return { __esModule: true, default: settings, PRESIDENT_GUIDE_SETTINGS: settings };
});

const INSCRIPTION = '2026-11-05T10:10:00.000Z';

describe('dirigeant parti sur l’écran d’offre', () => {
  beforeEach(() => { mockSettings.offerSince = null; });

  it('à la relance : plus d’étape, inscription finie, donc plus de « Bienvenue »', () => {
    /** @type {any} */ (storage.getBoolean).mockImplementation(
      (/** @type {string} */ key) => String(key).startsWith('onboardingStarted_'),
    );
    authUseCases.resetOnboardingSessionForTests?.();
    const views = authUseCases.getOnboardingViews(/** @type {any} */ ({
      birthdate: '1990-03-15',
      club: { documentId: 'club-neuf' },
      documentId: 'dirigeant-neuf',
      firstname: 'Dir',
      lastname: 'Neuf',
      role: { name: authUseCases.USER_ROLES.president },
    }));
    expect(views.finieALaReouverture).toBe(true);
    expect(views.views).toEqual([]);
    expect(authUseCases.resolveOnboardingExitRoute({
      hasSeenWelcome: false, userDocumentId: 'dirigeant-neuf', views: views.views,
    })).toBeUndefined();
  });

  it('sans `offerSince`, la carte de l’accueil ne le propose pas', () => {
    expect(PRESIDENT_GUIDE.isOfferDate(INSCRIPTION)).toBe(false);
  });

  it('avec la date du départ, elle le propose à qui s’inscrit après', () => {
    mockSettings.offerSince = Date.parse('2026-11-05T00:00:00.000Z');
    expect(PRESIDENT_GUIDE.isOfferDate(INSCRIPTION)).toBe(true);
    expect(PRESIDENT_GUIDE.isOfferDate('2026-11-04T23:59:00.000Z')).toBe(false);
  });

  it('piège : `offerSince` s’écrit en millisecondes, une date en texte ne propose rien', () => {
    mockSettings.offerSince = '2026-11-05T00:00:00.000Z';
    expect(PRESIDENT_GUIDE.isOfferDate(INSCRIPTION)).toBe(false);
  });
});
