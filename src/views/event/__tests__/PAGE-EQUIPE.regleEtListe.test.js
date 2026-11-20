/* eslint-disable max-len, no-unused-vars -- les témoins se lisent en entier ; harnais repris tel quel de T-PAGES-2.pageEquipe. */
import { Alert, ScrollView, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

import TournamentTeamDetails from '../TournamentTeamDetails';

// PAGE-EQUIPE (19/11/2026) — règle d'Adel D276 (pas d'infos du tournoi répétées) et liste des joueurs
// de la maquette 3a. Harnais repris de T-PAGES-2.pageEquipe.test.js (doublure de Button : elle garde
// aussi `style`, `icon` et `variant`), dont le texte d'origine suit.
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

// IMPL-2C (19/11) : les options de chaque action, gardées pour le témoin du filet global.
const mockOptionsDesActions = [];
jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ opts) => {
    mockOptionsDesActions.push(opts);
    return {
      isPending: false,
      // IMPL-2C (19/11) : comme react-query, `mutate` ne lève jamais : un refus va à `onError`.
      mutate: (/** @type {any} */ v) => Promise.resolve(opts.mutationFn(v)).catch((/** @type {any} */ e) => {
        if (!opts.onError) throw e;
        opts.onError(e, v);
      }),
      mutateAsync: async (/** @type {any} */ v) => opts.mutationFn(v),
    };
  },
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
      accessibilityLabel: props.title, disabled: props.disabled, icone: props.icon, onPress: props.onPress, style: props.style, testID: props.testID, variante: props.variant,
    }, react.createElement(rn.Text, null, props.title || ''));
  };
});
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => () => null);
// PAGE-EQUIPE : l'autorisation parentale, rendue par une doublure qui dit pour qui.
jest.mock('../TournamentMemberConsent', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ConsentDouble(/** @type {any} */ props) {
    return react.createElement(rn.Text, null, `consentement:${props.member?.documentId}`);
  };
});
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
// IMPL-2C (19/11) : la doublure compte ses montages (une fenêtre neuve = un montage de plus).
const mockMontagesDeFenetre = { n: 0 };
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const { useEffect } = jest.requireActual('react');
  return function BottomModalMock(/** @type {any} */ props) {
    useEffect(() => { mockMontagesDeFenetre.n += 1; }, []);
    return props.isVisible || props.visible ? props.children : null;
  };
});
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

// ---------------------------------------------------------------------------------------------
// PAGE-EQUIPE (19/11/2026)
// ---------------------------------------------------------------------------------------------

const ReactNative = jest.requireActual('react-native');
const MarqueeText = jest.requireActual('@/components/atoms/marqueeText/MarqueeText').default;
const { StyleSheet } = ReactNative;
const generateColors = jest.requireActual('@/theme/colors').default;
const COULEURS = generateColors();

const ADRESSE = 'AR Soccer, 119 rue de la Rauze basse, Montpellier';
/**
 * Le tournoi daté et situé (19/12 à 19 h, AR Soccer), avec la discussion de l'équipe.
 * @param {any} team - L'équipe.
 * @returns {any} L'équipe.
 */
const datee = (team) => ({
  ...team,
  discussion: { chat: 'chat-equipe', ecriture: true },
  event: { ...team.event, date: '2026-12-19T19:00:00', location: ADRESSE },
});
/**
 * La position d'un texte dans l'arbre (ordre de lecture), ou -1.
 * @param {any} arbre - L'arbre monté.
 * @param {string} morceau - Le texte.
 * @returns {number} L'indice.
 */
const position = (arbre, morceau) => texte(arbre).indexOf(morceau);
/**
 * Le nœud hôte qui porte ce testID.
 * @param {any} arbre - L'arbre monté.
 * @param {string} id - Le testID.
 * @returns {any} Le nœud, ou undefined.
 */
/**
 * L'équipe de base où Deux (mb-2) a répondu « Présent ».
 * @returns {any} L'équipe.
 */
const avecPresent = () => {
  const team = equipe();
  team.members[1] = { ...team.members[1], responseStatus: 'present' };
  return team;
};
/**
 * Les textes (feuilles) sous un nœud, à la suite.
 * @param {any} noeud - Un nœud de l'arbre.
 * @returns {string} Les textes, séparés par « | ».
 */
