/* eslint-disable max-len, no-unused-vars -- les témoins se lisent en entier ; harnais repris tel quel du témoin caractérisant. */
import { Alert, ScrollView, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

import TournamentTeamDetails from '../TournamentTeamDetails';

// T-PAGES-2 (17/11/2026) — LES NOUVEAUTÉS DE LA PAGE (rouges avant la refonte, vertes après). Harnais
// repris du témoin caractérisant (T-PAGES-2.caracterisation.test.js), dont le texte d'origine suit.
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
    // IMPL-2C (19/11) : comme react-query, `mutate` ne lève jamais : un refus va à `onError`.
    mutate: (/** @type {any} */ v) => Promise.resolve(opts.mutationFn(v)).catch((/** @type {any} */ e) => {
      if (!opts.onError) throw e;
      opts.onError(e, v);
    }),
    mutateAsync: async (/** @type {any} */ v) => opts.mutationFn(v),
  }),
  useQuery: (/** @type {any} */ opts) => {
    const cle = Array.isArray(opts?.queryKey) ? opts.queryKey[0] : '';
    if (cle === 'tournament-team-users') return { data: mockCandidats, isFetching: false };
    // Une future version de l'écran pourrait relire le tournoi : rien ne doit casser.
    // ADAPTÉ À LA REFONTE (F22) : la page lit les équipes du tournoi avant de proposer « Demander à
    // rejoindre » ; ici, un tournoi où le lecteur n'a aucune équipe.
    if (cle === 'event') return mockEventQuery || { data: mockEvent, isFetching: false };
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
const mockOuvrirAssistance = jest.fn();
jest.mock('@/views/chat/useOuvrirLAssistance', () => ({
  __esModule: true,
  default: () => ({ enCours: false, erreur: false, ouvrir: mockOuvrirAssistance }),
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
// IMPL-2-EQUIPE (M1311) : la conversation « Assistance FoundClub » ouverte avec un message prérempli.
jest.mock('@/services/chat/assistanceService', () => ({
  ouvrirMaConversationAssistance: jest.fn(async () => ({ documentId: 'chat-assistance' })),
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
let mockEvent = { documentId: 'evt-1', tournamentTeams: [] };
/** @type {any} */
let mockEventQuery = null;
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
 * @param {string} [naissance] - La date de naissance du compte.
 * @param {any} [params] - Paramètres de route en plus (T-REGLES-EQUIPE : focusSection).
 * @returns {Promise<any>} L'arbre monté.
 */
const monter = async (team, lecteur, role = 'player', naissance = undefined, params = {}) => {
  mockAuth = { accountRoleKey: role, userData: { birthdate: naissance, documentId: lecteur } };
  mockTeam = team;
  navigation = { goBack: jest.fn(), navigate: jest.fn() };
  /** @type {any} */
  let arbre = null;
  await act(async () => {
    arbre = renderer.create(
      <TournamentTeamDetails navigation={navigation} route={{ params: { eventId: 'evt-1', teamId: 'tt-1', ...params } }} />,
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

/**
 * Une équipe payante (20 €, 5 places à valider, taille demandée), avec le bloc `payment` vu par `lecteur`.
 * @param {'capitaine' | 'joueur'} lecteur - Qui lit.
 * @param {any} [extra] - Champs qui remplacent ceux de l'équipe.
 * @returns {any} L'équipe.
 */
const payante = (lecteur, extra = {}) => {
  const base = equipe();
  const capitaine = lecteur === 'capitaine';
  return {
    ...base,
    event: {
      ...base.event,
      tournamentConfig: {
        entryFeeCents: 2000, jerseySizeRequired: true, maxRosterSize: 8, minRosterSize: 5,
      },
    },
    payment: {
      currency: 'EUR',
      entryFeeCents: 2000,
      members: [
        {
          isSelf: capitaine, memberDocumentId: 'mb-1', paymentUrl: null, status: 'paid', ...(capitaine ? { jerseySize: 'M' } : {}),
        },
        {
          isSelf: !capitaine, jerseySize: null, memberDocumentId: 'mb-2', paymentUrl: LIEN_2, status: 'due',
        },
      ],
      paidCount: 1,
      paidMembersToValidate: 5,
    },
    ...extra,
  };
};
const ordre = (/** @type {any} */ arbre, /** @type {string[]} */ morceaux) => morceaux.map((m) => texte(arbre).indexOf(m));
const tousLesBoutons = (/** @type {any} */ arbre) => arbre.root.findAll(
  (/** @type {any} */ n) => typeof n.props?.accessibilityLabel === 'string' && typeof n.props?.onPress === 'function' && n.type !== 'View',
);

describe('T-PAGES-2 — capitaine (maquette c)', () => {
  // ATTENDUS CHANGÉS PAR IMPL-2-EQUIPE (18/11, planches 3a et 9a ; Adel « plus de “paiements” seul ») :
  // « 1 place payée sur 5 », la phrase qui dit les places libres et ce qui valide l'équipe ;
  // « Trouver 3 joueurs » devient « Il te faut une autre place payée ? », avec le partage du lien.
  test('🔴 « Où en est l’équipe » : « 1 place payée sur 5 », les places libres, la règle ; « À faire maintenant » et le partage du lien', async () => {
    const arbre = await monter(payante('capitaine'), 'u-cap');
    const contenu = texte(arbre);
    expect(contenu).toContain('Où en est l’équipe');
    expect(contenu).toContain('1 place payée sur 5');
    expect(contenu).toContain('3 places sont encore libres.');
    expect(contenu).toContain('L’équipe sera validée quand les 5 premières places seront payées.');
    expect(contenu).toContain('À faire maintenant');
    expect(contenu).toContain('Il te faut une autre place payée ?');
    expect(combien(arbre, ['Partager le lien d’invitation'])).toBe(1);
  });

  // T-SANS-PLAFOND (18/11, Adel D239) : plus de nombre maximum, donc « 2 joueurs », plus « 2 joueurs sur 8 ».
  test('🔴 effectif : « 2 joueurs » (plus de « sur 8 », D239), 3 lignes « Place libre » (jusqu’à 5), plus de « Roster actif »', async () => {
    const arbre = await monter(payante('capitaine'), 'u-cap');
    const contenu = texte(arbre);
    // ATTENDU CHANGÉ PAR IMPL-2-EQUIPE (3a, 4a) : la liste s'appelle « Joueurs ».
    expect(contenu).toContain('Joueurs');
    expect(contenu).toContain('2 joueurs');
    expect(contenu).not.toContain('sur 8');
    expect(contenu).not.toContain('Roster actif');
    expect(arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'tournament-team-free-slot' && typeof n.type === 'string')).toHaveLength(3);
  });

  test('🔴 T-PAGES-5 : « Taille choisie : M », « Taille : au paiement », « Tailles de maillot : 1 choisie sur 2 »', async () => {
    const arbre = await monter(payante('capitaine'), 'u-cap');
    const contenu = texte(arbre);
    expect(contenu).toContain('Taille choisie : M');
    expect(contenu).toContain('Taille : au paiement');
    expect(contenu).toContain('Tailles de maillot : 1 choisie sur 2');
  });

  test('🔴 menu à trois points : « Nommer capitaine » et « Retirer de l’équipe » n’apparaissent qu’après l’avoir ouvert', async () => {
    const arbre = await monter(equipe(), 'u-cap');
    expect(boutonsDe(arbre.root, ['Nommer capitaine', 'Retirer de l’équipe'])).toHaveLength(0);
    const [menu] = menusDe(arbre.root);
    expect(menu?.props?.accessibilityLabel).toBe('Actions pour Deux');
    await act(async () => { await menu.props.onPress(); });
    expect(boutonsDe(arbre.root, ['Nommer capitaine', 'Retirer de l’équipe'])).toHaveLength(2);
  });

  test('🔴 équipe complète et validée : « Équipe validée », plus de « À faire maintenant » ni de « Place libre »', async () => {
    const team = payante('capitaine', { status: 'accepted' });
    team.payment.paidCount = 5;
    const arbre = await monter(team, 'u-cap');
    const contenu = texte(arbre);
    expect(contenu).toContain('Équipe validée');
    expect(contenu).not.toContain('Pas encore validée');
    expect(contenu).not.toContain('À faire maintenant');
    expect(contenu).not.toContain('Il manque');
    expect(arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'tournament-team-free-slot')).toHaveLength(0);
  });

  // T-SANS-PLAFOND (18/11, Adel D239) : pas de nombre maximum ; au-delà du seuil, des remplaçants.
  // ATTENDUS CHANGÉS PAR IMPL-2-EQUIPE (18/11, planches 4b et 4c) : « Équipe validée », « 5 payés sur
  // 5 : ton équipe joue le tournoi… », une seule liste « Joueurs » sans « remplaçant », et
  // « Inviter un joueur » toujours visible.
  test('🔴 D239 : 7 joueurs, 7 payés, plafond 8 en base : « Équipe validée », « 7 joueurs · 7 payés », pas de remplaçant, toujours « Inviter un joueur »', async () => {
    const team = payante('capitaine', { status: 'accepted' });
    const enPlus = [5, 6, 7, 8, 9].map((n) => ({
      documentId: `mb-${n}`, origin: 'invited', responseStatus: 'pending', role: 'member', user: { documentId: `u-${n}`, firstname: `Joueur${n}` },
    }));
    team.members = [...team.members, ...enPlus];
    team.payment.paidCount = 7;
    const arbre = await monter(team, 'u-cap');
    const contenu = texte(arbre);
    expect(contenu).toContain('Équipe validée');
    expect(contenu).toContain('5 payés sur 5 : ton équipe joue le tournoi. Tu peux encore ajouter des joueurs.');
    expect(contenu).not.toContain('7 places payées sur 5');
    expect(contenu).toContain('7 joueurs · 7 payés');
    expect(contenu).not.toContain('remplaçant');
    expect(contenu).not.toContain('Équipe complète');
    expect(combien(arbre, ['Inviter un joueur'])).toBe(1);
  });

  test('🔴 retour au tournoi EN HAUT : c’est le premier bouton de la page', async () => {
    const arbre = await monter(equipe(), 'u-cap');
    expect(tousLesBoutons(arbre)[0].props.accessibilityLabel).toBe('Retour au tournoi');
  });
});

describe('T-PAGES-2 — joueur qui n’est pas capitaine (R6, R8)', () => {
  // ATTENDU CHANGÉ PAR IMPL-2-EQUIPE (18/11, planche 9a, validée après R6) : « Où en est l’équipe »
  // d'abord, puis « Ta place n’est pas encore payée » et « Payer ma place (20 €) » ; un seul bouton.
  test('🔴 9a : « Où en est l’équipe », puis « Payer ma place (20 €) », avec le prix ; un seul « Payer ma place »', async () => {
    const arbre = await monter(payante('joueur'), 'u-2');
    const [payer, etat] = ordre(arbre, ['Payer ma place (20 €)', 'Où en est l’équipe']);
    expect(etat).toBeGreaterThan(-1);
    expect(payer).toBeGreaterThan(etat);
    expect(texte(arbre)).toContain('Ta place n’est pas encore payée');
    expect(texte(arbre)).toContain('20 € par joueur');
    expect(combien(arbre, ['Payer ma place (20 €)'])).toBe(1);
  });

  test('🔴 R6 : « Quitter l’équipe » est le DERNIER bouton de la page', async () => {
    const arbre = await monter(payante('joueur'), 'u-2');
    const tous = tousLesBoutons(arbre);
    expect(tous[tous.length - 1].props.accessibilityLabel).toBe('Quitter l’équipe');
  });

  test('🔴 R8 : « Payer ma place » ouvre la page de paiement DANS LE MÊME ONGLET (openUrlHere), pas une fenêtre', async () => {
    const arbre = await monter(payante('joueur'), 'u-2');
    await appuyer(arbre, ['Payer ma place (20 €)']);
    expect(liens.default.openUrlHere).toHaveBeenCalledWith(LIEN_2);
    expect(liens.default.openUrl).not.toHaveBeenCalled();
  });

  // ATTENDU CHANGÉ PAR IMPL-2-EQUIPE (18/11, planches 9b et 10a) : la phrase « Pour te retirer… »
  // en double du bouton disparaît ; « Écrire à l’Assistance FoundClub » reste et ouvre l'Assistance.
  test('🔴 9b, 10a : plus de « Pour te retirer ou céder ta place, écris-nous » ; « Écrire à l’Assistance FoundClub » ouvre l’Assistance', async () => {
    const arbre = await monter(payante('joueur'), 'u-2');
    expect(texte(arbre)).not.toContain('Pour te retirer ou céder ta place, écris-nous');
    await appuyer(arbre, ['Écrire à l’Assistance FoundClub']);
    expect(mockOuvrirAssistance).toHaveBeenCalled();
  });

  test('la ligne « écris-nous » ne promet aucune date (elle renvoie aux conditions)', async () => {
    const arbre = await monter(payante('joueur'), 'u-2');
    const lignes = arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'tournament-team-withdraw' && typeof n.type === 'string');
    expect(lignes).toHaveLength(1);
    expect(JSON.stringify(arbre.toJSON())).not.toMatch(/rembours|5 décembre|17 décembre/);
  });
});

describe('T-PAGES-2 — F22 : la raison de refus avant la déclaration', () => {
  afterEach(() => { mockEvent = { documentId: 'evt-1', tournamentTeams: [] }; });

  test('🔴 compte de 15 ans, tournoi à partir de 16 ans : le message d’âge, pas de « Demander à rejoindre »', async () => {
    const team = equipe({ event: { ...equipe().event, date: '2026-12-19T18:00:00.000Z', tournamentConfig: { minAge: 16 } }, isOpenToJoinRequests: true });
    const arbre = await monter(team, 'u-9', 'player', '2011-06-01');
    expect(texte(arbre)).toContain('Ce tournoi est ouvert à partir de 16 ans.');
    expect(combien(arbre, ['Demander à rejoindre'])).toBe(0);
  });

  test('🔴 déjà dans une autre équipe du tournoi (viewerMembership) : la phrase, pas de « Demander à rejoindre »', async () => {
    mockEvent = { documentId: 'evt-1', tournamentTeams: [{ documentId: 'tt-autre', viewerMembership: { responseStatus: 'present' } }] };
    const arbre = await monter(equipe({ isOpenToJoinRequests: true }), 'u-9');
    expect(texte(arbre)).toContain('Tu es déjà dans une équipe de ce tournoi');
    expect(combien(arbre, ['Demander à rejoindre'])).toBe(0);
  });

  test('adulte sans équipe : le bouton reste proposé', async () => {
    const arbre = await monter(equipe({ isOpenToJoinRequests: true }), 'u-9', 'player', '1990-01-01');
    expect(combien(arbre, ['Demander à rejoindre'])).toBe(1);
  });
});

describe('T-PAGES-2 — relecture (17/11) : deux trous de la refonte', () => {
  // ATTENDU CHANGÉ PAR IMPL-2-EQUIPE (planche 9a) : « Où en est l’équipe » d'abord.
  test('🔴 capitaine dont la place est due, équipe validée : « Payer ma place (20 €) » reste, une seule fois', async () => {
    const team = payante('capitaine', { status: 'accepted' });
    team.payment.members[0] = {
      isSelf: true, memberDocumentId: 'mb-1', paymentUrl: 'https://foundclub.app/licenses/pay/jeton-cap', status: 'due',
    };
    const arbre = await monter(team, 'u-cap');
    expect(combien(arbre, ['Payer ma place (20 €)'])).toBe(1);
    const [payer, etat] = ordre(arbre, ['Payer ma place (20 €)', 'Où en est l’équipe']);
    expect(payer).toBeGreaterThan(etat);
  });

  test('🔴 tournoi gratuit sans effectif minimum : jamais « 2 / 0 »', async () => {
    const arbre = await monter(equipe(), 'u-cap');
    expect(texte(arbre)).not.toContain('/ 0');
  });

  test('🔴 visiteur : la carte ne lui dit pas « Ton équipe », ni ce qu’il manque', async () => {
    const arbre = await monter(payante('joueur', { isOpenToJoinRequests: true }), 'u-9');
    expect(texte(arbre)).not.toContain('Ton équipe');
    expect(texte(arbre)).not.toContain('Il manque');
  });
});

describe('T-PAGES-2 — F22 : une raison INCONNUE ne cache pas le bouton', () => {
  afterEach(() => { mockEventQuery = null; });

  test('🔴 la lecture du tournoi échoue : « Demander à rejoindre » reste (le serveur tranche)', async () => {
    mockEventQuery = {
      data: undefined, isError: true, isFetching: false, isLoading: false,
    };
    const arbre = await monter(equipe({ isOpenToJoinRequests: true }), 'u-9', 'player', '1990-01-01');
    expect(combien(arbre, ['Demander à rejoindre'])).toBe(1);
  });

  test('pendant le chargement du tournoi : pas encore de bouton', async () => {
    mockEventQuery = {
      data: undefined, isError: false, isFetching: true, isLoading: true,
    };
    const arbre = await monter(equipe({ isOpenToJoinRequests: true }), 'u-9', 'player', '1990-01-01');
    expect(combien(arbre, ['Demander à rejoindre'])).toBe(0);
  });
});

describe('M1312 (testeur, 17/11) — le capitaine fondateur', () => {
  test('🔴 le capitaine qui a créé l’équipe (origine serveur « external_addition ») ne porte pas « Ajout exceptionnel »', async () => {
    const arbre = await monter(equipe(), 'u-cap');
    expect(equipe().members[0]).toMatchObject({ origin: 'external_addition', role: 'captain' });
    expect(texte(arbre)).not.toContain('Ajout exceptionnel');
  });
});

describe('T-NOMS-EQUIPE (Adel « 3- B », D227, défaut M1331) — le roster vu par un joueur tiers', () => {
  /**
   * L'équipe telle que le serveur la rend à un lecteur SANS LIEN : `user: null`, et `displayName`
   * (« Prénom I. ») sur chaque membre actif (admin tournament-competition.js `rosterShortName`).
   * @returns {any} L'équipe.
   */
  const vueTiers = () => ({
    ...equipe(),
    adminUsers: null,
    captainUser: null,
    members: [
      {
        displayName: 'Capi T.', documentId: 'mb-1', origin: 'external_addition', responseStatus: 'present', role: 'captain', user: null,
      },
      {
        displayName: 'Djibril D.', documentId: 'mb-2', origin: 'invited', responseStatus: 'pending', role: 'member', user: null,
      },
      {
        documentId: 'mb-5', origin: 'invited', responseStatus: 'pending', role: 'member', user: null,
      },
    ],
  });
  const textes = (/** @type {any} */ arbre, /** @type {string} */ valeur) => arbre.root.findAll(
    (/** @type {any} */ n) => n.type === 'Text' && n.props?.children === valeur,
  );

  test('🔴 le Roster actif montre « Prénom I. » de chaque joueur, pas « Participant »', async () => {
    const arbre = await monter(vueTiers(), 'u-9');
    expect(textes(arbre, 'Djibril D.')).toHaveLength(1);
    expect(textes(arbre, 'Capi T.')).toHaveLength(1);
  });

  test('sans nom rendu par le serveur (compte supprimé, identités masquées) : « Participant » reste', async () => {
    const arbre = await monter(vueTiers(), 'u-9');
    expect(textes(arbre, 'Participant')).toHaveLength(1);
  });

  test('un membre de l’équipe garde le nom que le serveur lui rend en entier (pas de displayName)', async () => {
    const arbre = await monter(equipe(), 'u-2');
    expect(textes(arbre, 'Capi')).toHaveLength(1);
    expect(texte(arbre)).not.toContain('Participant');
  });
});

// T-REGLES-EQUIPE (18/11/2026, nuit D231, point 2 du chef) — une équipe PLEINE ne proposait plus
// « Demander à rejoindre ». RETOURNÉ par T-SANS-PLAFOND (18/11, décision d'Adel D239 « pas de limite de
// joueurs ») : à l'effectif du plafond en base, et au-delà, le bouton reste, jamais « Équipe complète ».
describe('T-SANS-PLAFOND (D239) — effectif au plafond en base : le bouton reste', () => {
  afterEach(() => { mockEvent = { documentId: 'evt-1', tournamentTeams: [] }; });
  const actifs = equipe().members.filter((m) => ['absent', 'pending', 'present'].includes(m.responseStatus)).length;
  const avecPlafond = (max) => equipe({ event: { ...equipe().event, tournamentConfig: { maxRosterSize: max } }, isOpenToJoinRequests: true });

  test('🔴 effectif = plafond en base : « Demander à rejoindre » reste, pas d « Équipe complète »', async () => {
    const arbre = await monter(avecPlafond(actifs), 'u-9', 'player', '1990-01-01');
    expect(texte(arbre)).not.toContain('Équipe complète');
    expect(combien(arbre, ['Demander à rejoindre'])).toBe(1);
  });

  test('une place libre : le bouton reste, sans la raison', async () => {
    const arbre = await monter(avecPlafond(actifs + 1), 'u-9', 'player', '1990-01-01');
    expect(combien(arbre, ['Demander à rejoindre'])).toBe(1);
    expect(texte(arbre)).not.toContain('Équipe complète');
  });

  test('🔴 lecteur tiers : le résumé du serveur (membersSummary.count) dit 7 sur un plafond 5 : le bouton reste', async () => {
    const team = { ...avecPlafond(5), members: [], membersSummary: { count: 7, list: [], paidCount: 0 } };
    const arbre = await monter(team, 'u-9', 'player', '1990-01-01');
    expect(texte(arbre)).not.toContain('Équipe complète');
    expect(combien(arbre, ['Demander à rejoindre'])).toBe(1);
  });
});

// T-REGLES-EQUIPE (18/11, point 7 du chef, capture Android recette 45) — équipe PLEINE vue par son
// capitaine : les gestes d'invitation étaient masqués. RETOURNÉ par T-SANS-PLAFOND (D239) : au plafond
// en base, « Inviter », « Partager le lien » et « Ouvrir / Fermer les demandes » restent proposés.
describe('T-SANS-PLAFOND (D239) — effectif au plafond en base, page du capitaine', () => {
  const actifs = equipe().members.filter((m) => ['absent', 'pending', 'present'].includes(m.responseStatus)).length;
  const avecPlafond = (max) => equipe({ event: { ...equipe().event, tournamentConfig: { maxRosterSize: max } }, isOpenToJoinRequests: true });

  test('🔴 effectif = plafond en base : « Inviter », « Partager le lien » et « Fermer les demandes » restent, pas d « Équipe complète »', async () => {
    const arbre = await monter(avecPlafond(actifs), 'u-cap');
    // ATTENDU CHANGÉ PAR IMPL-2-EQUIPE (3b, 9g) : « Inviter un joueur » et l'interrupteur « Ouverte aux
    // demandes » ; le lien de l'équipe est dans la fenêtre « Inviter un joueur ».
    ['Inviter un joueur', 'Ouverte aux demandes'].forEach((geste) => {
      expect([geste, combien(arbre, [geste]) > 0]).toEqual([geste, true]);
    });
    await appuyer(arbre, ['Inviter un joueur']);
    expect(combien(arbre, ['Copier le lien']) > 0).toBe(true);
    expect(texte(arbre)).not.toContain('Équipe complète');
  });

  test('une place libre : « Inviter », « Partager le lien » et « Fermer les demandes » restent', async () => {
    const arbre = await monter(avecPlafond(actifs + 1), 'u-cap');
    // ATTENDU CHANGÉ PAR IMPL-2-EQUIPE (3b, 9g) : « Inviter un joueur » et l'interrupteur « Ouverte aux
    // demandes » ; le lien de l'équipe est dans la fenêtre « Inviter un joueur ».
    ['Inviter un joueur', 'Ouverte aux demandes'].forEach((geste) => {
      expect([geste, combien(arbre, [geste]) > 0]).toEqual([geste, true]);
    });
    await appuyer(arbre, ['Inviter un joueur']);
    expect(combien(arbre, ['Copier le lien']) > 0).toBe(true);
    expect(texte(arbre)).not.toContain('Équipe complète');
  });
});

// T-REGLES-EQUIPE (18/11, point 9 du chef, venu de T-NOTIFS-TOURNOI) — la notification « demande de
// rejoindre » ouvre la page d'équipe SUR les demandes (`focusSection: 'requests'`), pas en haut.
describe('T-REGLES-EQUIPE — arrivée par la notification : la page défile jusqu’aux demandes', () => {
  const poser = async (/** @type {any} */ arbre, /** @type {string} */ testID, /** @type {number} */ y) => {
    const vue = arbre.root.find((/** @type {any} */ n) => n.props?.testID === testID && typeof n.props?.onLayout === 'function');
    const layout = {
      height: 100, width: 390, x: 0, y,
    };
    await act(async () => { vue.props.onLayout({ nativeEvent: { layout } }); });
  };

  test('🔴 focusSection « requests » : défile jusqu’aux demandes (colonnes + position dans la colonne)', async () => {
    const arbre = await monter(equipe(), 'u-cap', 'player', undefined, { focusSection: 'requests' });
    const defiler = jest.spyOn(arbre.root.findByType(ScrollView).instance, 'scrollTo');
    await poser(arbre, 'tournament-team-columns', 300);
    await poser(arbre, 'tournament-team-requests', 900);
    expect(defiler).toHaveBeenCalledTimes(1);
    expect(defiler).toHaveBeenCalledWith({ animated: true, y: 1200 });
  });

  test('🔴 page déjà ouverte dans la pile : la nouvelle arrivée (nouveaux paramètres) défile, une fois', async () => {
    const arbre = await monter(equipe(), 'u-cap');
    const defiler = jest.spyOn(arbre.root.findByType(ScrollView).instance, 'scrollTo');
    await poser(arbre, 'tournament-team-columns', 300);
    await poser(arbre, 'tournament-team-requests', 900);
    const arrivee = {
      eventId: 'evt-1', focusSection: 'requests', teamId: 'tt-1',
    };
    await act(async () => {
      arbre.update(<TournamentTeamDetails navigation={navigation} route={{ params: arrivee }} />);
    });
    await poser(arbre, 'tournament-team-requests', 900);
    expect(defiler).toHaveBeenCalledTimes(1);
    expect(defiler).toHaveBeenCalledWith({ animated: true, y: 1200 });
  });

  test('sans focusSection : la page reste en haut', async () => {
    const arbre = await monter(equipe(), 'u-cap');
    const defiler = jest.spyOn(arbre.root.findByType(ScrollView).instance, 'scrollTo');
    await poser(arbre, 'tournament-team-columns', 300);
    await poser(arbre, 'tournament-team-requests', 900);
    expect(defiler).not.toHaveBeenCalled();
  });
});

// T-SUITES-TOURNOI (18/11, points 7 et 8 ; testeur, iPhone 2.6.910, recette 46, capitaine 1/5) —
// « Chercher un joueur » (À faire maintenant) et « Inviter » d'une « Place libre » ne faisaient
// rien à l'œil : ils ouvraient la recherche dans la carte « Inviter un joueur », mais au téléphone
// cette carte est dans la colonne de côté, rendue SOUS l'effectif, hors de l'écran. Ils ouvrent la
// même recherche que l'« Inviter » de la carte, et la page défile jusqu'à elle.
// T-SUITES-TOURNOI (18/11, points 7, 8 et 13), REPRIS PAR IMPL-2-EQUIPE (planche 3b) : la recherche
// et le lien ne sont plus dans une carte sous l'effectif (qu'il fallait faire défiler) ; « Chercher
// un joueur » et « Inviter » ouvrent la fenêtre « Inviter un joueur » LÀ OÙ L'ON EST, et le champ
// prend le focus (chef « A »). « Copier le lien » copie l'adresse seule, sur le site comme au
// téléphone (planche 3b : WhatsApp, SMS, Copier).
describe('T-SUITES, repris par IMPL-2-EQUIPE — « Chercher un joueur » et « Inviter » ouvrent la fenêtre', () => {
  const champs = (/** @type {any} */ arbre) => arbre.root.findAll((/** @type {any} */ n) => n.type === TextInput && n.props?.testID === 'tournament-invite-search-input');
  const cartesLibres = (/** @type {any} */ arbre) => arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'tournament-team-free-slot' && typeof n.type === 'string');
  const boutonDans = (/** @type {any} */ noeud, /** @type {string} */ libelle) => noeud.findAll((/** @type {any} */ n) => n.props?.accessibilityLabel === libelle && typeof n.props?.onPress === 'function' && n.type !== 'View')[0];

  test('🔴 7 « Chercher un joueur » : la fenêtre s’ouvre sur la recherche, le champ prend le focus', async () => {
    const arbre = await monter(payante('capitaine'), 'u-cap');
    expect(champs(arbre)).toHaveLength(0);
    await act(async () => { boutonDans(arbre.root, 'Chercher un joueur').props.onPress(); });
    expect(champs(arbre)).toHaveLength(1);
    expect(champs(arbre)[0].props.autoFocus).toBe(true);
  });

  test.each([0, 1, 2, 3])('🔴 8 « Inviter » de la place libre n° %i : la fenêtre à deux choix, avec le numéro de la place, puis la recherche', async (rang) => {
    const capitaineSeul = { ...payante('capitaine'), members: [equipe().members[0]] };
    const arbre = await monter(capitaineSeul, 'u-cap');
    expect(cartesLibres(arbre)).toHaveLength(4);
    await act(async () => { boutonDans(cartesLibres(arbre)[rang], 'Inviter').props.onPress(); });
    expect(texte(arbre)).toContain(`Place ${rang + 2} de `);
    expect(champs(arbre)).toHaveLength(0);
    await act(async () => { boutonDans(arbre.root, 'Chercher un joueur FoundClub').props.onPress(); });
    expect(champs(arbre)).toHaveLength(1);
  });
});

describe('T-SUITES (13), repris par IMPL-2-EQUIPE — « Copier le lien » dans la fenêtre', () => {
  const { Platform } = jest.requireActual('react-native');
  const avant = Platform.OS;
  afterEach(() => { Platform.OS = avant; });
  const copier = (/** @type {any} */ arbre) => arbre.root.findAll((/** @type {any} */ n) => n.props?.accessibilityLabel === 'Copier le lien' && typeof n.props?.onPress === 'function' && n.type !== 'View')[0];

  test('🔴 site : « Copier le lien » copie le lien seul et dit « Lien copié » ; pas de SMS sur un ordinateur', async () => {
    Platform.OS = 'web';
    const arbre = await monter(payante('capitaine'), 'u-cap');
    expect(copier(arbre)).toBeUndefined();
    await appuyer(arbre, ['Inviter un joueur']);
    expect(combien(arbre, ['WhatsApp'])).toBe(1);
    expect(combien(arbre, ['SMS'])).toBe(0);
    await act(async () => { await copier(arbre).props.onPress(); });
    expect(partageLien.shareTournamentTeamInviteLink).toHaveBeenCalledWith(expect.objectContaining({ lienSeul: true }));
    expect(texte(arbre)).toContain('Lien copié');
  });

  // ATTENDU CHANGÉ PAR IMPL-2-EQUIPE (planche 3b) : au téléphone aussi, « Copier le lien », à côté de
  // WhatsApp et SMS.
  test('téléphone : WhatsApp, SMS et « Copier le lien »', async () => {
    Platform.OS = 'ios';
    const arbre = await monter(payante('capitaine'), 'u-cap');
    await appuyer(arbre, ['Inviter un joueur']);
    expect(combien(arbre, ['WhatsApp', 'SMS'])).toBe(2);
    expect(copier(arbre)).toBeDefined();
  });
});

// IMPL-2-EQUIPE (18/11/2026, planches 10c et 10d ; CGV § 5) — quitter avec une place PAYÉE : pas de
// retrait d'un geste, la fenêtre « Ta place est payée » dit la règle du jour, et mène à l'Assistance.
// L'horloge est figée (seule `Date`) : la page lit la vraie date du jour.
describe('IMPL-2-EQUIPE — quitter avec une place payée (10c, 10d)', () => {
  const NE_PAS_FIGER = ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'performance', 'hrtime'];
  const payee = () => {
    const team = payante('joueur');
    team.event = { ...team.event, date: '2026-12-19T18:00:00.000Z' };
    team.payment.members[1] = {
      ...team.payment.members[1], jerseySize: 'L', paymentUrl: null, status: 'paid',
    };
    return team;
  };
  afterEach(() => { jest.useRealTimers(); });

  test('🔴 10c (le 18/11) : remboursé en entier jusqu’au 5 décembre, « Écrire à l’Assistance », aucun retrait', async () => {
    jest.useFakeTimers({
      doNotFake: NE_PAS_FIGER, now: new Date('2026-11-18T12:00:00.000Z'),
    });
    const arbre = await monter(payee(), 'u-2');
    expect(texte(arbre)).toContain('Ta place est payée');
    expect(texte(arbre)).toContain('20 € · maillot taille L');
    await appuyer(arbre, ['Quitter l’équipe']);
    expect(texte(arbre)).toContain('Jusqu’au 5 décembre inclus, tu es remboursé en entier : 20 €, sous 14 jours.');
    await appuyer(arbre, ['Écrire à l’Assistance']);
    // M1311 (chef, 19/11) : la conversation s'ouvre avec « je souhaite me retirer » prérempli.
    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.Conversation, expect.objectContaining({
      brouillon: expect.stringContaining('je souhaite me retirer de l’équipe'), chatId: 'chat-assistance',
    }));
    expect(services.leaveTournamentTeam).not.toHaveBeenCalled();
  });

  test('🔴 10d (le 10/12) : plus remboursée depuis le 6 décembre, « Céder ma place » jusqu’au 17 décembre', async () => {
    jest.useFakeTimers({
      doNotFake: NE_PAS_FIGER, now: new Date('2026-12-10T12:00:00.000Z'),
    });
    const arbre = await monter(payee(), 'u-2');
    await appuyer(arbre, ['Quitter l’équipe']);
    const contenu = texte(arbre);
    expect(contenu).toContain('Depuis le 6 décembre, ta place n’est plus remboursée.');
    expect(contenu).toContain('Tu peux la céder à un autre joueur jusqu’au 17 décembre');
    expect(combien(arbre, ['Céder ma place'])).toBe(1);
    expect(services.leaveTournamentTeam).not.toHaveBeenCalled();
  });

  test('10b : sans paiement, la confirmation « Tu quittes l’équipe ? »', async () => {
    const arbre = await monter(payante('joueur'), 'u-2');
    await appuyer(arbre, ['Quitter l’équipe']);
    const appel = alerte.mock.calls[alerte.mock.calls.length - 1];
    expect(appel[0]).toBe('Tu quittes l’équipe ?');
    expect(appel[2].map((/** @type {any} */ b) => b.text)).toEqual(['Rester dans l’équipe', 'Quitter l’équipe']);
  });
});

// M1311 (testeur ; chef 19/11) — le capitaine ne pouvait ni retirer son équipe ni annuler son
// inscription. « Retirer mon équipe » (rouge) : la règle des CGV § 5, puis la conversation
// « Assistance FoundClub » avec le message prérempli ; le remboursement reste fait à la main (D233).
describe('M1311 — le capitaine retire son équipe par l’Assistance', () => {
  const NE_PAS_FIGER = ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'performance', 'hrtime'];
  afterEach(() => { jest.useRealTimers(); });
  const datee = () => {
    const team = payante('capitaine');
    team.event = { ...team.event, date: '2026-12-19T18:00:00.000Z' };
    return team;
  };

  test('🔴 capitaine : « Retirer mon équipe », la règle, puis l’Assistance avec « je souhaite retirer mon équipe »', async () => {
    jest.useFakeTimers({
      doNotFake: NE_PAS_FIGER, now: new Date('2026-11-19T12:00:00.000Z'),
    });
    const arbre = await monter(datee(), 'u-cap');
    await appuyer(arbre, ['Retirer mon équipe']);
    expect(texte(arbre)).toContain('Jusqu’au 5 décembre inclus, chaque place payée est remboursée intégralement. Après, pas de remboursement, mais chaque joueur peut céder sa place jusqu’au 17 décembre.');
    await appuyer(arbre, ['Écrire à l’Assistance']);
    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.Conversation, expect.objectContaining({
      brouillon: expect.stringContaining('je souhaite retirer mon équipe'), chatId: 'chat-assistance',
    }));
    const { brouillon } = navigation.navigate.mock.calls.find((/** @type {any[]} */ c) => c[0] === RouteNames.Conversation)[1];
    expect(brouillon).toContain('FoundClub x AR Soccer');
    expect(brouillon).toContain(datee().name);
  });

  test('un joueur ne voit pas « Retirer mon équipe »', async () => {
    const arbre = await monter(payante('joueur'), 'u-2');
    expect(combien(arbre, ['Retirer mon équipe'])).toBe(0);
  });
});

// Contrat IMPL-5 (chef, 19/11) — un tiers reçoit `payment` sans `members`, et `membersSummary.list[]`
// sans `paid` (`paidHidden: true`) : la page ne déduit jamais « non payé » d'un `paid` absent.
describe('Contrat IMPL-5 — la page vue par un tiers', () => {
  test('tiers : ni « À payer » ni « Payé » par joueur, ni nom de qui n’a pas payé ; le compte reste', async () => {
    const team = payante('capitaine');
    team.payment = {
      currency: 'EUR', entryFeeCents: 2000, paidCount: 1, paidMembersToValidate: 5,
    };
    team.membersSummary = {
      count: 2, list: [{ firstName: 'Capi', lastInitial: 'C', paidHidden: true }, { firstName: '', lastInitial: '', paidHidden: true }], paidCount: 1, pendingCount: 1,
    };
    const arbre = await monter(team, 'u-tiers');
    const contenu = texte(arbre);
    expect(contenu).toContain('1 place payée sur 5');
    expect(contenu).not.toMatch(/À payer|n’a pas encore payé|n’ont pas encore payé/);
    expect(contenu).not.toMatch(/(^| \| )Payé( \| |$)/);
  });
});

// IMPL-2C (19/11/2026, recette 48, bloquant de la tournée du site, compte 777) — le capitaine au rôle Joueur
// touche « Ouverte aux demandes » : le serveur refuse (403, droit `toggleOpenRequests` absent, corrigé côté
// serveur en recette 49), et l'écran affichait « Erreur — Forbidden ». Il dit une phrase lisible ; une phrase
// française du serveur (refus métier) passe toujours.
describe('IMPL-2C — un refus du serveur sur l’interrupteur se dit en français', () => {
  const { toggleTournamentTeamOpenRequests } = jest.requireMock('@/services/tournamentTeam/tournamentTeamService');
  const derniereAlerte = () => alerte.mock.calls[alerte.mock.calls.length - 1];

  test('🔴 403 « Forbidden » : « Tu ne peux pas modifier ce réglage pour l’instant. », jamais « Forbidden »', async () => {
    toggleTournamentTeamOpenRequests.mockRejectedValueOnce({
      details: {}, message: 'Forbidden', name: 'ForbiddenError', status: 403,
    });
    const arbre = await monter(equipe(), 'u-cap');
    await appuyer(arbre, ['Ouverte aux demandes']);
    expect(derniereAlerte()?.[1]).toBe('Tu ne peux pas modifier ce réglage pour l’instant.');
    expect(JSON.stringify(alerte.mock.calls)).not.toContain('Forbidden');
  });

  test('400 avec une phrase française du serveur : elle est gardée', async () => {
    toggleTournamentTeamOpenRequests.mockRejectedValueOnce({
      details: {}, message: 'Le tournoi est fermé.', name: 'ValidationError', status: 400,
    });
    const arbre = await monter(equipe(), 'u-cap');
    await appuyer(arbre, ['Ouverte aux demandes']);
    expect(derniereAlerte()?.[1]).toBe('Le tournoi est fermé.');
  });
});
