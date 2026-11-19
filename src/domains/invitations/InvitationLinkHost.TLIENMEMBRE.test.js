/* eslint-disable max-len -- phrases de l écran recopiées mot pour mot : une coupure les rendrait illisibles */
/**
 * T-LIEN-MEMBRE (18/11/2026, M1319 point 12) — UN MEMBRE QUI OUVRE LE LIEN DE SA PROPRE ÉQUIPE.
 * Constat du testeur (recette 46, site, connecté avec le 777, membre « present » de l'équipe 32) :
 * « Voir le tournoi » au lieu de « Voir mon équipe ». L'aperçu ne disait pas « membre » au client
 * (pas de `viewer` sur un tournoi clos ; verdict faux ou absent) : le client relit lui-même la ligne
 * du compte dans l'équipe (même source que la fiche : getTournamentViewerMember).
 * Attendu : « Tu fais déjà partie de l'équipe {{team}} » et « Voir mon équipe » en bouton principal.
 */
const mockEquipe = jest.fn();
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
  navigate: jest.fn(),
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
  getTournamentTeamById: (/** @type {any[]} */ ...args) => mockEquipe(...args),
  previewTournamentTeamInviteLink: jest.fn(),
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

const { describeCodedTournamentInvite, isActiveMemberOfTournamentTeam } = require('./InvitationLinkHost');

const t = (/** @type {string} */ cle, /** @type {any} */ parDefaut, /** @type {any} */ options = {}) => (
  String(parDefaut || cle).replace(/{{(\w+)}}/g, (_tout, nom) => String(options[nom] ?? ''))
);
const apercu = (/** @type {any} */ sur = {}) => ({
  captainName: 'Dorian D.',
  entryFeeCents: 2000,
  event: { documentId: 'tournoi-1912', name: 'FoundClub x AR Soccer', place: 'AR Soccer' },
  minAge: 16,
  rosterCount: 5,
  status: 'active',
  team: { documentId: 'equipe-32', name: 'Recette Site 333' },
  ...sur,
});
const MEMBRE = "Tu fais déjà partie de l'équipe Recette Site 333";

beforeEach(() => mockEquipe.mockReset());

test('🔴 le verdict dit « membre » : « Tu fais déjà partie de l équipe … », « Voir mon équipe » en principal', () => {
  const coded = describeCodedTournamentInvite({
    isSignedIn: true, preview: apercu({ viewer: { alreadyMember: true, canJoin: true } }), t,
  });
  expect(coded.title).toBe(MEMBRE);
  expect([coded.action, coded.primary]).toEqual(['openTeam', 'Voir mon équipe']);
});

test('🔴 tournoi clos (aucun verdict), mais le compte est dans l équipe : « Voir mon équipe », pas « Voir le tournoi »', () => {
  const coded = describeCodedTournamentInvite({
    isMember: true, isSignedIn: true, preview: apercu({ status: 'closed' }), t,
  });
  expect(coded.title).toBe(MEMBRE);
  expect([coded.action, coded.primary]).toEqual(['openTeam', 'Voir mon équipe']);
  expect(coded.primary).not.toBe('Voir le tournoi');
});

test('🔴 verdict « refus » alors que la relecture trouve le compte dans l équipe : la relecture gagne', () => {
  const coded = describeCodedTournamentInvite({
    isMember: true,
    isSignedIn: true,
    preview: apercu({ viewer: { alreadyMember: false, canJoin: false, reason: 'Cette équipe est complète.' } }),
    t,
  });
  expect(coded.title).toBe(MEMBRE);
  expect([coded.action, coded.primary]).toEqual(['openTeam', 'Voir mon équipe']);
});

test('caractérisant : le capitaine d un tournoi ouvert garde « Envoyer le lien » (planche 4)', () => {
  const coded = describeCodedTournamentInvite({
    isMember: true, isSignedIn: true, preview: apercu({ viewer: { alreadyMember: true, isCaptain: true } }), t,
  });
  expect(coded.action).toBe('shareLink');
});

test('caractérisant : clos et pas membre, « Voir le tournoi » ; sans compte, la relecture n est pas lue', () => {
  const closNonMembre = describeCodedTournamentInvite({
    isMember: false, isSignedIn: true, preview: apercu({ status: 'closed' }), t,
  });
  expect(closNonMembre.primary).toBe('Voir le tournoi');
  const visiteur = describeCodedTournamentInvite({
    isMember: true, isSignedIn: false, preview: apercu(), t,
  });
  expect(visiteur.action).toBe('signIn');
});

test('🔴 la relecture : une ligne active du compte, même derrière une ancienne ligne retirée', async () => {
  mockEquipe.mockResolvedValue({
    documentId: 'equipe-32',
    members: [
      { responseStatus: 'declined', user: { documentId: 'u-987' } },
      { responseStatus: 'present', user: { documentId: 'u-987' } },
    ],
  });
  await expect(isActiveMemberOfTournamentTeam('equipe-32', 'u-987')).resolves.toBe(true);
  expect(mockEquipe).toHaveBeenCalledWith('equipe-32');
});

test('🔴 la relecture : la ligne du lecteur rendue par le serveur (`viewerMembership`), sans `members`', async () => {
  mockEquipe.mockResolvedValue({ documentId: 'equipe-32', viewerMembership: { responseStatus: 'present' } });
  await expect(isActiveMemberOfTournamentTeam('equipe-32', 'u-987')).resolves.toBe(true);
});

test('🔴 le site passe sa propre lecture de la fiche (pas de `require` dans son navigateur)', async () => {
  const lireLaFiche = jest.fn(() => Promise.resolve({ members: [{ responseStatus: 'present', user: { documentId: 'u-987' } }] }));
  await expect(isActiveMemberOfTournamentTeam('equipe-32', 'u-987', lireLaFiche)).resolves.toBe(true);
  expect(lireLaFiche).toHaveBeenCalledWith('equipe-32');
  expect(mockEquipe).not.toHaveBeenCalled();
});

test('caractérisant : pas membre, fiche refusée (403), ou rien à relire : faux, sans appel inutile', async () => {
  mockEquipe.mockResolvedValue({ members: [{ responseStatus: 'declined', user: { documentId: 'u-987' } }] });
  await expect(isActiveMemberOfTournamentTeam('equipe-32', 'u-987')).resolves.toBe(false);
  mockEquipe.mockRejectedValue(new Error('Forbidden'));
  await expect(isActiveMemberOfTournamentTeam('equipe-32', 'u-987')).resolves.toBe(false);
  mockEquipe.mockClear();
  await expect(isActiveMemberOfTournamentTeam('', 'u-987')).resolves.toBe(false);
  await expect(isActiveMemberOfTournamentTeam('equipe-32', '')).resolves.toBe(false);
  expect(mockEquipe).not.toHaveBeenCalled();
});
