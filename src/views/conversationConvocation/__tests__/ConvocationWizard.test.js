import {
  Alert, StyleSheet, Text, TouchableOpacity,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TimePickerInput from '@/components/molecules/timePickerInput/TimePickerInput';

import { publishEventConvocation, saveEventCompositionDraft } from '@/services/event/eventService';

import ConvocationWizard from '../ConvocationWizard';
import { exempleHeureDeRendezVous } from '../convocationWizardUtils';

const brouillon = /** @type {any} */ (saveEventCompositionDraft);
const publication = /** @type {any} */ (publishEventConvocation);

// MESSAGERIE-1C — L'ASSISTANT « CONVOCATION » DU GROUPE D'EQUIPE, etape par etape.
//
// Il n'observe que le TEXTE VISIBLE, les boutons et les APPELS AU SERVEUR : c'est ce que
// l'entraineur voit et ce que le serveur recoit. Les services sont doubles, le theme et les
// traductions francaises sont les VRAIS.

const TEAM = 'equipe-seniors';

/** @type {any} */
const mockState = {
  composition: {},
  events: [],
  messages: [],
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({}),
}));

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  const lire = (/** @type {string} */ cle) => String(cle || '').split('.').reduce(
    (/** @type {any} */ noeud, /** @type {string} */ segment) => (
      noeud && typeof noeud === 'object' ? noeud[segment] : undefined
    ),
    traductions,
  );
  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ options) => {
        let valeur = lire(cle);
        // Regle du francais (CLDR) : 0 et 1 sont au singulier.
        if (typeof valeur !== 'string' && options && options.count !== undefined) {
          valeur = lire(`${cle}_${Math.abs(options.count) < 2 ? 'one' : 'other'}`);
        }
        if (typeof valeur !== 'string') return cle;
        return valeur.replace(/{{(\w+)}}/g, (_tout, nom) => (
          options && options[nom] !== undefined ? String(options[nom]) : ''
        ));
      },
    }),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: {},
      Spaces: espaces,
    }),
  };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { documentId: 'coach-1', firstname: 'Coach' } }),
}));

const mockSendMessage = jest.fn(() => 'temp-1');
jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ sendMessage: mockSendMessage }),
}));

jest.mock('@/domains/subscription/subscriptionDecision', () => ({
  extractSubscriptionDecisionFromError: (/** @type {any} */ erreur) => erreur?.decision || null,
}));

jest.mock('@/domains/refresh/afterAction', () => ({
  invalidateAfterAction: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => ({
  __esModule: true,
  default: () => null,
  SvgIcon: () => null,
}));

jest.mock('@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { isVisible }) => (
      isVisible ? <TexteRN>MUR PAYANT</TexteRN> : null
    ),
  };
});

jest.mock('@/components/molecules/eventCard/EventCardNew', () => {
  const { Text: TexteRN, TouchableOpacity: Touche } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { item, onPress }) => (
      <Touche onPress={onPress} testID={`carte-${item.documentId}`}>
        <TexteRN>{`CARTE ${item.name}`}</TexteRN>
      </Touche>
    ),
  };
});

jest.mock('@/services/chat/chatQueriesCompat', () => ({
  useGetChatMessages: () => ({ data: { pages: [{ data: mockState.messages }] } }),
}));

jest.mock('@/services/chat/chatService', () => ({
  createChatMessage: jest.fn(() => Promise.resolve({})),
}));

jest.mock('@/services/event/eventQueries', () => ({
  useGetEvents: (/** @type {any} */ params, /** @type {any} */ options) => ({
    data: options?.enabled ? { pages: [{ data: mockState.events }] } : undefined,
    isFetching: false,
  }),
  useGetEventTeamComposition: (
    /** @type {string} */ eventId,
    /** @type {string} */ _teamId,
    /** @type {any} */ options,
  ) => ({
    data: options?.enabled ? mockState.composition[eventId] : undefined,
    isError: false,
    isFetching: false,
    refetch: jest.fn(),
  }),
}));

jest.mock('@/services/event/eventService', () => ({
  publishEventConvocation: jest.fn(() => Promise.resolve({})),
  saveEventCompositionDraft: jest.fn(() => Promise.resolve({})),
}));

const player = (documentId, firstname, lastname) => ({ documentId, firstname, lastname });

