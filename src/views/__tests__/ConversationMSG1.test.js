import renderer, { act } from 'react-test-renderer';

// MSG1 / N6 — LE FILET D'ABORD (E6).
//
// Constat d'Adel (recette du 26/08) : « les messages sont hyper longs a
// s'envoyer » et « ouvrir la messagerie, c'est long ». L'audit du meme jour a
// trouve PIRE, et Adel ne l'avait pas signale parce que c'est invisible :
//
//   quand le fil telephonique du tchat est coupe, le texte tape DISPARAIT de
//   l'ecran sans etre parti nulle part, et rien ne le dit.
//
// Un message perdu ne se rattrape pas ; la lenteur, si. C'est donc ce
// temoin-la qui passe devant tous les autres.
//
// CE QUE MESURE CE FICHIER, et pourquoi c'est la BONNE couture :
// `Conversation.js` fait 6 811 lignes et n'avait AUCUN test. On ne teste pas
// ici une copie de la logique : on monte le VRAI ecran et on lit les PROPS que
// GiftedChat recoit reellement. `text` EST la valeur du champ de saisie
// (l'ecran est pilote : `text={composerText}`, Conversation.js:6086). Si le
// texte survit dans cette prop, il survit a l'ecran.
//
// Le piege verrouille au passage : les TROIS autres chemins d'envoi (piece
// jointe, note vocale, localisation) testent deja le retour de `sendMessage`
// et affichent une banniere. Le chemin TEXTE — le plus utilise de tous —
// etait le seul sans garde. La banniere EXISTE : on reutilise `showBanner`,
// on n'en fabrique pas une seconde.

const mockGiftedRenders = /** @type {any[]} */ ([]);
const mockBanners = /** @type {any[]} */ ([]);
const mockSendMessage = jest.fn();
const mockSendTypingStart = jest.fn();
const mockSendTypingStop = jest.fn();
// FINITIONS12-COLL : le fil doublé se règle (un fil de la Ville pour le témoin du canal vide).
const FIL_ORDINAIRE = { documentId: 'chat-1', participants: [], type: 'group' };
let mockChat = /** @type {any} */ (FIL_ORDINAIRE);

// VOCAL — la barre de saisie porte la zone vocale (Reanimated + Gesture Handler) :
// doublures partagées, qui gardent `Swipeable` et enregistrent les gestes.
jest.mock('react-native-gesture-handler', () => (
  // eslint-disable-next-line global-require
  require('@/testSupport/animationDouble').gestureHandler()
));
jest.mock('react-native-reanimated', () => (
  // eslint-disable-next-line global-require
  require('@/testSupport/animationDouble').reanimated()
));

// LA COUTURE : on capture les props a CHAQUE rendu, pas seulement au dernier.
jest.mock('react-native-gifted-chat', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    Bubble: VueRN,
    Composer: VueRN,
    GiftedChat: (/** @type {any} */ props) => { mockGiftedRenders.push(props); return null; },
    InputToolbar: VueRN,
    Time: VueRN,
  };
});

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(), launchImageLibrary: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 47,
  }),
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

// PERF2 — l ecran importe desormais WithDataWrapper → SkeletonLoader, qui tire
// MaskedView / LinearGradient / Reanimated : hors sujet ici (cette suite ne
// monte que des fils charges). Meme mock que les suites EventPublishedShowcase.
jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonLoaderMock() { return null; },
);

