import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { subscribeToGuidanceSignals } from '@/domains/guidance/guidanceRuntime';

// GUIDES-SITE-CORR S27 (tournée du site, 09/11, D 390 rangs 088-091) : au bonus 3, avec 2 puis 3
// membres « Exemple » cochés, la barre disait « Discussion privée » et « Démarrer » répondait
// « coche au moins 2 membres ». Cause : sur le site, `FC_CHAT_GROUP_V1` vaut 'false' par défaut
// (web/vite.config.ts) ; l'écran ne savait plus faire de groupe, même simulé. En simulation, rien
// n'est créé : le drapeau ne compte pas.
// Le drapeau est lu au chargement du module : on le pose AVANT de charger l'écran.
process.env.FC_CHAT_GROUP_V1 = 'false';
const NewConversation = require('../NewConversation').default;

const mockStartWhisperChat = jest.fn();
const mockStartGroupChat = jest.fn();
const mockGoBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ valeurs) => {
      const gabarit = typeof repli === 'string' ? repli : repli?.defaultValue;
      if (typeof gabarit !== 'string') return cle;
      const v = (typeof repli === 'object' ? repli : valeurs) || {};
      return gabarit.replace(/\{\{(\w+)\}\}/g, (_m, nom) => (v[nom] !== undefined ? String(v[nom]) : _m));
    },
  }),
}));
jest.mock('i18next', () => ({
  t: (/** @type {string} */ _cle, /** @type {any} */ repli) => (
    typeof repli === 'string' ? repli : _cle
  ),
}));
jest.mock('react-native-svg', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    Circle: VueRN,
    default: VueRN,
    Line: VueRN,
    Path: VueRN,
    Polyline: VueRN,
    Rect: VueRN,
    Svg: VueRN,
  };
});
jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(couleurs),
      Colors: couleurs,
      Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    allMyTeams: [],
    clubVerificationSummary: null,
    userData: {
      club: { documentId: 'club-1' },
      documentId: 'moi',
      firstname: 'Adel',
      role: { name: 'Dirigeant' },
    },
  }),
}));
jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({
    addGroupMembers: jest.fn(),
    startGroupChat: (/** @type {any} */ a) => mockStartGroupChat(a),
    startWhisperChat: (/** @type {any} */ a) => mockStartWhisperChat(a),
  }),
}));
jest.mock('@/domains/subscription/subscriptionDecision', () => ({
  extractSubscriptionDecisionFromError: () => null,
}));
// Un club seul : le dirigeant est son unique membre ; les « Exemple » viennent du guide.
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    get: () => Promise.resolve({
      data: [{
        documentId: 'moi', firstname: 'Adel', lastname: 'F', role: { name: 'Dirigeant' },
      }],
    }),
  },
}));
jest.mock('@/services/chat/chatQueriesCompat', () => ({
  useGetChatById: () => ({ data: { participants: [] } }),
}));
jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity: Touche } = jest.requireActual('react-native');
  return function BoutonDouble({ onPress, title }) {
    return <Touche onPress={onPress}><TexteRN>{title}</TexteRN></Touche>;
  };
});
jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => () => null);
jest.mock('@/components/atoms/loader/Loader', () => () => null);
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => () => null);
jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => () => null,
);
jest.mock(
  '@/components/templates/ScreenContainer',
  () => (/** @type {any} */ props) => props.children,
);
jest.mock('@/context/useTour', () => ({
  useTour: () => ({
    currentStep: { checksMembers: true, simulatesGroup: true },
    tourStatus: 'active',
  }),
}));

/**
 * Le texte rendu par un noeud, enfants compris.
 * @param {any} noeud
 * @returns {string}
 */
const texteDe = (noeud) => noeud
  .findAllByType(Text)
  .map((/** @type {any} */ n) => [n.props.children].flat().join(''))
  .join(' ');

test('S27 : groupes éteints sur le site, 2 « Exemple » cochés font un groupe simulé', async () => {
  const signaux = /** @type {string[]} */ ([]);
  const arreter = subscribeToGuidanceSignals((/** @type {any} */ s) => { signaux.push(s.key); });
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <NewConversation
          navigation={{ goBack: mockGoBack, navigate: jest.fn(), replace: mockReplace }}
          route={{ params: {} }}
        />
      </QueryClientProvider>,
    );
  });
  const exemples = () => arbre.root.findAllByType(TouchableOpacity).filter((
    /** @type {any} */ n,
  ) => n.props?.accessibilityRole === 'checkbox'
    && String(n.props?.accessibilityLabel || '').includes('Exemple'));
  for (let tour = 0; tour < 50 && exemples().length < 2; tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((fin) => { setTimeout(fin, 10); }); });
  }
  await act(async () => { exemples()[0].props.onPress(); });
  await act(async () => { exemples()[1].props.onPress(); });

  // La barre du bas annonce un groupe, pas une discussion privée.
  expect(texteDe(arbre.root)).not.toContain('Discussion privée');
  expect(texteDe(arbre.root)).toContain('Nouveau groupe');

  // « Suivant », puis « Créer le groupe » : rien ne part, le guide l'apprend.
  const appuyer = async (/** @type {string} */ motif) => {
    const trouves = arbre.root.findAllByType(TouchableOpacity)
      .filter((/** @type {any} */ n) => texteDe(n).includes(motif));
    if (!trouves.length) throw new Error(`Aucun bouton « ${motif} »`);
    await act(async () => { await trouves[trouves.length - 1].props.onPress(); });
  };
  await appuyer('Suivant');
  await appuyer('Créer le groupe');
  expect(mockStartGroupChat).not.toHaveBeenCalled();
  expect(mockStartWhisperChat).not.toHaveBeenCalled();
  expect(signaux).toContain('conversation.group.created');
  expect(mockGoBack).toHaveBeenCalled();

  act(() => { arbre.unmount(); });
  client.clear();
  arreter();
});
