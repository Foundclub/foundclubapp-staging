/* eslint-disable max-len -- les témoins se lisent en entier. */
import renderer, { act } from 'react-test-renderer';
import { Share, Text } from 'react-native';

import { readInviteLink } from '@/domains/invitations/inviteLink';
import { resolveInviteDestination } from '@/domains/invitations/InvitationLinkHost';
import { RouteNames } from '@/navigation/routeNames';

import TournamentInvitationRequest from '../TournamentInvitationRequest';
import TournamentInvites from '../TournamentInvites';
import { getTournamentClosure } from '../tournamentUtils';

// T3-TOURNOI-PRIVE (Adel « 8 A », 02/11) : privé n'est pas clôturé ; la liste d'invités de l'organisateur ;
// le lien qui mène à une demande, jamais au contenu du tournoi.

const mockInviter = jest.fn(() => Promise.resolve({}));
const mockRepondre = jest.fn(() => Promise.resolve({}));
const mockEquipes = jest.fn();
const mockInscrire = jest.fn(() => Promise.resolve({}));
const mockQuery = { audiences: [], apercu: null };
const mockUtilisateur = { value: { trainedTeams: [] } };

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: (/** @type {any} */ variables) => Promise.resolve(options?.mutationFn?.(variables)).then(
      (resultat) => { options?.onSuccess?.(resultat, variables); options?.onSettled?.(); },
      (erreur) => { options?.onError?.(erreur, variables); options?.onSettled?.(); },
    ),
  }),
  useQuery: (/** @type {any} */ options) => ({
    data: options.queryKey[0] === 'tournament-invites' ? { data: mockQuery.audiences } : mockQuery.apercu,
    isLoading: false,
  }),
  useQueryClient: () => ({ invalidateQueries: jest.fn(() => Promise.resolve()) }),
}));
jest.mock('@/services/client', () => ({ __esModule: true, default: {} }));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({ Colors, Fonts: generateFonts(Colors), Spaces: jest.requireActual('@/theme/spaces').default }),
  };
});
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockUtilisateur.value }),
}));
jest.mock('@/services/event/eventService', () => ({
  getEventTeamAudiences: jest.fn(),
  getTournamentInvitationPreview: jest.fn(),
  inviteEventTeamAudience: (/** @type {any[]} */ ...args) => mockInviter(...args),
  respondEventTeamAudience: (/** @type {any[]} */ ...args) => mockRepondre(...args),
}));
jest.mock('@/services/team/teamService', () => ({
  getTeams: (/** @type {any[]} */ ...args) => mockEquipes(...args),
}));
jest.mock('@/services/tournamentTeam/tournamentTeamService', () => ({
  registerClubTeamToTournament: (/** @type {any[]} */ ...args) => mockInscrire(...args),
}));
jest.mock('../wizard/components/EventWizardOpponentInvite', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function RechercheDouble(/** @type {any} */ props) {
    return react.createElement(rn.Pressable, { onPress: () => props.onTeamInvited({ documentId: 'eq-externe' }), testID: 'recherche' });
  };
});
jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ButtonDouble(/** @type {any} */ props) {
    return react.createElement(rn.Pressable, { accessibilityLabel: props.title, onPress: props.onPress });
  };
});

const monter = async (/** @type {any} */ element) => {
  /** @type {any} */
  let arbre;
  await act(async () => { arbre = renderer.create(element); });
  return arbre;
};
const appuyer = async (/** @type {any} */ arbre, /** @type {string} */ titre) => {
  const bouton = arbre.root.findAll((/** @type {any} */ n) => n.props.accessibilityLabel === titre && n.props.onPress)[0];
  await act(async () => { await bouton.props.onPress(); });
};
const texte = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => [n.props.children].flat().join('')).join(' | ');

beforeEach(() => {
  jest.clearAllMocks();
  mockQuery.audiences = [];
  mockQuery.apercu = null;
  mockUtilisateur.value = { trainedTeams: [] };
});

describe('getTournamentClosure : privé n\'est pas clôturé', () => {
  const archivee = { archivedAt: '2026-10-01T10:00:00.000Z', status: 'archived' };
  const vivante = { status: 'accepted' };

  it('🐞 une seule équipe archivée par l\'organisateur ne clôt pas un tournoi privé', () => {
    expect(getTournamentClosure({ sessionStatus: 'closed', tournamentTeams: [archivee, vivante] }).isClosed).toBe(false);
  });
  it('la date du serveur fait foi, même sans équipe', () => {
    const { closedAt, isClosed } = getTournamentClosure({ sessionStatus: 'closed', tournamentConfig: { closedAt: '2026-11-03T10:00:00.000Z' }, tournamentTeams: [] });
    expect(isClosed).toBe(true);
    expect(closedAt).toBe(Date.parse('2026-11-03T10:00:00.000Z'));
  });
  it('un ancien tournoi clôturé, toutes ses équipes archivées, reste clôturé', () => {
    expect(getTournamentClosure({ sessionStatus: 'closed', tournamentTeams: [archivee, archivee] }).isClosed).toBe(true);
  });
  it('un tournoi privé neuf n\'est pas clôturé', () => {
    expect(getTournamentClosure({ sessionStatus: 'closed', tournamentTeams: [] }).isClosed).toBe(false);
  });
});

