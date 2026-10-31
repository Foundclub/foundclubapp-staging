import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import NewConversation from '../NewConversation';

// MSG-VILLE-NOUVELLE (20/10/2026, REC17-004 ter) — « NOUVELLE CONVERSATION » DEPUIS
// L'ESPACE DE LA VILLE. Décisions d'Adel du 20/10 : « 1- B » (les membres MAJEURS des
// clubs de sa Ville et ses
// autres gérants, jamais un mineur) et « 2- A » (l'écran existant, sans maquette).
// Avant ce lot, l'écran ne proposait que les membres des ÉQUIPES du compte (`GET /users`), qu'une
// Ville n'a pas. Les doublures sont celles de `NewConversationMSG1A.test.js` (même écran).

const mockStartWhisperChat = jest.fn();
const mockStartGroupChat = jest.fn();
const mockReplace = jest.fn();
const mockClientGet = jest.fn();
const mockContacts = jest.fn();
const mockOuvrir = jest.fn();

const CLUBS = [
  { documentId: 'club-a', logo: null, name: 'AS Ville A' },
  { documentId: 'club-b', logo: null, name: 'US Ville B' },
];
/**
 * Un contact tel que le serveur le rend.
 * @param {string} documentId - L'identifiant.
 * @param {string} prenomNom - « Prénom Nom ».
 * @param {string} fonction - Sa fonction.
 * @param {any} [club] - Son club.
 * @returns {any} Le contact.
 */
const contact = (documentId, prenomNom, fonction, club = null) => {
  const [firstname, lastname] = prenomNom.split(' ');
  return {
    avatar: null, club, documentId, firstname, fonction, lastname,
  };
};
const CLUB_A_VU = { documentId: 'club-a', name: 'AS Ville A' };
const GERANTE = contact('gerante', 'Nadia Roux', 'gestionnaire');
const CLUB_A = [
  contact('karim', 'Karim Benali', 'dirigeant', CLUB_A_VU),
  contact('lea', 'Lea Morel', 'joueur', CLUB_A_VU),
  contact('paul', 'Paul Petit', 'parent', CLUB_A_VU),
];

/**
 * Ce que rend le serveur pour ces filtres (le serveur écarte déjà les mineurs).
 * @param {{ club?: string | null, q?: string, start?: number }} params - Les filtres.
 * @returns {any} La réponse.
 */
const reponseDuServeur = ({ club = null, q = '', start = 0 }) => {
  let contacts = [GERANTE];
  if (club === 'club-a') contacts = CLUB_A;
  if (String(q || '').trim().length >= 2) {
    const cherche = q.toLowerCase();
    contacts = [GERANTE, ...CLUB_A]
      .filter((c) => `${c.firstname} ${c.lastname}`.toLowerCase().includes(cherche));
  }
  return {
    data: {
      clubs: CLUBS,
      collectivite: { documentId: 'ville-1', name: 'Ville de Démouville' },
      contacts,
      limit: 50,
      start,
      total: contacts.length,
    },
  };
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ valeurs) => {
      const gabarit = typeof repli === 'string' ? repli : repli?.defaultValue;
      if (typeof gabarit !== 'string') return cle;
      const v = (typeof repli === 'object' ? repli : valeurs) || {};
      return gabarit.replace(
        /\{\{(\w+)\}\}/g,
        (_m, nom) => (v[nom] !== undefined ? String(v[nom]) : _m),
      );
    },
  }),
}));
jest.mock('i18next', () => ({
  // `exists` : la lecture des erreurs du serveur (displayError) demande si la clef existe.
  exists: () => false,
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
    userData: { documentId: 'moi', firstname: 'Adel', role: { name: 'Authenticated' } },
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
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: (/** @type {any[]} */ ...args) => mockClientGet(...args) },
}));
jest.mock('@/services/collectivite/collectiviteCanauxService', () => ({
  getContactsDeLaVille: (/** @type {any[]} */ ...args) => mockContacts(...args),
  getMembresDuFil: jest.fn(),
  getMesCanauxDeLaVille: jest.fn(),
  ouvrirConversationDeLaVille: (/** @type {any[]} */ ...args) => mockOuvrir(...args),
}));
jest.mock('@/services/chat/chatQueriesCompat', () => ({
  useGetChatById: () => ({ data: { participants: [] } }),
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
  () => () => null,
);
jest.mock(
  '@/components/templates/ScreenContainer',
  () => (/** @type {any} */ props) => props.children,
);

// Le premier montage de l'écran (et ses doublures) dépasse souvent 5 s sous charge.
jest.setTimeout(60000);

/** @type {Array<() => void>} */
const montes = [];

/**
 * Le texte rendu par un noeud, enfants compris.
 * @param {any} noeud - Le noeud.
 * @returns {string} Le texte.
 */
const texteDe = (noeud) => noeud
  .findAllByType(Text)
  .map((/** @type {any} */ n) => [n.props.children].flat().join(''))
  .join(' ');

/**
 * Attend que `motif` soit rendu (la liste arrive par une requête).
 * @param {any} arbre - L'arbre.
 * @param {string} motif - Le texte attendu.
 * @returns {Promise<void>}
 */
const attendre = async (arbre, motif) => {
  for (let tour = 0; tour < 60 && !texteDe(arbre.root).includes(motif); tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((fin) => {
        setTimeout(fin, 10);
      });
    });
  }
};

