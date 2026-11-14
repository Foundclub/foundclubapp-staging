/* eslint-disable max-len */
import { Modal, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Communautes from '../Communautes';

// COMMUNAUTES-L4 (14/11/2026, D76, maquette v3 validée le 12/11) — LES ÉCRANS DE LECTURE :
//   P1 écran 2 : une seule communauté (ouverte depuis sa ligne), non-lus, aperçu, « D'office · parent
//      de Lina » ;
//   P2 appui long : marquer comme lu, infos du groupe, quitter (jamais le fil de l'équipe) ;
//   P3 écran 8 : un mineur ne voit AUCUN groupe d'adultes, et « Pourquoi je ne vois pas tous les
//      groupes ? » ;
//   P4 variante A : le bandeau du complexe mis en favori, « Quitter la communauté » ;
//   P5 écran 5 : Annonces s'ouvre sous ce nom, avec la communauté en sous-titre.

const mockGetMesCommunautes = jest.fn();
const mockQuitterLeGroupe = jest.fn(() => Promise.resolve());
const mockQuitterLaCommunaute = jest.fn(() => Promise.resolve());
jest.mock('@/services/chat/communauteService', () => ({
  getMesCommunautes: (...args) => mockGetMesCommunautes(...args),
  quitterLaCommunauteDuComplexe: (...args) => mockQuitterLaCommunaute(...args),
  quitterLeGroupe: (...args) => mockQuitterLeGroupe(...args),
}));
let mockFils = [];
jest.mock('@/services/chat/chatQueriesCompat', () => ({
  useGetChats: () => ({ data: { pages: [{ data: mockFils }] } }),
}));
const mockAuth = { allMyTeams: [], userData: { documentId: 'nadia' } };
jest.mock('@/domains/auth/useAuth', () => ({ __esModule: true, default: () => mockAuth }));
const mockLu = jest.fn();
const mockRecu = jest.fn();
jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ sendReadReceipt: mockRecu, updateLastReadMessage: mockLu }),
}));
jest.mock('@/utils/fenetreDeLApp', () => ({ confirmerDansLApp: () => Promise.resolve(true) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      if (typeof repli === 'string') return repli;
      if (!repli?.defaultValue) return cle;
      return repli.defaultValue.replace(/\{\{(\w+)\}\}/g, (_, nom) => String(repli[nom] ?? ''));
    },
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));
jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  return { __esModule: true, default: () => ({ Colors: couleurs }) };
});
jest.mock('@/components/atoms/glyphIcon/GlyphIcon', () => () => null);

const neIlYA = (ans) => `${new Date().getUTCFullYear() - ans}-01-01`;

const CLUB = {
  annonces: 'fil-club',
  annoncesNonLus: 1,
  documentId: 'club-1',
  genre: 'club',
  groupes: [
    {
      chat: 'fil-u13', enfants: ['Lina'], nom: 'U13', nonLus: 4, origine: 'equipe', raison: 'parent', theme: 'equipe',
    },
    {
      chat: 'g-parents', dOffice: true, nom: 'Parents U13', nonLus: 2, origine: 'groupe', theme: 'parents',
    },
    {
      chat: 'g-benevoles', nom: 'Bénévoles', nonLus: 0, origine: 'groupe', theme: 'libre',
    },
  ],
  groupesAvecDuNouveau: 2,
  nom: 'AS Bellevue',
  nonLus: 7,
};
const COMPLEXE = {
  annonces: 'canal-cx',
  documentId: 'cx-1',
  genre: 'complexe',
  groupes: [{
    chat: 'g-jeudi', nom: 'Foot à 5 du jeudi', origine: 'groupe', theme: 'libre',
  }],
  nom: 'Five Lyon Est',
  pourquoi: 'favori',
  slug: 'five-lyon-est',
};
const fil = (documentId, message, prenom) => ({
  documentId,
  messages: [{
    createdAt: '2026-11-14T07:15:00.000Z', documentId: `m-${documentId}`, message, sender: { documentId: prenom, firstname: prenom },
  }],
  participants: [],
  type: 'group',
});

