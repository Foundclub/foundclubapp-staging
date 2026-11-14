import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Communautes from '../Communautes';
import NouveauGroupeCommunaute from '../NouveauGroupeCommunaute';

// COMMUNAUTES-L2 (13/11/2026, D76 ; maquette v3, écrans 2, 3 et 4) — de « Communautés » au fil
// créé.

// L4 (14/11) : « Communautés » monte plus de modules ; sous charge (2 workers, PC partagé), le
// premier témoin a dépassé 5 s une fois sur trois.
jest.setTimeout(20000);

const mockGetMesCommunautes = jest.fn();
const mockGetCandidats = jest.fn();
const mockCreer = jest.fn();
jest.mock('@/services/chat/communauteService', () => ({
  creerGroupeCommunaute: (...args) => mockCreer(...args),
  getCandidatsCommunaute: (...args) => mockGetCandidats(...args),
  getMesCommunautes: (...args) => mockGetMesCommunautes(...args),
}));
// L4 (14/11) : « Communautés » lit aussi le compte, la liste des messages (aperçus) et le « lu ».
jest.mock('@/services/chat/chatQueriesCompat', () => ({
  useGetChats: () => ({ data: undefined }),
}));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ allMyTeams: [], userData: { documentId: 'moi' } }),
}));
jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ sendReadReceipt: jest.fn(), updateLastReadMessage: jest.fn() }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ valeurs) => {
      const texte = typeof repli === 'string' ? repli : cle;
      return texte.replace(/\{\{(\w+)\}\}/g, (_, nom) => String(valeurs?.[nom] ?? ''));
    },
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
  }),
}));
jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  return { __esModule: true, default: () => ({ Colors: couleurs }) };
});
jest.mock('@/components/atoms/glyphIcon/GlyphIcon', () => () => null);

const parTestID = (arbre, id) => arbre.root.findAll(
  (n) => n.props?.testID === id && n.type === TouchableOpacity,
);
const textes = (arbre) => arbre.root.findAllByType(Text)
  .map((n) => [].concat(n.props.children).join(''));

const montes = [];
const monter = async (element) => {
  let arbre;
  await act(async () => {
    arbre = renderer.create(element);
  });
  montes.push(arbre);
  return arbre;
};

// RECOLTE-T11 K8 (14/11/2026, Adel « 337- B ») : ces témoins décrivent l'interrupteur
// FC_COMMUNAUTES_V1 ALLUMÉ (la recette) ; le bloc « K8 » en fin de fichier, ÉTEINT (la prod).
beforeEach(() => {
  process.env.FC_COMMUNAUTES_V1 = '1';
});
afterEach(() => {
  // `delete` ne retire rien du process.env de jest : on remet la valeur vide.
  process.env.FC_COMMUNAUTES_V1 = '';
});

afterEach(() => {
  montes.splice(0).forEach((arbre) => act(() => arbre.unmount()));
  jest.clearAllMocks();
});

