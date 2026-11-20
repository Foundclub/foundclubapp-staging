/* eslint-disable max-len -- les témoins se lisent en entier. */
/* eslint-disable no-unused-vars -- harnais copié tel quel de T-PAGES-2.caracterisation (doublures et utilitaires gardés entiers). */
import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

import TournamentTeamDetails from '../TournamentTeamDetails';

// RETOUCHES-R50 (20/11/2026, file RETOUCHES-RECETTE-50 ; testeur 20/11 12:50) — un REFUS ATTENDU du
// serveur (erreur de validation 400 : « Ce tournoi est ouvert à partir de 16 ans » quand le capitaine
// invite un joueur trop jeune) s'intitulait « Erreur ». Il s'intitule « Pas possible » ; sa phrase reste
// celle du serveur. Une vraie panne (500, réseau) garde « Erreur ».
// Harnais : celui de T-PAGES-2.caracterisation, mais `useMutation` JOUE `onError` quand le service rejette.

const mockCandidats = [{ documentId: 'u-cand', firstname: 'Candidat' }];

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ opts) => ({
    isPending: false,
    mutate: (/** @type {any} */ v) => Promise.resolve().then(() => opts.mutationFn(v)).then(
      (/** @type {any} */ r) => opts.onSuccess?.(r, v),
      (/** @type {any} */ e) => opts.onError?.(e, v),
    ),
    mutateAsync: async (/** @type {any} */ v) => opts.mutationFn(v),
  }),
  useQuery: (/** @type {any} */ opts) => {
    const cle = Array.isArray(opts?.queryKey) ? opts.queryKey[0] : '';
    if (cle === 'tournament-team-users') return { data: mockCandidats, isFetching: false };
    // Une future version de l'écran pourrait relire le tournoi : rien ne doit casser.
    // ADAPTÉ À LA REFONTE (F22) : la page lit les équipes du tournoi avant de proposer « Demander à
    // rejoindre » ; ici, un tournoi où le lecteur n'a aucune équipe.
    if (cle === 'event') return { data: { documentId: 'evt-1', tournamentTeams: [] }, isFetching: false };
    return { data: [], isFetching: false };
  },
  useQueryClient: () => ({ invalidateQueries: jest.fn(() => Promise.resolve()) }),
}));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});
jest.mock('@/domains/auth/useAuth', () => ({ __esModule: true, default: () => mockAuth }));
jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ButtonDouble(/** @type {any} */ props) {
    return react.createElement(rn.TouchableOpacity, {
      accessibilityLabel: props.title, disabled: props.disabled, onPress: props.onPress, testID: props.testID,
    }, react.createElement(rn.Text, null, props.title || ''));
  };
});
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => () => null);
// La fenêtre de demande : un seul bouton « Envoyer ma demande » quand elle est ouverte.
jest.mock('@/components/organisms/joinEventModal/JoinEventModal', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function JoinEventModalDouble(/** @type {any} */ props) {
    if (!props.isVisible) return null;
    return react.createElement(rn.TouchableOpacity, {
      accessibilityLabel: 'Envoyer ma demande', onPress: () => props.onConfirm({ acceptRiskDeclaration: true }),
    }, react.createElement(rn.Text, null, 'Envoyer ma demande'));
  };
});
jest.mock('@/components/molecules/bottomModal/BottomModal', () => (/** @type {any} */ props) => (props.isVisible || props.visible ? props.children : null));
jest.mock('@/views/chat/useOuvrirLAssistance', () => ({
  __esModule: true,
  default: () => ({ enCours: false, erreur: false, ouvrir: jest.fn() }),
}));
jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => (/** @type {any} */ { children }) => children);
jest.mock('@/components/templates/ScreenContainer', () => (/** @type {any} */ { children }) => children);
jest.mock('@/services/tournamentTeam/tournamentTeamQueries', () => ({
  useGetTournamentTeam: () => ({
    data: mockTeam, error: null, isLoading: false, refetch: jest.fn(),
  }),
}));
jest.mock('@/services/tournamentTeam/tournamentTeamService', () => ({
  inviteTournamentTeamMember: jest.fn(async () => ({})),
  leaveTournamentTeam: jest.fn(async () => ({})),
  removeTournamentTeamMember: jest.fn(async () => ({})),
  requestJoinTournamentTeam: jest.fn(async () => ({})),
  respondToTournamentInvitation: jest.fn(async () => ({})),
  respondToTournamentTeam: jest.fn(async () => ({})),
  reviewTournamentJoinRequest: jest.fn(async () => ({})),
  toggleTournamentTeamOpenRequests: jest.fn(async () => ({})),
  transferTournamentTeamCaptain: jest.fn(async () => ({})),
}));
jest.mock('@/services/teamInvite/teamInviteShare', () => ({
  shareTournamentTeamInviteLink: jest.fn(async () => ({ envoi: 'copie', url: 'https://x' })),
}));
jest.mock('@/services/chat/chatService', () => ({
  createWhisperChat: jest.fn(async () => ({ documentId: 'chat-1' })),
}));
jest.mock('@/services/user/userService', () => ({
  searchScopedUsers: jest.fn(async () => []),
  searchUsers: jest.fn(async () => []),
}));
jest.mock('@/platform/share', () => {
  const copier = jest.fn(async () => true);
  return { __esModule: true, copier, default: { copier } };
});
jest.mock('@/platform/links', () => {
  const openUrl = jest.fn(async () => true);
  const openUrlHere = jest.fn(async () => true);
  return {
    __esModule: true, default: { openUrl, openUrlHere }, openUrl, openUrlHere,
  };
});

