import renderer, { act } from 'react-test-renderer';

import { FACILITY_PLANNING_PALETTE } from '@/utils/facilityPlanningColor';

import EventHeader from '../EventHeader';

// Lot AD09 - « la couleur vient de l'installation ».
// Un club a plusieurs terrains, chaque terrain a une couleur choisie par le club.
// L'entete de la fiche evenement peignait TOUT en cyan, quel que soit le lieu.
// Le temoin 3 est celui qui prouve la demande : deux evenements de types
// differents au meme endroit doivent avoir la meme couleur.

jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => () => null);

// Le vrai theme construit `Fonts.<jeton de couleur>` = { color: valeur } et
// `ApplicationStyle.backgroundColor.<jeton>` = { backgroundColor: valeur }
// (src/theme/fonts.js:44-50 et src/theme/applicationStyle.js:19-26). Le mock
// reproduit CETTE forme-la, sinon la couleur d'avant serait invisible et le
// temoin 1 (non-regression) ne prouverait rien.
jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const COLOR_TOKEN = /^(primary|secondary|neutral|success|error|warning|info)/;
  const colorValue = (key) => `couleur-${String(key)}`;
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      ApplicationStyle: new Proxy({}, {
        get: (_target, group) => {
          if (group === 'backgroundColor') {
            return new Proxy({}, { get: (_t, key) => ({ backgroundColor: colorValue(key) }) });
          }
          if (group === 'tintColor') {
            return new Proxy({}, { get: (_t, key) => ({ tintColor: colorValue(key) }) });
          }
          return makeRamp();
        },
      }),
      Colors: new Proxy({}, { get: (_target, key) => colorValue(key) }),
      Fonts: new Proxy({}, {
        get: (_target, key) => (
          COLOR_TOKEN.test(String(key)) ? { color: colorValue(key) } : styleLeaf
        ),
      }),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

jest.mock('react-i18next', () => ({
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({
    t: (key, fallback) => fallback || key,
  }),
}));

const GPS_LABEL = 'Ouvrir dans le GPS';
const SECTION_PROBE = 'SECTION-PROBE-AD09';
const CYAN_OF_TODAY = 'couleur-primary500';
// Les deux couleurs de recette sortent de la VRAIE palette : aucun hexadecimal
// ecrit en dur ici, le contrat de theme scanne aussi les fichiers de test et son
// plafond `hexOutsideAllowlist` est un cliquet.
const ORANGE_TERRAIN_A = FACILITY_PLANNING_PALETTE[3];
const VIOLET_GYMNASE = FACILITY_PLANNING_PALETTE[5];

/**
 * Aplatit un style React Native (objet, tableau, imbrique) en un seul objet.
 * @param {any} style
 * @param {any} acc
 * @returns {any}
 */
const flattenStyle = (style, acc = {}) => {
  if (!style) return acc;
  if (Array.isArray(style)) {
    style.forEach((entry) => flattenStyle(entry, acc));
    return acc;
  }
  if (typeof style === 'object') {
    Object.assign(acc, style);
  }
  return acc;
};

/**
 * Rassemble tout le texte porte par un noeud rendu et ses enfants.
 * @param {any} node
 * @param {string[]} acc
 * @returns {string[]}
 */
const textContentOf = (node, acc = []) => {
  if (node === null || node === undefined || node === false) return acc;
  if (typeof node === 'string' || typeof node === 'number') {
    acc.push(String(node));
    return acc;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => textContentOf(child, acc));
    return acc;
  }
  textContentOf(node.children, acc);
  return acc;
};

/**
 * Retrouve le noeud Text dont le contenu exact est `content`.
 * @param {any} node
 * @param {string} content
 * @returns {any}
 */
const findTextNodeByContent = (node, content) => {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    return node.reduce(
      (/** @type {any} */ found, /** @type {any} */ child) => (
        found || findTextNodeByContent(child, content)
      ),
      null,
    );
  }
  if (node.type === 'Text' && textContentOf(node.children).join('').trim() === content) {
    return node;
  }
  return findTextNodeByContent(node.children, content);
};

/**
 * Rend la couleur effective du noeud Text dont le contenu est `content`.
 * @param {any} tree
 * @param {string} content
 * @returns {any}
 */
const colorOfText = (tree, content) => {
  const node = findTextNodeByContent(tree, content);
  if (!node) return undefined;
  return flattenStyle(node.props?.style).color;
};

/**
 * Les deux sondes d'accent de l'entete : le nom de section (a droite) et le
 * lien « Ouvrir dans le GPS ». Les deux portaient `Fonts.primary500` avant AD09.
 * @param {any} tree
 * @returns {any}
 */
const readAccent = (tree) => {
  const sectionColor = colorOfText(tree, SECTION_PROBE);
  const gpsColor = colorOfText(tree, GPS_LABEL);
  expect(sectionColor).toBeDefined();
  expect(gpsColor).toBeDefined();
  expect(sectionColor).toBe(gpsColor);
  return gpsColor;
};

/**
 * Fabrique un evenement de recette : meme squelette, lieu et type variables.
 * @param {{ facility: any; typeName?: string }} params
 * @returns {any}
 */
const makeEvent = ({ facility, typeName = 'Match' }) => ({
  date: '2026-09-12T18:00:00.000Z',
  documentId: 'evt-ad09',
  endTime: '20:00:00',
  facility,
  location: 'Stade municipal, Lyon',
  name: 'Rencontre AD09',
  startTime: '18:00:00',
  team: {
    club: { documentId: 'club-1', name: 'FC Test' },
    documentId: 'team-1',
    name: 'U15',
    section: { documentId: 'sec-1', name: SECTION_PROBE },
  },
  type: { documentId: 'type-1', name: typeName },
});

