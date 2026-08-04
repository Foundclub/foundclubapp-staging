import renderer, { act } from 'react-test-renderer';

import ClubCard from '@/components/molecules/clubCard/ClubCard';
import OnboardingClubCard from '@/views/onboarding/components/OnboardingClubCard';

import { formatClubDistanceLabel } from '@/utils/location';

// L23 — LE TEST QUI EMPÊCHE LES DEUX CARTES DE REDIVERGER.
//
// Constat qui commande ce fichier : `ClubCard` et `OnboardingClubCard` font le
// même métier et ont déjà divergé DANS LES DEUX SENS. Le garde de distance a
// été écrit dans OnboardingClubCard et jamais recopié dans ClubCard : sur cette
// dernière, `Number(null)` vaut 0 (pas NaN), franchissait les gardes, et
// `Math.max(50, 0)` affichait « à 50 m » sur TOUTES les cartes dès que la
// distance était inconnue.
//
// Ce fichier ne teste pas « le bug est corrigé » : il teste que les deux cartes
// tirent leur libellé de LA MÊME fonction. Corriger une seule des deux
// redeviendrait alors impossible sans rendre ce test rouge.
//
// ⚠️ Le témoin POSITIF est aussi important que les cas vides : un formateur qui
// rendrait toujours '' passerait tous les tests de distance inconnue.

/** Sentinelle du bloc « source unique » ; null = comportement réel. */
let mockSharedLabel = null;

jest.mock('@/utils/location', () => {
  const actual = jest.requireActual('@/utils/location');
  return {
    ...actual,
    // Le vrai formateur tant que la sentinelle est nulle : les deux premiers
    // blocs mesurent donc le comportement RÉEL, pas celui d'un bouchon.
    formatClubDistanceLabel: (/** @type {any} */ value) => (
      mockSharedLabel === null ? actual.formatClubDistanceLabel(value) : mockSharedLabel
    ),
  };
});

jest.mock('@/utils/imageUrl', () => ({
  getImageUrl: (/** @type {string} */ url) => url,
}));

jest.mock('react-native-linear-gradient', () => 'LinearGradient');

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));

jest.mock(
  '@/components/molecules/profilePicturePreviewOverlay/ProfilePicturePreviewOverlay',
  () => () => null,
);

jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      ApplicationStyle: new Proxy({}, { get: () => makeRamp() }),
      Colors: new Proxy({}, { get: (_target, key) => `couleur-${String(key)}` }),
      Fonts: makeRamp(),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

jest.mock('react-i18next', () => ({
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({ t: (/** @type {string} */ key, /** @type {any} */ fallback) => fallback || key }),
}));

const collectTexts = (/** @type {any} */ node, /** @type {string[]} */ acc = []) => {
  if (node === null || node === undefined) return acc;
  if (typeof node === 'string') {
    acc.push(node);
    return acc;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => collectTexts(child, acc));
    return acc;
  }
  collectTexts(node.children, acc);
  return acc;
};

const baseClub = {
  addressDetails: '12 rue du Sport, 13008 Marseille',
  documentId: 'club-1',
  name: 'FC Marseille Nord',
};

/**
 * Texte rendu par la carte de RECHERCHE pour une distance donnée.
 * Elle lit la distance dans `item.__search.distanceKm` (charge du serveur).
 * @param {any} distanceKm - Distance à injecter.
 * @returns {string} - Tout le texte rendu, lignes concaténées.
 */
const searchCardTexts = (distanceKm) => {
  let tree;
  act(() => {
    tree = renderer.create(
      <ClubCard item={{ ...baseClub, __search: { distanceKm }, _type: 'club' }} />,
    );
  });
  return collectTexts(tree.toJSON()).join('\n');
};

/**
 * Texte rendu par la carte d'INSCRIPTION pour une distance donnée.
 * Elle reçoit la distance en propriété (calculée côté client).
 * @param {any} distanceKm - Distance à injecter.
 * @returns {string} - Tout le texte rendu, lignes concaténées.
 */