/** @type {any} */
let mockTeam = null;
/** @type {any} */
let mockAuth = {};

/** @type {any} */
const services = jest.requireMock('@/services/tournamentTeam/tournamentTeamService');
/** @type {any} */
const partageLien = jest.requireMock('@/services/teamInvite/teamInviteShare');
/** @type {any} */
const chat = jest.requireMock('@/services/chat/chatService');
/** @type {any} */
const partage = jest.requireMock('@/platform/share');
/** @type {any} */
const liens = jest.requireMock('@/platform/links');

const LIEN_2 = 'https://foundclub.app/licenses/pay/jeton-joueur-2';

// ---------------------------------------------------------------------------------------------
// UTILITAIRES À ADAPTER APRÈS LA REFONTE (pas les assertions).
// ---------------------------------------------------------------------------------------------

/**
 * Les boutons (doublure de Button) dont le libellé est dans `libelles`, sans doublon.
 * @param {any} racine - Un nœud de l'arbre de test.
 * @param {string[]} libelles - Les libellés acceptés.
 * @returns {any[]} Les boutons, dans l'ordre de l'écran.
 */
// ADAPTÉ À LA REFONTE : le libellé du menu « Retirer de l’équipe » vaut « Retirer ».
/** @type {Record<string, string[]>} */
// ADAPTÉ À IMPL-2-EQUIPE (18/11, planches 3, 9g, 10) : « Annuler » dans la place de l'invité,
// l'interrupteur « Ouverte aux demandes », « Partager le lien d’invitation » et « Chercher un joueur »
// de « À faire maintenant » (la recherche est dans la fenêtre « Inviter un joueur »), « Quitter l’équipe »,
// « Payer ma place (20 €) ».
const ALIAS = {
  "Annuler l'invitation": ['Annuler'],
  'Fermer les demandes': ['Ouverte aux demandes'],
  Inviter: ['Chercher un joueur'],
  'Ouvrir les demandes': ['Ouverte aux demandes'],
  'Partager le lien': ['Partager le lien d’invitation'],
  'Payer ma place': ['Payer ma place (20 €)'],
  "Quitter l'équipe": ['Quitter l’équipe'],
  Retirer: ['Retirer de l’équipe'],
};
const avecAlias = (/** @type {string[]} */ libelles) => libelles.flatMap((l) => [l, ...(ALIAS[l] || [])]);
const boutonsDe = (racine, libelles) => racine.findAll(
  (/** @type {any} */ n) => avecAlias(libelles).includes(n.props?.accessibilityLabel) && typeof n.props?.onPress === 'function' && n.type !== 'View',
).filter((/** @type {any} */ n, /** @type {number} */ i, /** @type {any[]} */ all) => all.findIndex((m) => m.props.onPress === n.props.onPress) === i);