/**
 * Monte l'écran.
 * @param {Record<string, any>} params - Les paramètres de la route.
 * @param {string} motif - Le texte à attendre.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async (params, motif) => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <NewConversation
          navigation={{ goBack: jest.fn(), navigate: jest.fn(), replace: mockReplace }}
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
  await attendre(arbre, motif);
  return arbre;
};

/**
 * L'élément touchable (le plus profond) dont le testID vaut `id`.
 * @param {any} arbre - L'arbre.
 * @param {string} id - Le testID.
 * @returns {any} L'élément.
 */
const parId = (arbre, id) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === id && typeof n.props?.onPress === 'function',
).pop();

/**
 * Le touchable le plus profond dont le texte contient `motif`.
 * @param {any} arbre - L'arbre.
 * @param {string} motif - Le texte.
 * @returns {any} L'élément.
 */
const parTexte = (arbre, motif) => arbre.root.findAllByType(TouchableOpacity)
  .filter((/** @type {any} */ n) => texteDe(n).includes(motif))
  .pop();

const toucher = async (/** @type {any} */ element) => {
  await act(async () => {
    element.props.onPress();
  });
};

const VILLE = { chatScope: 'classic', collectiviteId: 'ville-1', espace: 'ville' };
const OUVERTE = {
  data: { collectivite: { documentId: 'ville-1' }, created: true, documentId: 'fil-1' },
};

beforeEach(() => {
  [mockStartWhisperChat, mockStartGroupChat, mockReplace, mockClientGet, mockContacts, mockOuvrir]
    .forEach((espion) => espion.mockReset());
  mockContacts.mockImplementation(async (_ville, params) => reponseDuServeur(params || {}));
  mockClientGet.mockResolvedValue({ data: [] });
  mockOuvrir.mockResolvedValue(OUVERTE);
});

afterEach(() => {
  montes.splice(0).forEach((demonter) => demonter());
});

/**
 * Les éléments dont le testID vaut `id` (tous, hôtes compris).
 * @param {any} arbre - L'arbre.
 * @param {string} id - Le testID.
 * @returns {any[]} Les éléments.
 */
const tousParId = (arbre, id) => arbre.root
  .findAll((/** @type {any} */ n) => n.props?.testID === id);

