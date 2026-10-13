import fs from 'fs';
import path from 'path';

import { Platform, StyleSheet } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FeuilleDAdresse from '@/components/organisms/feuilleDAdresse/FeuilleDAdresse';
import LeagueActionPromptHost from '@/components/organisms/league/LeagueActionPromptHost';

// 🤖 ANDROIDBAR-2 — suite du signalement Android du 12/10 (Samsung, navigation à 3 boutons) :
// les feuilles qui montent du bas posées à une marge FIXE. Mesuré à l'émulateur le 13/10
// (Pixel 9, Android 16, barre à 3 boutons = 126 px = 48 dp, `.tmp/portes/ANDROIDBAR/LOT2/`) :
// - une fenêtre <Modal> SANS `statusBarTranslucent` est remontée par Android lui-même : React
//   Native pose `fitsSystemWindows` sur son cadre (ReactModalHostView.kt), la racine de la
//   fenêtre s'arrête au haut de la barre (feuille « Choisir les entraîneurs » : 2298 px =
//   haut de la barre). Y ajouter la barre créerait un trou de 48 dp ⇒ on n'y touche pas ;
// - une fenêtre <Modal> AVEC `statusBarTranslucent` descend SOUS la barre (feuille « Adresse »
//   du fil : 0..2424 px, la rangée « Copier l'adresse » finit à 2334 px, 36 px sous la barre) ;
// - une feuille `BottomModal` descend aussi jusqu'au bas de l'écran (2424 px) : c'est sa marge
//   de contenu qui réserve la barre — sauf quand l'appelant l'écrase (League : 6).
// Sur iPhone (barre d'accueil 34) et Android ≤ 14 (`bottom` = 0), rien ne doit changer.

let mockInsets = {
  bottom: 34, left: 0, right: 0, top: 47,
};
const mockBottomModalProps = /** @type {any[]} */ ([]);

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      if (typeof repli === 'string') return repli;
      if (repli?.defaultValue) return repli.defaultValue.replace('{{app}}', repli.app);
      return cle;
    },
  }),
}));
jest.mock('react-native-svg', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    Circle: VueRN,
    default: VueRN,
    Line: VueRN,
    Path: VueRN,
    Polyline: VueRN,
    Rect: VueRN,
    Svg: VueRN,
  };
});
jest.mock('@/theme/themeContext', () => {
  const colors = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(colors),
      Colors: colors,
      Fonts: jest.requireActual('@/theme/fonts').default(colors),
    }),
  };
});
jest.mock('@/platform/maps/externalMap', () => ({
  buildExternalMapLinks: () => ({ google: 'https://google' }),
  listExternalMapApps: () => Promise.resolve([{ key: 'google', url: 'https://google' }]),
}));

// League : l'hôte réel, ses dépendances réduites à ce qu'il faut pour montrer la feuille.
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: () => Promise.resolve() }),
}));
jest.mock('@/domains/auth/authUseCases', () => ({ getUserRoleKey: () => 'coach' }));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ isBootstrapResolved: true, userData: { role: { type: 'coach' } } }),
}));
jest.mock('@/store/appContext', () => ({ useAppContext: () => [{ auth: { token: 'jeton' } }] }));
jest.mock('@/components/atoms/button/Button', () => 'Button');
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => {
      mockBottomModalProps.push(props);
      return <VueRN testID="league-feuille">{props.children}</VueRN>;
    },
  };
});
jest.mock('@/components/molecules/header/LeagueModalHeader', () => 'LeagueModalHeader');
jest.mock(
  '@/components/organisms/venueProposalModal/VenueProposalModal',
  () => 'VenueProposalModal',
);
jest.mock('@/views/league/match/utils/proposalDefaults', () => ({
  buildProposalDefaultsFromMatch: () => ({ date: null, end: '', start: '' }),
}));
jest.mock('@/views/league/match/utils/proposalPayload', () => ({
  buildCanonicalLeagueProposalPayload: () => ({}),
}));
jest.mock('@/navigation/navigationService', () => ({
  getCurrentRouteName: () => 'Home',
  getCurrentRouteTrail: () => [],
  navigate: () => {},
  navigationRef: {
    addListener: () => () => {},
    getCurrentRoute: () => ({ name: 'Home' }),
    isReady: () => true,
  },
}));
jest.mock('@/services/league/leagueActionQueries', () => ({
  getPendingLeagueActionQueryKey: () => ['league-action'],
  usePendingLeagueAction: () => ({
    data: {
      nextAction: {
        date: '2026-10-24T14:00:00.000Z',
        key: 'action-1',
        match: { documentId: 'match-1' },
        matchId: 'match-1',
        opponent: { name: 'FC Rivelac' },
        state: 'opponent_found',
      },
    },
    refetch: () => Promise.resolve(),
  }),
}));
jest.mock('@/services/league/leagueMatchService', () => ({
  createLeagueProposal: () => Promise.resolve(),
  respondToLeagueProposal: () => Promise.resolve(),
  submitPostSlotResponse: () => Promise.resolve(),
}));
jest.mock('@/utils/webRuntime', () => ({ getWebBackgroundPollMs: () => false }));
jest.mock('@/constants/popupRegistry', () => ({
  POPUP_DISMISS_SCOPES: { SESSION: 'session' },
  POPUP_IDS: { LEAGUE_ACTION_PROMPT: 'league-action', LEAGUE_COUNTER_PROPOSAL: 'league-counter' },
}));
jest.mock('@/constants/runtimeFlags', () => ({ ENABLE_LEAGUE_ACTION_PROMPTS: true }));
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: () => {} }),
}));
jest.mock('@/context/BlockingOverlayContext', () => ({
  useBlockingOverlayLifecycle: () => {},
  useBlockingOverlayPrompt: () => true,
}));
jest.mock('@/context/PopupManagerContext', () => ({
  usePopupEligibility: (/** @type {string} */ id, /** @type {boolean} */ actif) => ({
    canShow: actif,
    descriptor: { id, priority: 1 },
    dismiss: () => {},
    markShown: () => {},
  }),
}));
jest.mock('@/hooks/useLeagueLegalAcceptance', () => ({
  __esModule: true,
  default: () => ({
    leagueLegalAcceptanceModal: null,
    requestLeagueLegalAcceptance: () => Promise.resolve({}),
  }),
}));