/**
 * Le nœud où chercher.
 * @param {any} cible - Un arbre monté ou un nœud.
 * @returns {any} Le nœud racine.
 */
const racineDe = (cible) => cible?.root || cible;

/**
 * ADAPTÉ À LA REFONTE : les menus « trois points » des lignes (« Actions pour … »).
 * @param {any} racine - Un nœud de l'arbre.
 * @returns {any[]} Les boutons de menu.
 */
const menusDe = (racine) => racine.findAll(
  (/** @type {any} */ n) => String(n.props?.accessibilityLabel || '').startsWith('Actions pour ') && typeof n.props?.onPress === 'function' && n.type !== 'View',
).filter((/** @type {any} */ n, /** @type {number} */ i, /** @type {any[]} */ all) => all.findIndex((m) => m.props.onPress === n.props.onPress) === i);

/**
 * Appuie sur le PREMIER bouton dont le libellé est dans `libelles`.
 * Après la refonte : ouvrir ici le menu « trois points » si le bouton est derrière.
 * @param {any} cible - Un arbre monté, ou une ligne rendue par `ligne`.
 * @param {string[]} libelles - Les libellés acceptés.
 */
const appuyer = async (cible, libelles) => {
  let [bouton] = boutonsDe(racineDe(cible), libelles);
  // ADAPTÉ À IMPL-2-EQUIPE (3b) : sans « À faire maintenant », la recherche et le lien sont dans la
  // fenêtre « Inviter un joueur » : on l'ouvre, puis on y prend le geste.
  /** @type {Record<string, string>} */
  const dansLaFenetre = { Inviter: 'Chercher un joueur FoundClub', 'Partager le lien': 'Copier le lien' };
  const etape = libelles.map((l) => dansLaFenetre[l]).find(Boolean);
  if (!bouton && etape) {
    const [ouvrir] = boutonsDe(racineDe(cible), ['Inviter un joueur']);
    if (ouvrir) {
      await act(async () => { await ouvrir.props.onPress(); });
      [bouton] = boutonsDe(racineDe(cible), [etape]);
    }
  }
  if (!bouton) throw new Error(`Aucun bouton parmi : ${libelles.join(' / ')}`);
  await act(async () => { await bouton.props.onPress(); });
};

/**
 * La ligne d'un membre : le plus proche ancêtre du nom qui contient au moins un bouton.
 * @param {any} arbre - L'arbre monté.
 * @param {string} nom - Le prénom affiché du membre.
 * @returns {any} Le nœud de la ligne.
 */
const ligne = (arbre, nom) => {
  // ADAPTÉ À IMPL-2-EQUIPE (3a) : l'invité s'affiche « Invité : <nom> » dans sa place.
  const [etiquette] = arbre.root.findAll((/** @type {any} */ n) => n.type === 'Text' && [`Invité : ${nom}`, nom].includes(n.props?.children));
  if (!etiquette) throw new Error(`Aucune ligne pour ${nom}`);
  const aUnBouton = (/** @type {any} */ n) => n.findAll((/** @type {any} */ m) => typeof m.props?.accessibilityLabel === 'string' && typeof m.props?.onPress === 'function').length > 0;
  // ADAPTÉ À LA REFONTE : la carte d'un membre porte `tournament-member-row-<id>` ; on la prend
  // entière (sinon on s'arrêterait à la rangée du nom, qui ne porte que le menu).
  let carte = etiquette;
  while (carte && !String(carte.props?.testID || '').startsWith('tournament-member-row-')) carte = carte.parent;
  if (carte) return carte;
  let noeud = etiquette;
  while (noeud && !aUnBouton(noeud)) noeud = noeud.parent;
  if (!noeud) throw new Error(`Aucun bouton sur la ligne de ${nom}`);
  return noeud;
};

