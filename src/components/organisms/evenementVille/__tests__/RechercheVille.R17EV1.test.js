import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EvenementsVilleRecherche from '../RechercheVille';

// 🏛️ R17-EVT-1 (20/10/2026, REC17-005), point 3 — la recherche d'événements (niveau 3, planche
// P11-evenement-ou-ca-vit, porte 6) : une carte par événement public de la Ville (la Ville, le
// nom, quand et où, « Voir la fiche › »), qui ouvre sa fiche ; rien s'il n'y en a pas.

jest.setTimeout(30000);

/** @type {any} */
let mockPublics;
// R17-EVT-1-BIS (g) : le mot tape dans la recherche (eventFilters.q, partage par la liste).
let mockMot = '';
/** @type {string[]} */
const mockMotsDemandes = [];
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
}));
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({ Alignments: alignements, Colors: couleurs, Fonts: genererPolices(couleurs) }),
  };
});
jest.mock('@/services/collectivite/collectiviteEvenementQueries', () => ({
  useEvenementsPublicsDeLaVille: (/** @type {string} */ mot) => {
    mockMotsDemandes.push(mot);
    return mockPublics;
  },
}));
jest.mock('@/store/appContext', () => ({
  useAppContext: () => ([{ eventFilters: { q: mockMot } }, jest.fn()]),
}));

const FETE = {
  collectivite: { documentId: 'ville', name: 'Ville de Montrivage' },
  documentId: 'evt-1',
  endTime: '17:00',
  facility: { documentId: 'stade', name: 'Stade municipal' },
  name: 'Fête du sport',
  startDate: '2026-10-24',
  startTime: '10:00',
  takesPlace: true,
};

const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<EvenementsVilleRecherche />);
  });
  return arbre;
};

describe('R17-EVT-1 — la recherche d’événements : ceux de la Ville', () => {
  it('une carte par événement public, qui ouvre sa fiche', async () => {
    mockPublics = { data: [FETE] };
    const arbre = await monter();
    const lus = arbre.root.findAllByType(Text).map((n) => aplatir(n.props.children));
    expect(lus).toEqual([
      'Événements de la Ville',
      'Ville de Montrivage',
      'Fête du sport',
      'sam. 24 oct. · 10:00 – 17:00 · Stade municipal · toute l’installation',
      'Voir la fiche ›',
    ]);
    await act(async () => {
      arbre.root.findByType(TouchableOpacity).props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('EvenementDeLaVille', { evenementId: 'evt-1' });
  });

  // R17-EVT-1-BIS (g) (20/10, tri du chef) : la bande montrait les 10 prochains, quel que soit le
  // mot tape. Elle suit maintenant le champ de la recherche (deja retenu 300 ms par le champ) :
  // le serveur filtre sur le nom, le lieu, la Ville (publicList, q). ROUGE avant (toujours '').
  it('🔴 elle suit le mot tapé dans la recherche (sans les espaces autour)', async () => {
    mockPublics = { data: [FETE] };
    mockMot = '  fête ';
    mockMotsDemandes.length = 0;
    await monter();
    expect(mockMotsDemandes.at(-1)).toBe('fête');
    mockMot = '';
    mockMotsDemandes.length = 0;
    await monter();
    expect(mockMotsDemandes.at(-1)).toBe('');
  });

  it('aucun, ou le serveur ne répond pas : rien', async () => {
    mockPublics = { data: [] };
    expect((await monter()).toJSON()).toBeNull();
    mockPublics = { data: undefined, isError: true };
    expect((await monter()).toJSON()).toBeNull();
  });
});