// Le premier montage charge l'hôte League et ses dépendances (≈ 12 s sur ce poste).
jest.setTimeout(60000);

const OS_D_ORIGINE = Platform.OS;
/**
 * Bascule de système et de barre du bas (mêmes valeurs que l'émulateur de recette).
 * @param {string} systeme
 * @param {number} bas - `useSafeAreaInsets().bottom`
 */
const simuler = (systeme, bas) => {
  Platform.OS = /** @type {any} */ (systeme);
  mockInsets = {
    bottom: bas, left: 0, right: 0, top: systeme === 'ios' ? 47 : 24,
  };
};
afterEach(() => {
  Platform.OS = OS_D_ORIGINE;
});

/**
 * Marge basse de la feuille « Adresse » (le cadre qui porte `testID="feuille-adresse"`).
 * @returns {Promise<number>}
 */
const margeDeLaFeuilleDAdresse = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <FeuilleDAdresse
        adresse={{ label: '12 chemin du Moulin' }}
        onClose={() => {}}
        onCopy={() => {}}
      />,
    );
  });
  const feuille = arbre.root.findAll(
    (/** @type {any} */ n) => n.props?.testID === 'feuille-adresse' && n.props?.style,
  )[0];
  const marge = StyleSheet.flatten(feuille.props.style).paddingBottom;
  act(() => arbre.unmount());
  return marge;
};

/**
 * Marge de fin de défilement que l'hôte League donne à SA feuille.
 * @returns {Promise<number>}
 */
const margeDeLaFeuilleLeague = async () => {
  mockBottomModalProps.length = 0;
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<LeagueActionPromptHost />);
  });
  const props = mockBottomModalProps[mockBottomModalProps.length - 1];
  act(() => arbre.unmount());
  return props.contentBottomPaddingOverride;
};

describe('ANDROIDBAR-2 — les feuilles du bas restent au-dessus de la barre d’Android', () => {
  test('A1 — feuille « Adresse », Android 15/16 à 3 boutons : marge ≥ la barre (48)', async () => {
    simuler('android', 48);
    expect(await margeDeLaFeuilleDAdresse()).toBeGreaterThanOrEqual(48);
  });

  test('A2 — « Adresse » inchangée : iPhone (34), gestes (24), Android ≤ 14 (0)', async () => {
    simuler('ios', 34);
    expect(await margeDeLaFeuilleDAdresse()).toBe(34);
    simuler('android', 24);
    expect(await margeDeLaFeuilleDAdresse()).toBe(34);
    simuler('android', 0);
    expect(await margeDeLaFeuilleDAdresse()).toBe(34);
  });

  test('L1 — feuille League, Android 15/16 à 3 boutons : fin du défilement ≥ 48', async () => {
    simuler('android', 48);
    expect(await margeDeLaFeuilleLeague()).toBeGreaterThanOrEqual(48);
  });

  test('L2 — feuille League inchangée : iPhone (6), Android ≤ 14 (6), site (6)', async () => {
    simuler('ios', 34);
    expect(await margeDeLaFeuilleLeague()).toBe(6);
    simuler('android', 0);
    expect(await margeDeLaFeuilleLeague()).toBe(6);
    simuler('web', 0);
    expect(await margeDeLaFeuilleLeague()).toBe(6);
  });

  // Garde : ces 4 feuilles ne passent PAS sous la barre parce qu'Android les remonte (mesuré
  // sur « Choisir les entraîneurs »). Qui y ajoute `statusBarTranslucent` ou
  // `navigationBarTranslucent` les fait descendre sous la barre : il lui faudra alors
  // `Math.max(<marge>, useSafeAreaInsets().bottom)`, comme la feuille « Adresse ».
  test.each([
    ['views/team/TeamDetails.js', 'visible={isTrainerPickerVisible}'],
    ['views/event/EventDetails.js', 'visible={isFeaturedModalVisible}'],
    ['views/collectivite/components/DecisionCreneauModal.js', 'visible={Boolean(decision)}'],
    ['views/admin/components/ConsoleSheet.js', 'transparent visible>'],
  ])('G — %s : sa <Modal> reste remontée par Android (sans « Translucent »)', (fichier, ancre) => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', fichier), 'utf8');
    expect(source.split(ancre)).toHaveLength(2);
    const fin = source.indexOf(ancre);
    const ouverture = source.slice(source.lastIndexOf('<Modal', fin), fin + ancre.length);
    expect(ouverture.startsWith('<Modal')).toBe(true);
    expect(ouverture.length).toBeLessThan(300);
    expect(ouverture).not.toMatch(/statusBarTranslucent|navigationBarTranslucent/);
  });
});