/**
 * Appuie sur un bouton de la ligne du membre `nom`.
 * @param {any} arbre - L'arbre monté.
 * @param {string} nom - Le prénom affiché du membre.
 * @param {string[]} libelles - Les libellés acceptés.
 * @returns {Promise<void>} Fini quand l'appui est joué.
 */
const appuyerDansLigne = async (arbre, nom, libelles) => {
  // ADAPTÉ À LA REFONTE : l'action peut être rangée dans le menu de la ligne ; on l'ouvre d'abord.
  if (!boutonsDe(ligne(arbre, nom), libelles).length) {
    const [menu] = menusDe(ligne(arbre, nom));
    if (menu) await act(async () => { await menu.props.onPress(); });
  }
  return appuyer(ligne(arbre, nom), libelles);
};

/**
 * Combien de boutons portent l'un des libellés.
 * @param {any} cible - Un arbre ou un nœud.
 * @param {string[]} libelles - Les libellés acceptés.
 * @returns {number} Le nombre de boutons.
 */
const combien = (cible, libelles) => {
  // ADAPTÉ À LA REFONTE : compte aussi ce que chaque menu de ligne ouvre (un menu à la fois).
  const racine = racineDe(cible);
  const fermes = boutonsDe(racine, libelles).length;
  let enPlus = 0;
  menusDe(racine).map((/** @type {any} */ m) => m.props.accessibilityLabel).forEach((/** @type {string} */ nom) => {
    const trouver = () => menusDe(racine).find((/** @type {any} */ m) => m.props.accessibilityLabel === nom);
    act(() => { trouver().props.onPress(); });
    enPlus += boutonsDe(racine, libelles).length - fermes;
    act(() => { trouver().props.onPress(); });
  });
  return fermes + enPlus;
};

const texte = (/** @type {any} */ arbre) => JSON.stringify(arbre.toJSON());

/** @type {any} */
let alerte = null;
/** Appuie sur le bouton de confirmation (celui qui n'est pas « cancel ») de la dernière alerte. */
const confirmer = async () => {
  const appel = alerte.mock.calls[alerte.mock.calls.length - 1];
  const bouton = (appel?.[2] || []).find((/** @type {any} */ b) => b?.style !== 'cancel');
  if (!bouton) throw new Error('Aucune confirmation demandée');
  await act(async () => { await bouton.onPress(); });
};

// ---------------------------------------------------------------------------------------------
// LES DONNÉES
// ---------------------------------------------------------------------------------------------

/**
 * L'équipe éphémère du capitaine u-cap : lui, un actif, un invité, une demande.
 * @param {any} [extra] - Champs qui remplacent ceux de l'équipe.
 * @param {any} [demandeExtra] - Champs de la demande mb-4.
 * @returns {any} L'équipe.
 */
const equipe = (extra = {}, demandeExtra = { viewerCanWrite: true }) => ({
  adminUsers: [{ documentId: 'u-cap' }],
  archivedAt: null,
  captainUser: { documentId: 'u-cap', firstname: 'Capi' },
  club: { documentId: 'club-1', name: 'AR Soccer' },
  documentId: 'tt-1',
  event: {
    club: { documentId: 'club-1', name: 'AR Soccer' }, documentId: 'evt-1', isActive: true, name: 'FoundClub x AR Soccer', sessionStatus: 'open', tournamentConfig: {},
  },
  isOpenToJoinRequests: false,
  members: [
    {
      documentId: 'mb-1', origin: 'external_addition', responseStatus: 'present', role: 'captain', user: { documentId: 'u-cap', firstname: 'Capi' },
    },
    {
      documentId: 'mb-2', origin: 'invited', responseStatus: 'pending', role: 'member', user: { documentId: 'u-2', firstname: 'Deux' },
    },
    {
      documentId: 'mb-3', origin: 'invited', responseStatus: 'invited', role: 'member', user: { documentId: 'u-3', firstname: 'Trois' },
    },
    {
      documentId: 'mb-4', origin: 'join_request', responseStatus: 'requested', role: 'member', user: { documentId: 'u-4', firstname: 'Quatre' }, ...demandeExtra,
    },
  ],
  name: 'Les Rapides',
  sourceTeam: null,
  sourceType: 'custom_team',
  status: 'pending',
  ...extra,
});