describe('le lien du tournoi', () => {
  it('🐞 /i/tournament/<id> mène à l\'écran du tournoi, qui montre la demande à un compte sans lien', () => {
    const lu = readInviteLink('https://foundclub.app/i/tournament/tournoi-1');
    expect(lu.ok).toBe(true);
    expect(resolveInviteDestination(lu.invite)).toEqual({ params: { eventId: 'tournoi-1' }, route: RouteNames.TournamentManagement });
  });
});

describe('TournamentInvites', () => {
  it('🐞 « Inviter mon club » invite chaque équipe du club, sauf celles déjà invitées', async () => {
    mockQuery.audiences = [{ documentId: 'a1', status: 'ACCEPTED', team: { documentId: 'eq-1', name: 'U13' } }];
    mockEquipes.mockResolvedValue({ data: [{ documentId: 'eq-1' }, { documentId: 'eq-2' }, { documentId: 'eq-3' }] });
    const arbre = await monter(<TournamentInvites clubId="club-1" eventId="tournoi" />);
    await appuyer(arbre, 'Inviter mon club');
    expect(mockEquipes).toHaveBeenCalledWith(expect.objectContaining({ clubId: 'club-1' }));
    expect(mockInviter.mock.calls).toEqual([
      ['tournoi', { audienceKind: 'internal_invited', teamId: 'eq-2' }],
      ['tournoi', { audienceKind: 'internal_invited', teamId: 'eq-3' }],
    ]);
  });

  it('🐞 une équipe trouvée dans un autre club reçoit une invitation à laquelle elle doit répondre', async () => {
    const arbre = await monter(<TournamentInvites clubId="club-1" eventId="tournoi" />);
    const recherche = arbre.root.findAll((/** @type {any} */ n) => n.props.testID === 'recherche' && n.props.onPress)[0];
    await act(async () => { await recherche.props.onPress(); });
    expect(mockInviter).toHaveBeenCalledWith('tournoi', { audienceKind: 'external_invited', teamId: 'eq-externe' });
    expect(texte(arbre)).toContain('Invitation envoyée');
  });

  it('une invitation en attente se retire ; une équipe inscrite, non ; une invitation refusée ne s\'affiche plus', async () => {
    mockQuery.audiences = [
      { documentId: 'a1', status: 'ACCEPTED', team: { documentId: 'eq-1', name: 'U13' } },
      { documentId: 'a2', status: 'PENDING', team: { documentId: 'eq-2', name: 'Voisins' } },
      { documentId: 'a3', status: 'REFUSED', team: { documentId: 'eq-3', name: 'Absents' } },
    ];
    const arbre = await monter(<TournamentInvites clubId="club-1" eventId="tournoi" />);
    expect(texte(arbre)).toContain('Inscrite');
    expect(texte(arbre)).toContain('Attend sa réponse');
    expect(texte(arbre)).not.toContain('Absents');
    await appuyer(arbre, "Retirer l'invitation");
    expect(mockRepondre).toHaveBeenCalledWith('a2', 'cancel');
  });

  it('🐞 le lien partagé est celui du tournoi', async () => {
    const partage = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    const arbre = await monter(<TournamentInvites clubId="club-1" eventId="tournoi" />);
    await appuyer(arbre, 'Partager le lien');
    expect(partage.mock.calls[0][0].url).toMatch(/\/i\/tournament\/tournoi$/);
  });
});

describe('TournamentInvitationRequest', () => {
  const APERCU = { club: { name: 'AS Organisateur' }, invitationPreview: true, name: 'Tournoi de Noël' };

  it('🐞 il voit le tournoi et demande pour son équipe ; la réponse dit que ça attend', async () => {
    mockQuery.apercu = APERCU;
    mockUtilisateur.value = { trainedTeams: [{ documentId: 'eq-9', name: 'U15 B' }] };
    const arbre = await monter(<TournamentInvitationRequest eventId="tournoi" />);
    expect(texte(arbre)).toContain('Tournoi de Noël');
    await appuyer(arbre, 'Demander pour U15 B');
    expect(mockInscrire).toHaveBeenCalledWith('tournoi', 'eq-9');
    expect(texte(arbre)).toContain('Demande envoyée');
  });

  it('sans équipe encadrée, il comprend pourquoi il n\'a pas de bouton', async () => {
    mockQuery.apercu = APERCU;
    const arbre = await monter(<TournamentInvitationRequest eventId="tournoi" />);
    expect(texte(arbre)).toContain('encadrer une équipe');
  });

  it('un refus du serveur se lit, et rien n\'est annoncé comme envoyé', async () => {
    mockQuery.apercu = APERCU;
    mockUtilisateur.value = { trainedTeams: [{ documentId: 'eq-9', name: 'U15 B' }] };
    mockInscrire.mockRejectedValueOnce(new Error('Cette equipe est deja inscrite a ce tournoi'));
    const arbre = await monter(<TournamentInvitationRequest eventId="tournoi" />);
    await appuyer(arbre, 'Demander pour U15 B');
    expect(texte(arbre)).toContain('deja inscrite');
    expect(texte(arbre)).not.toContain('Demande envoyée');
  });

  it('sans aperçu (ancien serveur, tournoi inconnu) : rien, plutôt qu\'un écran vide qui promet', async () => {
    const arbre = await monter(<TournamentInvitationRequest eventId="tournoi" />);
    expect(arbre.toJSON()).toBeNull();
  });
});
