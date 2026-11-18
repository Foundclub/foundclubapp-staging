import { Platform } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import RemotePopupCampaignHost from '../RemotePopupCampaignHost';

const { PopupManagerProvider } = jest.requireActual('@/context/PopupManagerContext');

// IMPL-4-ACCUEIL, page 5 (variante B « billet », Adel 18/11) — QUAND l'hôte montre le billet.
// Le prédicat est UN seul : modèle `hero_image_modal` ET action principale `open_event`. Le
// serveur ramène toute clé inconnue à `standard_modal` (schéma + CAMPAIGN_TEMPLATES) : une clé
// neuve demanderait l'admin. Toute autre campagne garde la fenêtre d'avant, inchangée.

const mockNavigate = jest.fn();
/** @type {any} */
let mockFenetre = null;
/** @type {any} */
let mockBillet = null;

jest.mock('@/constants/runtimeFlags', () => ({ ENABLE_REMOTE_POPUP_CAMPAIGNS: true }));
jest.mock('@/store/appContext', () => ({
  storage: { delete: () => {}, getString: () => undefined, set: () => {} },
  useAppContext: () => [{ auth: { token: 'jeton', user: { documentId: 'joueur-1' } } }, () => {}],
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
jest.mock('@/components/organisms/popup/BilletTournoiModal', () => function BilletMock(
  /** @type {any} */ props,
) {
  mockBillet = props;
  return null;
});

const service = jest.requireMock('@/services/inAppPopupCampaign/inAppPopupCampaignService');

const BILLET = {
  actions: [{
    actionType: 'open_event', eventId: 'evt-tournoi', label: 'Voir le tournoi', slot: 'primary',
  }],
  body: 'Monte ton équipe de 5 et inscris-la.',
  cadence: 'once_ever',
  documentId: 'camp-billet',
  eyebrow: 'Tournoi de foot à 5',
  image: { url: 'https://exemple.test/photo.jpg' },
  templateKey: 'hero_image_modal',
  title: 'FoundClub x AR Soccer',
  trigger: 'app_open',
};

/** @type {any[]} */
const montes = [];
afterEach(() => {
  act(() => { montes.splice(0).forEach((arbre) => arbre.unmount()); });
  jest.restoreAllMocks();
  mockNavigate.mockClear();
  service.recordInAppPopupDismiss.mockClear();
  service.recordInAppPopupAction.mockClear();
  mockFenetre = null;
  mockBillet = null;
});

const monter = async (/** @type {any} */ campagne) => {
  jest.replaceProperty(Platform, 'OS', /** @type {any} */ ('web'));
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <PopupManagerProvider>
        <RemotePopupCampaignHost initialCampaign={campagne} />
      </PopupManagerProvider>,
    );
  });
  montes.push(arbre);
};

const TITRE_BILLET = 'hero_image_modal + open_event : le billet, avec les textes et l image '
  + 'de la campagne';
test(TITRE_BILLET, async () => {
  await monter(BILLET);
  expect(mockBillet).toBeTruthy();
  expect(mockBillet.visible).toBe(true);
  expect(mockBillet.eventId).toBe('evt-tournoi');
  expect(mockBillet.title).toBe('FoundClub x AR Soccer');
  expect(mockBillet.eyebrow).toBe('Tournoi de foot à 5');
  expect(mockBillet.body).toBe('Monte ton équipe de 5 et inscris-la.');
  expect(mockBillet.imageUrl).toBe('https://exemple.test/photo.jpg');
  expect(mockBillet.secondaryAction).toBeNull();
  // Le repli est la fenêtre d'avant, prête : même titre, même action.
  expect(mockBillet.repli.props.title).toBe('FoundClub x AR Soccer');
  expect(mockFenetre).toBeNull();
});

test('« Voir le tournoi » du billet ouvre la fiche de CE tournoi et compte le clic', async () => {
  await monter(BILLET);
  await act(async () => { await mockBillet.primaryAction.onPress(); });
  expect(mockNavigate).toHaveBeenCalledWith('EventStack', {
    params: { eventId: 'evt-tournoi' },
    screen: 'EventDetails',
  });
  expect(service.recordInAppPopupAction).toHaveBeenCalledWith('camp-billet', {
    actionType: 'open_event', slot: 'primary',
  });
});

test('fermer le billet (croix ou « Plus tard ») compte une fermeture', async () => {
  await monter(BILLET);
  await act(async () => { mockBillet.onRequestClose(); });
  expect(service.recordInAppPopupDismiss).toHaveBeenCalledWith('camp-billet');
});

test('📌 modèle standard : la fenêtre d avant, pas de billet', async () => {
  await monter({ ...BILLET, templateKey: 'standard_modal' });
  expect(mockBillet).toBeNull();
  expect(mockFenetre.visible).toBe(true);
});

test('📌 hero_image_modal sans événement à ouvrir : la fenêtre d avant', async () => {
  await monter({
    ...BILLET,
    actions: [{
      actionType: 'open_url', label: 'Voir', slot: 'primary', url: 'https://exemple.test',
    }],
  });
  expect(mockBillet).toBeNull();
  expect(mockFenetre.visible).toBe(true);
});