/**
 * Le bloc `payment` d'un tournoi payant (20 €) : mb-1 a payé, mb-2 doit sa place.
 * @param {boolean} mb2EstLeLecteur - Vrai quand le lecteur est mb-2 (sa propre place).
 * @returns {any} Les champs à fusionner dans l'équipe.
 */
const paiement = (mb2EstLeLecteur) => ({
  event: { ...equipe().event, tournamentConfig: { entryFeeCents: 2000 } },
  payment: {
    currency: 'EUR',
    entryFeeCents: 2000,
    members: [
      {
        isSelf: !mb2EstLeLecteur, memberDocumentId: 'mb-1', paymentUrl: null, status: 'paid',
      },
      {
        isSelf: mb2EstLeLecteur, memberDocumentId: 'mb-2', paymentUrl: LIEN_2, status: 'due',
      },
    ],
    paidCount: 1,
    paidMembersToValidate: 5,
  },
});

/** @type {any[]} */
const montes = [];
/** @type {any} */
let navigation = null;
/**
 * Monte la fiche de `team`, lue par `lecteur`.
 * @param {any} team - L'équipe.
 * @param {string} lecteur - Le documentId du lecteur.
 * @param {string} [role] - Le rôle du compte.
 * @returns {Promise<any>} L'arbre monté.
 */
const monter = async (team, lecteur, role = 'player') => {
  mockAuth = { accountRoleKey: role, userData: { documentId: lecteur } };
  mockTeam = team;
  navigation = { goBack: jest.fn(), navigate: jest.fn() };
  /** @type {any} */
  let arbre = null;
  await act(async () => {
    arbre = renderer.create(
      <TournamentTeamDetails navigation={navigation} route={{ params: { eventId: 'evt-1', teamId: 'tt-1' } }} />,
    );
  });
  montes.push(arbre);
  return arbre;
};

jest.setTimeout(30000);

beforeEach(() => {
  alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(async () => {
  const arbres = montes.splice(0);
  await act(async () => { arbres.forEach((arbre) => arbre?.unmount?.()); });
  alerte.mockRestore();
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------------------------
// LES ACTIONS
// ---------------------------------------------------------------------------------------------

const refus = (/** @type {number} */ status, /** @type {string} */ message) => Object.assign(new Error(message), {
  response: { data: { error: { message, status } }, status },
  status,
});

const inviterLeCandidat = async (/** @type {any} */ arbre) => {
  await appuyer(arbre, ['Inviter']);
  const [champ] = arbre.root.findAll((/** @type {any} */ n) => typeof n.props?.onChangeText === 'function');
  await act(async () => { champ.props.onChangeText('Ca'); });
  await appuyerDansLigne(arbre, 'Candidat', ['Inviter']);
  await act(async () => { await new Promise((fin) => { setTimeout(fin, 0); }); });
};

describe('RETOUCHES-R50 : un refus attendu s’intitule « Pas possible »', () => {
  test('🔴 inviter un joueur trop jeune : « Pas possible », avec la phrase du serveur', async () => {
    services.inviteTournamentTeamMember.mockImplementationOnce(async () => { throw refus(400, 'Ce tournoi est ouvert à partir de 16 ans'); });
    const arbre = await monter(equipe(), 'u-cap');
    await inviterLeCandidat(arbre);
    expect(alerte).toHaveBeenCalledWith('Pas possible', 'Ce tournoi est ouvert à partir de 16 ans');
  });

  test('caractérisant : une panne du serveur (500) garde « Erreur »', async () => {
    services.inviteTournamentTeamMember.mockImplementationOnce(async () => { throw refus(500, 'Internal Server Error'); });
    const arbre = await monter(equipe(), 'u-cap');
    await inviterLeCandidat(arbre);
    expect(alerte).toHaveBeenCalledWith('Erreur', expect.any(String));
    expect(alerte).not.toHaveBeenCalledWith('Pas possible', expect.anything());
  });
});
