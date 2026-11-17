/* eslint-disable max-len -- les témoins se lisent en entier. */
import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

import TournamentTeamDetails from '../TournamentTeamDetails';

// T-PAGES-2 (17/11/2026) — TÉMOIN CARACTÉRISANT de la fiche d'équipe de tournoi (TournamentTeamDetails),
// posé AVANT la refonte de sa mise en page. Il est vert sur le code d'avant la refonte : chaque action de
// l'écran (capitaine, joueur, invité, visiteur, parent) et son EFFET (service appelé et ses arguments, ou
// navigation). Après la refonte, les actions doivent toujours exister et produire le même effet ; seule la
// façon de les atteindre peut changer (menu « trois points » par ligne de joueur, « Capitaine » devenu
// « Nommer capitaine »).
//
// À ADAPTER APRÈS LA REFONTE : les utilitaires `appuyer` / `appuyerDansLigne` / `ligne` ci-dessous (par
// exemple ouvrir le menu de la ligne avant d'appuyer, ajouter un libellé accepté), JAMAIS les assertions.
// Point à vérifier en adaptant `ligne` : elle remonte du nom jusqu'au premier ancêtre qui porte un bouton ;
// si la carte d'un membre n'a plus de bouton visible (menu fermé), elle déborde sur un ancêtre plus large
// et pourrait appuyer sur le bouton d'un voisin.
//
// Non caractérisé (les `onSuccess` ne sont pas joués) : la navigation vers le tournoi après « Quitter »,
// la fermeture de la fenêtre de demande, le champ de recherche vidé après une invitation.
//
// Différence avec T-PAIE : `useMutation` n'est pas un `mutate: jest.fn()` muet ; il appelle la vraie
// `mutationFn` de l'écran, et les services du tournoi sont des doublures qui notent leurs arguments.
// Les `onSuccess` / `onError` ne sont pas appelés.

