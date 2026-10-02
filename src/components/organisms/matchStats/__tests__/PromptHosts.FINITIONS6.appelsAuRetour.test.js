import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppState } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TrainingReviewPromptHost from '../../trainingReview/TrainingReviewPromptHost';
import MatchStatsPromptHost from '../MatchStatsPromptHost';

// ==========================================================================
// FINITIONS6 · POINT 7 (tournee 8, 🟡 reseau) — LES RAPPELS RELISAIENT LE
// SERVEUR EN DOUBLE A CHAQUE RETOUR AU PREMIER PLAN.
//
// 📏 Journal du relais T8 (T8_relay.log) : 386 appels a
// `pending-match-stats`, TOUJOURS par paires a la meme seconde, idem
// `pending-training-reviews` — chaque paire colle a un
// `in-app-popup-campaigns/active?trigger=app_foreground` : un retour au premier
// plan. Des retours toutes les 1 a 3 s (fenetre systeme, permission) faisaient
// donc 4 lectures toutes les 1 a 3 s.
// 🧭 Cause, dans les deux hotes (MatchStatsPromptHost, TrainingReviewPromptHost) :
// au retour, `invalidateQueries` relancait deja la lecture (requete observee),
// puis `refetch()` en relancait une seconde.
// ✅ Attendu : UNE lecture au retour, et seulement si la donnee a plus de 30 s
// (la fraicheur que la requete declare deja).
// ==========================================================================

const RIEN_EN_ATTENTE = { items: [], nextPrompt: null, totalPending: 0 };
const mockLireRappelsDeMatch = jest.fn(async () => RIEN_EN_ATTENTE);
const mockLireAvisEnAttente = jest.fn(async () => RIEN_EN_ATTENTE);

jest.mock('@/services/matchStats/matchStatsService', () => ({
  getPendingMatchStatsPrompts: () => mockLireRappelsDeMatch(),
}));
jest.mock('@/services/trainingReview/trainingReviewService', () => ({
  getPendingTrainingReviews: () => mockLireAvisEnAttente(),
  getTrainingReviews: jest.fn(),
  submitTrainingReview: jest.fn(),
}));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ isBootstrapResolved: true }),
}));
jest.mock('@/store/appContext', () => ({
  useAppContext: () => [{ auth: { token: 'jeton-test-adel' } }, () => {}],
}));
jest.mock('@/navigation/navigationService', () => ({
  getCurrentRouteName: () => 'HomeTab',
  navigate: () => {},
  navigationRef: { addListener: () => () => {}, isReady: () => true },
}));
jest.mock('@/context/PopupManagerContext', () => ({
  usePopupEligibility: () => ({
    canShow: false,
    descriptor: { id: 'rappel', priority: 1 },
    dismiss: () => {},
    markShown: () => {},
  }),
}));
jest.mock('@/context/BlockingOverlayContext', () => ({
  useBlockingOverlayLifecycle: () => {},
  useBlockingOverlayPrompt: () => false,
}));
// La fenetre elle-meme n est pas le sujet (elle reste fermee ici) : le vrai
// `BottomModal` tire un module natif que Jest ne sait pas charger.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock() {
  return null;
});
jest.mock('@/components/atoms/button/Button', () => function ButtonMock() {
  return null;
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));
jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(couleurs),
      Colors: couleurs,
      Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

const DEPART = new Date('2026-10-02T08:00:00.000Z').getTime();
/** @type {Array<(etat: string) => void>} */
let ecouteurs = [];
/** @type {any} */
let arbre;

const vider = async () => {
  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await Promise.resolve(); });
  }
};

/**
 * Le telephone passe en arriere-plan puis revient, `secondes` apres le dernier geste.
 * @param {number} secondes - Le temps ecoule depuis le geste precedent.
 * @returns {Promise<void>}
 */
const sortirEtRevenir = async (secondes) => {
  jest.setSystemTime(Date.now() + (secondes * 1000));
  act(() => { ecouteurs.forEach((ecouter) => ecouter('background')); });
  act(() => { ecouteurs.forEach((ecouter) => ecouter('active')); });
  await vider();
};

beforeEach(async () => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
  jest.setSystemTime(DEPART);
  mockLireRappelsDeMatch.mockClear();
  mockLireAvisEnAttente.mockClear();
  ecouteurs = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, ecouter) => {
    ecouteurs.push(/** @type {any} */ (ecouter));
    return { remove: () => { ecouteurs = ecouteurs.filter((e) => e !== ecouter); } };
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <MatchStatsPromptHost />
        <TrainingReviewPromptHost />
      </QueryClientProvider>,
    );
  });
  await vider();
});

afterEach(() => {
  act(() => arbre.unmount());
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('FINITIONS6 · point 7 — une lecture au retour au premier plan, pas deux', () => {
  test('au demarrage : une lecture de chaque', () => {
    expect(mockLireRappelsDeMatch).toHaveBeenCalledTimes(1);
    expect(mockLireAvisEnAttente).toHaveBeenCalledTimes(1);
  });

  test('🚨 retour au premier plan apres 31 s : UNE lecture de chaque, pas deux', async () => {
    await sortirEtRevenir(31);

    expect(mockLireRappelsDeMatch).toHaveBeenCalledTimes(2);
    expect(mockLireAvisEnAttente).toHaveBeenCalledTimes(2);
  });

  test('🚨 dix retours en 20 s : aucune relecture, la donnee a moins de 30 s', async () => {
    for (let i = 0; i < 10; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await sortirEtRevenir(2);
    }

    expect(mockLireRappelsDeMatch).toHaveBeenCalledTimes(1);
    expect(mockLireAvisEnAttente).toHaveBeenCalledTimes(1);
  });

  test('🔒 au-dela de 30 s, le retour suivant relit bien (une fois)', async () => {
    await sortirEtRevenir(10);
    await sortirEtRevenir(25);

    expect(mockLireRappelsDeMatch).toHaveBeenCalledTimes(2);
    expect(mockLireAvisEnAttente).toHaveBeenCalledTimes(2);
  });
});