const matchSamedi = {
  date: '2026-10-10T13:00:00.000Z',
  documentId: 'match-samedi',
  name: 'Match vs US Pelican',
  team: { activities: [{ name: 'Football' }], documentId: TEAM },
  type: { name: 'Match' },
};
const entrainement = {
  date: '2026-10-08T17:00:00.000Z',
  documentId: 'entrainement-mercredi',
  name: 'Entraînement',
  team: { documentId: TEAM },
  type: { name: 'Entraînement' },
};
const autreEquipe = {
  date: '2026-10-09T10:00:00.000Z',
  documentId: 'match-u15',
  name: 'Match U15',
  team: { documentId: 'equipe-u15' },
  type: { name: 'Match' },
};
const detection = {
  date: '2026-10-11T10:00:00.000Z',
  documentId: 'detection',
  name: 'Journée détection',
  team: { documentId: TEAM },
  type: { name: 'Détection' },
};

const effectif = [
  player('hugo', 'Hugo', 'Martin'),
  player('sami', 'Sami', 'Diallo'),
  player('theo', 'Théo', 'Garcia'),
];

beforeEach(() => {
  jest.clearAllMocks();
  mockState.events = [matchSamedi, entrainement, autreEquipe, detection];
  mockState.messages = [];
  mockState.composition = {
    [entrainement.documentId]: {
      eligiblePlayers: effectif, published: null, responses: null, rsvpEnabled: true,
    },
    [matchSamedi.documentId]: {
      eligiblePlayers: effectif, published: null, responses: null, rsvpEnabled: true,
    },
  };
});

/**
 * Ouvre l'assistant, en creation par defaut.
 * @param {any} [props] `mode`, `initialEventId`, `startStep`, `eventSummary`.
 * @returns {{ arbre: any, onClose: jest.Mock }}
 */
const ouvrir = (props = {}) => {
  const onClose = jest.fn();
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <ConvocationWizard
        chatId="fil-equipe"
        eventSummary={props.eventSummary}
        initialEventId={props.initialEventId}
        mode={props.mode}
        onClose={onClose}
        startStep={props.startStep}
        teamId={TEAM}
        teamName="Seniors"
        visible
      />,
    );
  });
  return { arbre, onClose };
};

const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => [].concat(noeud.props.children).join(''));

const parTestId = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root
  .findAll((/** @type {any} */ noeud) => noeud.props.testID === id
    && noeud.type === TouchableOpacity);

const appuyer = (/** @type {any} */ arbre, /** @type {string} */ id) => {
  const [bouton] = parTestId(arbre, id);
  if (!bouton) throw new Error(`bouton introuvable : ${id}`);
  act(() => { bouton.props.onPress(); });
};

const estActif = (/** @type {any} */ arbre, /** @type {string} */ id) => !parTestId(arbre, id)[0]
  .props.disabled;

