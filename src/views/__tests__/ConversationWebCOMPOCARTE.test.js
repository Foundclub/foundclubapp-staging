import { QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import { buildWebPath } from '@/navigation/webRoutes';

import { creerQueryClientDeTest } from '../../testSupport/queryClientDeTest';

// ==========================================================================
// COMPO-CARTE-SITE (29/09) — LA MESSAGERIE DU SITE MONTRE LA CARTE DE COMPO.
//
// 🔍 Constat du lot BULLE (29/09) : `Conversation.web.js` ne rendait JAMAIS
// `CompositionMessageBubble`. Le repli de `renderComposition` ecrivait en texte
// brut « Composition lineup_share » : un mot technique, montre a tout lecteur
// web d'un canal d'equipe. Et les boutons Present / Absent de BULLE n'existaient
// donc pas sur le site.
//
// 🎯 Ce que ces temoins exigent, SUR LE SITE (le fichier `.web.js` lui-meme) :
//   1. un message `lineup_share` montre la carte : titre du match et « Ouvrir »,
//      jamais « lineup_share » ;
//   2. un convoque a qui la publication demande une reponse voit Present /
//      Absent, sa reponse marquee — la MEME source que le telephone ; un lecteur
//      non convoque n'a aucun bouton ;
//   3. « Ouvrir » mene a la page web equivalente (regle COMPOMSG) : un convoque
//      sur « Tu es convoque », les autres sur le plein ecran EN LECTURE SEULE ;
//   4. une carte qui ne peut pas se dessiner (charge incomplete, type inconnu)
//      tombe sur un repli en francais — aucun mot technique.
//
// 🧱 E6 — ce fichier n'avait AUCUN temoin. Le bloc « caracterisation » fige ce
// que les AUTRES charges affichent deja (sondage, evenement partage) : il est
// vert avant comme apres, et dira si le branchement de la carte les a touchees.
//
// 🧪 VRAI react-query (c'est le cache de la convocation qui est en jeu) ; les
// SERVICES sont doubles une couche plus bas.
// ==========================================================================

const MOI = 'joueur-1';
const REMPLACANT = 'joueur-2';
const SPECTATEUR = 'spectateur-9';
const A_VENIR = '2099-06-14T16:00:00.000Z';
const CHAT_ID = 'chat-equipe';

const mockNavigate = jest.fn();
const mockUseAuth = jest.fn();
/** @type {any} */
let mockSnapshot;
/** @type {any[]} */
let mockMessages = [];

const mockServeur = {
  lectures: 0,
  reponse: 'pending',
  requireResponse: true,
  /** @type {Array<{ eventId: string, reponse: string }>} */
  reponses: [],
  version: 2,
};

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

jest.mock('@/store/authRuntime', () => ({
  getAuthRuntimeSnapshot: () => mockSnapshot,
}));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const couleurs = genererCouleurs();
  const theme = {
    Alignments: jest.requireActual('@/theme/alignements').default,
    ApplicationStyle: genererStyles(couleurs),
    Colors: couleurs,
    Fonts: genererPolices(couleurs),
    Images: new Proxy({}, { get: () => 1 }),
    scheme: 'dark',
    Spaces: jest.requireActual('@/theme/spaces').default,
  };
  return { __esModule: true, default: () => theme };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockUseAuth(),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({
    isSocketConnected: true,
    joinChat: jest.fn(),
    leaveChat: jest.fn(),
    reactToMessage: jest.fn(),
    respondToProposal: jest.fn(),
    retryFailedMessage: jest.fn(),
    sendMessage: jest.fn(),
    sendReadReceipt: jest.fn(),
    sendTypingStart: jest.fn(),
    sendTypingStop: jest.fn(),
    votePoll: jest.fn(),
  }),
}));

