import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import NewConversation from '../NewConversation';

// MSG1BA (§3.15) — L'ETAPE « NOUVEAU GROUPE » BRANCHEE SUR LE SERVEUR 1B : la photo (envoyee
// juste apres la creation, `POST /chats/:id/group-photo`), les autorisations (`data.permissions`
// de `POST /chats/group`, seulement ce qui differe des defauts) et les admins choisis des la
// creation (`addAdminIds`, une requete apres la creation). Banc de `NewConversationMSG1A`.

const mockStartWhisperChat = jest.fn();
const mockStartGroupChat = jest.fn();
const mockAddGroupMembers = jest.fn();
const mockPaywall = jest.fn();
const mockReplace = jest.fn();
const mockGoBack = jest.fn();
const mockUpdateGroupMeta = jest.fn();
const mockChoisirLaPhoto = jest.fn();
const mockSetGroupPhoto = jest.fn();
let mockParticipantsDuGroupe = /** @type {any[]} */ ([]);

const MEMBRES = [
  {
    documentId: 'karim',
    firstname: 'Karim',
    lastname: 'Benali',
    role: { name: 'Entraîneur' },
  },
  {
    documentId: 'lea',
    firstname: 'Lea',
    lastname: 'Morel',
    role: { name: 'Joueur' },
  },
  {
    documentId: 'hugo',
    firstname: 'Hugo',
    lastname: 'Petit',
    role: { name: 'Joueur' },
  },
];

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
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: espaces,
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
    addGroupMembers: (/** @type {any} */ a) => mockAddGroupMembers(a),
    startGroupChat: (/** @type {any} */ a) => mockStartGroupChat(a),
    startWhisperChat: (/** @type {any} */ a) => mockStartWhisperChat(a),
    updateGroupMeta: (/** @type {any} */ a) => mockUpdateGroupMeta(a),
  }),
}));
jest.mock('@/domains/subscription/subscriptionDecision', () => ({
  extractSubscriptionDecisionFromError: (/** @type {any} */ erreur) => erreur?.decision || null,
}));
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: () => Promise.resolve({ data: MEMBRES }) },
}));
jest.mock('@/domains/messaging/photoDuGroupe', () => ({
  __esModule: true,
  choisirLaPhotoDuGroupe: (/** @type {any[]} */ ...args) => mockChoisirLaPhoto(...args),
  default: (/** @type {any[]} */ ...args) => mockChoisirLaPhoto(...args),
}));
jest.mock('@/services/chat/groupPhotoService', () => ({
  removeGroupPhoto: jest.fn(),
  setGroupPhoto: (/** @type {any[]} */ ...args) => mockSetGroupPhoto(...args),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
  }),
}));
jest.mock('@/services/chat/chatQueriesCompat', () => ({
  useGetChatById: () => ({ data: { participants: mockParticipantsDuGroupe } }),
}));
jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity: Touche } = jest.requireActual('react-native');
  return function BoutonDouble({ onPress, title }) {
    return (
      <Touche onPress={onPress}>
        <TexteRN>{title}</TexteRN>
      </Touche>
    );
  };
});
jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => () => null);
jest.mock('@/components/atoms/loader/Loader', () => () => null);
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => () => null);
jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => (/** @type {any} */ props) => {
    mockPaywall(props);
    return null;
  },
);
jest.mock(
  '@/components/templates/ScreenContainer',
  () => (/** @type {any} */ props) => props.children,
);

/** @type {any[]} */
const montes = [];

/**
 * Aide du temoin : `monter`.
 * @param {any} [params]
 * @returns {Promise<any>}
 */
const monter = async (params = {}) => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <NewConversation
          navigation={{ goBack: mockGoBack, navigate: jest.fn(), replace: mockReplace }}
          route={{ params }}
        />
      </QueryClientProvider>,
    );
  });
  montes.push(() => {
    act(() => {
      arbre.unmount();
    });
    client.clear();
  });
  // La liste des membres arrive par une requete : on attend qu'elle soit rendue.
  for (let tour = 0; tour < 50 && !texteDe(arbre.root).includes('Benali'); tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((fin) => {
        setTimeout(fin, 10);
      });
    });
  }
  return arbre;
};

/**
 * Le texte rendu par un noeud, enfants compris.
 * @param {any} noeud
 * @returns {string}
 */
const texteDe = (noeud) => noeud
  .findAllByType(Text)
  .map((/** @type {any} */ n) => [n.props.children].flat().join(''))
  .join(' ');

