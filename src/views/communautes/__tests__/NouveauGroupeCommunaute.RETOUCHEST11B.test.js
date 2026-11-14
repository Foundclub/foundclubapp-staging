import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import NouveauGroupeCommunaute from '../NouveauGroupeCommunaute';

// RETOUCHES-T11B défaut 1 (tournée T10-T11 du 14/11, capture 37) : avec un seul membre
// éligible, « Créer avec 1 membres » restait grisé sans dire pourquoi (minimum 2). Le témoin lit
// le VRAI fr.js par i18next, pour juger l'accord (_one / _other) et la phrase du minimum.
const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

const i18n = i18nextTemoin.default || i18nextTemoin;
i18n.init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

jest.setTimeout(20000);

const mockGetCandidats = jest.fn();
jest.mock('@/services/chat/communauteService', () => ({
  creerGroupeCommunaute: jest.fn(),
  getCandidatsCommunaute: (...args) => mockGetCandidats(...args),
  getMesCommunautes: jest.fn(),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => {
    // eslint-disable-next-line global-require -- jest.mock est hissé : l'instance se lit ici.
    const vrai = require('i18next');
    const inst = vrai.default || vrai;
    return { t: (...args) => inst.t(...args) };
  },
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
const allerEtapeDeux = async (membres) => {
  mockGetCandidats.mockResolvedValue({ membres, total: membres.length });
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <NouveauGroupeCommunaute
        navigation={{ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn() }}
        route={{ params: { genre: 'club', id: 'club-1', nomCommunaute: 'AS Demo' } }}
      />,
    );
  });
  montes.push(arbre);
  act(() => arbre.root.findByProps({ testID: 'nouveau-groupe-nom' }).props.onChangeText('Staff'));
  await act(async () => parTestID(arbre, 'nouveau-groupe-suivant')[0].props.onPress());
  return arbre;
};

beforeEach(() => {
  process.env.FC_COMMUNAUTES_V1 = '1';
});
afterEach(() => {
  process.env.FC_COMMUNAUTES_V1 = '';
  montes.splice(0).forEach((arbre) => act(() => arbre.unmount()));
  jest.clearAllMocks();
});

describe('RETOUCHES-T11B défaut 1 — « Nouveau groupe », minimum et accord', () => {
  test('R1 — un seul membre coché : singulier, bouton grisé ET la phrase du minimum', async () => {
    const arbre = await allerEtapeDeux([{ documentId: 'm1', firstname: 'Ana', lastname: 'B' }]);
    act(() => parTestID(arbre, 'nouveau-groupe-membre-m1')[0].props.onPress());
    expect(parTestID(arbre, 'nouveau-groupe-creer')[0].props.disabled).toBe(true);
    const vus = textes(arbre);
    expect(vus).toContain('Créer avec 1 membre');
    expect(vus).toContain('Il faut au moins 2 membres pour créer un groupe.');
    expect(vus.some((x) => x.includes('1 membres') || x.includes('1 cochés'))).toBe(false);
  });

  test('R2 — deux membres cochés : pluriel, bouton actif, plus de phrase du minimum', async () => {
    const arbre = await allerEtapeDeux([
      { documentId: 'm1', firstname: 'Ana', lastname: 'B' },
      { documentId: 'm2', firstname: 'Bob', lastname: 'C' },
    ]);
    act(() => parTestID(arbre, 'nouveau-groupe-tout-selectionner')[0].props.onPress());
    expect(parTestID(arbre, 'nouveau-groupe-creer')[0].props.disabled).toBe(false);
    const vus = textes(arbre);
    expect(vus).toContain('Créer avec 2 membres');
    expect(vus).not.toContain('Il faut au moins 2 membres pour créer un groupe.');
  });
});