const mockCandidats = [{ documentId: 'u-cand', firstname: 'Candidat' }];

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ opts) => ({
    isPending: false,
    mutate: (/** @type {any} */ v) => opts.mutationFn(v),
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
  const openUrlInPlace = jest.fn(async () => true);
  return {
    __esModule: true, default: { openUrl, openUrlInPlace }, openUrl, openUrlInPlace,
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
const ALIAS = { Retirer: ['Retirer de l’équipe'] };
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
  const [bouton] = boutonsDe(racineDe(cible), libelles);
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
  const [etiquette] = arbre.root.findAll((/** @type {any} */ n) => n.type === 'Text' && n.props?.children === nom);
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

describe('T-PAGES-2 — capitaine : les actions sur les lignes de joueurs', () => {
  test('1. « Nommer capitaine » sur mb-2 transfère le capitanat, après confirmation', async () => {
    const arbre = await monter(equipe(), 'u-cap');
    await appuyerDansLigne(arbre, 'Deux', ['Capitaine', 'Nommer capitaine']);
    expect(services.transferTournamentTeamCaptain).not.toHaveBeenCalled();
    await confirmer();
    expect(services.transferTournamentTeamCaptain).toHaveBeenCalledWith('tt-1', 'mb-2');
  });

  test('2. « Retirer » mb-2 le retire de l’équipe, après confirmation', async () => {
    const arbre = await monter(equipe(), 'u-cap');
    await appuyerDansLigne(arbre, 'Deux', ['Retirer']);
    expect(services.removeTournamentTeamMember).not.toHaveBeenCalled();
    await confirmer();
    expect(services.removeTournamentTeamMember).toHaveBeenCalledWith('tt-1', 'mb-2');
  });

  test('2 bis. la ligne du capitaine lui-même n’a ni « Capitaine » ni « Retirer » : un seul de chaque (mb-2)', async () => {
    const arbre = await monter(equipe(), 'u-cap');
    expect(combien(arbre, ['Capitaine', 'Nommer capitaine'])).toBe(1);
    expect(combien(arbre, ['Retirer'])).toBe(1);
    // La ligne isolée par `ligne` ne déborde pas sur ses voisines.
    expect(combien(ligne(arbre, 'Deux'), ["Annuler l'invitation", 'Accepter', 'Voir le profil'])).toBe(0);
    expect(combien(ligne(arbre, 'Quatre'), ['Retirer', 'Capitaine', 'Nommer capitaine'])).toBe(0);
  });

  test('3. « Annuler l’invitation » de mb-3 retire l’invité, après confirmation', async () => {
    const arbre = await monter(equipe(), 'u-cap');
    await appuyerDansLigne(arbre, 'Trois', ["Annuler l'invitation"]);
    expect(services.removeTournamentTeamMember).not.toHaveBeenCalled();
    await confirmer();
    expect(services.removeTournamentTeamMember).toHaveBeenCalledWith('tt-1', 'mb-3');
  });

  test('4. demande mb-4 : « Accepter » puis « Refuser », chacun après confirmation', async () => {
    const arbre = await monter(equipe(), 'u-cap');
    await appuyerDansLigne(arbre, 'Quatre', ['Accepter']);
    expect(services.reviewTournamentJoinRequest).not.toHaveBeenCalled();
    await confirmer();
    expect(services.reviewTournamentJoinRequest).toHaveBeenCalledWith('tt-1', 'mb-4', 'accepted');
    await appuyerDansLigne(arbre, 'Quatre', ['Refuser']);
    await confirmer();
    expect(services.reviewTournamentJoinRequest).toHaveBeenLastCalledWith('tt-1', 'mb-4', 'declined');
  });

  test('5. demande mb-4 : « Voir le profil » ouvre le profil du demandeur', async () => {
    const arbre = await monter(equipe(), 'u-cap');
    await appuyerDansLigne(arbre, 'Quatre', ['Voir le profil']);
    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.ProfileStack, { params: { userId: 'u-4' }, screen: RouteNames.UserDetails });
  });

  test('5 bis. demande mb-4 : « Écrire » crée le fil direct puis l’ouvre', async () => {
    const arbre = await monter(equipe(), 'u-cap');
    await appuyerDansLigne(arbre, 'Quatre', ['Écrire']);
    expect(chat.createWhisperChat).toHaveBeenCalledWith(['u-4']);
    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.Conversation, { chatId: 'chat-1' });
  });

  test('5 ter. sans `viewerCanWrite` : pas de « Écrire », « Voir le profil » reste', async () => {
    const arbre = await monter(equipe({}, {}), 'u-cap');
    expect(combien(arbre, ['Écrire'])).toBe(0);
    expect(combien(arbre, ['Voir le profil'])).toBe(1);
  });
});

describe('T-PAGES-2 — capitaine : les actions de l’équipe', () => {
  test('6. « Ouvrir les demandes » (fermées) ouvre ; « Fermer les demandes » (ouvertes) ferme', async () => {
    const fermee = await monter(equipe({ isOpenToJoinRequests: false }), 'u-cap');
    await appuyer(fermee, ['Ouvrir les demandes']);
    expect(services.toggleTournamentTeamOpenRequests).toHaveBeenCalledWith('tt-1', true);
    const ouverte = await monter(equipe({ isOpenToJoinRequests: true }), 'u-cap');
    await appuyer(ouverte, ['Fermer les demandes']);
    expect(services.toggleTournamentTeamOpenRequests).toHaveBeenLastCalledWith('tt-1', false);
  });

  test('7. « Partager le lien » prépare le lien de l’équipe, et l’écran dit qu’il est copié', async () => {
    const arbre = await monter(equipe(), 'u-cap');
    await appuyer(arbre, ['Partager le lien']);
    expect(partageLien.shareTournamentTeamInviteLink).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'evt-1', teamId: 'tt-1' }));
    expect(texte(arbre)).toContain('Lien copié');
  });

  test('8. « Inviter » ouvre la recherche ; 2 lettres ; « Inviter » sur le candidat l’invite', async () => {
    const arbre = await monter(equipe(), 'u-cap');
    await appuyer(arbre, ['Inviter']);
    const [champ] = arbre.root.findAll((/** @type {any} */ n) => typeof n.props?.onChangeText === 'function');
    expect(champ).toBeTruthy();
    await act(async () => { champ.props.onChangeText('Ca'); });
    // Deux « Inviter » possibles (la carte, le candidat) : on vise celui de la ligne du candidat.
    await appuyerDansLigne(arbre, 'Candidat', ['Inviter']);
    expect(services.inviteTournamentTeamMember).toHaveBeenCalledWith('tt-1', 'u-cand');
  });

  test('9. paiement : « Copier le lien de paiement » copie le lien de la place de mb-2', async () => {
    const arbre = await monter(equipe(paiement(false)), 'u-cap');
    await appuyerDansLigne(arbre, 'Deux', ['Copier le lien de paiement']);
    expect(partage.default.copier).toHaveBeenCalledWith(LIEN_2);
  });
});

describe('T-PAGES-2 — joueur non capitaine (u-2)', () => {
  test('10. « Présent » puis « Absent » envoient sa réponse', async () => {
    const arbre = await monter(equipe(), 'u-2');
    await appuyer(arbre, ['Présent']);
    expect(services.respondToTournamentTeam).toHaveBeenCalledWith('tt-1', 'present');
    await appuyer(arbre, ['Absent']);
    expect(services.respondToTournamentTeam).toHaveBeenLastCalledWith('tt-1', 'absent');
  });

  test('11. « Quitter l’équipe » le retire, après confirmation', async () => {
    const arbre = await monter(equipe(), 'u-2');
    await appuyer(arbre, ["Quitter l'équipe"]);
    expect(services.leaveTournamentTeam).not.toHaveBeenCalled();
    await confirmer();
    expect(services.leaveTournamentTeam).toHaveBeenCalledWith('tt-1');
  });

  test('11 bis. le joueur ne voit aucune action de capitaine', async () => {
    const arbre = await monter(equipe(), 'u-2');
    expect(combien(arbre, ['Capitaine', 'Nommer capitaine', 'Retirer', "Annuler l'invitation", 'Inviter', 'Partager le lien', 'Voir le profil', 'Écrire', 'Ouvrir les demandes', 'Fermer les demandes'])).toBe(0);
  });

  test('12. « Payer ma place » ouvre SON lien de paiement', async () => {
    const arbre = await monter(equipe(paiement(true)), 'u-2');
    await appuyer(arbre, ['Payer ma place']);
    // L'ouverture peut passer par `openUrl` ou `openUrlInPlace` : un seul appel, avec SON lien.
    const appels = [...liens.default.openUrl.mock.calls, ...liens.default.openUrlInPlace.mock.calls];
    expect(appels.some((/** @type {any[]} */ a) => a[0] === LIEN_2)).toBe(true);
  });
});