describe('MESSAGERIE-1C · etape 1 « Evenement »', () => {
  test('« Nouvelle convocation », Etape 1 sur 4, QUE les evenements de l equipe', () => {
    const { arbre } = ouvrir();
    const vus = textes(arbre);
    expect(vus).toContain('Nouvelle convocation');
    expect(vus).toContain('Étape 1 sur 4 · Événement');
    expect(vus).toContain('POUR QUEL ÉVÉNEMENT ?');
    // Du plus proche au plus lointain ; ni l autre equipe, ni la detection (pas de carte au fil).
    expect(vus.filter((texte) => texte.startsWith('CARTE '))).toEqual([
      'CARTE Entraînement',
      'CARTE Match vs US Pelican',
    ]);
  });

  test('« Suivant » attend le choix ; l evenement choisi porte la coche', () => {
    const { arbre } = ouvrir();
    expect(estActif(arbre, 'convocation-wizard-next')).toBe(false);
    expect(arbre.root.findAll((n) => n.props.testID === 'convocation-event-check')).toHaveLength(0);

    appuyer(arbre, 'carte-match-samedi');
    expect(arbre.root.findAll((n) => n.props.testID === 'convocation-event-check').length)
      .toBeGreaterThan(0);
    expect(estActif(arbre, 'convocation-wizard-next')).toBe(true);

    appuyer(arbre, 'convocation-wizard-next');
    expect(textes(arbre)).toContain('Étape 2 sur 4 · Joueurs');
  });

  test('la fleche retour de l etape 1 ferme l assistant', () => {
    const { arbre, onClose } = ouvrir();
    appuyer(arbre, 'convocation-wizard-back');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('aucun evenement a venir : on le dit', () => {
    mockState.events = [autreEquipe];
    const { arbre } = ouvrir();
    expect(textes(arbre)).toContain('Aucun événement à venir pour cette équipe.');
  });
});

/**
 * Ouvre l'assistant et va jusqu'a l'etape 2 sur le match du samedi.
 * @returns {{ arbre: any, onClose: jest.Mock }}
 */
const allerAuxJoueurs = () => {
  const ouvert = ouvrir();
  appuyer(ouvert.arbre, 'carte-match-samedi');
  appuyer(ouvert.arbre, 'convocation-wizard-next');
  return ouvert;
};

const estCoche = (/** @type {any} */ arbre, /** @type {string} */ id) => parTestId(
  arbre,
  `convocation-check-${id}`,
)[0].props.accessibilityState.checked;

describe('MESSAGERIE-1C · etape 2 « Joueurs »', () => {
  // 🐞 Recolte 1W (08/10) : sur le SITE, le « Suivant » compact du pied (a cote de « N convoques »)
  // etait rogne en « ivant » : `flex: 0` passe tel quel au navigateur (0 1 0 %), le bouton se
  // repliait sur ses marges. Il se dimensionne desormais a son texte, sans jamais retrecir.
  test('le « Suivant » compact garde son libelle entier et ne retrecit pas sous 44', () => {
    const { arbre } = allerAuxJoueurs();
    const [bouton] = parTestId(arbre, 'convocation-wizard-next');
    const style = StyleSheet.flatten(bouton.props.style);
    expect(style.flex).toBeUndefined();
    expect(style.flexBasis).toBeUndefined();
    expect(style.flexShrink).toBe(0);
    expect(style.minWidth).toBeGreaterThanOrEqual(44);
    const libelles = bouton.findAllByType(Text)
      .map((/** @type {any} */ n) => [].concat(n.props.children).join(''));
    expect(libelles).toContain('Suivant');
  });

  test('l effectif a cocher ; « Tout l effectif » ; les compteurs suivent', () => {
    const { arbre } = allerAuxJoueurs();
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Ajouter un joueur (nom, prénom)', 'Hugo Martin', 'Sami Diallo', 'Théo Garcia',
      '0 TERRAIN · 0 BANC', 'Tout l’effectif',
    ]));
    // Personne de convoque : on ne peut pas avancer.
    expect(estActif(arbre, 'convocation-wizard-next')).toBe(false);

    appuyer(arbre, 'convocation-whole-squad');
    expect(['hugo', 'sami', 'theo'].map((id) => estCoche(arbre, id))).toEqual([true, true, true]);
    expect(textes(arbre)).toContain('3 TERRAIN · 0 BANC');
    expect(textes(arbre)).toContain('3 convoqués');
    expect(estActif(arbre, 'convocation-wizard-next')).toBe(true);
  });

  test('cocher envoie sur le terrain, « Banc » ne change que la place, decocher annule', () => {
    const { arbre } = allerAuxJoueurs();
    appuyer(arbre, 'convocation-check-sami');
    expect(textes(arbre)).toContain('1 TERRAIN · 0 BANC');

    const [banc] = arbre.root.findByProps({ testID: 'convocation-row-sami' })
      .findAll((/** @type {any} */ n) => n.props.testID === 'convocation-side-bench'
        && n.type === TouchableOpacity);
    act(() => { banc.props.onPress(); });
    expect(textes(arbre)).toContain('0 TERRAIN · 1 BANC');
    expect(estCoche(arbre, 'sami')).toBe(true);

    appuyer(arbre, 'convocation-check-sami');
    expect(textes(arbre)).toContain('0 TERRAIN · 0 BANC');
    expect(textes(arbre)).toContain('0 convoqué');
  });

  test('« manuels B » : les manuels de la derniere convocation reviennent DECOCHES', () => {
    mockState.messages = [{
      composition: {
        eventId: 'match-precedent',
        manualPlayers: [{
          documentId: 'manual_1',
          firstname: 'Kévin',
          id: 'manual_1',
          isManual: true,
          lastname: 'Sans-Compte',
        }],
        publishedAt: '2026-10-01T10:00:00.000Z',
        publishedVersion: 1,
        teamId: TEAM,
        type: 'lineup_share',
      },
    }];
    const { arbre } = allerAuxJoueurs();
    expect(textes(arbre)).toContain('Kévin Sans-Compte');
    expect(textes(arbre)).toContain('Ajouté à la main · présent');
    expect(estCoche(arbre, 'manual_1')).toBe(false);

    // « oui » : on peut le retirer de la liste.
    appuyer(arbre, 'convocation-remove-manual_1');
    expect(textes(arbre)).not.toContain('Kévin Sans-Compte');
  });

  test('« Ajouter un joueur » : prenom + nom, ajoute sans compte et coche sur le terrain', () => {
    const { arbre } = allerAuxJoueurs();
    appuyer(arbre, 'convocation-add-player');
    expect(estActif(arbre, 'convocation-add-confirm')).toBe(false);
    act(() => {
      arbre.root.findByProps({ testID: 'convocation-add-firstname' }).props.onChangeText('Rayan');
      arbre.root.findByProps({ testID: 'convocation-add-lastname' }).props.onChangeText('Delmaure');
    });
    appuyer(arbre, 'convocation-add-confirm');
    expect(textes(arbre)).toContain('Rayan Delmaure');
    expect(textes(arbre)).toContain('1 TERRAIN · 0 BANC');
  });
});