/**
 * Le premier element touchable (le plus profond) dont le texte contient `motif`.
 * @param {any} arbre
 * @param {string} motif
 * @returns {any}
 */
const touchable = (arbre, motif) => {
  const trouves = arbre.root
    .findAllByType(TouchableOpacity)
    .filter((/** @type {any} */ n) => texteDe(n).includes(motif));
  return trouves[trouves.length - 1];
};

/**
 * Aide du temoin : `appuyer`.
 * @param {any} arbre
 * @param {string} motif
 */
const appuyer = async (arbre, motif) => {
  const cible = touchable(arbre, motif);
  if (!cible) throw new Error(`Aucun bouton « ${motif} »`);
  await act(async () => {
    await cible.props.onPress();
  });
};

beforeEach(() => {
  [
    mockStartWhisperChat,
    mockStartGroupChat,
    mockAddGroupMembers,
    mockPaywall,
    mockReplace,
    mockGoBack,
    mockUpdateGroupMeta,
    mockChoisirLaPhoto,
    mockSetGroupPhoto,
  ].forEach((f) => f.mockReset());
  mockUpdateGroupMeta.mockResolvedValue({});
  mockSetGroupPhoto.mockResolvedValue({ groupPhoto: { url: '/uploads/g.jpg' } });
  mockStartWhisperChat.mockResolvedValue({ documentId: 'fil-prive' });
  mockStartGroupChat.mockResolvedValue({ documentId: 'fil-groupe' });
  mockAddGroupMembers.mockResolvedValue({});
  mockParticipantsDuGroupe = [];
});

afterEach(() => {
  while (montes.length) /** @type {any} */ (montes.pop())();
});

/**
 * Le premier element touchable qui porte ce testID.
 * @param {any} arbre
 * @param {string} id
 * @returns {any}
 */
const parId = (arbre, id) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === id
    && (typeof n.props?.onPress === 'function' || typeof n.props?.onValueChange === 'function'),
)[0];

/**
 * Choisit Karim et Lea, puis passe a l'etape « Nouveau groupe ».
 * @returns {Promise<any>}
 */
const jusquALEtapeNom = async () => {
  const arbre = await monter();
  await appuyer(arbre, 'Karim Benali');
  await appuyer(arbre, 'Lea Morel');
  await appuyer(arbre, 'Suivant');
  return arbre;
};

describe('MSG1BA §3.15 — autorisations des la creation', () => {
  test('NG1 — la ligne « Autorisations du groupe » resume les reglages, avec 1 admin', async () => {
    const arbre = await jusquALEtapeNom();
    const tout = texteDe(arbre.root);
    expect(tout).toContain('Autorisations du groupe');
    expect(tout).toContain('Les membres peuvent écrire · 1 admin');
  });

  test('NG2 — couper « Envoyer des messages » : le reglage part avec la creation', async () => {
    const arbre = await jusquALEtapeNom();
    await act(async () => {
      parId(arbre, 'nouveau-groupe-autorisations').props.onPress();
    });
    await act(async () => {
      parId(arbre, 'autorisation-membersCanSendMessages').props.onValueChange(false);
    });
    await act(async () => {
      parId(arbre, 'autorisations-du-groupe-retour').props.onPress();
    });
    expect(texteDe(arbre.root)).toContain('Seuls les admins peuvent agir · 1 admin');
    await appuyer(arbre, 'Créer le groupe');

    expect(mockStartGroupChat).toHaveBeenCalledWith({
      groupName: 'Groupe (3)',
      participants: ['karim', 'lea'],
      permissions: { membersCanSendMessages: false },
    });
  });

  test('NG3 — reglages par defaut : la requete garde sa forme d avant 1B', async () => {
    const arbre = await jusquALEtapeNom();
    await appuyer(arbre, 'Créer le groupe');
    expect(Object.keys(mockStartGroupChat.mock.calls[0][0]).sort())
      .toEqual(['groupName', 'participants']);
    expect(mockSetGroupPhoto).not.toHaveBeenCalled();
    expect(mockUpdateGroupMeta).not.toHaveBeenCalled();
  });

  test('NG4 — « Modifier les admins » : Karim nomme admin des la creation', async () => {
    const arbre = await jusquALEtapeNom();
    await act(async () => {
      parId(arbre, 'nouveau-groupe-autorisations').props.onPress();
    });
    await act(async () => {
      parId(arbre, 'autorisations-modifier-les-admins').props.onPress();
    });
    // « Vous » est coche et verrouille ; Valider reste eteint tant que rien ne change.
    expect(parId(arbre, 'admins-du-groupe-moi').props.disabled).toBe(true);
    expect(parId(arbre, 'admins-du-groupe-valider').props.disabled).toBe(true);
    await act(async () => {
      parId(arbre, 'admins-du-groupe-karim').props.onPress();
    });
    await act(async () => {
      parId(arbre, 'admins-du-groupe-valider').props.onPress();
    });
    await act(async () => {
      parId(arbre, 'autorisations-du-groupe-retour').props.onPress();
    });
    expect(texteDe(arbre.root)).toContain('· 2 admins');
    await appuyer(arbre, 'Créer le groupe');

    expect(mockUpdateGroupMeta).toHaveBeenCalledWith({
      chatId: 'fil-groupe',
      data: { addAdminIds: ['karim'] },
    });
    expect(mockReplace).toHaveBeenCalledWith('Conversation', { chatId: 'fil-groupe' });
  });
});

