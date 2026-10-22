import renderer, { act } from 'react-test-renderer';

// MSGIMG — L'IMAGE OUVERTE EN GRAND DANS UNE CONVERSATION (constat d'Adel, 20/10/2026).
//
// « Quand on envoie une image, il faut que la croix en haut à gauche, elle soit toujours
// visible. […] sur une image blanche, vu que la croix elle est blanche, on ne voit pas la
// croix. […] il faut qu'on puisse swiper vers le bas, pour enlever l'image. Et il faut
// qu'on puisse l'enregistrer dans sa galerie. »
//
// Ce temoin monte le VRAI ecran `Conversation.js` (memes doublures que `ConversationMSG1A`),
// appuie sur la photo d'une bulle et interroge l'apercu plein ecran qui s'ouvre.
// CAR — caracterisation (E6) : ce que l'apercu faisait AVANT le lot, et qui doit tenir.

const mockGiftedRenders = /** @type {any[]} */ ([]);
let mockChatData;
const mockEnregistrerLImage = jest.fn();

// MSGIMG-3 — l'enregistrement dans la galerie : la doublure retient l'adresse demandee.
// Les raisons d'echec sont lues dans le VRAI module, jamais recopiees.
jest.mock('@/platform/media/enregistrerLImage', () => ({
  ...jest.requireActual('@/platform/media/enregistrerLImage'),
  __esModule: true,
  enregistrerLImage: (/** @type {any[]} */ ...args) => mockEnregistrerLImage(...args),
}));

jest.mock('react-native-gesture-handler', () => (
  // eslint-disable-next-line global-require
  require('@/testSupport/animationDouble').gestureHandler()
));
jest.mock('react-native-reanimated', () => (
  // eslint-disable-next-line global-require
  require('@/testSupport/animationDouble').reanimated()
));

jest.mock('react-native-gifted-chat', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    Bubble: VueRN,
    Composer: VueRN,
    Day: VueRN,
    GiftedChat: (/** @type {any} */ props) => {
      mockGiftedRenders.push(props);
      return null;
    },
    InputToolbar: VueRN,
    MessageText: VueRN,
    Time: VueRN,
  };
});

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34,
    left: 0,
    right: 0,
    top: 47,
  }),
}));
jest.mock('react-native-svg', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    Circle: VueRN,
    default: VueRN,
    // La photo du fil porte un degrade en bas (`DegradeDePhoto`).
    Defs: VueRN,
    Line: VueRN,
    LinearGradient: VueRN,
    Path: VueRN,
    Polyline: VueRN,
    Rect: VueRN,
    Stop: VueRN,
    Svg: VueRN,
  };
});

jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonLoaderMock() {
    return null;
  },
);

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

jest.mock('@/services/event/eventService', () => ({
  missingEvent: jest.fn(),
  respondToEventRsvp: jest.fn(),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    allMyTeams: [],
    hasClubAccess: true,
    userData: { documentId: 'moi', firstname: 'Adel', role: { name: 'Joueur' } },
  }),
}));
jest.mock('@/domains/auth/authUseCases', () => ({
  getAuthTokens: () => Promise.resolve({ jwt: 'jwt' }),
  getManagedMultisportIds: () => [],
  getUserRoleKey: () => 'player',
}));
jest.mock('@/theme/strings', () => ({
  __esModule: true,
  default: {
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
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
  cancelMatch: jest.fn(),
  createLeagueProposal: jest.fn(),
  respondToLeagueProposal: jest.fn(),
}));
jest.mock('@/services/messageReport/messageReportService', () => ({
  createMessageReport: jest.fn(),
}));
jest.mock('@/services/reservation/reservationService', () => ({ joinReservation: jest.fn() }));
jest.mock('@/services/event/eventQueries', () => ({ useGetEvents: () => ({ data: null }) }));
jest.mock('@/platform/share', () => ({ __esModule: true, default: { share: jest.fn() } }));

jest.mock('@/services/userBlock/userBlockQueries', () => ({
  useBlockUser: () => ({ isPending: false, mutate: jest.fn() }),
  useGetMyBlockedUsers: () => ({ data: [], refetch: jest.fn() }),
  useUnblockUser: () => ({ isPending: false, mutate: jest.fn() }),
}));

jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: jest.fn() }),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({
    getConversationName: () => 'Fil',
    joinChat: jest.fn(),
    leaveChat: jest.fn(),
    markMessagesAsRead: jest.fn(),
    retryMessage: jest.fn(),
    sendMessage: jest.fn(),
    sendReadReceipt: jest.fn(),
    sendTypingStart: jest.fn(),
    sendTypingStop: jest.fn(),
    socket: { emit: jest.fn(), off: jest.fn(), on: jest.fn() },
    typingUsers: [],
  }),
}));