describe('COMMUNAUTES-L2 — Communautés et Nouveau groupe', () => {
  test('N1 — Communautés : les lignes ouvrent le fil ; « Nouveau groupe » si permis', async () => {
    mockGetMesCommunautes.mockResolvedValue([
      {
        annonces: 'fil-club',
        documentId: 'club-1',
        genre: 'club',
        groupes: [
          {
            chat: 'fil-u13',
            icone: null,
            nom: 'U13',
            origine: 'equipe',
            theme: 'equipe',
          },
        ],
        nom: 'AS Demo',
        peutCreer: true,
      },
      {
        annonces: 'canal-cx',
        documentId: 'cx-1',
        genre: 'complexe',
        groupes: [],
        nom: 'Five Demo',
        peutCreer: false,
      },
      {
        annonces: 'fil-ville',
        documentId: 'ville-1',
        genre: 'ville',
        groupes: [],
        nom: 'Ville Demo',
        peutCreer: true,
      },
    ]);
    const navigate = jest.fn();
    const arbre = await monter(
      <Communautes navigation={{ addListener: () => () => {}, goBack: jest.fn(), navigate }} />,
    );
    act(() => parTestID(arbre, 'communaute-ligne-fil-u13')[0].props.onPress());
    expect(navigate).toHaveBeenLastCalledWith('Conversation', { chatId: 'fil-u13', title: 'U13' });
    act(() => parTestID(arbre, 'communaute-ligne-annonces-club-1')[0].props.onPress());
    // L4 (écran 5) : la communauté en sous-titre d'Annonces.
    expect(navigate).toHaveBeenLastCalledWith('Conversation', {
      chatId: 'fil-club',
      subTitle: 'AS Demo',
      title: 'Annonces',
    });
    expect(parTestID(arbre, 'communaute-nouveau-groupe-club-1')).toHaveLength(1);
    expect(parTestID(arbre, 'communaute-nouveau-groupe-cx-1')).toHaveLength(0);
    expect(parTestID(arbre, 'communaute-nouveau-groupe-ville-1')).toHaveLength(0);
    expect(textes(arbre)).toContain('Les groupes de la Ville arrivent avec les invitations.');
    act(() => parTestID(arbre, 'communaute-nouveau-groupe-club-1')[0].props.onPress());
    expect(navigate).toHaveBeenLastCalledWith('NouveauGroupeCommunaute', {
      genre: 'club',
      id: 'club-1',
      nomCommunaute: 'AS Demo',
    });
  });

  test('N2 — Nouveau groupe : étape 1, Tout sélectionner, corps exact, fil ouvert', async () => {
    mockGetCandidats.mockResolvedValue({
      membres: [
        { documentId: 'm1', firstname: 'Ana', lastname: 'B' },
        { documentId: 'm2', firstname: 'Bob', lastname: 'C' },
      ],
      total: 2,
    });
    mockCreer.mockResolvedValue({ chat: 'fil-neuf', groupe: 'ligne-1' });
    const replace = jest.fn();
    const arbre = await monter(
      <NouveauGroupeCommunaute
        navigation={{ goBack: jest.fn(), navigate: jest.fn(), replace }}
        route={{ params: { genre: 'club', id: 'club-1', nomCommunaute: 'AS Demo' } }}
      />,
    );
    expect(parTestID(arbre, 'nouveau-groupe-suivant')[0].props.disabled).toBe(true);
    const champNom = arbre.root.findByProps({ testID: 'nouveau-groupe-nom' });
    act(() => champNom.props.onChangeText('Covoiturage U13'));
    act(() => parTestID(arbre, 'nouveau-groupe-theme-covoiturage')[0].props.onPress());
    act(() => parTestID(arbre, 'nouveau-groupe-icone-flag')[0].props.onPress());
    await act(async () => parTestID(arbre, 'nouveau-groupe-suivant')[0].props.onPress());
    expect(mockGetCandidats).toHaveBeenCalledWith({
      genre: 'club',
      id: 'club-1',
      theme: 'covoiturage',
    });
    expect(parTestID(arbre, 'nouveau-groupe-creer')[0].props.disabled).toBe(true);
    act(() => parTestID(arbre, 'nouveau-groupe-tout-selectionner')[0].props.onPress());
    expect(textes(arbre)).toContain('Créer avec 2 membres');
    await act(async () => parTestID(arbre, 'nouveau-groupe-creer')[0].props.onPress());
    expect(mockCreer).toHaveBeenCalledWith({
      corps: {
        data: {
          icone: 'flag',
          membres: ['m1', 'm2'],
          nom: 'Covoiturage U13',
          quiEcrit: 'tous',
          theme: 'covoiturage',
        },
      },
      genre: 'club',
      id: 'club-1',
    });
    expect(replace).toHaveBeenCalledWith('Conversation', {
      chatId: 'fil-neuf',
      title: 'Covoiturage U13',
    });
  });

  test('N3 — un refus du serveur s affiche tel quel et n ouvre rien', async () => {
    mockGetCandidats.mockResolvedValue({
      membres: [{ documentId: 'm1' }, { documentId: 'm2' }],
      total: 2,
    });
    mockCreer.mockRejectedValue({
      response: {
        data: {
          error: { message: 'Une des personnes choisies ne peut pas entrer dans ce groupe.' },
        },
      },
    });
    const replace = jest.fn();
    const arbre = await monter(
      <NouveauGroupeCommunaute
        navigation={{ goBack: jest.fn(), replace }}
        route={{ params: { genre: 'club', id: 'club-1' } }}
      />,
    );
    act(() => arbre.root.findByProps({ testID: 'nouveau-groupe-nom' }).props.onChangeText('Staff'));
    await act(async () => parTestID(arbre, 'nouveau-groupe-suivant')[0].props.onPress());
    act(() => parTestID(arbre, 'nouveau-groupe-tout-selectionner')[0].props.onPress());
    await act(async () => parTestID(arbre, 'nouveau-groupe-creer')[0].props.onPress());
    expect(textes(arbre)).toContain(
      'Une des personnes choisies ne peut pas entrer dans ce groupe.',
    );
    expect(replace).not.toHaveBeenCalled();
  });
});

// RECOLTE-T11 K8 — interrupteur ÉTEINT (la prod) : rien des Communautés, et aucun appel au serveur.
describe('K8 — interrupteur FC_COMMUNAUTES_V1 éteint', () => {
  beforeEach(() => {
    process.env.FC_COMMUNAUTES_V1 = '0';
  });

  test('K8-N — « Nouveau groupe » ne montre rien, ne lit rien, renvoie aux Messages', async () => {
    const navigation = { goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn() };
    const arbre = await monter(
      <NouveauGroupeCommunaute
        navigation={navigation}
        route={{ params: { genre: 'club', id: 'club-1', nom: 'AS Demo' } }}
      />,
    );
    expect(arbre.toJSON()).toBeNull();
    expect(mockGetCandidats).not.toHaveBeenCalled();
    expect(mockCreer).not.toHaveBeenCalled();
    expect(navigation.navigate).toHaveBeenCalledWith('Chat');
  });
});
