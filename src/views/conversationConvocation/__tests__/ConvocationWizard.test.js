import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ConvocationWizard from '../ConvocationWizard';

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
        if (typeof valeur !== 'string' && options && options.count !== undefined) {
          valeur = lire(`${cle}_${options.count === 1 ? 'one' : 'other'}`);
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
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({ Colors: couleurs, Fonts: genererPolices(couleurs) }),
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