describe('MSG1BA §3.15 — la photo du groupe des la creation', () => {
  const PHOTO = {
    apercu: 'file:///tmp/groupe.jpg',
    fichier: { name: 'groupe.jpg', type: 'image/jpeg', uri: 'file:///tmp/groupe.jpg' },
  };

  /**
   * Ouvre la feuille photo et choisit dans la galerie.
   * @param {any} arbre
   * @returns {Promise<void>}
   */
  const choisirDansLaGalerie = async (arbre) => {
    await act(async () => {
      parId(arbre, 'nouveau-groupe-photo').props.onPress();
    });
    await act(async () => {
      await parId(arbre, 'photo-du-groupe-galerie').props.onPress();
    });
  };

  test('NP1 — galerie : apercu, puis la photo part juste apres la creation', async () => {
    mockChoisirLaPhoto.mockResolvedValue(PHOTO);
    const arbre = await jusquALEtapeNom();
    await choisirDansLaGalerie(arbre);
    expect(mockChoisirLaPhoto).toHaveBeenCalledWith('galerie', expect.any(Function));
    const apercus = arbre.root.findAll(
      (/** @type {any} */ n) => n.props?.testID === 'nouveau-groupe-photo-apercu',
    );
    expect(apercus[0].props.source).toEqual({ uri: PHOTO.apercu });

    await appuyer(arbre, 'Créer le groupe');
    expect(mockSetGroupPhoto).toHaveBeenCalledWith('fil-groupe', PHOTO.fichier);
    expect(mockReplace).toHaveBeenCalledWith('Conversation', { chatId: 'fil-groupe' });
  });

  test('NP2 — serveur d avant 1B (404) : pas d erreur, le groupe s ouvre', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockChoisirLaPhoto.mockResolvedValue(PHOTO);
    mockSetGroupPhoto.mockRejectedValue({ response: { status: 404 } });
    const arbre = await jusquALEtapeNom();
    await choisirDansLaGalerie(arbre);
    await appuyer(arbre, 'Créer le groupe');
    expect(alerte).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('Conversation', { chatId: 'fil-groupe' });
    alerte.mockRestore();
  });

  test('NP3 — photo refusee (500) : le groupe est cree, et on le dit', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockChoisirLaPhoto.mockResolvedValue(PHOTO);
    mockSetGroupPhoto.mockRejectedValue({ response: { status: 500 } });
    const arbre = await jusquALEtapeNom();
    await choisirDansLaGalerie(arbre);
    await appuyer(arbre, 'Créer le groupe');
    expect(alerte).toHaveBeenCalledWith(
      'Messagerie',
      'Le groupe est créé, mais sa photo n’a pas pu être envoyée.',
    );
    expect(mockReplace).toHaveBeenCalledWith('Conversation', { chatId: 'fil-groupe' });
    alerte.mockRestore();
  });

  test('NP4 — photo trop lourde : le refus est dit, rien n est retenu', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockChoisirLaPhoto.mockResolvedValue({ erreur: 'Fichier trop volumineux (max 15 Mo).' });
    const arbre = await jusquALEtapeNom();
    await choisirDansLaGalerie(arbre);
    expect(alerte).toHaveBeenCalledWith('Messagerie', 'Fichier trop volumineux (max 15 Mo).');
    await appuyer(arbre, 'Créer le groupe');
    expect(mockSetGroupPhoto).not.toHaveBeenCalled();
    alerte.mockRestore();
  });
});