const textesDe = (noeud) => noeud.findAll((/** @type {any} */ n) => n.type === 'Text')
  .flatMap((/** @type {any} */ n) => [].concat(n.props.children))
  .filter((/** @type {any} */ c) => typeof c === 'string')
  .join(' | ');
const parId = (arbre, id) => arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === id && typeof n.type === 'string')[0];

/** @type {any} */
let largeur = null;
beforeEach(() => {
  largeur = jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({
    fontScale: 1, height: 812, scale: 2, width: 375,
  });
});
afterEach(() => largeur.mockRestore());

describe('PAGE-EQUIPE — témoins caractérisants (verts avant, verts après)', () => {
  test('C1. l’autorisation parentale reste sur la ligne du joueur', async () => {
    const arbre = await monter(datee(equipe()), 'u-cap');
    expect(textesDe(ligne(arbre, 'Deux'))).toContain('consentement:mb-2');
  });
  test('C2. équipe de club : « Équipe tournoi dérivée de … » reste', async () => {
    const arbre = await monter(datee(equipe({ sourceTeam: { name: 'Seniors A', players: [] }, sourceType: 'club_team' })), 'u-cap');
    expect(texte(arbre)).toContain('Seniors A');
  });
  test('C3. décision 5 : « Présent » reste lisible par une autre équipe', async () => {
    const arbre = await monter(datee(avecPresent()), 'u-tiers');
    expect(texte(arbre)).toContain('Présent');
  });
  test('C4. capitaine : « Copier le lien de paiement » d’un joueur qui n’a pas payé reste atteignable', async () => {
    const arbre = await monter(datee(payante('capitaine')), 'u-cap');
    expect(combien(arbre, ['Copier le lien de paiement'])).toBe(1);
  });
  test('C5. la taille de maillot reste sur la ligne', async () => {
    const arbre = await monter(datee(payante('capitaine')), 'u-cap');
    expect(texte(arbre)).toContain('Taille choisie : M');
    expect(texte(arbre)).toContain('Taille : au paiement');
  });
});

describe('PAGE-EQUIPE — règle d’Adel D276 : pas d’infos du tournoi répétées', () => {
  test.each([
    ['capitaine', () => payante('capitaine'), 'u-cap'],
    ['joueur qui n’a pas payé', () => payante('joueur'), 'u-2'],
    ['tiers', () => equipe(), 'u-tiers'],
  ])('🔴 %s : plus de bloc « Le tournoi », ni « Conditions », ni « Fiche du tournoi », ni adresse', async (_qui, faire, lecteur) => {
    const arbre = await monter(datee(faire()), lecteur);
    const contenu = texte(arbre);
    expect(parId(arbre, 'tournament-team-tournament')).toBeUndefined();
    expect(contenu).not.toContain('Le tournoi');
    expect(contenu).not.toContain('Conditions d’inscription');
    expect(contenu).not.toContain('Fiche du tournoi');
    expect(contenu).not.toContain('Retour au tournoi');
    expect(contenu).not.toContain('119 rue de la Rauze');
  });

  test('🔴 en haut : le nom, « FoundClub x AR Soccer · sam. 19 déc. », puis « Voir les infos du tournoi »', async () => {
    const arbre = await monter(datee(payante('capitaine')), 'u-cap');
    const nom = position(arbre, 'Les Rapides');
    const ligneTournoi = position(arbre, 'FoundClub x AR Soccer · sam. 19 déc.');
    const lien = position(arbre, 'Voir les infos du tournoi');
    expect(nom).toBeGreaterThan(-1);
    expect(ligneTournoi).toBeGreaterThan(nom);
    expect(lien).toBeGreaterThan(ligneTournoi);
    expect(position(arbre, 'Où en est l’équipe')).toBeGreaterThan(lien);
  });

  test('🔴 « Voir les infos du tournoi » ouvre la fiche, même arrivé sans eventId (notification)', async () => {
    mockAuth = { accountRoleKey: 'player', userData: { documentId: 'u-cap' } };
    mockTeam = datee(payante('capitaine'));
    navigation = { goBack: jest.fn(), navigate: jest.fn() };
    /** @type {any} */
    let arbre = null;
    await act(async () => {
      arbre = renderer.create(<TournamentTeamDetails navigation={navigation} route={{ params: { teamId: 'tt-1' } }} />);
    });
    montes.push(arbre);
    await appuyer(arbre, ['Voir les infos du tournoi']);
    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.EventDetails, { eventId: 'evt-1' });
  });

  test('on garde ce qui sert à agir : le prix dans « Payer ma place (20 €) »', async () => {
    const arbre = await monter(datee(payante('joueur')), 'u-2');
    expect(combien(arbre, ['Payer ma place (20 €)'])).toBe(1);
  });
});