jest.mock('@/services/chat/chatQueriesCompat', () => ({
  useGetChatById: () => ({ data: mockChatData, isLoading: false }),
  useGetChatMessageReactions: () => ({ data: { chatDocumentId: '', data: [] } }),
  useGetChatMessages: () => ({
    data: { pages: [{ data: [], meta: { pagination: { page: 1, pageCount: 1, total: 0 } } }] },
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetching: false,
    isLoading: false,
  }),
}));

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
jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => (/** @type {any} */ { children }) => children,
);
jest.mock('@/components/molecules/eventMessageBubble/EventMessageBubble', () => () => null);
jest.mock('@/components/atoms/errorWrapper/ErrorWrapper', () => () => null);
jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => () => null);
jest.mock(
  '@/components/molecules/compositionMessageBubble/CompositionMessageBubble',
  () => () => null,
);
jest.mock('@/components/molecules/contactShareBubble/ContactShareBubble', () => () => null);
jest.mock('@/components/molecules/documentMessageBubble/DocumentMessageBubble', () => () => null);
jest.mock('@/components/molecules/eventCard/EventCardNew', () => () => null);
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

/** @type {Array<() => void>} */
const aDemonter = [];

const TETE_A_TETE = {
  documentId: 'chat-1',
  participants: [
    { documentId: 'moi', firstname: 'Adel' },
    { documentId: 'karim', firstname: 'Karim' },
  ],
  type: 'whisper',
};

const ADRESSE_DE_LA_PHOTO = 'https://cdn.example.test/uploads/photo-blanche.png';

/** Une photo envoyee par Karim, sans texte. */
const PHOTO = {
  _id: 'p1',
  createdAt: new Date('2026-10-20T15:30:00'),
  documentId: 'p1',
  image: ADRESSE_DE_LA_PHOTO,
  text: '',
  user: { _id: 'karim', name: 'Karim Benali' },
};

/**
 * Monte le VRAI ecran.
 * @returns {{ecran: any, gifted: any}} L'arbre rendu et les dernieres props de GiftedChat.
 */
const monterLaConversation = () => {
  // eslint-disable-next-line global-require
  const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
  // eslint-disable-next-line global-require
  const { createElement } = require('react');
  // eslint-disable-next-line global-require
  const Conversation = require('../Conversation').default;

  const clientRequetes = new QueryClient({
    defaultOptions: {
      mutations: { gcTime: 0, retry: false },
      queries: { gcTime: 0, retry: false },
    },
  });

  /** @type {any} */
  let ecran = null;
  act(() => {
    ecran = renderer.create(
      createElement(
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
      ),
    );
  });

  aDemonter.push(() => {
    act(() => {
      ecran.unmount();
    });
    clientRequetes.clear();
  });

  return { ecran, gifted: mockGiftedRenders[mockGiftedRenders.length - 1] };
};

/**
 * Rend la bulle de la photo, puis appuie dessus : l'ecran ouvre son apercu.
 * @param {any} gifted Les props de GiftedChat.
 */
const ouvrirLaPhoto = (gifted) => {
  /** @type {any} */
  let bulle;
  act(() => {
    bulle = renderer.create(gifted.renderBubble({ currentMessage: PHOTO, position: 'left' }));
  });
  aDemonter.push(() => {
    act(() => {
      bulle.unmount();
    });
  });
  const vignette = bulle.root.find((/** @type {any} */ noeud) => (
    typeof noeud.type !== 'string'
    && noeud.props?.accessibilityRole === 'imagebutton'
    && typeof noeud.props?.onPress === 'function'
  ));
  act(() => {
    vignette.props.onPress();
  });
};

/**
 * L'image plein ecran de l'apercu (la seule Image de l'ecran qui montre la photo).
 * @param {any} ecran L'arbre de l'ecran.
 * @returns {any[]} Les images trouvees.
 */
