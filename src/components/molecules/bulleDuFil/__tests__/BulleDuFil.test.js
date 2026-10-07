import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { colors } from '@/theme/colors';

import BulleDuFil from '../BulleDuFil';
import MetaDuMessage, { etatDEnvoi, heureDuMessage } from '../MetaDuMessage';

// MSG1A (§3.1) — LE CADRE COMMUN DES BULLES ET L'HEURE DANS LA BULLE (SPECS.md §1).

jest.mock('react-native-svg', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true, default: VueRN, Path: VueRN, Svg: VueRN,
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (typeof repli === 'string' ? repli : cle),
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const Colors = generateColors();
  return { __esModule: true, default: () => ({ Colors }) };
});

/**
 * @param {any} element
 * @returns {any} L'arbre rendu.
 */
const rendre = (element) => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(element); });
  return arbre;
};

/**
 * Les noeuds NATIFS qui portent un testID (le composant et son noeud natif le portent tous deux).
 * @param {any} arbre
 * @param {string} testID
 * @returns {any[]} Les noeuds.
 */
const natifs = (arbre, testID) => arbre.root.findAll(
  (n) => n.props?.testID === testID && typeof n.type === 'string',
);

const fondDe = (arbre) => [].concat(natifs(arbre, 'cadre')[0].props.style)
  .flat(Infinity).reduce((acc, s) => ({ ...acc, ...(s || {}) }), {}).backgroundColor;

describe('MSG1A — BulleDuFil', () => {
  test('C1 — la queue n est que sur la DERNIERE bulle du groupe', () => {
    const derniere = rendre(<BulleDuFil estDernier testID="cadre"><Text>a</Text></BulleDuFil>);
    const milieu = rendre(<BulleDuFil estDernier={false} testID="cadre"><Text>a</Text></BulleDuFil>);

    expect(natifs(derniere, 'bulle-du-fil-queue')).toHaveLength(1);
    expect(natifs(milieu, 'bulle-du-fil-queue')).toHaveLength(0);
  });

  test('C2 — ma bulle est petrole (chatBubbleMine), la recue primary700', () => {
    expect(fondDe(rendre(<BulleDuFil estAMoi testID="cadre" />))).toBe(colors.chatBubbleMine);
    expect(fondDe(rendre(<BulleDuFil testID="cadre" />))).toBe(colors.primary700);
  });

  test('C3 — le nom s affiche en tete, dans SA couleur, seulement s il est donne', () => {
    const avecNom = rendre(<BulleDuFil couleurDuNom={colors.chatName1} nom="Karim Benali" testID="cadre" />);
    const sansNom = rendre(<BulleDuFil testID="cadre" />);

    const nom = avecNom.root.findByProps({ testID: 'bulle-du-fil-nom' });
    expect(nom.props.children).toBe('Karim Benali');
    expect([].concat(nom.props.style).flat(Infinity).find((s) => s?.color)?.color).toBe(colors.chatName1);
    expect(sansNom.root.findAllByProps({ testID: 'bulle-du-fil-nom' })).toHaveLength(0);
  });

  test('C4 — le contenu passe APRES la queue (il est dessine par-dessus)', () => {
    const arbre = rendre(
      <BulleDuFil estDernier testID="cadre"><Text testID="contenu">a</Text></BulleDuFil>,
    );
    const enfants = natifs(arbre, 'cadre')[0].children;
    const ordre = enfants.map((n) => n.props?.testID).filter(Boolean);
    expect(ordre.indexOf('bulle-du-fil-queue')).toBeLessThan(ordre.indexOf('contenu'));
  });
});

describe('MSG1A — MetaDuMessage', () => {
  test('M1 — l heure se lit en HH:MM', () => {
    expect(heureDuMessage(new Date(2026, 9, 7, 9, 5))).toBe('09:05');
    expect(heureDuMessage('pas une date')).toBe('');
  });

  test('M2 — l etat d envoi garde la regle d avant : echec, en cours, lu, envoye', () => {
    expect(etatDEnvoi({ failed: true })).toBe('echec');
    expect(etatDEnvoi({ pending: true })).toBe('enCours');
    expect(etatDEnvoi({ readBy: [{ documentId: 'x' }] })).toBe('lu');
    expect(etatDEnvoi({ readBy: [] })).toBe('envoye');
  });

  test('M3 — sur MES messages, le lecteur d ecran entend l heure et l etat', () => {
    const arbre = rendre(<MetaDuMessage estAMoi etat="lu" heure="14:32" />);
    expect(arbre.root.findByProps({ testID: 'meta-du-message' }).props.accessibilityLabel)
      .toBe('14:32, Lu');
  });

  test('M4 — sur un message recu, l heure seule (pas de coches)', () => {
    const arbre = rendre(<MetaDuMessage heure="14:32" />);
    const meta = arbre.root.findByProps({ testID: 'meta-du-message' });
    expect(meta.props.accessibilityLabel).toBe('14:32');
    expect(arbre.root.findAll((n) => n.props?.name === 'checkDouble')).toHaveLength(0);
  });
});