describe('T-PAGES-2 — invité (u-3)', () => {
  test('13. « Accepter » puis « Refuser » répondent à l’invitation', async () => {
    const arbre = await monter(equipe(), 'u-3');
    await appuyer(arbre, ['Accepter']);
    expect(services.respondToTournamentInvitation).toHaveBeenCalledWith('tt-1', 'accepted');
    await appuyer(arbre, ['Refuser']);
    expect(services.respondToTournamentInvitation).toHaveBeenLastCalledWith('tt-1', 'declined');
  });
});

describe('T-PAGES-2 — visiteur et parent', () => {
  test('14. visiteur adulte, équipe ouverte : « Demander à rejoindre » puis « Envoyer ma demande »', async () => {
    const arbre = await monter(equipe({ isOpenToJoinRequests: true }), 'u-9');
    expect(combien(arbre, ['Envoyer ma demande'])).toBe(0);
    await appuyer(arbre, ['Demander à rejoindre']);
    await appuyer(arbre, ['Envoyer ma demande']);
    expect(services.requestJoinTournamentTeam).toHaveBeenCalledWith('tt-1', { acceptRiskDeclaration: true });
  });

  test('15. visiteur, équipe fermée : « Demandes fermées », aucun « Demander à rejoindre »', async () => {
    const arbre = await monter(equipe({ isOpenToJoinRequests: false }), 'u-9');
    expect(texte(arbre)).toContain('Demandes fermées');
    expect(combien(arbre, ['Demander à rejoindre'])).toBe(0);
  });

  test('20. compte Parent, équipe ouverte : pas de « Demander à rejoindre »', async () => {
    const arbre = await monter(equipe({ isOpenToJoinRequests: true }), 'u-9', 'parent');
    expect(combien(arbre, ['Demander à rejoindre'])).toBe(0);
  });
});

describe('T-PAGES-2 — les états de l’équipe', () => {
  test('16. équipe archivée : « Équipe archivée », plus aucune action de capitaine', async () => {
    const arbre = await monter(equipe({ status: 'archived' }), 'u-cap');
    expect(texte(arbre)).toContain('Équipe archivée');
    expect(combien(arbre, ['Retirer', 'Capitaine', 'Nommer capitaine', 'Inviter', 'Partager le lien', "Annuler l'invitation"])).toBe(0);
  });

  test('16 bis. tournoi clôturé : « Tournoi clôturé », plus aucune action de capitaine', async () => {
    const arbre = await monter(equipe({ event: { ...equipe().event, sessionStatus: 'closed' } }), 'u-cap');
    expect(texte(arbre)).toContain('Tournoi clôturé');
    expect(combien(arbre, ['Retirer', 'Capitaine', 'Nommer capitaine', 'Inviter', 'Partager le lien', "Annuler l'invitation"])).toBe(0);
  });

  test('17. effectif maximum dépassé (max 2, 3 actifs) : l’avertissement est affiché', async () => {
    const team = equipe({ event: { ...equipe().event, tournamentConfig: { maxRosterSize: 2 } } });
    team.members.push({
      documentId: 'mb-5', origin: 'invited', responseStatus: 'pending', role: 'member', user: { documentId: 'u-5', firstname: 'Cinq' },
    });
    const arbre = await monter(team, 'u-cap');
    expect(texte(arbre)).toContain('Effectif maximum dépassé');
  });

  test('18. discussion de l’équipe : le bouton ouvre la conversation', async () => {
    // Le serveur (team-chat.js) rend `chat` comme un identifiant (chaîne), voir T-FIL-EQUIPE.discussion.
    const arbre = await monter(equipe({ discussion: { chat: 'chat-eq', ecriture: true } }), 'u-cap');
    await appuyer(arbre, ["Discussion de l'équipe"]);
    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.Conversation, { chatId: 'chat-eq' });
  });

  test('19. retour au tournoi : navigue vers la fiche du tournoi', async () => {
    const arbre = await monter(equipe(), 'u-cap');
    await appuyer(arbre, ['Revenir au tournoi', 'Retour au tournoi', 'Retour']);
    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.EventDetails, { eventId: 'evt-1' });
  });
});