const imagesPleinEcran = (ecran) => {
  // eslint-disable-next-line global-require
  const { Image } = require('react-native');
  return ecran.root.findAll((/** @type {any} */ noeud) => (
    noeud.type === Image && noeud.props?.source?.uri === ADRESSE_DE_LA_PHOTO
  ));
};

/**
 * La fenetre de l'apercu (le Modal qui contient l'image plein ecran).
 * @param {any} ecran L'arbre de l'ecran.
 * @returns {any} Le Modal.
 */
const fenetreDeLApercu = (ecran) => {
  // eslint-disable-next-line global-require
  const { Modal } = require('react-native');
  return ecran.root.findAll((/** @type {any} */ noeud) => noeud.type === Modal)
    .find((/** @type {any} */ modal) => modal.findAll((/** @type {any} */ noeud) => (
      noeud.props?.source?.uri === ADRESSE_DE_LA_PHOTO
    )).length > 0);
};

describe('MSGIMG — CAR : ce que l apercu d une photo faisait avant le lot', () => {
  beforeEach(() => {
    mockGiftedRenders.length = 0;
    mockChatData = TETE_A_TETE;
  });

  afterEach(() => {
    while (aDemonter.length) {
      /** @type {any} */ (aDemonter.pop())();
    }
  });

  test('CAR-1 — appuyer sur la photo ouvre l apercu plein ecran de CETTE image', () => {
    const { ecran, gifted } = monterLaConversation();
    expect(imagesPleinEcran(ecran)).toHaveLength(0);

    ouvrirLaPhoto(gifted);

    const images = imagesPleinEcran(ecran);
    expect(images).toHaveLength(1);
    expect(images[0].props.resizeMode).toBe('contain');
  });

  test('CAR-2 — le bouton retour d Android (onRequestClose) referme l apercu', () => {
    const { ecran, gifted } = monterLaConversation();
    ouvrirLaPhoto(gifted);
    const fenetre = fenetreDeLApercu(ecran);
    expect(fenetre).toBeTruthy();

    act(() => {
      fenetre.props.onRequestClose();
    });

    expect(imagesPleinEcran(ecran)).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MSGIMG-1 — LA CROIX TOUJOURS VISIBLE. Avant le lot : un « X » blanc, sans fond, posé
// directement sur l'image. Sur une photo blanche, il disparaissait.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Le bouton de l'apercu qui porte ce libelle (lecteur d'ecran).
 * @param {any} ecran L'arbre de l'ecran.
 * @param {string} libelle Le libelle.
 * @returns {any[]} Les boutons trouves.
 */
const boutonsNommes = (ecran, libelle) => ecran.root.findAll((/** @type {any} */ noeud) => (
  typeof noeud.type !== 'string'
  && noeud.props?.accessibilityLabel === libelle
  && noeud.props?.accessibilityRole === 'button'
  && typeof noeud.props?.onPress === 'function'
));

/**
 * Le style aplati d'un noeud.
 * @param {any} noeud Le noeud.
 * @returns {Record<string, any>} Le style.
 */
const styleDe = (noeud) => {
  // eslint-disable-next-line global-require
  const { StyleSheet } = require('react-native');
  const style = typeof noeud.props.style === 'function'
    ? noeud.props.style({ pressed: false })
    : noeud.props.style;
  return StyleSheet.flatten(style) || {};
};

/**
 * Une couleur CSS (#rrggbb ou rgba()) en composantes.
 * @param {string} couleur La couleur.
 * @returns {{ r: number, g: number, b: number, a: number }} Ses composantes.
 */
const composantes = (couleur) => {
  const texte = String(couleur || '').trim();
  const hexa = texte.match(/^#([0-9a-f]{6})$/i);
  if (hexa) {
    const octet = (/** @type {number} */ debut) => parseInt(hexa[1].slice(debut, debut + 2), 16);
    return {
      a: 1, b: octet(4), g: octet(2), r: octet(0),
    };
  }
  const rgba = texte.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (!rgba) throw new Error(`couleur illisible : ${texte}`);
  return {
    a: rgba[4] === undefined ? 1 : Number(rgba[4]),
    b: Number(rgba[3]),
    g: Number(rgba[2]),
    r: Number(rgba[1]),
  };
};

/**
 * Le contraste (WCAG) entre une croix et son rond translucide, pose sur une image unie.
 * @param {string} croix La couleur de la croix.
 * @param {string} rond La couleur (translucide) du rond.
 * @param {number} image La valeur de gris de l'image dessous (255 blanc, 0 noir).
 * @returns {number} Le rapport de contraste.
 */
const contrasteSurImage = (croix, rond, image) => {
  const c = composantes(croix);
  const f = composantes(rond);
  const fond = ['r', 'g', 'b'].map((k) => (/** @type {any} */ (f)[k] * f.a) + (image * (1 - f.a)));
  const luminance = (/** @type {number[]} */ rvb) => {
    const [r, g, b] = rvb.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
  };
  const l1 = luminance([c.r, c.g, c.b]);
  const l2 = luminance(fond);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

describe('MSGIMG-1 — la croix se voit sur n importe quelle image', () => {
  beforeEach(() => {
    mockGiftedRenders.length = 0;
    mockChatData = TETE_A_TETE;
  });

  afterEach(() => {
    while (aDemonter.length) {
      /** @type {any} */ (aDemonter.pop())();
    }
  });

  test('MSGIMG-1a — un bouton « Fermer l’image » pour le lecteur d ecran, qui referme', () => {
    const { ecran, gifted } = monterLaConversation();
    ouvrirLaPhoto(gifted);

    const croix = boutonsNommes(ecran, 'Fermer l’image');
    expect(croix).toHaveLength(1);

    act(() => {
      croix[0].props.onPress();
    });
    expect(imagesPleinEcran(ecran)).toHaveLength(0);
  });

  test('MSGIMG-1b — un ROND sombre translucide, 44 px au moins, sous la barre d etat', () => {
    const { ecran, gifted } = monterLaConversation();
    ouvrirLaPhoto(gifted);

    const style = styleDe(boutonsNommes(ecran, 'Fermer l’image')[0]);
    expect(style.width).toBeGreaterThanOrEqual(44);
    expect(style.height).toBeGreaterThanOrEqual(44);
    expect(style.borderRadius).toBeGreaterThanOrEqual(style.width / 2);
    // La barre d'etat du telephone de la doublure mesure 47 px : la croix passe dessous.
    expect(style.top).toBeGreaterThanOrEqual(47);
    expect(style.backgroundColor).toEqual(expect.stringMatching(/^rgba\(/));
  });

  test('MSGIMG-1c — la croix contraste (≥ 4,5:1) sur une image BLANCHE comme sur une NOIRE', () => {
    const { ecran, gifted } = monterLaConversation();
    ouvrirLaPhoto(gifted);

    const bouton = boutonsNommes(ecran, 'Fermer l’image')[0];
    const { backgroundColor } = styleDe(bouton);
    const glyphe = bouton.findAll((/** @type {any} */ noeud) => noeud.props?.name === 'xmark')[0];
    expect(glyphe).toBeTruthy();

    expect(contrasteSurImage(glyphe.props.color, backgroundColor, 255)).toBeGreaterThanOrEqual(4.5);
    expect(contrasteSurImage(glyphe.props.color, backgroundColor, 0)).toBeGreaterThanOrEqual(4.5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MSGIMG-2 — GLISSER VERS LE BAS POUR FERMER. Le geste est joue sur la doublure partagee
// de Gesture Handler (`animationDouble`), qui retient les rappels du geste : on les
// appelle dans l'ordre ou le telephone les appellerait.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Le geste de glissement de l'apercu, et les deux calques qu'il fait bouger.
 * @param {any} ecran L'arbre de l'ecran.
 * @returns {{ geste: any, image: any, fond: any }} Le geste et les calques.
 */
const gesteDeLApercu = (ecran) => {
  const detecteurs = ecran.root.findAll((/** @type {any} */ noeud) => (
    noeud.props?.testID === 'gesture-detector' && noeud.props?.gesture?.type === 'Pan'
    && noeud.findAll((/** @type {any} */ n) => (
      n.props?.source?.uri === ADRESSE_DE_LA_PHOTO
    )).length > 0
  ));
  const calque = (/** @type {string} */ testID) => ecran.root.findAll(
    (/** @type {any} */ noeud) => noeud.props?.testID === testID,
  )[0];
  return {
    fond: calque('MSGIMG-fond'),
    geste: detecteurs[0]?.props?.gesture,
    image: calque('MSGIMG-image-glissante'),
  };
};

/**
 * Le deplacement vertical d'un calque anime.
 * @param {any} calque Le calque.
 * @returns {number} Le deplacement (0 s'il n'en a pas).
 */
const deplacementDe = (calque) => {
  const transformation = styleDe(calque).transform || [];
  const pas = transformation.find((/** @type {any} */ t) => 'translateY' in t);
  return pas ? pas.translateY : 0;
};

/**
 * Joue un glissement complet : debut, deplacement, lacher.
 * @param {any} geste Le geste enregistre par la doublure.
 * @param {number} glissement Le deplacement vertical du doigt (positif = vers le bas).
 * @param {number} vitesse La vitesse au lacher (px/s).
 * @param {() => void} [pendant] Ce qu'on verifie doigt pose, avant de lacher.
 */
const glisser = async (geste, glissement, vitesse, pendant) => {
  act(() => {
    geste.rappels.onStart?.({ translationY: 0, velocityY: 0 });
    geste.rappels.onUpdate({ translationY: glissement, velocityY: vitesse });
  });
  if (pendant) pendant();
  await act(async () => {
    geste.rappels.onEnd({ translationY: glissement, velocityY: vitesse });
  });
};

describe('MSGIMG-2 — glisser l image vers le bas la referme', () => {
  beforeEach(() => {
    mockGiftedRenders.length = 0;
    mockChatData = TETE_A_TETE;
  });

  afterEach(() => {
    while (aDemonter.length) {
      /** @type {any} */ (aDemonter.pop())();
    }
  });

  test('MSGIMG-2a — l image suit le doigt, le fond pali, puis elle se ferme', async () => {
    const { ecran, gifted } = monterLaConversation();
    ouvrirLaPhoto(gifted);
    const { fond, geste, image } = gesteDeLApercu(ecran);
    expect(geste).toBeTruthy();
    expect(styleDe(fond).opacity).toBe(1);

    await glisser(geste, 320, 300, () => {
      expect(deplacementDe(image)).toBe(320);
      expect(styleDe(fond).opacity).toBeLessThan(1);
    });

    expect(imagesPleinEcran(ecran)).toHaveLength(0);
  });

  test('MSGIMG-2b — un petit glissement lent ne ferme pas : l image revient', async () => {
    const { ecran, gifted } = monterLaConversation();
    ouvrirLaPhoto(gifted);
    const { geste, image } = gesteDeLApercu(ecran);

    await glisser(geste, 60, 100);

    expect(imagesPleinEcran(ecran)).toHaveLength(1);
    expect(deplacementDe(image)).toBe(0);
  });

  test('MSGIMG-2c — un coup sec vers le bas ferme meme court', async () => {
    const { ecran, gifted } = monterLaConversation();
    ouvrirLaPhoto(gifted);
    const { geste } = gesteDeLApercu(ecran);

    await glisser(geste, 70, 1600);

    expect(imagesPleinEcran(ecran)).toHaveLength(0);
  });

  test('MSGIMG-2d — vers le HAUT, rien ne bouge et rien ne se ferme', async () => {
    const { ecran, gifted } = monterLaConversation();
    ouvrirLaPhoto(gifted);
    const { geste, image } = gesteDeLApercu(ecran);

    await glisser(geste, -300, -2000, () => {
      expect(deplacementDe(image)).toBe(0);
    });

    expect(imagesPleinEcran(ecran)).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MSGIMG-3 — « ENREGISTRER » DANS LA GALERIE. Un bouton du meme habit que la croix ;
// un retour visible (« Image enregistree ») ; un refus d'acces explique quoi faire.
// ─────────────────────────────────────────────────────────────────────────────

const ENREGISTRER = 'Enregistrer l’image dans ta galerie';

/**
 * Le texte visible de l'ecran, mis bout a bout.
 * @param {any} ecran L'arbre de l'ecran.
 * @returns {string} Les textes.
 */
const textesDe = (ecran) => {
  // eslint-disable-next-line global-require
  const { Text } = require('react-native');
  return ecran.root.findAll((/** @type {any} */ noeud) => noeud.type === Text)
    .map((/** @type {any} */ noeud) => [].concat(noeud.props.children).join(''))
    .join(' | ');
};

describe('MSGIMG-3 — enregistrer l image dans la galerie', () => {
  beforeEach(() => {
    mockGiftedRenders.length = 0;
    mockChatData = TETE_A_TETE;
    mockEnregistrerLImage.mockReset();
  });

  afterEach(() => {
    while (aDemonter.length) {
      /** @type {any} */ (aDemonter.pop())();
    }
    jest.restoreAllMocks();
  });

  test('MSGIMG-3a — « Enregistrer », meme habit que la croix, range CETTE image', async () => {
    mockEnregistrerLImage.mockResolvedValue({ issue: 'enregistree' });
    const { ecran, gifted } = monterLaConversation();
    ouvrirLaPhoto(gifted);

    const boutons = boutonsNommes(ecran, ENREGISTRER);
    expect(boutons).toHaveLength(1);
    const style = styleDe(boutons[0]);
    const croix = styleDe(boutonsNommes(ecran, 'Fermer l’image')[0]);
    expect(style.backgroundColor).toBe(croix.backgroundColor);
    expect(style.height).toBeGreaterThanOrEqual(44);
    expect(style.top).toBe(croix.top);
    expect(textesDe(ecran)).toContain('Enregistrer');

    await act(async () => {
      boutons[0].props.onPress();
    });

    expect(mockEnregistrerLImage).toHaveBeenCalledTimes(1);
    expect(mockEnregistrerLImage).toHaveBeenCalledWith(ADRESSE_DE_LA_PHOTO);
    expect(textesDe(ecran)).toContain('Image enregistrée dans ta galerie');
    // L'avis touche le bas de la fenetre translucide : il reserve la barre d'Android
    // (doublure : 34 px), cf. ANDROIDBAR2BIS.fenetresTranslucides.
    const avis = ecran.root.findAll((/** @type {any} */ noeud) => (
      typeof noeud.type !== 'string' && noeud.props?.accessibilityRole === 'alert'
    ))[0];
    expect(styleDe(avis).bottom).toBeGreaterThanOrEqual(34);
  });

  test('MSGIMG-3b — acces refuse : une alerte explique et ouvre les reglages', async () => {
    // eslint-disable-next-line global-require
    const { Alert, Linking } = require('react-native');
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const reglages = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    mockEnregistrerLImage.mockRejectedValue(Object.assign(new Error('refus'), {
      reason: 'permission_refusee',
    }));
    const { ecran, gifted } = monterLaConversation();
    ouvrirLaPhoto(gifted);

    await act(async () => {
      boutonsNommes(ecran, ENREGISTRER)[0].props.onPress();
    });

    expect(alerte).toHaveBeenCalledTimes(1);
    const [titre, corps, boutons] = alerte.mock.calls[0];
    expect(titre).toBe('Accès aux photos refusé');
    expect(corps).toMatch(/réglages/);
    const ouvrir = /** @type {any[]} */ (boutons).find((b) => b.text === 'Ouvrir les réglages');
    expect(ouvrir).toBeTruthy();
    ouvrir.onPress();
    expect(reglages).toHaveBeenCalledTimes(1);
  });

  test('MSGIMG-3c — un autre echec se dit, et l apercu reste ouvert', async () => {
    mockEnregistrerLImage.mockRejectedValue(Object.assign(new Error('reseau'), {
      reason: 'http_error',
    }));
    const { ecran, gifted } = monterLaConversation();
    ouvrirLaPhoto(gifted);

    await act(async () => {
      boutonsNommes(ecran, ENREGISTRER)[0].props.onPress();
    });

    expect(textesDe(ecran)).toContain('L’image n’a pas pu être enregistrée. Réessaie.');
    expect(imagesPleinEcran(ecran)).toHaveLength(1);
  });

  test('MSGIMG-3d — deux appuis pendant l enregistrement n enregistrent qu une fois', async () => {
    /**
     * Termine l'enregistrement en attente.
     * @type {(v: any) => void}
     */
    let finir = () => {};
    mockEnregistrerLImage.mockReturnValue(new Promise((resoudre) => { finir = resoudre; }));
    const { ecran, gifted } = monterLaConversation();
    ouvrirLaPhoto(gifted);

    act(() => {
      boutonsNommes(ecran, ENREGISTRER)[0].props.onPress();
    });
    act(() => {
      boutonsNommes(ecran, ENREGISTRER)[0].props.onPress();
    });
    await act(async () => {
      finir({ issue: 'enregistree' });
    });

    expect(mockEnregistrerLImage).toHaveBeenCalledTimes(1);
  });
});