// Sans cette doublure la SUITE ENTIERE meurt au CHARGEMENT : `client` lit
// `.env`, qui est gitignore donc absent de toute copie de travail.
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(), get: jest.fn(), post: jest.fn(), put: jest.fn(),
  },
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    allMyTeams: [],
    hasClubAccess: true,
    userData: { documentId: 'moi', firstname: 'Adel', role: { name: 'Dirigeant' } },
  }),
}));
jest.mock('@/domains/auth/authUseCases', () => ({
  getAuthTokens: () => Promise.resolve({ jwt: 'jwt' }),
  getManagedMultisportIds: () => [],
  getUserRoleKey: () => 'dirigeant',
}));
jest.mock('@/theme/strings', () => ({
  __esModule: true,
  // I18N-4 : l ecran lit ses textes par i18n.t(clef, repli) ; la doublure rend le repli.
  default: {
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ valeurs) => (
      typeof repli === 'string'
        ? repli.replace(/\{\{(\w+)\}\}/g, (/** @type {string} */ m, /** @type {string} */ nom) => (
          valeurs && valeurs[nom] !== undefined ? String(valeurs[nom]) : m))
        : cle
    ),
  },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: {},
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));
jest.mock('@/hooks/useAudioPlayback', () => ({
  __esModule: true,
  default: () => ({}),
  pauseActivePlayback: () => {},
}));
jest.mock('@/hooks/useLeagueLegalAcceptance', () => ({ __esModule: true, default: () => ({}) }));
jest.mock('@/services/chat/voiceNoteService', () => ({
  cancelRecording: jest.fn(),
  deleteVoiceNoteFile: jest.fn(),
  isVoiceNoteRecordingSupported: () => false,
  startRecording: jest.fn(),
  stopRecording: jest.fn(),
}));
jest.mock('@/services/eventParticipation/eventParticipationService', () => ({
  createEventParticipation: jest.fn(),
}));
jest.mock('@/services/league/leagueMatchService', () => ({
  cancelMatch: jest.fn(), createLeagueProposal: jest.fn(), respondToLeagueProposal: jest.fn(),
}));
jest.mock('@/services/messageReport/messageReportService', () => ({
  createMessageReport: jest.fn(),
}));
jest.mock('@/services/reservation/reservationService', () => ({ joinReservation: jest.fn() }));
jest.mock('@/services/event/eventQueries', () => ({ useGetEvents: () => ({ data: null }) }));
// TRIO — l'ecran repond desormais « Absent » sur la carte d'evenement du fil, via
// `useEventAnswerMutations`. Ce hook importe `eventService`, qui charge
// `react-native-blob-util` (module ESM que Jest ne transforme pas) : sans cette
// doublure c'est la SUITE ENTIERE qui meurt au chargement, sans un seul test rouge.
// Meme motif que la ligne du dessus : ce fil-la ne mesure pas les evenements.
jest.mock('@/services/event/eventService', () => ({
  missingEvent: jest.fn(),
  respondToEventRsvp: jest.fn(),
}));
jest.mock('@/platform/share', () => ({ __esModule: true, default: { share: jest.fn() } }));

// LA BANNIERE, celle qui existe deja dans l'ecran. On capture ce qu'elle recoit.
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({
    showBanner: (/** @type {any} */ charge) => { mockBanners.push(charge); return 'banniere'; },
  }),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({
    getConversationName: () => 'Fil',
    joinChat: jest.fn(),
    leaveChat: jest.fn(),
    markMessagesAsRead: jest.fn(),
    retryMessage: jest.fn(),
    sendMessage: (/** @type {any[]} */ ...args) => mockSendMessage(...args),
    sendReadReceipt: jest.fn(),
    sendTypingStart: (/** @type {any[]} */ ...args) => mockSendTypingStart(...args),
    sendTypingStop: (/** @type {any[]} */ ...args) => mockSendTypingStop(...args),
    socket: { emit: jest.fn(), off: jest.fn(), on: jest.fn() },
    typingUsers: [],
  }),
}));

jest.mock('@/services/chat/chatQueriesCompat', () => ({
  // MSGREACT — les reactions emoji du fil. Aucune par defaut : les temoins de
  // cet ecran ne parlent pas de reactions, et une rangee vide ne se dessine pas.
  useGetChatMessageReactions: () => ({ data: { chatDocumentId: '', data: [] } }),
  useGetChatById: () => ({
    data: mockChat,
    isLoading: false,
  }),
  useGetChatMessages: () => ({
    data: { pages: [{ data: [], meta: { pagination: { page: 1, pageCount: 1, total: 0 } } }] },
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetching: false,
    isLoading: false,
  }),
}));

// Le VRAI theme, jamais un Proxy : un faux theme rend les echecs Jest illisibles.
jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const generateApplicationStyle = jest.requireActual('@/theme/applicationStyle').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: generateApplicationStyle(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      scheme: 'dark',
      Spaces,
    }),
  };
});

