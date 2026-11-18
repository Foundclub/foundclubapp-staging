import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import InvitationsTournoiAccueil from '@/views/home/InvitationsTournoiAccueil';

import { RouteNames } from '@/navigation/routeNames';

import {
  getMyTournamentInvitations,
  respondToTournamentInvitation,
} from '@/services/tournamentTeam/tournamentTeamService';

import { lisibles, pressable } from '@/testSupport/temoinComplexe';

// T-INVITATION-ACCUEIL (18/11/2026, Adel D237 ; constat M1357 de la recette 46) — LA CARTE
// D'INVITATION DE TOURNOI EN HAUT DE L'ACCUEIL. Adel : « avec le nom et le prénom de l'utilisateur,
// le tournoi en question et la demande : Veux-tu rejoindre mon équipe pour ce tournoi ? On peut
// cliquer pour voir le tournoi, et après on peut accepter ou refuser ». Accepter et Refuser passent
// par l'action de la page d'équipe (`respondToTournamentInvitation`) ; le refus du serveur s'écrit
// sur la carte.

const mockNavigate = jest.fn();
let mockFocus = true;
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => mockFocus }));
jest.mock('@/services/tournamentTeam/tournamentTeamService', () => ({
  getMyTournamentInvitations: jest.fn(),
  respondToTournamentInvitation: jest.fn(),
}));
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

beforeEach(() => {
  jest.clearAllMocks();
  mockFocus = true;
  getMyTournamentInvitations.mockResolvedValue([invitation('a')]);
  respondToTournamentInvitation.mockResolvedValue({ documentId: 'tt-a' });
});

describe('T-INVITATION-ACCUEIL — la carte d’invitation de tournoi sur l’accueil', () => {
  it('qui invite, l’équipe, le tournoi, sa date, son lieu, la question, 3 gestes', async () => {
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Invitation en attente',
      `Dorian Durand t’invite à rejoindre son équipe Les Lions pour le tournoi ${TOURNOI}.`,
      'Veux-tu rejoindre son équipe pour ce tournoi ?',
      'Voir le tournoi',
    ]));
    expect(lisibles(arbre).some((texte) => /19 décembre · 19:00 – 23:00$/.test(texte))).toBe(true);
    expect(lisibles(arbre)).toContain('12 avenue du Stade, Montpellier');
    expect(pressable(arbre, 'Accepter')).toBeTruthy();
    expect(pressable(arbre, 'Refuser')).toBeTruthy();
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

  it('« Accepter » : l’action de l’équipe, la carte s’en va, la page d’équipe', async () => {
    const arbre = await monter();
    getMyTournamentInvitations.mockResolvedValue([]);
    await act(async () => { pressable(arbre, 'Accepter').props.onPress(); });
    await vidanger();
    expect(respondToTournamentInvitation).toHaveBeenCalledWith('tt-a', 'accepted');
    expect(arbre.toJSON()).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.EventStack, {
      params: { eventId: 'evt-a', teamId: 'tt-a' },
      screen: RouteNames.TournamentTeamDetails,
    });
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
    expect(lisibles(arbre)).toContain('Invitation en attente');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('répondue ailleurs (page d’équipe) : au retour sur l’accueil, la carte s’en va', async () => {
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Invitation en attente');
    mockFocus = false; // l'accueil part sous la page d'équipe, où l'invité répond
    await arbre.redessiner();
    getMyTournamentInvitations.mockResolvedValue([]);
    mockFocus = true; // retour sur l'accueil
    await arbre.redessiner();
    expect(getMyTournamentInvitations).toHaveBeenCalledTimes(2);
    expect(arbre.toJSON()).toBeNull();
  });

  it('sans nom d’invitant : « Un joueur t’invite… »', async () => {
    getMyTournamentInvitations.mockResolvedValue([invitation('a', { invitedBy: null })]);
    const arbre = await monter();
    expect(lisibles(arbre)).toContain(
      `Un joueur t’invite à rejoindre son équipe Les Lions pour le tournoi ${TOURNOI}.`,
    );
  });
});
