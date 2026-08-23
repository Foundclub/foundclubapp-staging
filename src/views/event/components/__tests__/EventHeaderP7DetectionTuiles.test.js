import renderer, { act } from 'react-test-renderer';

import EventHeader from '../EventHeader';

// Lot P7 — « deux tuiles de recrutement » dans l'entete d'une detection
// (planche 03 du pack « detail evenement », carte E : « Les deux chiffres du
// metier remplacent l'encart score »).
//
// 🪤 CE FICHIER EXISTE AUSSI POUR PROTEGER AE01. Son helper `primaryTitleOf`
// lit le PREMIER `Text` de l'arbre rendu : toute tuile posee AVANT le titre
// casserait ses 3 temoins d'un coup, et le message d'echec parlerait de fond
// d'ecran, pas de tuile. Le temoin 3 ci-dessous tient cette regle de place
// EXPLICITEMENT, pour qu'une future modification echoue en disant pourquoi.

jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => () => null);

// Meme mock de theme qu'AE01 et AD09 : des Proxy a formes PRECISES, jamais un
// attrape-tout (un attrape-tout rend les echecs illisibles).
jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const COLOR_TOKEN = /^(primary|secondary|neutral|success|error|warning|info)/;
  const colorValue = (/** @type {any} */ key) => `couleur-${String(key)}`;
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

// Le `t` du mock rend le REPLI : c'est ce que l'utilisateur voit tant que la
// clef n'existe pas dans fr.js.
jest.mock('react-i18next', () => ({
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ key, /** @type {string} */ fallback) => fallback || key,
  }),
}));

const CLUB_NAME = 'FC Test';
const TEAM_NAME = 'U15 A';
const EVENT_NAME = 'Detection gardiens';

/**
 * Fabrique un evenement de recette.
 * @param {string} typeName
 * @returns {any}
 */
const makeEvent = (typeName) => ({
  date: '2026-09-12T18:00:00.000Z',
  documentId: 'evt-p7',
  endTime: '20:00:00',
  eventFormat: null,
  facility: null,
  location: 'Stade municipal, Lyon',
  name: EVENT_NAME,
  startTime: '18:00:00',
  team: {
    club: { documentId: 'club-1', name: CLUB_NAME },
    documentId: 'team-1',
    name: TEAM_NAME,
  },
  type: { documentId: 'type-1', name: typeName },
});

/**
 * Rend l'entete une fois et rend son arbre JSON.
 * @param {{ detectionSummary?: any, event: any, matchScoreSummary?: any }} props
 * @returns {any}
 */
const renderHeader = ({ detectionSummary = null, event, matchScoreSummary = null }) => {
  /** @type {any} */
  let tree;
  act(() => {
    tree = renderer.create(
      <EventHeader
        detectionSummary={detectionSummary}
        event={event}
        matchScoreSummary={matchScoreSummary}
      />,
    );
  });
  const json = tree.toJSON();
  act(() => {
    tree.unmount();
  });
  return json;
};

/**
 * Rassemble TOUS les noeuds de l'arbre qui satisfont `predicate`, DANS L'ORDRE
 * de rendu. C'est l'ordre qui porte la preuve du temoin 3.
 * @param {any} node
 * @param {(candidate: any) => boolean} predicate
 * @param {any[]} acc
 * @returns {any[]}
 */
const collectNodes = (node, predicate, acc = []) => {
  if (!node || typeof node !== 'object') return acc;
  if (Array.isArray(node)) {
    node.forEach((/** @type {any} */ child) => collectNodes(child, predicate, acc));
    return acc;
  }
  if (predicate(node)) acc.push(node);
  collectNodes(node.children, predicate, acc);
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
    node.forEach((/** @type {any} */ child) => textContentOf(child, acc));
    return acc;
  }
  textContentOf(node.children, acc);
  return acc;
};