jest.mock('@/services/chat/chatQueriesCompat', () => ({
  useGetChatById: () => ({
    data: {
      documentId: 'chat-equipe',
      name: 'Aix-Perd en Buvette',
      participants: [],
      type: 'team',
    },
    error: null,
    isLoading: false,
    refetch: jest.fn(),
  }),
  useGetChatMessageReactions: () => ({ data: { chatDocumentId: '', data: [] } }),
  useGetChatMessages: () => ({
    data: { pages: [{ data: mockMessages }] },
    error: null,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    refetch: jest.fn(),
  }),
  // COLL-C4A3 : la liste des fils, que le site ne lit que pour la colonne de la Ville.
  useGetChats: () => ({ data: undefined }),
}));

// Le client HTTP lit ses adresses au CHARGEMENT du module : dans une copie de
// travail, `.env` n'existe pas (`piege-env-absent-worktree-import-service`).
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}));
jest.mock('@/services/chat/chatService', () => ({ createChatMessage: jest.fn() }));
jest.mock('@/services/league/leagueMatchService', () => ({
  createLeagueProposal: jest.fn(),
  respondToLeagueProposal: jest.fn(),
}));
jest.mock('@/services/messageReport/messageReportService', () => ({
  createMessageReport: jest.fn(),
}));
jest.mock('@/platform/links', () => ({ __esModule: true, default: { openUrl: jest.fn() } }));
jest.mock('@/platform/media', () => ({ __esModule: true, default: {} }));
// MSG1W §3.5 — les fenetres du « + » (grande carte d evenement, sondage du telephone) : leurs
// modules natifs ne se chargent pas dans ce banc, et ce temoin ne les regarde pas.
jest.mock('@/components/molecules/eventCard/EventCardNew', () => () => null);
jest.mock('@/components/organisms/pollCreationModal/PollCreationModal', () => () => null);

jest.mock('@/services/event/eventService', () => ({
  getEventConvocation: jest.fn(() => {
    mockServeur.lectures += 1;
    return Promise.resolve({
      branches: [{
        published: {
          requireResponse: mockServeur.requireResponse,
          reservePlayerIds: ['joueur-2'],
          reserveSnapshotPlayers: [
            { documentId: 'joueur-2', firstname: 'Paul', lastname: 'Veuillet' },
          ],
          snapshotPlayers: [
            { documentId: 'joueur-1', firstname: 'Adel', lastname: 'Ferchichi' },
            { documentId: 'joueur-2', firstname: 'Paul', lastname: 'Veuillet' },
          ],
          sportContext: 'football',
          teams: [{
            id: 't1',
            placements: [{ playerId: 'joueur-1', positionX: 50, positionY: 20 }],
          }],
          version: mockServeur.version,
        },
        responses: {
          byPlayerId: { 'joueur-1': mockServeur.reponse, 'joueur-2': 'pending' },
        },
        team: { documentId: 'team-1', name: 'Aix-Perd en Buvette' },
      }],
      event: { date: '2099-06-14T16:00:00.000Z', documentId: 'evt-1', name: '' },
    });
  }),
  getEvents: jest.fn(() => Promise.resolve({
    data: [],
    meta: { pagination: { page: 1, pageCount: 1 } },
  })),
  missingEvent: jest.fn(() => Promise.resolve({})),
  respondToEventRsvp: jest.fn((/** @type {string} */ eventId, /** @type {string} */ reponse) => {
    mockServeur.reponses.push({ eventId, reponse });
    mockServeur.reponse = reponse;
    return Promise.resolve({ changed: true });
  }),
}));

jest.mock('@/components/templates/ScreenContainer', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ScreenContainerDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, null, props.children);
  };
});

jest.mock('@/components/tactical/RenderedTacticalField', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children, style }) => (
      <View style={style} testID="mini-terrain">{children}</View>
    ),
  };
});

// Le bouton du design system, reduit a ce qui se verifie : son titre, sa
// variante (c'est elle qui dit « ta reponse ») et son appui.
jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onPress, title }) => (
      <TouchableOpacity accessibilityLabel={title} onPress={onPress}>
        <TexteRN>{title}</TexteRN>
      </TouchableOpacity>
    ),
  };
});

// eslint-disable-next-line import/first
import ConversationWeb from '../Conversation.web';

// Le premier montage transpile tout le graphe d'imports de l'ecran.
jest.setTimeout(30000);