/**
 * Rend l entete une fois et rend son arbre JSON, sans laisser de montage vivant.
 * @param {any} event
 * @returns {any}
 */
const renderHeader = (event) => {
  /** @type {any} */
  let tree;
  act(() => {
    tree = renderer.create(<EventHeader event={event} />);
  });
  const json = tree.toJSON();
  act(() => {
    tree.unmount();
  });
  return json;
};

describe('AD09 - la couleur de l installation dans l entete de la fiche evenement', () => {
  // eslint-disable-next-line max-len -- titre de temoin impose mot pour mot par le lot AD09
  test('AD09 · temoin 1 — sans installation, l entete garde exactement la couleur d aujourd hui', () => {
    const accent = readAccent(renderHeader(makeEvent({ facility: null })));

    expect(accent).toBe(CYAN_OF_TODAY);
  });

  // eslint-disable-next-line max-len -- titre de temoin impose mot pour mot par le lot AD09
  test('AD09 · temoin 2 — l entete peint son accent avec la planningColor de l installation', () => {
    const accent = readAccent(renderHeader(makeEvent({
      facility: { documentId: 'f1', name: 'Terrain A', planningColor: ORANGE_TERRAIN_A },
    })));

    expect(accent).toBe(ORANGE_TERRAIN_A);
  });

  // eslint-disable-next-line max-len -- titre de temoin impose mot pour mot par le lot AD09
  test('AD09 · temoin 3 — deux evenements de TYPES DIFFERENTS au MEME endroit ont la MEME couleur', () => {
    const facility = { documentId: 'f1', name: 'Terrain A', planningColor: ORANGE_TERRAIN_A };

    const accentMatch = readAccent(renderHeader(makeEvent({ facility, typeName: 'Match' })));
    const accentTraining = readAccent(renderHeader(makeEvent({
      facility,
      typeName: 'Entrainement',
    })));

    expect(accentMatch).toBe(accentTraining);
    // Et cette couleur commune est celle du LIEU, pas le cyan par defaut : sans
    // cette seconde assertion le temoin passerait aussi quand tout est peint
    // d'une seule couleur, ce qui etait justement le defaut d'avant AD09.
    expect(accentMatch).toBe(ORANGE_TERRAIN_A);
  });

  // eslint-disable-next-line max-len -- titre de temoin impose mot pour mot par le lot AD09
  test('AD09 · temoin 4 — deux evenements du MEME type a DEUX endroits ont des couleurs DIFFERENTES', () => {
    const accentA = readAccent(renderHeader(makeEvent({
      facility: { documentId: 'f1', name: 'Terrain A', planningColor: ORANGE_TERRAIN_A },
      typeName: 'Match',
    })));
    const accentB = readAccent(renderHeader(makeEvent({
      facility: { documentId: 'f2', name: 'Gymnase', planningColor: VIOLET_GYMNASE },
      typeName: 'Match',
    })));

    expect(accentA).toBe(ORANGE_TERRAIN_A);
    expect(accentB).toBe(VIOLET_GYMNASE);
    expect(accentA).not.toBe(accentB);
  });

  test('AD09 · temoin 8 — le lisere gauche de 4 px porte lui aussi la couleur du lieu', () => {
    const withFacility = flattenStyle(renderHeader(makeEvent({
      facility: { documentId: 'f1', name: 'Terrain A', planningColor: ORANGE_TERRAIN_A },
    })).props?.style);
    const withoutFacility = flattenStyle(renderHeader(makeEvent({ facility: null })).props?.style);

    expect(withFacility.borderLeftWidth).toBe(4);
    expect(withFacility.borderLeftColor).toBe(ORANGE_TERRAIN_A);
    // Sans lieu, le lisere existe mais reste de la couleur d'avant AD09.
    expect(withoutFacility.borderLeftColor).toBe(CYAN_OF_TODAY);
  });

  test('AD09 · temoin 9 — la pastille affiche le nom du lieu, et disparait sans nom', () => {
    const avecNom = renderHeader(makeEvent({
      facility: { documentId: 'f1', name: 'Terrain A', planningColor: ORANGE_TERRAIN_A },
    }));
    expect(findTextNodeByContent(avecNom, 'Terrain A')).not.toBeNull();

    // Une installation sans nom ne doit produire AUCUNE pastille vide.
    const sansNom = renderHeader(makeEvent({
      facility: { documentId: 'f2', planningColor: VIOLET_GYMNASE },
    }));
    expect(textContentOf(sansNom).join('|')).not.toContain('||');
    expect(findTextNodeByContent(sansNom, '')).toBeNull();
  });

  // eslint-disable-next-line max-len -- titre de temoin impose mot pour mot par le lot AD09
  test('AD09 · temoin 5 — une installation sans planningColor prend son repli deterministe, jamais du cyan', () => {
    const facility = { documentId: 'f-legacy', name: 'Terrain historique' };

    const first = readAccent(renderHeader(makeEvent({ facility })));
    const second = readAccent(renderHeader(makeEvent({ facility })));

    expect(FACILITY_PLANNING_PALETTE).toContain(first);
    expect(first).toBe(second);
    expect(first).not.toBe(CYAN_OF_TODAY);
  });
});