/**
 * Dit si un noeud rendu est un `Text`.
 * @param {any} candidate - Le noeud a examiner.
 * @returns {boolean} - Vrai si c'est un `Text`.
 */
const isTextNode = (candidate) => candidate?.type === 'Text';

/**
 * Rend le noeud portant ce testID, ou null.
 * @param {any} tree
 * @param {string} testID
 * @returns {any}
 */
const parTestID = (tree, testID) => (
  collectNodes(tree, (candidate) => candidate?.props?.testID === testID)[0] || null
);

/**
 * Rend le texte d'une tuile, en une chaine : « 4 postes ouverts ».
 * @param {any} tree
 * @param {string} testID
 * @returns {string}
 */
const texteDeLaTuile = (tree, testID) => (
  textContentOf(parTestID(tree, testID)?.children).join(' ').trim()
);

const DETECTION = makeEvent('Detection');

describe('P7 - les deux tuiles de recrutement de l entete detection', () => {
  test('P7 · temoin 1 — une detection porte les DEUX chiffres du metier', () => {
    const tree = renderHeader({
      detectionSummary: { openPositions: 4, toReview: 9 },
      event: DETECTION,
    });

    // Les deux chiffres viennent de `detectionSlots` (l'ecran les calcule
    // deja, anti-double-comptage compris) : l'entete ne fait que les afficher.
    expect(texteDeLaTuile(tree, 'p7-tuile-postes-ouverts')).toBe('4 postes ouverts');
    expect(texteDeLaTuile(tree, 'p7-tuile-candidatures')).toBe('9 candidatures à voir');
  });

  test('P7 · temoin 2 — a UN seul, le libelle passe au singulier', () => {
    // Cas limite reel : une detection avec un seul poste ouvert et une seule
    // candidature. « 1 postes ouverts » serait une faute visible a l'ecran.
    const tree = renderHeader({
      detectionSummary: { openPositions: 1, toReview: 1 },
      event: DETECTION,
    });

    expect(texteDeLaTuile(tree, 'p7-tuile-postes-ouverts')).toBe('1 poste ouvert');
    expect(texteDeLaTuile(tree, 'p7-tuile-candidatures')).toBe('1 candidature à voir');
  });

  test('P7 · temoin 3 — les tuiles arrivent APRES le titre (le piege d AE01)', () => {
    const tree = renderHeader({
      detectionSummary: { openPositions: 4, toReview: 9 },
      event: DETECTION,
    });

    // `primaryTitleOf` d'AE01 lit le PREMIER `Text` de l'arbre. Il doit rester
    // le titre de la carte, jamais le « 4 » d'une tuile.
    const premierTexte = textContentOf(collectNodes(tree, isTextNode)[0]?.children).join('').trim();

    expect(premierTexte).toBe(EVENT_NAME);
    expect(premierTexte).not.toBe('4');
  });

  test('P7 · temoin 4 — SANS resume de detection, aucune tuile n est montee', () => {
    // Les tuiles ne sont pas un ajout global : elles sont commandees par la
    // prop, et par elle seule.
    const tree = renderHeader({ event: makeEvent('Match') });

    expect(parTestID(tree, 'p7-tuiles-detection')).toBeNull();
    expect(parTestID(tree, 'p7-tuile-postes-ouverts')).toBeNull();
  });

  test('P7 · temoin 5 — l encart score d un match n est pas touche', () => {
    // Le pack dit « les deux chiffres REMPLACENT l'encart score ». On prouve
    // donc que l'encart score existe toujours quand c'est lui qu'on demande.
    const tree = renderHeader({
      event: makeEvent('Match'),
      matchScoreSummary: { badgeLabel: 'Terminé', value: '2 - 1', verdict: 'win' },
    });

    expect(parTestID(tree, 'event-header-match-encart')).not.toBeNull();
    expect(parTestID(tree, 'p7-tuiles-detection')).toBeNull();
  });
});
