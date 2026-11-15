import { Platform, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import RemotePopupCampaignHost from '../RemotePopupCampaignHost';

// Le VRAI gestionnaire de fenetres, charge hors des `import` (ordre des imports).
const { PopupManagerProvider } = jest.requireActual('@/context/PopupManagerContext');

// T-VITRINE (14/11) — LA FENETRE D ARRIVEE SUR LE SITE.
// Au site, personne n appelle `markNavigationReady` (seul app/src/App.js le fait, au telephone) :
// la phase de demarrage reste `boot_core` pour toujours, et l hote, qui n autorisait que les
// phases du telephone, ne s ouvrait jamais. Au site il ne depend plus des phases ; au
// telephone, rien ne change (temoin de controle).

/** La phase ou le site reste : personne ne l avance au site. */
const mockPhase = 'boot_core';

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
  body: 'Le tournoi arrive',
  cadence: 'once_per_session',
  documentId: 'camp-vitrine',
  trigger: 'app_open',
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
  jest.restoreAllMocks();
});

/**
 * Monte l hote avec une campagne deja recue, sur la plateforme donnee.
 * @param {string} os
 * @returns {any}
 */
const rendre = (os) => {
  jest.replaceProperty(Platform, 'OS', /** @type {any} */ (os));
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

describe('T-VITRINE — phase `boot_core`, celle ou le site reste', () => {
  it('au site, la campagne s affiche', () => {
    expect(affichee(rendre('web'))).toBe(true);
  });

  it('temoin de controle : au telephone, elle attend la fin du demarrage', () => {
    expect(affichee(rendre('ios'))).toBe(false);
  });
});
