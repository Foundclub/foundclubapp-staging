import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import SubscriptionCompare from '../SubscriptionCompare';

// L33 — c'est CETTE matrice qui porte desormais le detail complet des trois
// offres : plus aucune liste de douze ✓ n'est repetee ailleurs. Elle a un seul
// chemin de sortie, et ce chemin doit mener au carrousel — pas au hub, qui ne
// vend rien.

/** @type {any} */
let mockCatalogQueryState;
const mockNavigate = jest.fn();

// L39 — deux requetes derriere le catalogue : le serveur et les prix du STORE.
// Sans cle, la seconde recevrait le catalogue de la premiere.
jest.mock('@tanstack/react-query', () => ({
  useQuery: (/** @type {any} */ options) => (
    String(options?.queryKey?.[0]) === 'subscription-store-prices'
      ? { data: undefined, isError: false, isLoading: false }
      : mockCatalogQueryState
  ),
}));

jest.mock('@/services/subscription/subscriptionService', () => ({
  getSubscriptionCatalog: jest.fn(),
}));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();

  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: {},
      Spaces: espaces,
    }),
  };
});

jest.mock('@/components/templates/ScreenContainer', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onPress, title }) => (
      <PressableRN accessibilityRole="button" onPress={onPress}>
        <TexteRN>{title}</TexteRN>
      </PressableRN>
    ),
  };
});

/* Prix d'appel mensuels de la grille serveur : Equipe 7,99 € et Club 19,99 €. */
const CATALOG_ENTRIES = [
  {
    billingPeriod: 'monthly', planCode: 'fc_team_1_monthly', referencePriceEurCents: 799, scopeType: 'TEAM', slotCount: 1,
  },
  {
    billingPeriod: 'monthly', planCode: 'fc_team_3_monthly', referencePriceEurCents: 1699, scopeType: 'TEAM', slotCount: 3,
  },
  {
    billingPeriod: 'yearly', planCode: 'fc_team_1_yearly', referencePriceEurCents: 5999, scopeType: 'TEAM', slotCount: 1,
  },
  {
    billingPeriod: 'monthly', planCode: 'fc_club_tier_1_monthly', referencePriceEurCents: 1999, scopeType: 'CLUB', slotCount: null,
  },
  {
    billingPeriod: 'monthly', planCode: 'fc_club_tier_3_monthly', referencePriceEurCents: 5499, scopeType: 'CLUB', slotCount: null,
  },
];

/**
 * Aplati les enfants React en une chaine, pour lire le texte rendu.
 * @param {any} enfants
 * @returns {string}
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

/**
 * Tout le texte visible de l'arbre rendu, concatene.
 * @param {any} arbre
 * @returns {string}
 */
const texteVisible = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
  .join(' | ');

/**
 * Monte la matrice.
 * @returns {Promise<any>}
 */
const rendre = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <SubscriptionCompare navigation={/** @type {any} */ ({ navigate: mockNavigate })} />,
    );
  });
  return arbre;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCatalogQueryState = { data: { data: CATALOG_ENTRIES } };
});

describe('Matrice comparative', () => {
  it('porte les dix lignes de comparaison, en une seule surface', async () => {
    const texte = texteVisible(await rendre());

    [
      'Équipes couvertes',
      'Événements & matchs',
      'Annonces de recrutement',
      'Composition & convocations',
      'Cotisations de l\'équipe',
      'Fiche club & rôles',
      'Installations & réservations',
      'Sponsors & partenaires',
      'Cotisations du club',
      'Certification du club',
    ].forEach((ligne) => expect(texte).toContain(ligne));
  });

  it('annonce le prix d\'appel de chaque colonne, pris dans le catalogue', async () => {
    const texte = texteVisible(await rendre());

    expect(texte).toContain('0 €/mois');
    expect(texte).toContain('dès 7,99 €/mois');
    expect(texte).toContain('dès 19,99 €/mois');
  });

  it('n\'annonce AUCUN prix quand le catalogue est absent', async () => {
    mockCatalogQueryState = { data: null };
    const texte = texteVisible(await rendre());

    expect(texte).toContain('Équipes couvertes');
    expect(texte).not.toContain('dès ');
  });

  it('« Voir les offres » mene au CARROUSEL, la seule surface qui vend', async () => {
    const arbre = await rendre();
    const cta = arbre.root
      .findAllByType(TouchableOpacity)
      .find((/** @type {any} */ noeud) => noeud
        .findAllByType(Text)
        .some((/** @type {any} */ texte) => aplatirTexte(texte.props.children) === 'Voir les offres'));

    await act(async () => {
      cta.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('SubscriptionOffers');
  });
});
