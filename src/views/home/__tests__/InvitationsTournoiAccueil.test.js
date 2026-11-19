import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StyleSheet } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import InvitationsTournoiAccueil from '@/views/home/InvitationsTournoiAccueil';

import { RouteNames } from '@/navigation/routeNames';

import {
  getMyTournamentInvitations,
  getTournamentTeamById,
  respondToTournamentInvitation,
} from '@/services/tournamentTeam/tournamentTeamService';

import LinksPlatform from '@/platform/links';
import { lisibles, pressable } from '@/testSupport/temoinComplexe';

// T-INVITATION-ACCUEIL (18/11/2026, Adel D237 ; constat M1357 de la recette 46) — LA CARTE
// D'INVITATION DE TOURNOI EN HAUT DE L'ACCUEIL. Adel : « avec le nom et le prénom de l'utilisateur,
// le tournoi en question et la demande : Veux-tu rejoindre mon équipe pour ce tournoi ? On peut
// cliquer pour voir le tournoi, et après on peut accepter ou refuser ». Accepter et Refuser passent
// par l'action de la page d'équipe (`respondToTournamentInvitation`) ; le refus du serveur s'écrit
// sur la carte.

// IMPL-4-ACCUEIL : le premier rendu charge les modules de la carte (4 s seul, plus de 5 s en lot
// avec deux workers) ; au-delà, un dépassement fait tomber les cas suivants en cascade.
jest.setTimeout(20_000);

const mockNavigate = jest.fn();
let mockFocus = true;
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => mockFocus }));
jest.mock('@/services/tournamentTeam/tournamentTeamService', () => ({
  getMyTournamentInvitations: jest.fn(),
  getTournamentTeamById: jest.fn(),
  respondToTournamentInvitation: jest.fn(),
}));
jest.mock('@/platform/links', () => ({ __esModule: true, default: { openUrlHere: jest.fn() } }));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

const TOURNOI = 'FoundClub x AR Soccer';
const DEJA_PRIS = 'Ce joueur fait déjà partie d’une autre équipe de ce tournoi';

const invitation = (cle, extra = {}) => ({
  event: {
    date: '2026-12-19T00:00:00.000Z',
    documentId: `evt-${cle}`,
    endTime: '23:00:00.000',
    location: { address: '12 avenue du Stade, Montpellier', name: 'AR Soccer' },
    locationDetails: null,
    name: TOURNOI,
    startTime: '19:00:00.000',
  },
  invitedBy: { displayName: 'Dorian Durand' },
  memberDocumentId: `mb-${cle}`,
  responseStatus: 'invited',
  team: { documentId: `tt-${cle}`, name: 'Les Lions' },
  ...extra,
});

/**
 * Laisse react-query redescendre jusqu'au rendu.
 * @returns {Promise<void>} Quand la file est vidée.
 */
const vidanger = async () => {
  for (let tour = 0; tour < 6; tour += 1) {
    // eslint-disable-next-line no-await-in-loop -- l'attente est le sujet
    await act(async () => { await new Promise((resoudre) => { setTimeout(resoudre, 0); }); });
  }
};

/**
 * Monte les cartes de l'accueil.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  const ecran = () => (
    <QueryClientProvider client={client}>
      <InvitationsTournoiAccueil navigation={{ navigate: mockNavigate }} />
    </QueryClientProvider>
  );
  /** @type {any} */
  let arbre;
  await act(async () => { arbre = renderer.create(ecran()); });
  await vidanger();
  arbre.redessiner = async () => {
    await act(async () => { arbre.update(ecran()); });
    await vidanger();
  };
  return arbre;
};