jest.mock('@/components/atoms/button/Button', () => () => null);
jest.mock('@/components/atoms/errorWrapper/ErrorWrapper', () => () => null);
jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => () => null);
jest.mock('@/components/molecules/bottomModal/BottomModal', () => () => null);
jest.mock(
  '@/components/molecules/compositionMessageBubble/CompositionMessageBubble',
  () => () => null,
);
jest.mock('@/components/molecules/contactShareBubble/ContactShareBubble', () => () => null);
jest.mock('@/components/molecules/documentMessageBubble/DocumentMessageBubble', () => () => null);
jest.mock('@/components/molecules/eventCard/EventCardNew', () => () => null);
jest.mock('@/components/molecules/eventMessageBubble/EventMessageBubble', () => () => null);
jest.mock('@/components/molecules/eventShareBubble/EventShareBubble', () => () => null);
jest.mock('@/components/molecules/locationShareBubble/LocationShareBubble', () => () => null);
jest.mock('@/components/molecules/pollMessageBubble/PollMessageBubble', () => () => null);
jest.mock('@/components/molecules/proposalMessageBubble/ProposalMessageBubble', () => () => null);
jest.mock('@/components/molecules/voiceNoteBubble/VoiceNoteBubble', () => () => null);
jest.mock(
  '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput',
  () => () => null,
);
jest.mock('@/components/organisms/chatAttachmentSheet/ChatAttachmentSheet', () => () => null);
jest.mock('@/components/organisms/joinEventModal/JoinEventModal', () => () => null);
jest.mock('@/components/organisms/pollCreationModal/PollCreationModal', () => () => null);
jest.mock('@/components/organisms/popup/GlobalPromptModal', () => () => null);
jest.mock('@/components/organisms/venueProposalModal/VenueProposalModal', () => () => null);

/**
 * Les props du DERNIER rendu de GiftedChat — l'etat reel de l'ecran.
 * @returns {any} Les props.
 */
const dernieresProps = () => mockGiftedRenders[mockGiftedRenders.length - 1];

/**
 * Monte le vrai ecran Conversation.
 * @returns {{ arbre: any }} L'arbre monte.
 */
const monterConversation = () => {
  // eslint-disable-next-line global-require
  const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
  // eslint-disable-next-line global-require
  const { createElement } = require('react');
  // eslint-disable-next-line global-require
  const Conversation = require('../Conversation').default;
  const clientRequetes = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(
      QueryClientProvider,
      { client: clientRequetes },
      createElement(Conversation, {
        navigation: {
          addListener: () => () => {},
          goBack: jest.fn(),
          navigate: jest.fn(),
          setOptions: jest.fn(),
        },
        route: { params: { chatId: 'chat-1' } },
      }),
    ));
  });
  return { arbre };
};

/**
 * Tape un texte dans le champ, comme le clavier le ferait.
 * @param {string} texte - Ce que l'utilisateur a tape jusqu'ici.
 * @returns {void}
 */
const taper = (texte) => {
  act(() => { dernieresProps().onInputTextChanged(texte); });
};

/**
 * Appuie sur Envoyer, exactement comme GiftedChat le fait.
 * @param {string} texte - Le texte du message envoye.
 * @returns {void}
 */
const appuyerSurEnvoyer = (texte) => {
  act(() => { dernieresProps().onSend([{ text: texte }]); });
};

beforeEach(() => {
  mockChat = FIL_ORDINAIRE;
  mockGiftedRenders.length = 0;
  mockBanners.length = 0;
  mockSendMessage.mockReset();
  mockSendTypingStart.mockReset();
  mockSendTypingStop.mockReset();
});