const onboardingCardTexts = (distanceKm) => {
  let tree;
  act(() => {
    tree = renderer.create(<OnboardingClubCard distanceKm={distanceKm} item={baseClub} />);
  });
  return collectTexts(tree.toJSON()).join('\n');
};

afterEach(() => {
  mockSharedLabel = null;
});

describe('formatClubDistanceLabel — le formateur partagé', () => {
  it('TÉMOIN POSITIF : une vraie distance produit bien un libellé', () => {
    expect(formatClubDistanceLabel(2.4)).toBe('à 2,4 km');
    expect(formatClubDistanceLabel(0.3)).toBe('à 300 m');
  });

  it('garde une décimale sous 10 km, arrondit au-dessus', () => {
    expect(formatClubDistanceLabel(2.44)).toBe('à 2,4 km');
    expect(formatClubDistanceLabel(12.6)).toBe('à 13 km');
  });

  it('plancher à 50 m sous la barre des 50 mètres', () => {
    expect(formatClubDistanceLabel(0.42)).toBe('à 400 m');
    expect(formatClubDistanceLabel(0.01)).toBe('à 50 m');
  });

  it('distance inconnue => AUCUN libellé', () => {
    expect(formatClubDistanceLabel(null)).toBe('');
    expect(formatClubDistanceLabel(undefined)).toBe('');
    expect(formatClubDistanceLabel('')).toBe('');
    expect(formatClubDistanceLabel('   ')).toBe('');
    expect(formatClubDistanceLabel(-3)).toBe('');
    expect(formatClubDistanceLabel(Number.NaN)).toBe('');
  });

  it('les trous de `Number()` sont bouchés : [] et true ne valent pas 0', () => {
    // C'est la MÊME famille de bug que `Number(null) === 0` : une valeur qui
    // n'est pas une mesure ne doit jamais franchir la porte.
    expect(formatClubDistanceLabel([])).toBe('');
    expect(formatClubDistanceLabel(true)).toBe('');
    expect(formatClubDistanceLabel({})).toBe('');
  });

  it('0 reste une VRAIE distance : le serveur ne s\'en sert pas pour dire « inconnu »', () => {
    // Vérifié dans le dépôt admin : `computeDistanceKm` rend `undefined` quand
    // une coordonnée manque (scoring.ts:211-213) et la charge est normalisée en
    // `distanceKm ?? null` (search.ts:439). Le serveur envoie donc `null`, jamais
    // 0. Traiter 0 comme inconnu perdrait un club situé sur le point cherché.
    expect(formatClubDistanceLabel(0)).toBe('à 50 m');
  });
});

describe('les DEUX cartes club rendent le même libellé de distance', () => {
  it.each([
    ['distance nulle', null],
    ['distance absente', undefined],
    ['chaîne vide', ''],
    ['zéro', 0],
    ['300 mètres', 0.3],
    ['2,4 km', 2.4],
    ['12,6 km', 12.6],
    ['distance négative', -3],
  ])('%s : recherche et inscription disent la même chose', (_libelle, distanceKm) => {
    const attendu = formatClubDistanceLabel(distanceKm);
    const recherche = searchCardTexts(distanceKm);
    const inscription = onboardingCardTexts(distanceKm);

    if (attendu === '') {
      expect(recherche).not.toMatch(/à \d/);
      expect(inscription).not.toMatch(/à \d/);
      return;
    }
    expect(recherche).toContain(attendu);
    expect(inscription).toContain(attendu);
  });
});

describe('un seul point de vérité, prouvé par substitution', () => {
  it('remplacer le formateur partagé change les DEUX cartes', () => {
    mockSharedLabel = 'LIBELLE-PARTAGE';

    // Si l'une des deux gardait sa copie locale, elle afficherait « à 2,4 km »
    // et ne contiendrait pas la sentinelle : le test tomberait.
    expect(searchCardTexts(2.4)).toContain('LIBELLE-PARTAGE');
    expect(onboardingCardTexts(2.4)).toContain('LIBELLE-PARTAGE');
  });
});