describe('MESSAGERIE-1C · modifier une convocation publiee', () => {
  beforeEach(() => {
    mockState.composition[matchSamedi.documentId] = {
      eligiblePlayers: effectif,
      published: {
        reservePlayerIds: ['theo'],
        snapshotPlayers: effectif,
        teams: [{
          placements: [
            { playerId: 'hugo', positionX: 50, positionY: 93 },
            { playerId: 'sami', positionX: 38, positionY: 79 },
          ],
        }],
        version: 2,
      },
      responses: { byPlayerId: { hugo: 'present', sami: 'absent', theo: 'pending' } },
      rsvpEnabled: true,
    };
  });

  test('« Modifier la convocation » s ouvre aux Joueurs, avec la reponse de chacun', () => {
    const { arbre } = ouvrir({
      eventSummary: { eventDisplayName: 'Match vs US Pelican', typeName: 'Match' },
      initialEventId: matchSamedi.documentId,
      mode: 'edit',
      startStep: 2,
    });
    const vus = textes(arbre);
    expect(vus).toContain('Modifier la convocation');
    expect(vus).toContain('Étape 2 sur 4 · Joueurs');
    expect(vus).toContain('Match vs US Pelican');
    expect(vus).toContain('A dit présent');
    expect(vus).toContain('A dit absent');
    expect(vus).toContain('2 TERRAIN · 1 BANC');
    expect(vus).toContain(
      'Les réponses déjà données sont gardées. Un joueur ajouté reçoit la convocation.',
    );
    // En modification, l evenement ne change pas : pas de « Changer », et « Mettre a jour » existe.
    expect(arbre.root.findAll((n) => n.props.testID === 'convocation-event-change'))
      .toHaveLength(0);
    expect(parTestId(arbre, 'convocation-wizard-update')).toHaveLength(1);
  });

  test('le retour de la premiere etape d une modification ferme l assistant', () => {
    const { arbre, onClose } = ouvrir({
      initialEventId: matchSamedi.documentId, mode: 'edit', startStep: 2,
    });
    appuyer(arbre, 'convocation-wizard-back');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

/**
 * Va jusqu'au terrain : Hugo et Sami titulaires, Theo au banc, terrain de 300 x 450.
 * @returns {{ arbre: any, onClose: jest.Mock }}
 */
const allerAuTerrain = () => {
  const ouvert = allerAuxJoueurs();
  const { arbre } = ouvert;
  appuyer(arbre, 'convocation-check-hugo');
  appuyer(arbre, 'convocation-check-sami');
  appuyer(arbre, 'convocation-check-theo');
  const [banc] = arbre.root.findByProps({ testID: 'convocation-row-theo' })
    .findAll((/** @type {any} */ n) => n.props.testID === 'convocation-side-bench'
      && n.type === TouchableOpacity);
  act(() => { banc.props.onPress(); });
  appuyer(arbre, 'convocation-wizard-next');
  const [cadre] = arbre.root.findAll((/** @type {any} */ n) => (
    n.props.testID === 'convocation-field-box')
    && typeof n.props.onLayout === 'function');
  act(() => { cadre.props.onLayout({ nativeEvent: { layout: { height: 450, width: 300 } } }); });
  return ouvert;
};

const terrain = (/** @type {any} */ arbre) => arbre.root.findAll((/** @type {any} */ n) => (
  n.props.testID === 'convocation-field' && typeof n.props.onResponderGrant === 'function'))[0];

const pastille = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props.testID === `convocation-token-${id}`
    && typeof n.props.onAccessibilityAction === 'function',
)[0];

/**
 * Le centre d'une pastille, en pixels du terrain de 300 x 450.
 * @param {any} arbre
 * @param {string} id
 * @returns {{ x: number, y: number }}
 */
const centre = (/** @type {any} */ arbre, /** @type {string} */ id) => {
  const style = [].concat(pastille(arbre, id).props.style).reduce(
    (/** @type {any} */ acc, /** @type {any} */ s) => ({ ...acc, ...(s || {}) }),
    {},
  );
  return { x: style.left + 37, y: style.top + 18 };
};

const toucher = (/** @type {number} */ x, /** @type {number} */ y) => ({
  nativeEvent: {
    locationX: x, locationY: y, pageX: x, pageY: y,
  },
});

describe('MESSAGERIE-1C · etape 3 « Placement »', () => {
  test('une pastille d initiales par titulaire, en 4-3-3 ; les remplacants dessous', () => {
    const { arbre } = allerAuTerrain();
    const vus = textes(arbre);
    expect(vus).toContain('Étape 3 sur 4 · Placement');
    expect(vus).toEqual(expect.arrayContaining([
      'HM', 'Hugo', 'SD', 'Sami', 'BANC · 1', 'Théo Garcia',
    ]));
    // Le gardien en bas au centre (50 %, 93 %), le 2e poste du 4-3-3 a (86 %, 76 %).
    expect(centre(arbre, 'hugo')).toEqual({ x: 150, y: 418.5 });
    expect(centre(arbre, 'sami')).toEqual({ x: 258, y: 342 });
  });

  test('« la PHOTO ; sinon, les initiales » (Adel, 07/10) : pastille et puce du banc', () => {
    mockState.composition[matchSamedi.documentId].eligiblePlayers = [
      { ...effectif[0], avatar: 'https://cdn.foundclub.test/hugo.jpg' },
      effectif[1],
      { ...effectif[2], avatar: { url: 'https://cdn.foundclub.test/theo.jpg' } },
    ];
    const { arbre } = allerAuTerrain();
    const photos = arbre.root.findAll((/** @type {any} */ n) => typeof n.props.imageUrl === 'string'
      && n.props.imageUrl.startsWith('https://cdn.foundclub.test/'));
    expect(photos.map((n) => n.props.imageUrl)).toEqual(expect.arrayContaining([
      'https://cdn.foundclub.test/hugo.jpg',
      'https://cdn.foundclub.test/theo.jpg',
    ]));
    // Hugo et Theo ont une photo : plus d'initiales pour eux ; Sami n'en a pas : ses initiales.
    const vus = textes(arbre);
    expect(vus).toContain('SD');
    expect(vus).not.toContain('TG');
    expect(pastille(arbre, 'hugo').props.accessibilityLabel).toBe('Hugo Martin, sur le terrain');
  });

  test('glisser une pastille la deplace librement', () => {
    const { arbre } = allerAuTerrain();
    const champ = terrain(arbre);
    act(() => { champ.props.onResponderGrant(toucher(150, 418.5)); });
    act(() => { champ.props.onResponderMove(toucher(180, 328.5)); });
    act(() => { terrain(arbre).props.onResponderRelease(toucher(180, 328.5)); });
    expect(centre(arbre, 'hugo')).toEqual({ x: 180, y: 328.5 });
  });

  test('sans glisser : toucher une pastille, puis la place voulue', () => {
    const { arbre } = allerAuTerrain();
    act(() => { terrain(arbre).props.onResponderGrant(toucher(258, 342)); });
    act(() => { terrain(arbre).props.onResponderRelease(toucher(258, 342)); });
    expect(textes(arbre)).toContain('Touche le terrain pour placer Sami Diallo.');

    act(() => { terrain(arbre).props.onResponderGrant(toucher(60, 90)); });
    act(() => { terrain(arbre).props.onResponderRelease(toucher(60, 90)); });
    expect(centre(arbre, 'sami')).toEqual({ x: 60, y: 90 });
  });

  test('au lecteur d ecran : « Avancer » monte la pastille de 5 %', () => {
    const { arbre } = allerAuTerrain();
    const hugo = pastille(arbre, 'hugo');
    expect(hugo.props.accessibilityLabel).toBe('Hugo Martin, sur le terrain');
    expect(hugo.props.accessibilityActions.map((a) => a.label))
      .toEqual(['Avancer', 'Reculer', 'Vers la gauche', 'Vers la droite']);
    act(() => { hugo.props.onAccessibilityAction({ nativeEvent: { actionName: 'up' } }); });
    // 93 % - 5 % = 88 % de 450 px.
    expect(centre(arbre, 'hugo')).toEqual({ x: 150, y: 396 });
  });
});

/**
 * Du terrain aux Details.
 * @returns {{ arbre: any, onClose: jest.Mock }}
 */
const allerAuxDetails = () => {
  const ouvert = allerAuTerrain();
  appuyer(ouvert.arbre, 'convocation-wizard-next');
  return ouvert;
};

/**
 * Appuie sur le bouton d'envoi et laisse partir les appels au serveur.
 * @param {any} arbre
 * @param {string} [id]
 * @returns {Promise<void>}
 */
const envoyer = async (arbre, id = 'convocation-wizard-next') => {
  const [bouton] = parTestId(arbre, id);
  await act(async () => { await bouton.props.onPress(); });
};

describe('MESSAGERIE-1C · etape 4 « Details » et envoi', () => {
  // CONVOC-RDV (08/10) : le rendez-vous n'est plus pre-rempli en VRAIE valeur (« 13h30 au club »
  // partait tel quel) ; l'heure se choisit au selecteur, qui s'ouvre sur un exemple.
  test('« Rendez-vous » (heure + lieu), « Infos », « Demander Present / Absent » allume', () => {
    const { arbre } = allerAuxDetails();
    const vus = textes(arbre);
    expect(vus).toContain('Étape 4 sur 4 · Détails');
    expect(vus).toEqual(expect.arrayContaining([
      'RENDEZ-VOUS', 'Heure', 'Lieu', 'INFOS', 'Demander Présent / Absent',
      '2 sur le terrain · 1 sur le banc', 'Envoyer la convocation',
    ]));
    expect(arbre.root.findByType(TimePickerInput).props.value).toBe('');
    expect(arbre.root.findByProps({ testID: 'convocation-ask' }).props.value).toBe(true);
  });

  test('« Envoyer » : la publication EXISTANTE, avec les positions du terrain', async () => {
    const { arbre, onClose } = allerAuTerrain();
    // Hugo est deplace avant l'envoi.
    act(() => { terrain(arbre).props.onResponderGrant(toucher(150, 418.5)); });
    act(() => { terrain(arbre).props.onResponderMove(toucher(180, 328.5)); });
    act(() => { terrain(arbre).props.onResponderRelease(toucher(180, 328.5)); });
    appuyer(arbre, 'convocation-wizard-next');
    act(() => {
      arbre.root.findByProps({ testID: 'convocation-infos' }).props.onChangeText('Maillot bleu');
    });
    await envoyer(arbre);

    expect(brouillon).toHaveBeenCalledTimes(1);
    const [eventId, { draft, teamId }] = brouillon.mock.calls[0];
    expect(eventId).toBe('match-samedi');
    expect(teamId).toBe(TEAM);
    expect(draft.teams[0].placements).toEqual([
      {
        playerId: 'hugo', positionX: 60, positionY: 73, slotId: null,
      },
      {
        playerId: 'sami', positionX: 86, positionY: 76, slotId: null,
      },
    ]);
    expect(draft.reservePlayerIds).toEqual(['theo']);
    expect(draft.requireResponse).toBe(true);
    expect(draft.visibility).toBe('team');

    // Le brouillon AVANT la publication (sinon on publierait l etat precedent).
    expect(publication).toHaveBeenCalledWith('match-samedi', { teamId: TEAM });
    expect(brouillon.mock.invocationCallOrder[0])
      .toBeLessThan(publication.mock.invocationCallOrder[0]);

    // Les infos partent dans le groupe, en message ; aucun rendez-vous choisi, aucun invente.
    expect(mockSendMessage).toHaveBeenCalledWith(
      'fil-equipe',
      'Infos : Maillot bleu',
      expect.any(Object),
    );
    expect(Object.prototype.hasOwnProperty.call(draft, 'rendezVous')).toBe(false);
    expect(onClose).toHaveBeenCalledWith({ published: true });
  });

  test('un joueur a la main COCHE part dans la composition, un repropose decoche non', async () => {
    mockState.messages = [{
      composition: {
        manualPlayers: [
          {
            documentId: 'manual_1',
            firstname: 'Kévin',
            id: 'manual_1',
            isManual: true,
            lastname: 'A',
          },
          {
            documentId: 'manual_2', firstname: 'Léo', id: 'manual_2', isManual: true, lastname: 'B',
          },
        ],
        publishedAt: '2026-10-01T10:00:00.000Z',
        teamId: TEAM,
        type: 'lineup_share',
      },
    }];
    const { arbre } = allerAuxJoueurs();
    appuyer(arbre, 'convocation-check-hugo');
    appuyer(arbre, 'convocation-check-manual_1');
    appuyer(arbre, 'convocation-wizard-next');
    appuyer(arbre, 'convocation-wizard-next');
    await envoyer(arbre);

    const [, { draft }] = brouillon.mock.calls[0];
    expect(draft.manualPlayers.map((p) => p.documentId)).toEqual(['manual_1']);
    expect(draft.selectedPlayerIds).toEqual(['hugo', 'manual_1']);
  });

  test('reponses non demandees : pack a false ; rendez-vous vide : aucun message', async () => {
    const { arbre } = allerAuxDetails();
    act(() => {
      arbre.root.findByProps({ testID: 'convocation-ask' }).props.onValueChange(false);
    });
    await envoyer(arbre);
    expect(brouillon.mock.calls[0][1].draft.requireResponse).toBe(false);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  test('reponses coupees par l organisateur : interrupteur verrouille, pack a false', async () => {
    mockState.composition[matchSamedi.documentId].rsvpEnabled = false;
    const { arbre } = allerAuxDetails();
    const interrupteur = arbre.root.findByProps({ testID: 'convocation-ask' });
    expect(interrupteur.props.value).toBe(false);
    expect(interrupteur.props.disabled).toBe(true);
    expect(textes(arbre)).toContain(
      'Les réponses sont coupées sur cet événement : personne ne pourra répondre.',
    );
    await envoyer(arbre);
    expect(brouillon.mock.calls[0][1].draft.requireResponse).toBe(false);
  });

  test('un refus du serveur : l entraineur est prevenu, l assistant reste ouvert', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    publication.mockRejectedValueOnce(new Error('refus'));
    const { arbre, onClose } = allerAuxDetails();
    await envoyer(arbre);
    expect(alerte).toHaveBeenCalledWith(
      'Convocation non envoyée',
      'La convocation n\'a pas pu partir. Réessaie dans un instant.',
    );
    expect(onClose).not.toHaveBeenCalled();
    alerte.mockRestore();
  });

  test('un refus d abonnement montre l offre (mur payant), comme le plateau', async () => {
    brouillon.mockRejectedValueOnce({ decision: { reason: 'offre' } });
    const { arbre, onClose } = allerAuxDetails();
    await envoyer(arbre);
    expect(textes(arbre)).toContain('MUR PAYANT');
    expect(publication).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  test('modification : « Mettre a jour » publie des l etape Joueurs, sans message', async () => {
    mockState.composition[matchSamedi.documentId] = {
      eligiblePlayers: effectif,
      published: {
        reservePlayerIds: [],
        snapshotPlayers: effectif,
        sportContext: 'Football',
        teams: [{ placements: [{ playerId: 'hugo', positionX: 40, positionY: 60 }] }],
        version: 2,
      },
      responses: { byPlayerId: { hugo: 'present' } },
      rsvpEnabled: true,
    };
    const { arbre, onClose } = ouvrir({
      initialEventId: matchSamedi.documentId, mode: 'edit', startStep: 2,
    });
    appuyer(arbre, 'convocation-check-sami');
    await envoyer(arbre, 'convocation-wizard-update');

    const [, { draft }] = brouillon.mock.calls[0];
    // Hugo garde SA place publiee ; Sami, nouveau titulaire, prend un poste libre du 4-3-3.
    expect(draft.teams[0].placements).toEqual([
      {
        playerId: 'hugo', positionX: 40, positionY: 60, slotId: null,
      },
      {
        playerId: 'sami', positionX: 50, positionY: 93, slotId: null,
      },
    ]);
    expect(publication).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledWith({ published: true });
  });
});

// ==========================================================================
// CONVOC-RDV (decision d'Adel du 08/10, `rdv lot`) — L'HEURE DU RENDEZ-VOUS AU SELECTEUR,
// LE LIEU DANS UN CHAMP, LES DEUX DANS LA CONVOCATION.
//
// Avant : un texte libre, pre-rempli « 13h30 au club », envoye en MESSAGE apres la carte. Le
// serveur range desormais `rendezVous: { time, place }` dans la convocation et le rend dans la
// reponse de publication : c'est ce retour qui dit a l'app s'il le connait. Un serveur d'avant ne
// le rend pas : le rendez-vous repart alors en message texte, comme avant (repli, aucune erreur).
// ==========================================================================
describe('CONVOC-RDV · etape 4 : le rendez-vous', () => {
  const STADE = 'Stade Georges Ricard';

  beforeEach(() => {
    mockState.events = [{ ...matchSamedi, facility: { name: STADE } }, entrainement];
  });

  const heure = (/** @type {any} */ arbre) => arbre.root.findByType(TimePickerInput);
  const lieu = (/** @type {any} */ arbre) => arbre.root.findAll(
    (/** @type {any} */ n) => n.props.testID === 'convocation-meeting-place'
      && typeof n.props.onChangeText === 'function',
  )[0];
  /**
   * Choisit l'heure au selecteur, puis (si donne) tape le lieu.
   * @param {any} arbre
   * @param {string} valeurHeure
   * @param {string} [valeurLieu]
   */
  const choisir = (arbre, valeurHeure, valeurLieu) => {
    act(() => { heure(arbre).props.onChange(valeurHeure); });
    if (valeurLieu !== undefined) act(() => { lieu(arbre).props.onChangeText(valeurLieu); });
  };

  test('heure au SELECTEUR, vide, ouverte sur le coup d envoi - 1 h ; lieu de l evenement', () => {
    const { arbre } = allerAuxDetails();
    expect(heure(arbre).props.value).toBe('');
    expect(heure(arbre).props.placeholder).toBe(exempleHeureDeRendezVous(matchSamedi.date));
    expect(heure(arbre).props.testID).toBe('convocation-meeting-time');
    expect(lieu(arbre).props.value).toBe(STADE);
    expect(lieu(arbre).props.maxLength).toBe(120);
  });

  test('choisi : le RDV part dans la convocation ; seules les infos en message', async () => {
    publication.mockResolvedValueOnce({
      published: { rendezVous: { place: 'Au club', time: '13:30' }, version: 1 },
    });
    const { arbre, onClose } = allerAuxDetails();
    choisir(arbre, '13:30', 'Au club');
    act(() => {
      arbre.root.findByProps({ testID: 'convocation-infos' }).props.onChangeText('Maillot bleu');
    });
    await envoyer(arbre);

    expect(brouillon.mock.calls[0][1].draft.rendezVous)
      .toEqual({ place: 'Au club', time: '13:30' });
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage)
      .toHaveBeenCalledWith('fil-equipe', 'Infos : Maillot bleu', expect.any(Object));
    expect(onClose).toHaveBeenCalledWith({ published: true });
  });

  test('l heure seule garde le lieu de l evenement', async () => {
    publication.mockResolvedValueOnce({ published: { rendezVous: null, version: 1 } });
    const { arbre } = allerAuxDetails();
    choisir(arbre, '14:00');
    await envoyer(arbre);
    expect(brouillon.mock.calls[0][1].draft.rendezVous).toEqual({ place: STADE, time: '14:00' });
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  test('serveur SANS le champ : le RDV repart en message texte, aucune erreur', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { arbre, onClose } = allerAuxDetails();
    choisir(arbre, '13:30', 'Au club');
    await envoyer(arbre);

    expect(mockSendMessage).toHaveBeenCalledWith(
      'fil-equipe',
      'Rendez-vous : 13:30 · Au club',
      expect.any(Object),
    );
    expect(alerte).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledWith({ published: true });
    alerte.mockRestore();
  });

  test('un telephone dans le lieu : dit SOUS le champ, et l envoi attend', async () => {
    const { arbre } = allerAuxDetails();
    choisir(arbre, '13:30', 'Appelle au 06 12 34 56 78');
    expect(textes(arbre)).toContain(
      'Le lieu est lu par toute l’équipe : ni téléphone, ni courriel, ni lien.',
    );
    expect(estActif(arbre, 'convocation-wizard-next')).toBe(false);
    await envoyer(arbre);
    expect(brouillon).not.toHaveBeenCalled();
  });

  test('modifier : le RDV publie revient, et « Mettre a jour » seul le garde', async () => {
    mockState.composition[matchSamedi.documentId] = {
      eligiblePlayers: effectif,
      published: {
        rendezVous: { place: 'Gymnase', time: '10:00' },
        reservePlayerIds: [],
        snapshotPlayers: effectif,
        teams: [{ placements: [{ playerId: 'hugo', positionX: 40, positionY: 60 }] }],
        version: 2,
      },
      responses: { byPlayerId: {} },
      rsvpEnabled: true,
    };
    const { arbre } = ouvrir({
      initialEventId: matchSamedi.documentId, mode: 'edit', startStep: 2,
    });
    await envoyer(arbre, 'convocation-wizard-update');
    // Absent ≠ vide : la cle n'est pas envoyee, le serveur garde le rendez-vous publie.
    expect(Object.prototype.hasOwnProperty.call(brouillon.mock.calls[0][1].draft, 'rendezVous'))
      .toBe(false);

    const second = ouvrir({ initialEventId: matchSamedi.documentId, mode: 'edit', startStep: 3 });
    appuyer(second.arbre, 'convocation-wizard-next');
    expect(heure(second.arbre).props.value).toBe('10:00');
    expect(lieu(second.arbre).props.value).toBe('Gymnase');
  });
});