describe('PAGE-EQUIPE — décisions 3 et 4, lignes 18-24 et 30-35', () => {
  test('🔴 téléphone : « Discussion de l’équipe · 2 membres » tout en haut, avant « Où en est l’équipe »', async () => {
    const arbre = await monter(datee(payante('capitaine')), 'u-cap');
    const discussion = position(arbre, 'Discussion de l’équipe · 2 membres');
    expect(discussion).toBeGreaterThan(position(arbre, 'Voir les infos du tournoi'));
    expect(discussion).toBeLessThan(position(arbre, 'Où en est l’équipe'));
    await appuyer(arbre, ['Discussion de l’équipe · 2 membres']);
    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.Conversation, { chatId: 'chat-equipe' });
  });

  test('🔴 « Discussion » : bouton à contour, pleine largeur', async () => {
    const arbre = await monter(datee(payante('capitaine')), 'u-cap');
    const [bouton] = boutonsDe(arbre.root, ['Discussion de l’équipe · 2 membres']);
    expect(bouton.props.variante).toBe('Secondary');
    expect(StyleSheet.flatten(bouton.props.style).alignSelf).toBe('stretch');
  });

  test('🔴 9a : « Payer ma place (20 €) » prend toute la largeur', async () => {
    const arbre = await monter(datee(payante('joueur')), 'u-2');
    const [bouton] = boutonsDe(arbre.root, ['Payer ma place (20 €)']);
    expect(StyleSheet.flatten(bouton.props.style).alignSelf).toBe('stretch');
  });

  test('🔴 9a : « Partager le lien » et « Chercher un joueur » portent leur icône', async () => {
    const arbre = await monter(datee(payante('capitaine')), 'u-cap');
    expect(boutonsDe(arbre.root, ['Partager le lien'])[0].props.icone).toBe('share');
    expect(boutonsDe(arbre.root, ['Chercher un joueur'])[0].props.icone).toBe('search');
  });

  test('🔴 9b : « Seras-tu là le 19 décembre ? » au lieu de « Ma réponse tournoi »', async () => {
    const arbre = await monter(datee(payante('joueur')), 'u-2');
    expect(texte(arbre)).toContain('Seras-tu là le 19 décembre ?');
    expect(texte(arbre)).not.toContain('Ma réponse tournoi');
    await appuyer(arbre, ['Présent']);
    expect(services.respondToTournamentTeam).toHaveBeenCalledWith('tt-1', 'present');
  });

  test('🔴 10a : « Quitter l’équipe » suit « Ta place est payée », avant la liste des joueurs', async () => {
    const team = datee(payante('joueur'));
    team.payment.members[1] = {
      ...team.payment.members[1], jerseySize: 'L', paymentUrl: null, status: 'paid',
    };
    const arbre = await monter(team, 'u-2');
    const payee = position(arbre, 'Ta place est payée');
    const quitter = position(arbre, 'Quitter l’équipe');
    expect(payee).toBeGreaterThan(-1);
    expect(quitter).toBeGreaterThan(payee);
    expect(quitter).toBeLessThan(position(arbre, '"Joueurs"'));
  });

  test('🔴 ordinateur (1280 px) : à droite, « Discussion » en tête, puis « Seras-tu là… », puis « Quitter »', async () => {
    largeur.mockReturnValue({
      fontScale: 1, height: 800, scale: 1, width: 1280,
    });
    const arbre = await monter(datee(payante('joueur')), 'u-2');
    const droite = textesDe(parId(arbre, 'tournament-team-side'));
    const discussion = droite.indexOf('Discussion de l’équipe · 2 membres');
    const seras = droite.indexOf('Seras-tu là le 19 décembre ?');
    const quitter = droite.indexOf('Quitter l’équipe');
    expect(discussion).toBeGreaterThan(-1);
    expect(seras).toBeGreaterThan(discussion);
    expect(quitter).toBeGreaterThan(seras);
    expect(texte(arbre)).not.toContain('Le tournoi');
  });
});