// La carte telle que le serveur la poste (`publishLineupShareToTeamChat`).
const COMPO = {
  eventAddress: 'Pélissanne (13330)',
  eventDate: A_VENIR,
  eventDisplayName: 'Match vs US Pelican',
  eventId: 'evt-1',
  eventName: 'Match vs US Pelican',
  manualPlayers: [],
  placements: [],
  publishedVersion: 2,
  reservePlayers: [{ documentId: REMPLACANT, firstname: 'Paul', lastname: 'Veuillet' }],
  schemaVersion: 3,
  snapshotPlayers: [
    { documentId: MOI, firstname: 'Adel', lastname: 'Ferchichi' },
    { documentId: REMPLACANT, firstname: 'Paul', lastname: 'Veuillet' },
  ],
  sport: 'football',
  sportContext: 'football',
  teamId: 'team-1',
  teamName: 'Aix-Perd en Buvette',
  teams: [{
    id: 't1',
    name: 'Aix-Perd en Buvette',
    placements: [{ playerId: MOI, positionX: 50, positionY: 20 }],
  }],
  type: 'lineup_share',
};

/**
 * Un message du fil, tel que `GET /chat-messages` le rend.
 * @param {string} documentId
 * @param {any} composition
 * @returns {any}
 */
const messageDuFil = (documentId, composition) => ({
  attachments: [],
  composition,
  createdAt: '2026-09-29T08:00:00.000Z',
  documentId,
  message: '',
  sender: { documentId: 'coach-1', firstname: 'Jean', lastname: 'Coach' },
});

/** @type {any} */
let queryClient;
/** @type {any[]} */
const montes = [];

/**
 * Tout le texte rendu, noeud hote par noeud hote, colle comme le navigateur
 * colle des noeuds texte voisins (meme parcours que `PollDetailsWeb.test.js`).
 * @param {any} noeud
 * @returns {string}
 */
const texteDe = (noeud) => {
  /** @type {string[]} */
  const morceaux = [];
  const parcourir = (/** @type {any} */ enfant) => {
    if (enfant === null || enfant === undefined || enfant === false) return;
    if (typeof enfant === 'string' || typeof enfant === 'number') {
      morceaux.push(String(enfant));
      return;
    }
    (enfant.children || []).forEach(parcourir);
  };
  parcourir(noeud);
  return morceaux.join('').replace(/\s+/g, ' ').trim();
};

/**
 * Attend, borne par une CONDITION (20 tours au plus).
 * @param {() => boolean} condition
 * @returns {Promise<void>}
 */
const attendre = async (condition) => {
  for (let tour = 0; tour < 20 && !condition(); tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((resoudre) => { setTimeout(resoudre, 0); });
    });
  }
};

/**
 * Monte la messagerie du site sur un fil qui porte ces charges.
 * @param {any[]} compositions
 * @returns {Promise<any>}
 */
const monterLeFil = async (compositions) => {
  mockMessages = compositions.map((composition, index) => (
    messageDuFil(`message-${index + 1}`, composition)
  ));
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={queryClient}>
        <ConversationWeb
          navigation={{ goBack: jest.fn(), navigate: jest.fn() }}
          route={{ params: { chatId: CHAT_ID } }}
        />
      </QueryClientProvider>,
    );
  });
  montes.push(arbre);
  return arbre;
};

/**
 * Les boutons de reponse de la carte (par leur titre).
 * @param {any} arbre
 * @param {string} titre
 * @returns {any[]}
 */
const boutonsDeReponse = (arbre, titre) => arbre.root
  .findAll((/** @type {any} */ noeud) => noeud.props?.title === titre
    && typeof noeud.props?.variant === 'string');

beforeEach(() => {
  queryClient = creerQueryClientDeTest();
  mockNavigate.mockClear();
  mockServeur.lectures = 0;
  mockServeur.reponse = 'pending';
  mockServeur.requireResponse = true;
  mockServeur.reponses = [];
  mockServeur.version = 2;
  mockSnapshot = { auth: { user: { documentId: MOI } } };
  mockUseAuth.mockReturnValue({
    userData: { documentId: MOI, firstname: 'Adel', lastname: 'Ferchichi' },
  });
});

