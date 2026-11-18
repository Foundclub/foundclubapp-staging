/* eslint-disable max-len -- phrases et doublures recopiées telles quelles */
/**
 * T-PAGES-6b (18/11/2026, points 5 et 6 de T-PAGES-6) — L'INVITATION RETIENT LE TOURNOI POUR LE
 * TUNNEL. Sans compte, l'aperçu reçu range le tournoi et l'équipe (inscriptionEnCours.js) : l'écran
 * du numéro et celui du rôle les rappellent. Avec un compte, l'invitation rouverte est le retour au
 * tournoi : le rangement est effacé. Les conditions s'ouvrent avec l'identifiant du tournoi.
 * ROUGE avant le lot : rien n'était rangé, les conditions ne savaient pas d'où l'on venait.
 */
import { act, create } from 'react-test-renderer';

const DATE = '2026-12-19T18:00:00.000Z';

const mockNavigate = jest.fn(() => true);
const mockApercu = jest.fn();

// T-PAGES-6 : le bouton « Conditions d'inscription » de la fenêtre (doublures, react-native est
// simulé ici).
jest.mock('@/components/atoms/button/Button', () => () => null);
const mockConditions = jest.fn();
jest.mock('@/views/event/components/tournamentTerms', () => ({
  openTournamentTerms: (/** @type {any[]} */ ...args) => mockConditions(...args),
}));
const mockRetenir = jest.fn();
const mockOublier = jest.fn();
jest.mock('@/domains/tournoi/inscriptionEnCours', () => ({
  oublierLInscriptionAuTournoi: (/** @type {any[]} */ ...args) => mockOublier(...args),
  retenirLInscriptionAuTournoi: (/** @type {any[]} */ ...args) => mockRetenir(...args),
}));
jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
  Linking: {
    addEventListener: () => ({ remove: jest.fn() }),
    getInitialURL: () => Promise.resolve(
      'https://foundclub.app/i/tournament/tournoi-1912?c=Abcdefghijklmnopqrstuvwx',
    ),
  },
  Platform: { OS: 'android', select: (/** @type {any} */ options) => options.android },
}));
jest.mock('@/navigation/navigationService', () => ({
  navigate: (/** @type {any[]} */ ...args) => mockNavigate(...args),
  navigationRef: { getRootState: () => undefined, isReady: () => false },
}));
jest.mock('@/services/teamInvite/teamInviteService', () => ({
  claimTeamInvite: jest.fn(() => Promise.resolve(null)),
  getTeamInvitePreview: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('@/services/teamMembershipRequest/teamMembershipRequestService', () => ({
  acceptTeamInvitation: jest.fn(),
  createTeamMembershipRequest: jest.fn(),
  refuseTeamInvitation: jest.fn(),
}));
jest.mock('@/services/tournamentTeam/tournamentTeamService', () => ({
  previewTournamentTeamInviteLink: (/** @type {any[]} */ ...args) => mockApercu(...args),
}));
jest.mock('@/domains/invitations/pendingInvite', () => ({
  clearPendingInvite: jest.fn(),
  readPendingInvite: jest.fn(() => null),
  savePendingInvite: jest.fn(),
}));
jest.mock('@/domains/invitations/deferredInviteRecovery', () => ({
  readAndroidDeferredInviteUrl: jest.fn(() => Promise.resolve(null)),
  readIOSClipboardInviteUrl: jest.fn(() => Promise.resolve(null)),
  shouldOfferIOSClipboardInvite: jest.fn(() => Promise.resolve(false)),
}));

/** @type {any} */
let lastModalProps = null;
jest.mock('@/components/organisms/popup/GlobalPromptModal', () => {
  // eslint-disable-next-line global-require -- une usine jest.mock ne peut pas etre hissee
  const React = require('react');
  return function GlobalPromptModalProbe(/** @type {any} */ props) {
    lastModalProps = props;
    return React.createElement('GlobalPromptModalProbe', null);
  };
});

/**
 * La doublure de traduction : le texte par défaut, avec ses variables.
 * @param {string} cle - La clé.
 * @param {any} parDefaut - Le texte par défaut.
 * @param {any} [options] - Les variables.
 * @returns {string} Le texte.
 */
const mockT = (cle, parDefaut, options = {}) => (
  String(parDefaut || cle).replace(/{{(\w+)}}/g, (_tout, nom) => String(options[nom] ?? ''))
);
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT }),
}));

const InvitationLinkHost = require('./InvitationLinkHost').default;

const apercu = (/** @type {any} */ sur = {}) => ({
  entryFeeCents: 2000,
  event: {
    date: DATE, documentId: 'tournoi-1912', name: 'FoundClub x AR Soccer', place: 'AR Soccer',
  },
  maxRosterSize: 5,
  rosterCount: 3,
  status: 'active',
  team: { documentId: 'equipe-a', name: 'EMU Test 002' },
  ...sur,
});

const monter = async (/** @type {string | undefined} */ userId) => {
  await act(async () => { create(<InvitationLinkHost userId={userId} />); });
  await act(async () => { await Promise.resolve(); });
};

beforeEach(() => {
  jest.clearAllMocks();
  lastModalProps = null;
});

test('🔴 sans compte : l aperçu reçu range le tournoi et l équipe, sans rien effacer', async () => {
  mockApercu.mockResolvedValue(apercu());
  await monter(undefined);
  expect(mockRetenir).toHaveBeenCalledWith({ equipe: 'EMU Test 002', event: apercu().event });
  expect(mockOublier).not.toHaveBeenCalled();
});

test('🔴 avec un compte : l invitation rouverte efface le rangement', async () => {
  mockApercu.mockResolvedValue(apercu({ viewer: { alreadyMember: false, canJoin: true } }));
  await monter('u-1');
  expect(mockOublier).toHaveBeenCalled();
  expect(mockRetenir).not.toHaveBeenCalled();
});

test('🔴 « Conditions d inscription » ouvre la page avec l identifiant du tournoi', async () => {
  mockApercu.mockResolvedValue(apercu());
  await monter(undefined);
  const bouton = [].concat(lastModalProps.children).find(Boolean);
  act(() => { bouton.props.onPress(); });
  expect(mockConditions).toHaveBeenCalledWith('tournoi-1912');
});

test('caractérisant : un tournoi clos n est pas rangé', async () => {
  mockApercu.mockResolvedValue(apercu({ status: 'closed' }));
  await monter(undefined);
  expect(mockRetenir).not.toHaveBeenCalled();
});
