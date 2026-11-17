/* eslint-disable max-len -- phrases de l écran recopiées mot pour mot : une coupure les rendrait illisibles */
/**
 * T-PAGES-6 (17/11/2026, points 1 et 2, R5 + décisions « 4a A » / « 4b A », D214) — REJOINDRE EN UN
 * SEUL ÉCRAN, dans l'app : la fenêtre du lien d'équipe dit qui invite (prénom et initiale), le
 * tournoi, la date, le lieu, les places et le prix, puis « Rejoindre l'équipe ». Variantes :
 * « C'est ton équipe » (capitaine), « Tu es déjà dans l'équipe », « Tu joues déjà ce tournoi avec
 * l'équipe … » et l'âge (message seul, sans bouton). Sous le texte : le rappel de l'âge.
 * Décision PURE (describeCodedTournamentInvite) : pas de rendu.
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
jest.mock('@/utils/date', () => ({ formatDateTimeWithDayPrefix: () => 'Sam. 19 déc. à 19:00' }));

const { describeCodedTournamentInvite } = require('./InvitationLinkHost');

const t = (/** @type {string} */ cle, /** @type {any} */ parDefaut, /** @type {any} */ options = {}) => (
  String(parDefaut || cle).replace(/{{(\w+)}}/g, (_tout, nom) => String(options[nom] ?? ''))
);
const apercu = (/** @type {any} */ sur = {}) => ({
  captainName: 'Dorian D.',
  entryFeeCents: 2000,
  event: {
    date: '2026-12-19T18:00:00.000Z', documentId: 'tournoi-1912', name: 'FoundClub x AR Soccer', place: 'AR Soccer',
  },
  maxRosterSize: 5,
  minAge: 16,
  rosterCount: 3,
  status: 'active',
  team: { documentId: 'equipe-a', name: 'Recette Site 333' },
  ...sur,
});
const connecte = (/** @type {any} */ viewer) => describeCodedTournamentInvite({ isSignedIn: true, preview: apercu({ viewer }), t });

test('🔴 connecté : un seul écran, capitaine, tournoi, date, lieu, places et prix, puis « Rejoindre l équipe »', () => {
  const coded = connecte({ alreadyMember: false, canJoin: true, reason: null });
  expect(coded.body.split('\n')).toEqual([
    "Dorian D. t'invite dans son équipe Recette Site 333, pour le tournoi FoundClub x AR Soccer.",
    'Sam. 19 déc. à 19:00 · AR Soccer',
    '3 joueurs sur 5 · 20 € par joueur',
  ]);
  expect(coded.primary).toBe("Rejoindre l'équipe");
  expect(coded.action).toBe('join');
});

test('🔴 sans compte : le capitaine aussi, en prénom et initiale (jamais plus)', () => {
  const coded = describeCodedTournamentInvite({ isSignedIn: false, preview: apercu(), t });
  expect(coded.body.split('\n')[0]).toBe("Dorian D. t'invite dans son équipe Recette Site 333, pour le tournoi FoundClub x AR Soccer.");
});

test('caractérisant : sans capitaine dans l aperçu (serveur d avant), la phrase d avant', () => {
  const coded = describeCodedTournamentInvite({ isSignedIn: true, preview: apercu({ captainName: null }), t });
  expect(coded.body.split('\n')[0]).toBe("Tu es invité·e à rejoindre l'équipe Recette Site 333 pour le tournoi FoundClub x AR Soccer.");
});

test('🔴 le capitaine ouvre son propre lien : « C est ton équipe », envoyer le lien, voir mon équipe', () => {
  const coded = connecte({
    alreadyMember: true, canJoin: true, isCaptain: true, reason: null,
  });
  expect(coded.title).toBe("C'est ton équipe");
  expect(coded.body).toBe('Ce lien sert à inviter tes joueurs. Envoie-le-leur.');
  expect([coded.action, coded.primary]).toEqual(['shareLink', 'Envoyer le lien']);
  expect([coded.secondaryAction, coded.secondary]).toEqual(['openTeam', 'Voir mon équipe']);
});

test('🔴 déjà dans l équipe : « Tu es déjà dans l équipe », « Voir mon équipe » (la place se paie sur sa page)', () => {
  const coded = connecte({ alreadyMember: true, canJoin: true, reason: null });
  expect(coded.title).toBe("Tu es déjà dans l'équipe");
  expect(coded.body).toBe('Ta place se paie sur la page de ton équipe.');
  expect([coded.action, coded.primary]).toEqual(['openTeam', 'Voir mon équipe']);
});

test('🔴 autre équipe du tournoi ou âge : la phrase du serveur, SANS bouton « Rejoindre »', () => {
  const autre = connecte({ alreadyMember: false, canJoin: false, reason: 'Tu joues déjà ce tournoi avec l’équipe Les Rauzeurs.' });
  expect(autre.body).toBe('Tu joues déjà ce tournoi avec l’équipe Les Rauzeurs.');
  expect(autre.primary).toBeNull();
  expect(autre.action).toBe('none');
  const age = connecte({ alreadyMember: false, canJoin: false, reason: 'Ce tournoi est ouvert à partir de 16 ans' });
  expect(age.body).toBe('Ce tournoi est ouvert à partir de 16 ans');
  expect(age.primary).toBeNull();
  expect(age.secondary).toBe('Fermer');
});

test('🔴 sous le texte : le rappel de l âge (16-17 ans : autorisation d un parent) et les conditions', () => {
  const coded = connecte({ alreadyMember: false, canJoin: true, reason: null });
  expect(coded.ageNotice).toBe("À partir de 16 ans. Pour les 16-17 ans, un parent remplit l'autorisation au moment de payer.");
  expect(coded.showTerms).toBe(true);
  const majeur = describeCodedTournamentInvite({ isSignedIn: false, preview: apercu({ minAge: 18 }), t });
  expect(majeur.ageNotice).toBe('À partir de 18 ans.');
  const sansAge = describeCodedTournamentInvite({ isSignedIn: false, preview: apercu({ minAge: null }), t });
  expect(sansAge.ageNotice).toBe('');
});

test('caractérisant : tournoi clos, « Voir le tournoi », sans rappel', () => {
  const coded = describeCodedTournamentInvite({ isSignedIn: true, preview: apercu({ status: 'closed' }), t });
  expect(coded.closed).toBe(true);
  expect(coded.primary).toBe('Voir le tournoi');
  expect(coded.ageNotice).toBe('');
});
