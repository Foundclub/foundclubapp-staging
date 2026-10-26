import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SectionList, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import NewConversation from '../NewConversation';

// MSG1A (§3.15) — E6 : « NOUVELLE DISCUSSION » N'AVAIT AUCUN TEMOIN.
//
// Le bloc C fige ce que l'ecran fait DEJA et doit survivre au nouveau dessin du pack :
// 1 personne => discussion privee ; 2 et plus => groupe nomme « Groupe (N) » ; mode ajout
// => `addGroupMembers` ; refus d'abonnement => la feuille d'abonnement. Il est vert AVANT et
// APRES (seul le chemin jusqu'au bouton change : « Suivant » puis « Creer le groupe »).
// Le bloc N decrit le pack (rouge avant).

const mockStartWhisperChat = jest.fn();
const mockStartGroupChat = jest.fn();
const mockAddGroupMembers = jest.fn();
const mockPaywall = jest.fn();
const mockReplace = jest.fn();
const mockGoBack = jest.fn();
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
  }),
}));
jest.mock('@/domains/subscription/subscriptionDecision', () => ({
  extractSubscriptionDecisionFromError: (/** @type {any} */ erreur) => erreur?.decision || null,
}));
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: () => Promise.resolve({ data: MEMBRES }) },
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

/**
 * Valide la selection : avant MSG1A, un seul bouton ; apres, « Suivant » puis « Creer le groupe ».
 * @param {any} arbre
 */
const validerLeGroupe = async (arbre) => {
  if (touchable(arbre, 'Suivant')) {
    await appuyer(arbre, 'Suivant');
    await appuyer(arbre, 'Créer le groupe');
  } else {
    await appuyer(arbre, 'Créer un groupe');
  }
};

beforeEach(() => {
  [
    mockStartWhisperChat,
    mockStartGroupChat,
    mockAddGroupMembers,
    mockPaywall,
    mockReplace,
    mockGoBack,
  ].forEach((f) => f.mockReset());
  mockStartWhisperChat.mockResolvedValue({ documentId: 'fil-prive' });
  mockStartGroupChat.mockResolvedValue({ documentId: 'fil-groupe' });
  mockAddGroupMembers.mockResolvedValue({});
  mockParticipantsDuGroupe = [];
});

afterEach(() => {
  while (montes.length) /** @type {any} */ (montes.pop())();
});

describe('C — ce que « Nouvelle discussion » fait deja (vert avant et apres)', () => {
  test('C1 — une personne : discussion privee, puis le fil s ouvre', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Karim Benali');
    await appuyer(arbre, 'Démarrer');

    expect(mockStartWhisperChat).toHaveBeenCalledWith(['karim']);
    expect(mockReplace).toHaveBeenCalledWith('Conversation', { chatId: 'fil-prive' });
  });

  test('C2 — deux personnes sans nom : un groupe « Groupe (3) »', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Karim Benali');
    await appuyer(arbre, 'Lea Morel');
    await validerLeGroupe(arbre);

    expect(mockStartGroupChat).toHaveBeenCalledWith({
      groupName: 'Groupe (3)',
      participants: ['karim', 'lea'],
    });
    expect(mockReplace).toHaveBeenCalledWith('Conversation', { chatId: 'fil-groupe' });
  });

  test('C3 — mode ajout : addGroupMembers puis retour', async () => {
    const arbre = await monter({ chatId: 'fil-1', mode: 'add_group_members' });
    await appuyer(arbre, 'Hugo Petit');
    await appuyer(arbre, 'Ajouter (1)');

    expect(mockAddGroupMembers).toHaveBeenCalledWith({ chatId: 'fil-1', memberIds: ['hugo'] });
    expect(mockGoBack).toHaveBeenCalled();
  });

  test('C4 — refus d abonnement : la feuille d abonnement s ouvre', async () => {
    mockStartWhisperChat.mockRejectedValue({ decision: { reason: 'quota' } });
    const arbre = await monter();
    await appuyer(arbre, 'Karim Benali');
    await appuyer(arbre, 'Démarrer');

    const derniere = mockPaywall.mock.calls[mockPaywall.mock.calls.length - 1][0];
    expect(derniere.isVisible).toBe(true);
    expect(derniere.decision).toEqual({ reason: 'quota' });
  });
});

describe('N — le dessin du pack', () => {
  test('N1 — la barre du bas annonce le resultat : « Discussion privée » avec Karim', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Karim Benali');
    const tout = texteDe(arbre.root);
    expect(tout).toContain('Discussion privée');
    expect(tout).toContain('avec Karim Benali');
  });

  test(
    'N2 — deux personnes : « Nouveau groupe · 2 membres + vous », bandeau des selectionnes',
    async () => {
      const arbre = await monter();
      await appuyer(arbre, 'Karim Benali');
      await appuyer(arbre, 'Lea Morel');
      const tout = texteDe(arbre.root);
      expect(tout).toContain('Nouveau groupe');
      expect(tout).toContain('2 membres + vous');
      // Le bandeau : toucher la pastille retire la personne.
      await act(async () => {
        arbre.root
          .findAll(
            (/** @type {any} */ n) => n.props?.testID === 'selection-retirer-karim'
          && typeof n.props?.onPress === 'function',
          )[0]
          .props.onPress();
      });
      expect(texteDe(arbre.root)).toContain('Discussion privée');
    },
  );

  test('N3 — l etape « Nouveau groupe » : le nom tape part dans groupName', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Karim Benali');
    await appuyer(arbre, 'Lea Morel');
    await appuyer(arbre, 'Suivant');
    expect(texteDe(arbre.root)).toContain('Groupe (3)');

    const champ = arbre.root.findAll(
      (/** @type {any} */ n) => n.props?.testID === 'nouveau-groupe-nom'
        && typeof n.props?.onChangeText === 'function',
    )[0];
    await act(async () => {
      champ.props.onChangeText('Covoit U15');
    });
    await appuyer(arbre, 'Créer le groupe');

    expect(mockStartGroupChat).toHaveBeenCalledWith({
      groupName: 'Covoit U15',
      participants: ['karim', 'lea'],
    });
  });

  test('N4 — mode ajout : un membre deja dans le groupe est grise et ne se coche pas', async () => {
    mockParticipantsDuGroupe = [{ documentId: 'karim' }];
    const arbre = await monter({ chatId: 'fil-1', mode: 'add_group_members' });
    expect(texteDe(arbre.root)).toContain('Déjà dans le groupe');
    const ligne = touchable(arbre, 'Karim Benali');
    expect(ligne.props.disabled).toBe(true);
  });
});

describe('Q4-17 — le rôle réel du serveur s écrit « Entraineur » (sans accent)', () => {
  test('un entraîneur est rangé dans « Coachs / Profs », pas dans « Autres »', async () => {
    const karim = MEMBRES[0];
    const roleDAvant = karim.role;
    karim.role = { name: 'Entraineur' };
    try {
      const arbre = await monter();
      const { sections } = arbre.root.findByType(SectionList).props;
      const coachs = sections.find((/** @type {any} */ s) => s.title === 'Coachs / Profs');
      expect((coachs?.data || []).map((/** @type {any} */ u) => u.documentId)).toEqual(['karim']);
    } finally {
      karim.role = roleDAvant;
    }
  });
});
