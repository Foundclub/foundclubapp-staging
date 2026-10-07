import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import SeasonSlotWeekGrid from '../SeasonSlotWeekGrid';

// ==========================================================================
// FINITIONS16 · POINT 21 (tournee T15, photo SITE_C23a ; planche 23, P4v2-creneaux-ordi) — la
// semaine type d'une installation, sur ordinateur. Trois creneaux a la meme heure se posent cote
// a cote ; avec le panneau « Attribuer » ouvert, la colonne du jour ne fait plus que ~66 px et
// chaque voie ~22 px : « Mo… », « A… », illisibles.
//
//   1. CARACTERISATION (E6, vert avant) : une voie large montre le club, l'equipe et les heures ;
//   2. une voie etroite montre les INITIALES du club (celles des ecussons) et l'equipe ;
//   3. une voie trop etroite pour deux lettres ne montre AUCUN texte coupe (le bloc garde sa
//      couleur, son nom complet pour le lecteur d'ecran, et s'ouvre au clic).
// ==========================================================================

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const couleurs = genererCouleurs();
  const theme = {
    Alignments: jest.requireActual('@/theme/alignements').default,
    Colors: couleurs,
    Fonts: genererPolices(couleurs),
    Spaces: jest.requireActual('@/theme/spaces').default,
  };
  return { __esModule: true, default: () => theme };
});

const creneau = (
  /** @type {string} */ id,
  /** @type {string} */ club,
  /** @type {string} */ equipe,
) => ({
  club: { documentId: `club-${id}`, name: club },
  documentId: id,
  endTime: '17:00:00.000',
  startTime: '14:00:00.000',
  team: { documentId: `equipe-${id}`, name: equipe },
  weekday: 5,
});

// Le vendredi de la T15 : trois creneaux de 14:00 a 17:00.
const VENDREDI = [
  creneau('c1', 'AS Montrivage', 'U15'),
  creneau('c2', 'Montrivage Basket', 'Seniors'),
  creneau('c3', 'Montrivage FC', 'Senior B'),
];

/** @type {any[]} */
const montes = [];
afterEach(() => {
  act(() => {
    montes.splice(0).forEach((arbre) => arbre.unmount());
  });
});

/**
 * Monte la grille ; `largeur` : la largeur mesuree du cadre (onLayout), ou rien.
 * @param {number | null} largeur
 * @returns {any} L'arbre.
 */
const monter = (largeur) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <SeasonSlotWeekGrid capacite={2} creneaux={VENDREDI} onCreneau={jest.fn()} />,
    );
  });
  montes.push(arbre);
  if (largeur !== null) {
    const [cadre] = arbre.root.findAll(
      (/** @type {any} */ n) => n.props?.testID === 'semaine-type-cadre'
        && typeof n.props?.onLayout === 'function',
    );
    act(() => {
      cadre.props.onLayout({ nativeEvent: { layout: { height: 400, width: largeur } } });
    });
  }
  return arbre;
};

const texteDuBloc = (/** @type {any} */ arbre, /** @type {string} */ id) => {
  const [bloc] = arbre.root.findAll(
    (/** @type {any} */ n) => n.props?.testID === `creneau-${id}` && typeof n.type !== 'string',
  );
  return bloc.findAllByType(Text).map((/** @type {any} */ n) => String(n.props.children));
};

describe('FINITIONS16 21 — planche 23 : des blocs lisibles quand la place manque', () => {
  it('🔒 caractérisation : sans largeur mesurée, le club, l’équipe et les heures', () => {
    expect(texteDuBloc(monter(null), 'c2'))
      .toEqual(['Montrivage Basket', 'Seniors', '14:00 – 17:00']);
  });

  it('🔴 une voie de 72 px garde le nom entier', () => {
    // 1 600 px : (1 600 - 24 - 56) / 7 = 217 px par jour, 72 px par voie.
    expect(texteDuBloc(monter(1600), 'c2'))
      .toEqual(['Montrivage Basket', 'Seniors', '14:00 – 17:00']);
  });

  it('🔴 une voie étroite : les initiales du club (celles des écussons) et l’équipe', () => {
    // 880 px (panneau ferme, 1 280 px) : (880 - 80) / 7 = 114 px par jour, 38 px par voie.
    const lus = texteDuBloc(monter(880), 'c2');
    expect(lus).toEqual(['MB', 'Seniors']);
  });

  it('🔴 une voie trop étroite pour deux lettres : aucun texte coupé', () => {
    // 540 px (panneau ouvert) : (540 - 80) / 7 = 66 px par jour, 22 px par voie.
    const arbre = monter(540);
    expect(texteDuBloc(arbre, 'c2')).toEqual([]);
    const [bloc] = arbre.root.findAll(
      (/** @type {any} */ n) => n.props?.testID === 'creneau-c2'
        && typeof n.props?.onPress === 'function',
    );
    expect(bloc.props.accessibilityLabel).toContain('Montrivage Basket');
  });
});

// 🎨 VILLE-T18A (07/10), tournée T18 point 4b (site, capture SITE_G37b) — panneau
// « Attribuer » ouvert : sous « Mar. », le moment complet s affichait « comple… » (une
// seule ligne imposée dans une colonne de ~66 px). Il passe à la ligne, centré :
// « complet » puis ses heures, rien de coupé. ROUGE avant.
describe('VILLE-T18A 4b — le moment complet de l en-tête ne se coupe pas', () => {
  it('panneau ouvert (66 px par jour) : « complet 14:00 – 17:00 » passe à la ligne', () => {
    const arbre = monter(540);
    const [complet] = arbre.root.findAllByType(Text)
      .filter((/** @type {any} */ n) => String(n.props.children).startsWith('complet'));
    expect(String(complet.props.children)).toBe('complet 14:00 – 17:00');
    const lignes = complet.props.numberOfLines;
    expect(lignes === undefined || lignes >= 3).toBe(true);
    const style = jest.requireActual('react-native').StyleSheet.flatten(complet.props.style);
    expect(style.textAlign).toBe('center');
  });
});
