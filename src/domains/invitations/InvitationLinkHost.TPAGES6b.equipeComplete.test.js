/* eslint-disable max-len -- phrases de l écran recopiées mot pour mot */
/**
 * T-PAGES-6b (18/11/2026, point 6 du chef ; recette 45, « Recette Site 333 » à 5 sur 5) — LE LIEN
 * D'UNE ÉQUIPE PLEINE. Le visiteur se voyait encore proposer « Continuer » (créer son compte et
 * rejoindre) : la variante « équipe complète » n'a AUCUN bouton pour rejoindre, et renvoie à la
 * fiche du tournoi pour trouver une autre équipe. Lue dans l'aperçu (rosterCount, maxRosterSize).
 * ROUGE avant le lot : l'équipe pleine proposait de rejoindre.
 */
const mockNavigate = jest.fn(() => true);
const mockApercu = jest.fn();
// T-PAGES-6 : le bouton « Conditions d'inscription » de la fenêtre (doublures, react-native est simulé ici).
jest.mock('@/components/atoms/button/Button', () => () => null);
jest.mock('@/views/event/components/tournamentTerms', () => ({ openTournamentTerms: jest.fn() }));
jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
  Linking: {
    addEventListener: () => ({ remove: jest.fn() }),
    getInitialURL: () => Promise.resolve(null),
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

jest.mock('@/components/organisms/popup/GlobalPromptModal', () => () => null);
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (/** @type {string} */ c, /** @type {any} */ d) => d || c }) }));
jest.mock('@/views/event/tournamentUtils', () => ({
  getTournamentEntryFeeLabel: (/** @type {any} */ event) => (
    Number(event?.tournamentConfig?.entryFeeCents) > 0
      ? `${Number(event.tournamentConfig.entryFeeCents) / 100} € par joueur` : null
  ),
}));

const { describeCodedTournamentInvite } = require('./InvitationLinkHost');

const t = (/** @type {string} */ cle, /** @type {any} */ parDefaut, /** @type {any} */ options = {}) => (
  String(parDefaut || cle).replace(/{{(\w+)}}/g, (_tout, nom) => String(options[nom] ?? ''))
);
const apercu = (/** @type {any} */ sur = {}) => ({
  captainName: 'Dorian D.',
  entryFeeCents: 2000,
  event: {
    date: '2026-12-19T00:00:00.000Z', documentId: 'tournoi-1912', name: 'FoundClub x AR Soccer', place: 'AR Soccer', startTime: '19:00:00.000',
  },
  maxRosterSize: 5,
  minAge: 16,
  rosterCount: 3,
  status: 'active',
  team: { documentId: 'equipe-a', name: 'Recette Site 333' },
  ...sur,
});
const plein = apercu({ rosterCount: 5 });
const COMPLETE = "L'équipe Recette Site 333 est complète (5 joueurs sur 5). Trouve une autre équipe sur la fiche du tournoi.";

test('🔴 visiteur, équipe pleine : aucun bouton pour rejoindre, la fiche du tournoi', () => {
  const coded = describeCodedTournamentInvite({ isSignedIn: false, preview: plein, t });
  expect(coded.title).toBe('Équipe complète');
  expect(coded.body).toBe(COMPLETE);
  expect([coded.action, coded.primary]).toEqual(['openEventDetails', 'Voir le tournoi']);
});

test('🔴 compte connecté hors de l équipe, équipe pleine : la même variante', () => {
  const coded = describeCodedTournamentInvite({
    isSignedIn: true, preview: { ...plein, viewer: { alreadyMember: false, canJoin: false, reason: 'Équipe pleine.' } }, t,
  });
  expect(coded.body).toBe(COMPLETE);
  expect(coded.action).toBe('openEventDetails');
});

test('caractérisant : le capitaine et le membre d une équipe pleine gardent leur variante', () => {
  const capitaine = describeCodedTournamentInvite({ isSignedIn: true, preview: { ...plein, viewer: { alreadyMember: true, isCaptain: true } }, t });
  expect(capitaine.action).toBe('shareLink');
  const membre = describeCodedTournamentInvite({ isSignedIn: true, preview: { ...plein, viewer: { alreadyMember: true } }, t });
  expect(membre.action).toBe('openTeam');
});

test('caractérisant : une place libre, ou un effectif sans maximum, et rien ne change', () => {
  expect(describeCodedTournamentInvite({ isSignedIn: false, preview: apercu(), t }).action).toBe('signIn');
  expect(describeCodedTournamentInvite({ isSignedIn: false, preview: apercu({ maxRosterSize: null, rosterCount: 9 }), t }).action).toBe('signIn');
});