afterEach(() => {
  act(() => {
    montes.splice(0).forEach((arbre) => arbre.unmount());
  });
  queryClient.clear();
});

describe('COMPO-CARTE-SITE · témoin 1 — le site montre la carte', () => {
  test('🥇 un message lineup_share montre le titre du match et « Ouvrir »', async () => {
    const arbre = await monterLeFil([COMPO]);
    const texte = texteDe(arbre.root);

    expect(texte).toContain('Match vs US Pelican');
    expect(texte).toContain('Ouvrir');
    expect(texte).toContain('Composition publiée');
  });

  test('⛔ le mot technique « lineup_share » n apparait JAMAIS', async () => {
    const arbre = await monterLeFil([COMPO]);

    expect(texteDe(arbre.root)).not.toContain('lineup_share');
  });

  test('🥇 le lieu, les noms et le compte des convoqués sont écrits', async () => {
    const arbre = await monterLeFil([COMPO]);
    const texte = texteDe(arbre.root);

    expect(texte).toContain('Pélissanne (13330)');
    expect(texte).toContain('Adel Ferchichi');
    expect(texte).toContain('Paul Veuillet');
    expect(texte).toContain('2 convoqués');
  });
});

describe('COMPO-CARTE-SITE · témoin 2 — Présent / Absent sur le site', () => {
  test('🥇 un convoqué voit Présent et Absent, sa réponse marquée', async () => {
    mockServeur.reponse = 'present';
    const arbre = await monterLeFil([COMPO]);
    await attendre(() => boutonsDeReponse(arbre, 'Absent').length > 0);

    expect(boutonsDeReponse(arbre, 'Présent')).toHaveLength(1);
    expect(boutonsDeReponse(arbre, 'Absent')).toHaveLength(1);
    expect(boutonsDeReponse(arbre, 'Présent')[0].props.variant).toBe('Primary');
    expect(boutonsDeReponse(arbre, 'Absent')[0].props.variant).toBe('Secondary');
  });

  test('🥇 répondre depuis le site passe par la MÊME route que le téléphone', async () => {
    const arbre = await monterLeFil([COMPO]);
    await attendre(() => boutonsDeReponse(arbre, 'Absent').length > 0);

    await act(async () => {
      arbre.root.findByProps({ accessibilityLabel: 'Absent' }).props.onPress();
    });
    await attendre(() => boutonsDeReponse(arbre, 'Absent')[0]?.props?.variant === 'Primary');

    expect(mockServeur.reponses).toEqual([{ eventId: 'evt-1', reponse: 'absent' }]);
    expect(boutonsDeReponse(arbre, 'Absent')[0].props.variant).toBe('Primary');
  });

  test('⛔ un lecteur NON convoqué n a aucun bouton, et rien n est demandé au serveur', async () => {
    mockSnapshot = { auth: { user: { documentId: SPECTATEUR } } };
    mockUseAuth.mockReturnValue({ userData: { documentId: SPECTATEUR } });
    const arbre = await monterLeFil([COMPO]);
    await attendre(() => false);

    expect(texteDe(arbre.root)).toContain('Match vs US Pelican');
    expect(boutonsDeReponse(arbre, 'Présent')).toHaveLength(0);
    expect(boutonsDeReponse(arbre, 'Absent')).toHaveLength(0);
    expect(mockServeur.lectures).toBe(0);
  });

  test('⛔ la publication n a PAS demandé de réponse : aucun bouton', async () => {
    mockServeur.requireResponse = false;
    const arbre = await monterLeFil([COMPO]);
    await attendre(() => mockServeur.lectures > 0);
    await attendre(() => false);

    expect(mockServeur.lectures).toBeGreaterThan(0);
    expect(boutonsDeReponse(arbre, 'Absent')).toHaveLength(0);
  });
});

