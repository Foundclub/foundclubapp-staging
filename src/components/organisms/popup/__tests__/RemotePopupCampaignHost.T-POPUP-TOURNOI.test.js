import { Platform } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import RemotePopupCampaignHost from '../RemotePopupCampaignHost';

const { PopupManagerProvider } = jest.requireActual('@/context/PopupManagerContext');

// T-POPUP-TOURNOI (18/11) — la pop-up qui annonce le tournoi « FoundClub x AR Soccer ».
// 1. Un joueur CONNECTE voit le titre et l image, et « Voir le tournoi » ouvre la fiche
//    de CE tournoi (EventStack › EventDetails, avec son eventId).
// 2. Un VISITEUR (sans compte) : CONSTAT de l etat actuel, pas un souhait. L hote ne
//    demande rien au serveur sans jeton (et `active` n est pas accorde au role Public,
//    admin src/index.ts) : le visiteur ne voit jamais la pop-up. L ouvrir aux visiteurs
//    est une decision d Adel (un droit Public), remontee au chef.

/** @type {{ token: string | null, user: any }} */
let mockAuth = { token: 'jeton', user: { documentId: 'joueur-1' } };
const mockNavigate = jest.fn();
/** @type {any} */
let mockFenetre = null;

jest.mock('@/constants/runtimeFlags', () => ({ ENABLE_REMOTE_POPUP_CAMPAIGNS: true }));
jest.mock('@/store/appContext', () => ({
  storage: { delete: () => {}, getString: () => undefined, set: () => {} },
  useAppContext: () => [{ auth: mockAuth }, () => {}],
}));
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: () => {} }),
}));
jest.mock('@/context/BlockingOverlayContext', () => ({
  useBlockingOverlayLifecycle: () => {},
  useBlockingOverlayPrompt: () => true,
}));
jest.mock('@/navigation/navigationService', () => ({
  getCurrentRouteName: () => 'HomeTab',
  navigate: (/** @type {any[]} */ ...args) => mockNavigate(...args),
}));
jest.mock('@/services/inAppPopupCampaign/inAppPopupCampaignService', () => ({
  getActiveInAppPopupCampaigns: jest.fn(() => Promise.resolve({ data: [] })),
  recordInAppPopupAction: jest.fn(() => Promise.resolve()),
  recordInAppPopupDismiss: jest.fn(() => Promise.resolve()),
  recordInAppPopupImpression: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/utils/mediaUrl', () => ({ resolveMediaUrl: (/** @type {any} */ url) => url }));
jest.mock('@/components/organisms/popup/GlobalPromptModal', () => function GlobalPromptModalMock(
  /** @type {any} */ props,
) {
  mockFenetre = props;
  return null;
});

const service = jest.requireMock('@/services/inAppPopupCampaign/inAppPopupCampaignService');

const TOURNOI = {
  actions: [{
    actionType: 'open_event',
    eventId: 'evt-tournoi',
    label: 'Voir le tournoi',
    slot: 'primary',
    variant: 'Primary',
  }],
  body: 'Le 19/12 à Montpellier, 20 € par joueur.',
  cadence: 'once_per_24h',
  documentId: 'camp-tournoi',
  image: { url: 'https://exemple.test/affiche.jpg' },
  title: 'FoundClub x AR Soccer',
  trigger: 'app_open',
};

/** @type {any[]} */
const montes = [];
afterEach(() => {
  act(() => { montes.splice(0).forEach((arbre) => arbre.unmount()); });
  jest.restoreAllMocks();
  mockNavigate.mockClear();
  service.getActiveInAppPopupCampaigns.mockClear();
  mockFenetre = null;
});

/**
 * Monte l hote (au site : aucune phase de demarrage exigee).
 * @param {any} [initialCampaign]
 */
const monter = async (initialCampaign) => {
  jest.replaceProperty(Platform, 'OS', /** @type {any} */ ('web'));
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <PopupManagerProvider>
        <RemotePopupCampaignHost initialCampaign={initialCampaign} />
      </PopupManagerProvider>,
    );
  });
  montes.push(arbre);
};

const TITRE_JOUEUR_CONNECTE = 'joueur connecté — titre, image, et « Voir le tournoi » '
  + 'ouvre la fiche de CE tournoi';
test(TITRE_JOUEUR_CONNECTE, async () => {
  mockAuth = { token: 'jeton', user: { documentId: 'joueur-1' } };
  await monter(TOURNOI);

  expect(mockFenetre.visible).toBe(true);
  expect(mockFenetre.title).toBe('FoundClub x AR Soccer');
  expect(mockFenetre.headerContent).toBeTruthy();
  expect(mockFenetre.primaryAction.label).toBe('Voir le tournoi');

  await act(async () => { await mockFenetre.primaryAction.onPress(); });

  expect(mockNavigate).toHaveBeenCalledWith('EventStack', {
    params: { eventId: 'evt-tournoi' },
    screen: 'EventDetails',
  });
  expect(service.recordInAppPopupAction).toHaveBeenCalledWith('camp-tournoi', {
    actionType: 'open_event', slot: 'primary',
  });
});

test('visiteur sans compte — CONSTAT : rien n est demandé au serveur, aucune pop-up', async () => {
  mockAuth = { token: null, user: null };
  await monter();

  expect(service.getActiveInAppPopupCampaigns).not.toHaveBeenCalled();
  expect(mockFenetre).toBeNull();
});
