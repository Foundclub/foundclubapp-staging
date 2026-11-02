/* eslint-disable max-len -- des phrases entieres */
import { storage } from '@/store/appContext';

import { getOnboardingViews, markOnboardingStarted, USER_ROLES } from '@/domains/auth/authUseCases';
import { RouteNames } from '@/navigation/routeNames';

// FIN-CHEMINS (02/11, D-COACH-9, contre-recette 07:11) — un entraîneur neuf fermé sur « Trouve ton
// club » reprenait à « Où habites-tu ? », deux étapes trop tôt : ville et photo à repasser par
// « Passer ». Un « Passer » n'enregistre rien (TUNNELREPRISE) : à la réouverture, les étapes qui se
// passent AVANT l'étape due comptent comme faites, et la reprise va à la première étape due.
// ROUGE avant.

jest.mock('../../../store/appContext', () => ({
  storage: { getBoolean: jest.fn(), getString: jest.fn(), set: jest.fn() },
}));

const COACH_NEUF = {
  birthdate: '1995-03-15',
  documentId: 'coach-reprise',
  firstname: 'Luc',
  lastname: 'Harne',
  role: { name: USER_ROLES.coach },
};

const premiere = (/** @type {any} */ resultat) => (resultat.views || []).find((/** @type {any} */ vue) => vue.canShow)?.route;

beforeEach(() => {
  /** @type {any} */ (storage.getBoolean).mockImplementation(
    (/** @type {string} */ cle) => String(cle).startsWith('onboardingStarted_'),
  );
});

describe('FIN-CHEMINS D-COACH-9 — la reprise va à la première étape due', () => {
  it('🔴 ville remplie, photo passée : la reprise ouvre « Trouve ton club »', () => {
    const resultat = getOnboardingViews({ ...COACH_NEUF, address: { label: 'Marseille' } });
    expect(premiere(resultat)).toBe(RouteNames.UserAffiliationGuide);
  });

  it('🔴 la session du site a perdu la ville : la reprise ouvre quand même « Trouve ton club »', () => {
    expect(premiere(getOnboardingViews({ ...COACH_NEUF, address: null }))).toBe(RouteNames.UserAffiliationGuide);
  });

  it('🔒 l accord parental dû reste la première étape', () => {
    const quatorzeAns = new Date(Date.now() - 14 * 365.25 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const resultat = getOnboardingViews({ ...COACH_NEUF, birthdate: quatorzeAns, documentId: 'coach-ado' });
    expect(premiere(resultat)).toBe(RouteNames.UserParentalDeclaration);
  });

  it('🔒 dans le même lancement, le tunnel garde la ville et la photo', () => {
    markOnboardingStarted('coach-en-cours');
    const resultat = getOnboardingViews({ ...COACH_NEUF, documentId: 'coach-en-cours' });
    expect(premiere(resultat)).toBe(RouteNames.UserAddress);
  });
});
