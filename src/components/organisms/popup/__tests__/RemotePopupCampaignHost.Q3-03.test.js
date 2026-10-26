import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import RemotePopupCampaignHost from '../RemotePopupCampaignHost';

// Le VRAI gestionnaire de fenetres, charge hors des `import` (ordre des imports).
const { PopupManagerProvider } = jest.requireActual('@/context/PopupManagerContext');

// 🐞 Q3-03 — LES POPUPS DISTANTES NE S AFFICHAIENT JAMAIS APRES LES 2,2 PREMIERES SECONDES.
// La campagne n autorisait que la phase `startup_prompt_window`, qui dure 2,2 s ; l app
// n y revient jamais. Une reponse `/active` lente, ou une campagne « au retour au premier
// plan », restait donc invisible.

/** La phase de demarrage en cours : elle avance et ne revient jamais. */
let mockPhase = 'startup_prompt_window';

jest.mock('@/constants/runtimeFlags', () => ({ ENABLE_REMOTE_POPUP_CAMPAIGNS: true }));
jest.mock('@/store/appContext', () => ({
  storage: { delete: () => {}, getString: () => undefined, set: () => {} },
  useAppContext: () => [{ auth: { token: 'jeton', user: { documentId: 'u1' } } }, () => {}],
}));
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: () => {} }),
}));
jest.mock('@/context/BlockingOverlayContext', () => ({
  useBlockingOverlayLifecycle: () => {},
  useBlockingOverlayPrompt: () => true,
}));
jest.mock('@/context/StartupPhaseContext', () => ({
  useStartupPhase: () => ({
    activeStartupPromptId: null,
    canShowGlobalStartupPrompt: mockPhase === 'startup_prompt_window',
    canShowLocalScreenPrompt: true,
    currentRouteName: 'HomeTab',
    markStartupPromptDismissed: () => {},
    markStartupPromptShown: () => {},
    phase: mockPhase,
  }),
}));
jest.mock('@/navigation/navigationService', () => ({
  getCurrentRouteName: () => 'HomeTab',
  navigate: () => {},
}));
jest.mock('@/services/inAppPopupCampaign/inAppPopupCampaignService', () => ({
  getActiveInAppPopupCampaigns: jest.fn(),
  recordInAppPopupAction: jest.fn(() => Promise.resolve()),
  recordInAppPopupDismiss: jest.fn(() => Promise.resolve()),
  recordInAppPopupImpression: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/components/organisms/popup/GlobalPromptModal', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return function GlobalPromptModalMock(/** @type {any} */ { body, visible }) {
    return visible ? <TexteRN>{body}</TexteRN> : null;
  };
});

const CAMPAGNE = {
  actions: [],
  body: 'Nouveau : les amicaux',
  cadence: 'once_per_session',
  documentId: 'camp-1',
  trigger: 'app_foreground',
};

/**
 * La campagne est-elle a l ecran ?
 * @param {any} arbre
 * @returns {boolean}
 */
const affichee = (arbre) => arbre.root.findAllByType(Text)
  .some((n) => n.props.children === CAMPAGNE.body);

/** @type {any[]} */
const montes = [];
afterEach(() => {
  act(() => { montes.splice(0).forEach((arbre) => arbre.unmount()); });
});

/**
 * Monte l hote avec une campagne deja recue, dans la phase donnee.
 * @param {string} phase
 * @returns {any}
 */
const rendre = (phase) => {
  mockPhase = phase;
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <PopupManagerProvider>
        <RemotePopupCampaignHost initialCampaign={CAMPAGNE} />
      </PopupManagerProvider>,
    );
  });
  montes.push(arbre);
  return arbre;
};

describe('🐞 Q3-03 — une campagne recue apres le demarrage s affiche', () => {
  it('jumeau : pendant les 2,2 premieres secondes, elle s affiche', () => {
    expect(affichee(rendre('startup_prompt_window'))).toBe(true);
  });

  it.each(['screen_local_prompts', 'steady_state'])('en phase « %s », elle s affiche aussi', (
    phase,
  ) => {
    expect(affichee(rendre(phase))).toBe(true);
  });
});