describe('COMPO-CARTE-SITE · témoin 3 — « Ouvrir » mène à la page web équivalente', () => {
  /**
   * L'adresse que le site ouvre pour ce `navigate` : c'est `buildWebPath` que
   * l'adaptateur de navigation du site appelle (`webNavigationAdapter.js`).
   * @returns {string}
   */
  const adresseOuverte = () => {
    const [nom, params] = mockNavigate.mock.calls[mockNavigate.mock.calls.length - 1];
    return buildWebPath(nom, params);
  };

  /**
   * Le bouton-carte : le premier bouton qui porte le resume de la carte.
   * @param {any} arbre
   * @returns {any}
   */
  const boutonCarte = (arbre) => arbre.root.findAll(
    (/** @type {any} */ n) => typeof n.props?.onPress === 'function'
      && n.props?.accessibilityHint === 'Ouvre la composition',
  )[0];

  test('🥇 un convoqué ouvre « Tu es convoqué » du site', async () => {
    const arbre = await monterLeFil([COMPO]);
    act(() => { boutonCarte(arbre).props.onPress(); });

    expect(adresseOuverte()).toBe('/match/convocation/me?eventId=evt-1');
  });

  test('🥇 un autre lecteur ouvre le plein écran du site EN LECTURE SEULE', async () => {
    mockSnapshot = { auth: { user: { documentId: SPECTATEUR } } };
    mockUseAuth.mockReturnValue({ userData: { documentId: SPECTATEUR } });
    const arbre = await monterLeFil([COMPO]);
    act(() => { boutonCarte(arbre).props.onPress(); });

    const adresse = adresseOuverte();
    expect(adresse.startsWith('/match/composition/board?')).toBe(true);
    const params = new URLSearchParams(adresse.split('?')[1]);
    expect(params.get('eventId')).toBe('evt-1');
    expect(params.get('readOnly')).toBe('true');
    expect(params.get('refreshFromServer')).toBe('true');
    // 🧨 Une adresse web ne porte que des CHAINES : `canEdit=false` y arrive
    // en « false », une chaine NON VIDE — donc VRAIE pour le plateau, qui
    // montrerait « Modifier » a un simple lecteur. Le droit absent est absent.
    expect(params.has('canEdit')).toBe(false);
  });
});

describe('COMPO-CARTE-SITE · témoin 4 — le repli est en français', () => {
  test('⛔ une carte sans match rattaché : texte français, aucun mot technique', async () => {
    const arbre = await monterLeFil([{ type: 'lineup_share' }]);
    const texte = texteDe(arbre.root);

    expect(texte).not.toContain('lineup_share');
    expect(texte).toContain('Composition publiée');
    expect(texte).toContain('Ce contenu ne peut pas s’afficher sur le site.');
  });

  test('⛔ un type de charge inconnu : texte français, pas son nom technique', async () => {
    const arbre = await monterLeFil([{ type: 'charge_du_futur' }]);
    const texte = texteDe(arbre.root);

    expect(texte).not.toContain('charge_du_futur');
    expect(texte).toContain('Ce contenu ne peut pas s’afficher sur le site.');
  });
});

describe('COMPO-CARTE-SITE · caractérisation (E6) — les autres charges ne bougent pas', () => {
  test('un sondage garde sa question et ses options', async () => {
    const arbre = await monterLeFil([{
      options: [
        { id: 'o1', label: 'Samedi 14h', voters: [] },
        { id: 'o2', label: 'Dimanche 10h', voters: [] },
      ],
      question: 'Quel créneau pour le match ?',
      type: 'poll',
    }]);
    const texte = texteDe(arbre.root);

    expect(texte).toContain('Quel créneau pour le match ?');
    expect(texte).toContain('Samedi 14h');
    expect(texte).toContain('Dimanche 10h');
  });

  test('un événement partagé garde son nom et son bouton', async () => {
    const arbre = await monterLeFil([{
      eventDocumentId: 'evt-9',
      eventName: 'Tournoi de Noël',
      type: 'event_share',
    }]);
    const texte = texteDe(arbre.root);

    expect(texte).toContain('Tournoi de Noël');
    expect(texte).toContain('Voir l événement');
  });
});
