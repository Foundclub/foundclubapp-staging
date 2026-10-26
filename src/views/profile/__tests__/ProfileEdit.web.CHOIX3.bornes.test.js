import { validateValues } from '../ProfileEdit.web';

// CHOIX3 (« 11- A », P5-24, 26/10) — LE PROFIL DU SITE BORNE AUSSI TAILLE ET POIDS.
// Le site ne fait pas tourner Joi (web/src/shims/joi.ts valide tout) : son formulaire a sa propre
// fonction de controle, qui doit appliquer la meme regle que `profileFormContract`.

// Seule la fonction de controle est testee : l'ecran et ses services sont doubles.
jest.mock('@/domains/auth/useAuth', () => ({ __esModule: true, default: () => ({}) }));
jest.mock('@/domains/auth/authUseCases', () => ({}));
jest.mock('@/services/auth/authService', () => ({ updateMe: jest.fn() }));
jest.mock('@/services/celebrations/celebrationRuntime', () => ({
  emitCelebrationBanner: jest.fn(),
}));
jest.mock('@/domains/places/usePlaces', () => ({ __esModule: true, default: () => ({}) }));
jest.mock('@/components/atoms/button/Button', () => () => null);
jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => () => null);
jest.mock('@/components/molecules/input/Input', () => () => null);
jest.mock('@/components/molecules/onboardingWrapper/OnboardingWrapper', () => () => null);
jest.mock(
  '@/components/molecules/parentalDeclarationCard/ParentalDeclarationCard',
  () => () => null,
);
jest.mock('@/components/molecules/selectAvatar/SelectAvatar', () => () => null);
jest.mock('@/components/molecules/tutorial/TutorialFlowBoundary', () => () => null);
jest.mock(
  '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput',
  () => () => null,
);
jest.mock('@/components/templates/ScreenContainer', () => () => null);
// `.env` est gitignore, donc absent de toute copie de travail.
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(), get: jest.fn(), post: jest.fn(), put: jest.fn(),
  },
}));

const base = { birthdate: '10/04/1995', firstname: 'Hugo', lastname: 'Lemaire' };
const anneeIlYa = (/** @type {number} */ ans) => new Date().getFullYear() - ans;

describe('CHOIX3 — ProfileEdit.web : validateValues', () => {
  test('180 cm et 75 kg : aucune erreur', () => {
    const erreurs = validateValues(/** @type {any} */ ({ ...base, height: '180', weight: '75' }));

    expect(erreurs).toEqual({});
  });

  test('🚨 adulte, 240 cm et 250 kg : deux erreurs', () => {
    const erreurs = validateValues(/** @type {any} */ ({ ...base, height: '240', weight: '250' }));

    expect(Object.keys(erreurs).sort()).toEqual(['height', 'weight']);
  });

  test('un enfant de 8 ans, 90 cm et 24 kg : aucune erreur', () => {
    const erreurs = validateValues(/** @type {any} */ ({
      ...base, birthdate: `01/01/${anneeIlYa(8)}`, height: '90', weight: '24',
    }));

    expect(erreurs).toEqual({});
  });
});