describe('MSG1 / N1 — le texte ne s efface plus dans le vide', () => {
  it('T1 — fil coupe : le texte RESTE dans le champ', () => {
    // `sendMessage` rend `null` quand la socket est coupee
    // (useMessaging.js:851-858). C'est ce que le telephone vit dans le metro,
    // ou sur un wifi qui bloque les websockets.
    mockSendMessage.mockReturnValue(null);
    const { arbre } = monterConversation();

    taper('rendez-vous a 14h au stade');
    appuyerSurEnvoyer('rendez-vous a 14h au stade');

    expect(dernieresProps().text).toBe('rendez-vous a 14h au stade');
    act(() => { arbre.unmount(); });
  });

  it('T2 — fil coupe : la banniere QUI EXISTE DEJA le dit, une seule fois', () => {
    mockSendMessage.mockReturnValue(null);
    const { arbre } = monterConversation();

    taper('coucou');
    appuyerSurEnvoyer('coucou');

    expect(mockBanners).toHaveLength(1);
    expect(mockBanners[0].tone).toBe('error');
    // Le meme texte que les TROIS autres chemins d'envoi : une seule phrase
    // dans toute l'app pour un seul defaut.
    expect(String(mockBanners[0].body)).toContain('Connexion messagerie indisponible');
    act(() => { arbre.unmount(); });
  });

  it('T3 — envoi reussi : le champ se vide, et AUCUNE banniere n apparait', () => {
    mockSendMessage.mockReturnValue('temp-42');
    const { arbre } = monterConversation();

    taper('coucou');
    appuyerSurEnvoyer('coucou');

    expect(dernieresProps().text).toBe('');
    expect(mockBanners).toHaveLength(0);
    act(() => { arbre.unmount(); });
  });

  it('T4 — deux messages refuses d un coup : UNE banniere, et le texte reste', () => {
    mockSendMessage.mockReturnValue(null);
    const { arbre } = monterConversation();

    taper('un');
    act(() => { dernieresProps().onSend([{ text: 'un' }, { text: 'deux' }]); });

    expect(mockBanners).toHaveLength(1);
    expect(dernieresProps().text).toBe('un');
    act(() => { arbre.unmount(); });
  });
});

describe('MSG1 / N5 — brider la frappe', () => {
  // Le serveur n'accepte que 10 evenements par seconde et par personne
  // (admin/src/socket/constants.ts:67), et ce quota est PARTAGE avec l'envoi.
  // Or l'app prevenait le serveur A CHAQUE TOUCHE. Taper vite ou coller un
  // texte epuisait le quota, et le message envoye juste apres etait REFUSE.
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('T5 — le premier caractere previent TOUT DE SUITE', () => {
    const { arbre } = monterConversation();
    taper('a');
    expect(mockSendTypingStart).toHaveBeenCalledTimes(1);
    act(() => { arbre.unmount(); });
  });

  it('T6 — 14 caracteres tapes en rafale ne font QU UN seul appel', () => {
    const { arbre } = monterConversation();
    const phrase = 'bonjour a tous';
    phrase.split('').forEach((_, index) => { taper(phrase.slice(0, index + 1)); });
    expect(mockSendTypingStart).toHaveBeenCalledTimes(1);
    act(() => { arbre.unmount(); });
  });

  it('T7 — apres une seconde, la frappe previent de nouveau', () => {
    const { arbre } = monterConversation();
    taper('a');
    act(() => { jest.advanceTimersByTime(1100); });
    taper('ab');
    expect(mockSendTypingStart).toHaveBeenCalledTimes(2);
    act(() => { arbre.unmount(); });
  });

  it('T9 — apres un envoi, le message SUIVANT reprevient tout de suite', () => {
    // Envoyer emet un `typing-stop`. Si le ralentisseur n etait pas rearme la,
    // le premier caractere du message suivant ne previendrait personne pendant
    // une seconde : le « ... » n apparaitrait plus chez l autre.
    mockSendMessage.mockReturnValue('temp-1');
    const { arbre } = monterConversation();

    taper('a');
    appuyerSurEnvoyer('a');
    expect(mockSendTypingStop).toHaveBeenCalled();

    mockSendTypingStart.mockClear();
    taper('b');

    expect(mockSendTypingStart).toHaveBeenCalledTimes(1);
    act(() => { arbre.unmount(); });
  });

  it('T8 — vider le champ arrete l indicateur, sans ralentisseur', () => {
    // `typing-stop` est le signal qui ETEINT le « ... » chez l'autre : le
    // brider laisserait un indicateur allume chez quelqu'un qui n'ecrit plus.
    const { arbre } = monterConversation();
    taper('a');
    taper('');
    expect(mockSendTypingStop).toHaveBeenCalled();
    act(() => { arbre.unmount(); });
  });
});