// IMPL-4-ACCUEIL (page 2) : la fiche d'équipe, telle que le serveur la rend à l'invité (prix,
// maillot, seuil), puis au membre (son lien de paiement).
const FICHE_INVITE = {
  documentId: 'tt-a',
  event: { tournamentConfig: { entryFeeCents: 2000, jerseySizeRequired: true } },
  payment: { entryFeeCents: 2000, paidCount: 0, paidMembersToValidate: 5 },
};
const FICHE_MEMBRE = {
  ...FICHE_INVITE,
  payment: {
    ...FICHE_INVITE.payment,
    members: [
      {
        isSelf: false, memberDocumentId: 'mb-x', paymentUrl: null, status: 'paid',
      },
      {
        isSelf: true, memberDocumentId: 'mb-a', paymentUrl: 'https://paiement.test/place', status: 'due',
      },
    ],
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFocus = true;
  getMyTournamentInvitations.mockResolvedValue([invitation('a')]);
  getTournamentTeamById.mockResolvedValue(FICHE_INVITE);
  respondToTournamentInvitation.mockResolvedValue({ documentId: 'tt-a' });
});

describe('T-INVITATION-ACCUEIL — la carte d’invitation de tournoi sur l’accueil', () => {
  // IMPL-4-ACCUEIL, page 2 (planche 2a, 18/11) : titre « Invitation au tournoi », le nom de qui
  // invite à part (avec la photo), le tournoi dans un encadré avec le lieu complet et le prix, la
  // question dite par l'invitant (« mon équipe »). Remplace les textes de T-INVITATION-ACCUEIL.
  it('qui invite, l’équipe, le tournoi, sa date, son lieu, son prix, la question', async () => {
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Invitation au tournoi',
      'Dorian Durand',
      't’invite dans son équipe Les Lions',
      TOURNOI,
      'AR Soccer, 12 avenue du Stade, Montpellier',
      '20 € par joueur · maillot offert',
      '« Veux-tu rejoindre mon équipe pour ce tournoi ? »',
      'Voir le tournoi',
    ]));
    expect(lisibles(arbre).some((texte) => /19 décembre · 19:00 – 23:00$/.test(texte))).toBe(true);
    expect(arbre.root.findAllByProps({ testID: 'accueil-invitation-photo' }).length)
      .toBeGreaterThan(0);
    expect(pressable(arbre, 'Accepter').props.variant).toBe('Primary');
    expect(pressable(arbre, 'Refuser').props.variant).toBe('Danger');
  });

  it('IMPL-4 — sans fiche d’équipe lisible, la ligne du prix n’est pas dessinée', async () => {
    getTournamentTeamById.mockRejectedValue(new Error('Forbidden'));
    const arbre = await monter();
    expect(lisibles(arbre).some((texte) => texte.includes('€'))).toBe(false);
    expect(lisibles(arbre)).toContain('Invitation au tournoi');
  });

  it('IMPL-4 — maillot non demandé : le prix seul', async () => {
    getTournamentTeamById.mockResolvedValue({
      ...FICHE_INVITE, event: { tournamentConfig: { entryFeeCents: 2000 } },
    });
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('20 € par joueur');
  });

  it.each(['requested', 'present', 'declined', 'pending'])('rien pour « %s »', async (statut) => {
    getMyTournamentInvitations.mockResolvedValue([invitation('a', { responseStatus: statut })]);
    const arbre = await monter();
    expect(arbre.toJSON()).toBeNull();
  });

  it('une carte par invitation ; rien sans invitation ; rien si la lecture échoue', async () => {
    getMyTournamentInvitations.mockResolvedValue([invitation('a'), invitation('b')]);
    let arbre = await monter();
    const cartes = arbre.root.findAll((n) => typeof n.type === 'string'
      && String(n.props?.testID || '').startsWith('accueil-invitation-tournoi-'));
    expect(cartes).toHaveLength(2);
    getMyTournamentInvitations.mockResolvedValue([]);
    arbre = await monter();
    expect(arbre.toJSON()).toBeNull();
    const refus = Object.assign(new Error('Forbidden'), { status: 403 });
    getMyTournamentInvitations.mockRejectedValue(refus);
    arbre = await monter();
    expect(arbre.toJSON()).toBeNull();
  });

  it('« Voir le tournoi » ouvre la fiche du tournoi (EventDetails)', async () => {
    const arbre = await monter();
    await act(async () => { pressable(arbre, 'Voir le tournoi').props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.EventStack, {
      params: { eventId: 'evt-a' },
      screen: RouteNames.EventDetails,
    });
  });

  // IMPL-4-ACCUEIL, page 2 (planche 2b) : après « Accepter », la carte reste et enchaîne sur le
  // paiement, au lieu d'ouvrir la page d'équipe (T-INVITATION-ACCUEIL).
  it('« Accepter » : l’action, puis « Tu as rejoint » et « Payer ma place »', async () => {
    const arbre = await monter();
    getMyTournamentInvitations.mockResolvedValue([]);
    getTournamentTeamById.mockResolvedValue(FICHE_MEMBRE);
    await act(async () => { pressable(arbre, 'Accepter').props.onPress(); });
    await vidanger();
    expect(respondToTournamentInvitation).toHaveBeenCalledWith('tt-a', 'accepted');
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Tu as rejoint l’équipe Les Lions',
      'Il te reste à payer ta place pour qu’elle compte : 20 €, maillot offert.',
      'L’équipe est validée dès 5 joueurs payés. Dorian est prévenu de ta réponse.',
    ]));
    expect(lisibles(arbre)).not.toContain('Invitation au tournoi');
    await act(async () => { pressable(arbre, 'Payer ma place (20 €)').props.onPress(); });
    expect(LinksPlatform.openUrlHere).toHaveBeenCalledWith('https://paiement.test/place');
    await act(async () => { pressable(arbre, 'Voir l’équipe').props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.EventStack, {
      params: { eventId: 'evt-a', teamId: 'tt-a' },
      screen: RouteNames.TournamentTeamDetails,
    });
  });

  it('IMPL-4 — accepté sans lien de paiement : « Voir l’équipe » seulement', async () => {
    const arbre = await monter();
    getMyTournamentInvitations.mockResolvedValue([]);
    await act(async () => { pressable(arbre, 'Accepter').props.onPress(); });
    await vidanger();
    expect(lisibles(arbre)).toContain('Tu as rejoint l’équipe Les Lions');
    expect(() => pressable(arbre, 'Payer ma place')).toThrow();
    expect(pressable(arbre, 'Voir l’équipe')).toBeTruthy();
  });

  it('IMPL-4 — tournoi gratuit : « Tu as rejoint », sans phrase de paiement', async () => {
    getTournamentTeamById.mockResolvedValue({
      documentId: 'tt-a', event: { tournamentConfig: {} },
    });
    const arbre = await monter();
    getMyTournamentInvitations.mockResolvedValue([]);
    await act(async () => { pressable(arbre, 'Accepter').props.onPress(); });
    await vidanger();
    expect(lisibles(arbre)).toContain('Tu as rejoint l’équipe Les Lions');
    expect(lisibles(arbre).some((texte) => texte.includes('payer'))).toBe(false);
  });

  it('IMPL-4 — « Tu as rejoint » s’en va quand on quitte l’accueil', async () => {
    const arbre = await monter();
    getMyTournamentInvitations.mockResolvedValue([]);
    await act(async () => { pressable(arbre, 'Accepter').props.onPress(); });
    await vidanger();
    expect(lisibles(arbre)).toContain('Tu as rejoint l’équipe Les Lions');
    mockFocus = false;
    await arbre.redessiner();
    mockFocus = true;
    await arbre.redessiner();
    expect(arbre.toJSON()).toBeNull();
  });

  it('« Refuser » appelle la même action, la carte s’en va, on reste sur l’accueil', async () => {
    const arbre = await monter();
    getMyTournamentInvitations.mockResolvedValue([]);
    await act(async () => { pressable(arbre, 'Refuser').props.onPress(); });
    await vidanger();
    expect(respondToTournamentInvitation).toHaveBeenCalledWith('tt-a', 'declined');
    expect(arbre.toJSON()).toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('le refus du serveur (déjà dans une équipe) s’écrit sur la carte, qui reste', async () => {
    respondToTournamentInvitation.mockRejectedValue(new Error(DEJA_PRIS));
    const arbre = await monter();
    await act(async () => { pressable(arbre, 'Accepter').props.onPress(); });
    await vidanger();
    expect(lisibles(arbre)).toContain(DEJA_PRIS);
    expect(lisibles(arbre)).toContain('Invitation au tournoi');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // IMPL-4B-ACCUEIL (planche 2c, 19/11) : l'icône « ! » devant le message d'erreur, à sa couleur ;
  // décorative (le texte garde la région vivante, donc l'annonce au lecteur d'écran).
  it('IMPL-4B — l’erreur de la carte porte l’icône « ! », le texte reste annoncé', async () => {
    respondToTournamentInvitation.mockRejectedValue(new Error(DEJA_PRIS));
    const arbre = await monter();
    expect(arbre.root.findAllByType(GlyphIcon)).toHaveLength(0);
    await act(async () => { pressable(arbre, 'Accepter').props.onPress(); });
    await vidanger();
    const icones = arbre.root.findAllByType(GlyphIcon);
    expect(icones).toHaveLength(1);
    expect(icones[0].props).toMatchObject({ name: 'triangleExclamation', size: 16 });
    const message = arbre.root.findAll((n) => typeof n.type === 'string'
      && n.props?.accessibilityLiveRegion === 'polite');
    expect(message).toHaveLength(1);
    expect(message[0].props.children).toBe(DEJA_PRIS);
    // La même couleur que le texte (le rouge du thème).
    expect(StyleSheet.flatten(message[0].props.style).color).toBe(icones[0].props.color);
  });

  // IMPL-4B-ACCUEIL (planches 2a, 2e, 19/11) : « Il y a 5 min » à droite du titre, quand le
  // serveur rend la date de l'invitation (`createdAt`, lot IMPL-5C, recette 49).
  it('IMPL-4B — avec la date de l’invitation : « Il y a 5 min »', async () => {
    const ilYA5Min = new Date(Date.now() - 5 * 60_000 - 5_000).toISOString();
    getMyTournamentInvitations.mockResolvedValue([invitation('a', { createdAt: ilYA5Min })]);
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Il y a 5 min');
    expect(lisibles(arbre)).toContain('Invitation au tournoi');
  });

  it.each([
    ['absente (serveur de la recette 48)', {}],
    ['nulle', { createdAt: null }],
    ['illisible', { createdAt: 'pas-une-date' }],
  ])('IMPL-4B — date de l’invitation %s : aucun texte de temps', async (_cas, extra) => {
    getMyTournamentInvitations.mockResolvedValue([invitation('a', extra)]);
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Invitation au tournoi');
    expect(lisibles(arbre).some((texte) => /il y a|instant|Invalid/i.test(texte))).toBe(false);
    // Le titre reste seul sur sa ligne : rien de vide à sa droite.
    expect(lisibles(arbre).filter((texte) => texte === '')).toHaveLength(0);
  });

  it('répondue ailleurs (page d’équipe) : au retour sur l’accueil, la carte s’en va', async () => {
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Invitation au tournoi');
    mockFocus = false; // l'accueil part sous la page d'équipe, où l'invité répond
    await arbre.redessiner();
    getMyTournamentInvitations.mockResolvedValue([]);
    mockFocus = true; // retour sur l'accueil
    await arbre.redessiner();
    expect(getMyTournamentInvitations).toHaveBeenCalledTimes(2);
    expect(arbre.toJSON()).toBeNull();
  });

  it('sans nom d’invitant : « Un joueur », t’invite dans son équipe', async () => {
    getMyTournamentInvitations.mockResolvedValue([invitation('a', { invitedBy: null })]);
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Un joueur', 't’invite dans son équipe Les Lions',
    ]));
  });
});