describe('PAGE-EQUIPE — la liste des joueurs de la maquette 3a', () => {
  test('🔴 titre : « Joueurs » et « 1 payé sur 5 pour valider »', async () => {
    const arbre = await monter(datee(payante('capitaine')), 'u-cap');
    expect(texte(arbre)).toContain('1 payé sur 5 pour valider');
  });

  test('🔴 une liste continue : les lignes vivent dans UN cadre, sans cadre chacune', async () => {
    const arbre = await monter(datee(payante('capitaine')), 'u-cap');
    const liste = parId(arbre, 'tournament-team-roster-list');
    expect(liste).toBeDefined();
    expect(liste.findAll((/** @type {any} */ n) => n.props?.testID === 'tournament-member-row-mb-2' && typeof n.type === 'string')).toHaveLength(1);
    const style = StyleSheet.flatten(parId(arbre, 'tournament-member-row-mb-2').props.style) || {};
    expect(style.borderRadius).toBeUndefined();
    expect(style.backgroundColor).toBeUndefined();
  });

  test('🔴 « À payer » sur la même ligne que le nom, à droite', async () => {
    const arbre = await monter(datee(payante('capitaine')), 'u-cap');
    const ligneNom = parId(arbre, 'tournament-member-line-mb-2');
    expect(ligneNom).toBeDefined();
    expect(StyleSheet.flatten(ligneNom.props.style).flexDirection).toBe('row');
    expect(textesDe(ligneNom)).toContain('À payer');
  });

  test('🔴 un nom long défile dans sa place (MarqueeText) ; la ligne garde le nom entier pour le lecteur d’écran', async () => {
    const team = datee(payante('capitaine'));
    team.members[1] = { ...team.members[1], user: { documentId: 'u-2', firstname: 'Maximilien-Alexandre', lastname: 'de La Tour d’Auvergne' } };
    const arbre = await monter(team, 'u-cap');
    const bandeaux = arbre.root.findAllByType(MarqueeText).map((/** @type {any} */ n) => n.props.text);
    expect(bandeaux).toContain('Maximilien-Alexandre de La Tour d’Auvergne');
    expect(parId(arbre, 'tournament-member-name-mb-2').props.accessibilityLabel).toContain('Maximilien-Alexandre de La Tour d’Auvergne');
  });

  test('🔴 « Présent » en bleu, plus en vert', async () => {
    const arbre = await monter(datee(avecPresent()), 'u-tiers');
    const present = arbre.root.findAll((/** @type {any} */ n) => n.type === 'Text' && n.props.children === 'Présent')[0];
    expect(JSON.stringify(present.props.style)).not.toContain(COULEURS.success500);
    expect(JSON.stringify(present.props.style)).toContain(COULEURS.primary500);
  });

  test('🔴 Android : « Annuler » une invitation demande « Annuler l’invitation ? », puis retire l’invité', async () => {
    const arbre = await monter(datee(equipe()), 'u-cap');
    const [annuler] = boutonsDe(parId(arbre, 'tournament-member-row-mb-3'), ['Annuler']);
    await act(async () => { await annuler.props.onPress(); });
    expect(alerte.mock.calls[alerte.mock.calls.length - 1][0]).toBe('Annuler l’invitation ?');
    await confirmer();
    expect(services.removeTournamentTeamMember).toHaveBeenCalledWith('tt-1', 'mb-3');
  });
});