// 🧯 FINITIONS12-COLL (03/10) — point 3 : LE CANAL VIDE DE LA VILLE (tournée T11, C47_3).
//   a) « Envoyer » sans connexion temps réel EFFAÇAIT le texte. Les témoins MSG1 ci-dessus
//      appellent `onSend` DIRECTEMENT : ils contournent le vrai bouton, qui appelait
//      `props.onSend(message, true)` — et GiftedChat 2.8.1 (lib/GiftedChat/index.js, `_onSend`)
//      remet la barre à zéro AVANT de transmettre (`onInputTextChanged('')`) quand ce second
//      argument vaut `true`. La garde de l'écran gardait un texte déjà effacé.
//   b) La phrase d'accueil d'un fil vide s'affichait À L'ENVERS sur Android : la liste inversée
//      y retourne son contenu sur les DEUX axes (`scale: -1`, @react-native/virtualized-lists,
//      `verticallyInverted`), l'écran ne le redressait que sur un (`scaleY: -1`) ⇒ miroir.
// ROUGE avant le lot.
describe('FINITIONS12-COLL point 3 — le canal vide de la Ville', () => {
  // Le vrai bouton Envoyer, avec la remise à zéro telle que GiftedChat 2.8.1 la fait.
  const envoyerParLeBouton = (/** @type {string} */ texte) => {
    const props = dernieresProps();
    const onSendDeGiftedChat = (
      /** @type {any} */ messages,
      /** @type {boolean} */ remettreAZero,
    ) => {
      if (remettreAZero === true) props.onInputTextChanged('');
      props.onSend(Array.isArray(messages) ? messages : [messages]);
    };
    /** @type {any} */
    let bouton;
    act(() => {
      bouton = renderer.create(props.renderSend({ onSend: onSendDeGiftedChat, text: texte }));
    });
    const touche = bouton.root.findAll((/** @type {any} */ n) => (
      n.props?.accessibilityRole === 'button' && typeof n.props?.onPress === 'function'
    ))[0];
    act(() => { touche.props.onPress(); });
    act(() => { bouton.unmount(); });
  };

  it('a) sans connexion, le VRAI bouton Envoyer laisse le texte dans le champ', () => {
    mockSendMessage.mockReturnValue(null);
    const { arbre } = monterConversation();
    taper('Recette T11 canal, message de la Ville');
    envoyerParLeBouton('Recette T11 canal, message de la Ville');
    expect(dernieresProps().text).toBe('Recette T11 canal, message de la Ville');
    expect(mockBanners).toHaveLength(1);
    act(() => { arbre.unmount(); });
  });

  it('a) envoi accepté : le VRAI bouton vide le champ, comme avant', () => {
    mockSendMessage.mockReturnValue('optimiste-1');
    const { arbre } = monterConversation();
    taper('Bonjour');
    envoyerParLeBouton('Bonjour');
    expect(dernieresProps().text).toBe('');
    act(() => { arbre.unmount(); });
  });

  it.each([
    ['android', [{ scale: -1 }]],
    ['ios', [{ scaleY: -1 }]],
  // eslint-disable-next-line max-len
  ])('b) %s : la phrase d’un fil vide est redressée comme la liste la retourne', (systeme, attendu) => {
    // eslint-disable-next-line global-require
    const { Platform, StyleSheet } = require('react-native');
    const avant = Platform.OS;
    Platform.OS = /** @type {any} */ (systeme);
    try {
      mockChat = {
        collectivite: { name: 'Ville de Montrivage' },
        documentId: 'chat-1',
        participants: [],
        type: 'collectivite_dirigeants',
      };
      const { arbre } = monterConversation();
      const vide = dernieresProps().renderChatEmpty();
      expect(StyleSheet.flatten(vide.props.style).transform).toEqual(attendu);
      act(() => { arbre.unmount(); });
    } finally {
      Platform.OS = avant;
    }
  });
});
