/* eslint-disable max-len -- les libellés se lisent en entier. */
import { createElement } from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// FINITIONS11-STATS · point 6 bis — « listes ok » (Adel, 03/10 ~13h20) : sur la carte « Après le
// match » de l'entraîneur, DEUX listes :
//   1. « Convoqués : 7 sur 9 ont répondu » (quand une convocation est publiée) ;
//   2. « Aussi présents, sans convocation : Lucas, Nathan ».
// Sans convocation publiée, ni le mot « Convoqués », ni la seconde liste : la carte d'avant.

jest.mock('react-i18next', () => {
  const remplir = (/** @type {string} */ modele, /** @type {any} */ valeurs) => modele.replace(
    /\{\{(\w+)\}\}/g,
    (/** @type {string} */ tout, /** @type {string} */ nom) => (
      valeurs && nom in valeurs ? String(valeurs[nom]) : tout
    ),
  );
  return {
    useTranslation: () => ({
      t: (/** @type {string} */ key, /** @type {any} */ fallback, /** @type {any} */ options) => {
        if (typeof fallback === 'string') return remplir(fallback, options);
        if (fallback && fallback.defaultValue_one) {
          const modele = Number(fallback.count) <= 1 ? fallback.defaultValue_one : fallback.defaultValue_other;
          return remplir(String(modele), fallback);
        }
        return key;
      },
    }),
  };
});

jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      scheme: 'dark',
      Spaces,
    }),
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ButtonDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.TouchableOpacity,
      { accessibilityRole: 'button', disabled: Boolean(props.disabled), onPress: props.onPress },
      react.createElement(rn.Text, null, props.title || ''),
    );
  };
});

// eslint-disable-next-line import/first
import PostMatchJourneyCard from '../PostMatchJourneyCard';

/** @type {any[]} */
const montes = [];
afterEach(() => {
  montes.splice(0).forEach((arbre) => act(() => arbre.unmount()));
});

const carte = (/** @type {any} */ props = {}) => {
  /** @type {any} */
  let arbre = null;
  act(() => {
    arbre = renderer.create(createElement(PostMatchJourneyCard, {
      onPressEtape: jest.fn(),
      onRelancer: jest.fn(),
      reponsesAttendues: 9,
      reponsesRecues: 7,
      scoreDisponible: true,
      scoreLibelle: '2 - 1',
      scoreOrigine: 'manual',
      statsFinalisees: true,
      ...props,
    }));
  });
  montes.push(arbre);
  return arbre.root;
};

const textOf = (/** @type {any} */ node) => {
  if (node === null || node === undefined || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (node.props?.children !== undefined) return textOf(node.props.children);
  return '';
};
const textes = (/** @type {any} */ root) => root.findAllByType(Text)
  .map((/** @type {any} */ node) => textOf(node.props.children).trim())
  .filter(Boolean);

describe('FINITIONS11 · point 6 bis — les deux listes de la carte « Après le match »', () => {
  test('1 · 🔴 convocation publiée : « Convoqués : 7 sur 9 ont répondu · manquent … »', () => {
    const vus = textes(carte({ avecConvocation: true, manquants: ['Léo', 'Nina'] }));

    expect(vus).toContain('Convoqués : 7 sur 9 ont répondu · manquent Léo, Nina');
  });

  test('2 · 🔴 « Aussi présents, sans convocation : Lucas, Nathan », sous l étape des retours', () => {
    const root = carte({ avecConvocation: true, presentsSansConvocation: ['Lucas', 'Nathan'] });
    const etape = root.findAll((/** @type {any} */ n) => n.props?.testID === 'post-match-step-responses', { deep: false })[0];

    expect(textes(etape)).toContain('Aussi présents, sans convocation : Lucas, Nathan');
  });

  test('3 · 🔒 sans convocation publiée : ni « Convoqués », ni seconde liste (la carte d avant)', () => {
    const vus = textes(carte({ manquants: ['Léo'], reponsesRecues: 8 }));

    expect(vus).toContain('8 sur 9 ont répondu · manquent Léo');
    expect(vus.join(' ')).not.toContain('Convoqués');
    expect(vus.join(' ')).not.toContain('sans convocation');
  });

  test('4 · 🔒 avant la fin du match : aucune des deux listes', () => {
    const vus = textes(carte({ avantLaFin: true, avecConvocation: true, presentsSansConvocation: ['Lucas'] }));

    expect(vus.join(' ')).not.toContain('Convoqués');
    expect(vus.join(' ')).not.toContain('sans convocation');
  });
});