// RELANCER-B (Adel « 5- B », 19/11 ~16:55) — maquette 3a : « Relancer », sans cloche, sur la ligne
// d'un joueur qui n'a pas payé (vue du capitaine). Le bouton ouvre le fil direct avec ce joueur (créé
// ou retrouvé par le serveur, `createWhisperChat`) et y dépose un message prérempli (`brouillon`, lu
// par Conversation.js et Conversation.web.js) que le capitaine envoie lui-même. Aucun droit, aucun
// appel serveur et aucun envoi neufs.
const chatDouble = jest.requireMock('@/services/chat/chatService');
const relancerDe = (/** @type {any} */ arbre, /** @type {string} */ id) => boutonsDe(parId(arbre, `tournament-member-row-${id}`), ['Relancer']);
describe('RELANCER-B — « Relancer » un joueur qui n’a pas payé', () => {
  test('🔴 capitaine : un « Relancer » sur la ligne de Deux (à payer), aucun sur la sienne (payée)', async () => {
    const arbre = await monter(datee(payante('capitaine')), 'u-cap');
    expect(relancerDe(arbre, 'mb-2')).toHaveLength(1);
    expect(relancerDe(arbre, 'mb-1')).toHaveLength(0);
  });
  test('🔴 sans cloche : « Relancer » ne porte aucune icône', async () => {
    const arbre = await monter(datee(payante('capitaine')), 'u-cap');
    expect(relancerDe(arbre, 'mb-2')[0].props.icone).toBeUndefined();
  });
  test('🔴 « Relancer » ouvre le fil direct avec Deux, message prérempli (tournoi + son lien), rien n’est envoyé', async () => {
    const arbre = await monter(datee(payante('capitaine')), 'u-cap');
    await act(async () => { await relancerDe(arbre, 'mb-2')[0].props.onPress(); });
    expect(chatDouble.createWhisperChat).toHaveBeenCalledWith(['u-2']);
    const [ecran, params] = navigation.navigate.mock.calls[navigation.navigate.mock.calls.length - 1];
    expect(ecran).toBe(RouteNames.Conversation);
    expect(params.chatId).toBe('chat-1');
    expect(params.brouillon).toBe(`Salut Deux ! Il te reste ta place à payer pour le tournoi FoundClub x AR Soccer : ${LIEN_2}`);
    expect(alerte).not.toHaveBeenCalled();
  });
  // Récolte train 17 (RELANCER-B × DEUX-EQUIPES-2) : une équipe refusée n'a plus rien à payer
  // (DEUX-EQUIPES-2, point 5 ; le serveur refuse le paiement, TOURNAMENT_TEAM_CLOSED) : personne à relancer.
  test('🔴 équipe refusée : aucun « Relancer », même pour le capitaine', async () => {
    const arbre = await monter({ ...datee(payante('capitaine')), status: 'declined' }, 'u-cap');
    expect(combien(arbre, ['Relancer'])).toBe(0);
  });
  test('🔴 équipe retirée (archivée) : aucun « Relancer » non plus', async () => {
    const arbre = await monter({ ...datee(payante('capitaine')), archivedAt: '2026-11-19T09:00:00.000Z', status: 'archived' }, 'u-cap');
    expect(combien(arbre, ['Relancer'])).toBe(0);
  });
  test('un joueur qui n’est pas capitaine ne voit aucun « Relancer »', async () => {
    const arbre = await monter(datee(payante('joueur')), 'u-2');
    expect(combien(arbre, ['Relancer'])).toBe(0);
  });
  test('🔴 joueur mineur : « Relancer » grisé, avec la raison ; aucun fil ouvert', async () => {
    const team = datee(payante('capitaine'));
    team.members[1] = { ...team.members[1], parentalConsentPending: true };
    const arbre = await monter(team, 'u-cap');
    const [relancer] = relancerDe(arbre, 'mb-2');
    expect(relancer.props.disabled).toBe(true);
    expect(textesDe(parId(arbre, 'tournament-member-row-mb-2'))).toContain('Joueur mineur : pas de message privé, écris-lui dans la discussion de l’équipe.');
    await act(async () => { await relancer.props.onPress?.(); });
    expect(chatDouble.createWhisperChat).not.toHaveBeenCalled();
  });
  test('🔴 le serveur refuse le fil (règle des mineurs) : sa phrase s’affiche, on ne navigue pas', async () => {
    chatDouble.createWhisperChat.mockRejectedValueOnce(Object.assign(new Error('Cette personne est mineure : seuls les encadrants de son club peuvent lui écrire en privé.'), { details: { code: 'MINOR_DIRECT_CHAT_FORBIDDEN' } }));
    const arbre = await monter(datee(payante('capitaine')), 'u-cap');
    await act(async () => { await relancerDe(arbre, 'mb-2')[0].props.onPress(); });
    expect(alerte.mock.calls[alerte.mock.calls.length - 1][1]).toBe('Cette personne est mineure : seuls les encadrants de son club peuvent lui écrire en privé.');
    expect(navigation.navigate).not.toHaveBeenCalledWith(RouteNames.Conversation, expect.anything());
  });
});