describe('MSG-VILLE-NOUVELLE — « Nouvelle conversation » au nom de la Ville', () => {
  test('N1 — les contacts de la Ville : ses gérants, ses clubs en puces, une aide', async () => {
    const arbre = await monter(VILLE, 'Roux');
    expect(mockContacts)
      .toHaveBeenCalledWith('ville-1', expect.objectContaining({ club: null, q: '' }));
    expect(mockClientGet).not.toHaveBeenCalled();
    const texte = texteDe(arbre.root);
    // CORR-COLLECTIVITES 100 (31/10, Adel A) : « gestionnaire », le mot de tout l'espace Ville.
    expect(texte).toContain('GESTIONNAIRES DE LA VILLE');
    expect(texte).not.toMatch(/gérant/i);
    expect(texte).toContain('Nadia Roux');
    expect(texte).toContain('Au nom de Ville de Démouville');
    expect(parId(arbre, 'nouvelle-discussion-filtre-club-a')).toBeTruthy();
    expect(parId(arbre, 'nouvelle-discussion-filtre-club-b')).toBeTruthy();
    expect(texte).toContain('Choisissez un club ci-dessus, ou cherchez un nom.');
  });

  test('N2 — un club ouvert : ses membres, rangés par club puis par fonction', async () => {
    const arbre = await monter(VILLE, 'Roux');
    await toucher(parId(arbre, 'nouvelle-discussion-filtre-club-a'));
    await attendre(arbre, 'Benali');
    expect(mockContacts)
      .toHaveBeenLastCalledWith('ville-1', expect.objectContaining({ club: 'club-a' }));
    const texte = texteDe(arbre.root);
    expect(texte).toContain('AS VILLE A · DIRIGEANTS');
    expect(texte).toContain('AS VILLE A · JOUEURS');
    expect(texte).toContain('AS VILLE A · PARENTS');
    expect(texte).toContain('Joueur · AS Ville A');
    expect(texte.indexOf('DIRIGEANTS')).toBeLessThan(texte.indexOf('JOUEURS'));
  });

  test('N3 — une personne : un tête-à-tête, qui s’ouvre côté Ville', async () => {
    const arbre = await monter(VILLE, 'Roux');
    await toucher(parId(arbre, 'nouvelle-discussion-filtre-club-a'));
    await attendre(arbre, 'Morel');
    await toucher(parId(arbre, 'nouvelle-discussion-personne-lea'));
    await toucher(parId(arbre, 'nouvelle-discussion-valider'));
    expect(mockOuvrir).toHaveBeenCalledWith('ville-1', { participants: ['lea'] });
    expect(mockStartWhisperChat).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('Conversation', {
      chatId: 'fil-1', chatType: 'collectivite_conversation', espace: 'ville',
    });
  });

  test('N4 — plusieurs personnes : un groupe nommé, sans photo ni autorisations', async () => {
    const arbre = await monter(VILLE, 'Roux');
    await toucher(parId(arbre, 'nouvelle-discussion-personne-gerante'));
    await toucher(parId(arbre, 'nouvelle-discussion-filtre-club-a'));
    await attendre(arbre, 'Benali');
    await toucher(parId(arbre, 'nouvelle-discussion-personne-karim'));
    await toucher(parId(arbre, 'nouvelle-discussion-valider'));
    expect(texteDe(arbre.root)).toContain('Il part au nom de la Ville.');
    const styles = tousParId(arbre, 'nouveau-groupe-autorisations').map((n) => n.props.style);
    expect(JSON.stringify(styles)).toContain('"display":"none"');
    await toucher(parTexte(arbre, 'Créer le groupe'));
    expect(mockOuvrir).toHaveBeenCalledWith('ville-1', {
      groupName: 'Groupe (3)', participants: ['gerante', 'karim'],
    });
    expect(mockStartGroupChat).not.toHaveBeenCalled();
  });

  test('N5 — la recherche cherche dans tous les clubs de la Ville', async () => {
    const arbre = await monter(VILLE, 'Roux');
    const champ = tousParId(arbre, 'nouvelle-discussion-recherche')
      .filter((n) => typeof n.props?.onChangeText === 'function').pop();
    await act(async () => {
      champ.props.onChangeText('morel');
    });
    await attendre(arbre, 'Morel');
    expect(mockContacts)
      .toHaveBeenLastCalledWith('ville-1', expect.objectContaining({ club: null, q: 'morel' }));
  });

  test('N6 — un refus du serveur (personne mineure) se dit, et rien ne s’ouvre', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const refus = new Error('Cette personne est mineure : la Ville ne peut pas lui écrire.');
    mockOuvrir.mockRejectedValueOnce(Object.assign(refus, {
      response: {
        data: { error: { details: { code: 'MINOR_DIRECT_CHAT_FORBIDDEN' }, status: 403 } },
        status: 403,
      },
    }));
    const arbre = await monter(VILLE, 'Roux');
    await toucher(parId(arbre, 'nouvelle-discussion-personne-gerante'));
    await toucher(parId(arbre, 'nouvelle-discussion-valider'));
    expect(alerte).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    alerte.mockRestore();
  });

  test('N7 — hors de la Ville, rien ne change : les membres des équipes', async () => {
    const arbre = await monter({ chatScope: 'classic' }, 'Aucun membre');
    expect(mockContacts).not.toHaveBeenCalled();
    expect(texteDe(arbre.root)).toContain('1 personne = privé · 2 et plus = groupe');
    expect(texteDe(arbre.root)).not.toContain('Au nom de');
  });
});