const parTestID = (arbre, id) => arbre.root.findAll((n) => n.props?.testID === id && n.type === TouchableOpacity);
const existe = (arbre, id) => arbre.root.findAll((n) => n.props?.testID === id).length > 0;
const textes = (noeud) => noeud.findAllByType(Text).map((n) => [].concat(n.props.children).join(''));

const laFeuille = (arbre) => arbre.root.find((n) => n.type === Modal && n.props?.testID === 'communaute-mineur-modal');

const montes = [];
const monter = async (params) => {
  const navigation = {
    addListener: () => () => {}, goBack: jest.fn(), navigate: jest.fn(),
  };
  let arbre;
  await act(async () => {
    arbre = renderer.create(<Communautes navigation={navigation} route={{ params }} />);
  });
  montes.push(arbre);
  return { arbre, navigation };
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

beforeEach(() => {
  mockAuth.userData = { birthdate: neIlYA(38), documentId: 'nadia' };
  mockFils = [fil('g-parents', 'Qui a la clé du local ?', 'Sophie'), fil('fil-club', 'Entraînement déplacé', 'Sami')];
  mockGetMesCommunautes.mockResolvedValue([CLUB, COMPLEXE]);
});
afterEach(() => {
  montes.splice(0).forEach((arbre) => act(() => arbre.unmount()));
  jest.clearAllMocks();
});

describe('COMMUNAUTES-L4 — les écrans de lecture', () => {
  test('P1 — écran 2 : la communauté demandée seule, non-lus, aperçu, « parent de Lina »', async () => {
    const { arbre } = await monter({ genre: 'club', id: 'club-1' });
    expect(existe(arbre, 'communaute-club-club-1')).toBe(true);
    expect(existe(arbre, 'communaute-complexe-cx-1')).toBe(false);
    expect(textes(arbre.root)).toContain('AS Bellevue');
    expect(textes(parTestID(arbre, 'communaute-ligne-fil-u13')[0])).toEqual(
      expect.arrayContaining(['U13', 'D’office · parent de Lina', '4']),
    );
    // D'office sans raison à dire : l'aperçu passe devant (maquette : « Sophie : Qui a la clé… »).
    expect(textes(parTestID(arbre, 'communaute-ligne-g-parents')[0])).toEqual(
      expect.arrayContaining(['Parents U13', 'Sophie : Qui a la clé du local ?', '2']),
    );
    // Sans raison : l'aperçu du dernier message, lu dans la liste des messages.
    expect(textes(parTestID(arbre, 'communaute-ligne-annonces-club-1')[0])).toEqual(
      expect.arrayContaining(['Annonces', 'Sami : Entraînement déplacé', '1']),
    );
    expect(existe(arbre, 'communaute-non-lus-g-benevoles')).toBe(false);
  });

  test('P2 — appui long : lu, infos, quitter ; le fil de l équipe ne se quitte pas', async () => {
    const { arbre, navigation } = await monter({ genre: 'club', id: 'club-1' });
    const menu = () => arbre.root.find((n) => n.props?.entrees && typeof n.props?.onClose === 'function');
    act(() => parTestID(arbre, 'communaute-ligne-fil-u13')[0].props.onLongPress());
    expect(menu().props.visible).toBe(true);
    expect(menu().props.entrees.map((e) => e.cle)).toEqual(['marquer-lu', 'infos']);
    act(() => menu().props.onClose());
    act(() => parTestID(arbre, 'communaute-ligne-g-parents')[0].props.onLongPress());
    expect(menu().props.entrees.map((e) => e.cle)).toEqual(['marquer-lu', 'infos', 'quitter']);
    act(() => menu().props.entrees[0].onPress());
    expect(mockLu).toHaveBeenCalledWith('g-parents');
    expect(mockRecu).toHaveBeenCalledWith('g-parents');
    expect(existe(arbre, 'communaute-non-lus-g-parents')).toBe(false);
    act(() => parTestID(arbre, 'communaute-ligne-g-parents')[0].props.onLongPress());
    act(() => menu().props.entrees.find((e) => e.cle === 'infos').onPress());
    expect(navigation.navigate).toHaveBeenLastCalledWith('Conversation', {
      chatId: 'g-parents', ouvrirInfos: true, title: 'Parents U13',
    });
    act(() => parTestID(arbre, 'communaute-ligne-g-parents')[0].props.onLongPress());
    await act(async () => { await menu().props.entrees.find((e) => e.cle === 'quitter').onPress(); });
    expect(mockQuitterLeGroupe).toHaveBeenCalledWith('g-parents');
  });

  test('P3 — un mineur ne voit aucun groupe d adultes, et peut demander pourquoi', async () => {
    mockAuth.userData = { birthdate: neIlYA(12), documentId: 'lina' };
    // Même si le serveur rendait un groupe d'adultes (il ne le fait pas), l'écran ne le montre pas.
    const { arbre } = await monter({ genre: 'club', id: 'club-1' });
    expect(existe(arbre, 'communaute-ligne-g-parents')).toBe(false);
    expect(existe(arbre, 'communaute-ligne-fil-u13')).toBe(true);
    expect(existe(arbre, 'communaute-ligne-g-benevoles')).toBe(true);
    expect(textes(arbre.root)).toContain('Tes parents sont dans les groupes où tu es.');
    expect(laFeuille(arbre).props.visible).toBe(false);
    act(() => parTestID(arbre, 'communaute-mineur-pourquoi')[0].props.onPress());
    expect(laFeuille(arbre).props.visible).toBe(true);
    expect(textes(arbre.root)).toContain('Certains groupes du club sont réservés aux adultes : parents, '
      + 'covoiturage, encadrement. Tu vois les groupes de ton équipe et les annonces du club.');
    act(() => parTestID(arbre, 'communaute-mineur-compris')[0].props.onPress());
    expect(laFeuille(arbre).props.visible).toBe(false);
  });

  test('P3b — un adulte ne voit pas la question des mineurs', async () => {
    const { arbre } = await monter({ genre: 'club', id: 'club-1' });
    expect(existe(arbre, 'communaute-mineur-club-1')).toBe(false);
    expect(existe(arbre, 'communaute-ligne-g-parents')).toBe(true);
  });

  test('P4 — variante A : le bandeau du favori ; « Quitter la communauté » sort du canal et des groupes', async () => {
    const { arbre, navigation } = await monter({ genre: 'complexe', id: 'cx-1' });
    expect(textes(arbre.root)).toContain(
      'Tu es dans la communauté du Five Lyon Est parce que tu l’as mis en favori.',
    );
    await act(async () => { await parTestID(arbre, 'communaute-quitter-cx-1')[0].props.onPress(); });
    expect(mockQuitterLaCommunaute).toHaveBeenCalledWith({ groupes: ['g-jeudi'], slug: 'five-lyon-est' });
    expect(navigation.goBack).toHaveBeenCalled();
  });

  test('P4b — le gérant ne voit pas le bandeau', async () => {
    mockGetMesCommunautes.mockResolvedValue([{ ...COMPLEXE, pourquoi: 'gerant' }]);
    const { arbre } = await monter({ genre: 'complexe', id: 'cx-1' });
    expect(existe(arbre, 'communaute-bandeau-cx-1')).toBe(false);
  });

  test('P5 — écran 5 : Annonces s ouvre sous ce nom, la communauté en sous-titre', async () => {
    const { arbre, navigation } = await monter({ genre: 'club', id: 'club-1' });
    act(() => parTestID(arbre, 'communaute-ligne-annonces-club-1')[0].props.onPress());
    expect(navigation.navigate).toHaveBeenLastCalledWith('Conversation', {
      chatId: 'fil-club', subTitle: 'AS Bellevue', title: 'Annonces',
    });
  });
});

// RECOLTE-T11 K8 — interrupteur ÉTEINT (la prod) : rien des Communautés, et aucun appel au serveur.
describe('K8 — interrupteur FC_COMMUNAUTES_V1 éteint', () => {
  beforeEach(() => {
    process.env.FC_COMMUNAUTES_V1 = '0';
  });

  test('K8-P — l écran Communautés (adresse tapée, lien) ne montre rien, ne lit rien, renvoie aux Messages', async () => {
    const { arbre, navigation } = await monter({ genre: 'club', id: 'club-1' });
    expect(arbre.toJSON()).toBeNull();
    expect(mockGetMesCommunautes).not.toHaveBeenCalled();
    expect(navigation.navigate).toHaveBeenCalledWith('Chat');
  });
});
