import { Image, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';

import SubscriptionOverview from '../SubscriptionOverview';

// AD07 (T6) — « COMPARER LES OFFRES » MONTRAIT UN ENTONNOIR.
//
// Constat du 2026-08-21 : `images.js:64` declare `chart:
// require('../assets/icons/filter.png')` avec un commentaire « Temp mapping »
// vieux de plusieurs mois. La clef EST affichee — `SubscriptionOverview.js:410`
// rend `Images[icon]` et `:539` passait `icon: 'chart'` — donc la ligne
// « Comparer les offres » portait un ENTONNOIR de 14 px a la place d'un
// histogramme, dans Profil → Abonnement → Offre.
//
// Retirer la clef n'etait pas une option : l'image aurait disparu. Elle est
// remplacee, sur CETTE ligne seulement, par le glyphe vectoriel `chartColumn`.
// Les 5 autres rangees que sert `renderActionRow` restent en `<Image>` : c'est
// ce que le second temoin verrouille.
//
// ⛔ Ne PAS elargir : `trophy` (7 appelants) et `whistle` (1 appelant) ont la
// meme maladie et appartiennent a un autre lot.

/** @type {any} */
let mockAuthValue;
const mockNavigate = jest.fn();
const mockReplace = jest.fn();

// Sentinelle : si l'entonnoir revient, c'est CETTE valeur qu'on retrouvera dans
// la source d'une `<Image>` de la ligne « Comparer les offres ».
const ENTONNOIR = 'ENTONNOIR-filter.png';

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutateAsync: (/** @type {any} */ input) => options.mutationFn(input),
  }),
  useQueryClient: () => ({ id: 'query-client-test' }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuthValue,
}));

jest.mock('@/domains/subscription/subscriptionPurchaseRail', () => ({
  restoreAllSubscriptionPurchases: jest.fn(),
}));

jest.mock('@/domains/subscription/subscriptionRefresh', () => ({
  invalidateSubscriptionState: jest.fn(),
  scheduleSubscriptionStateRefresh: jest.fn(),
}));

// Le VRAI theme, sans le contexte React qui le porte : un mock en Proxy rend
// les echecs Jest illisibles (constat du lot paywall du 2026-08-02).
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
      Images: {
        arrowRight: 'FLECHE',
        calendar: 'CALENDRIER',
        chart: 'ENTONNOIR-filter.png',
        check: 'COCHE',
        euroCircle: 'EURO',
        search: 'LOUPE',
        shield: 'BOUCLIER',
        users: 'PERSONNES',
      },
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

jest.mock('@/components/molecules/legalFooter/LegalFooter', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/views/profile/SubscriptionCoveredHero', () => ({
  __esModule: true,
  default: () => null,
}));

/**
 * Contexte d'authentification minimal, dans la forme exacte rendue par useAuth.
 * @returns {any}
 */
const contexteAuth = () => ({
  clubVerificationSummary: {
    clubDocumentId: 'club-1',
    clubVerified: true,
    requiresClubVerification: false,
  },
  entitlementsSummary: [],
  subscriptionAccessLevel: 'FREE',
  subscriptionSummary: {
    activePlanCodes: [],
    payerSubscriptionIds: [],
    teamSlotSummary: {
      assigned: 0, available: 0, coveredTeamDocumentIds: [], total: 0,
    },
  },
  userData: {
    club: { documentId: 'club-1' },
    documentId: 'user-1',
    role: { name: 'Dirigeant', type: 'president' },
  },
});

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
 * La rangee d'action portant EXACTEMENT ce libelle.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {any}
 */
const rangeePortant = (arbre, libelle) => {
  const trouvees = arbre.root
    .findAllByType(TouchableOpacity)
    .filter((/** @type {any} */ noeud) => noeud
      .findAllByType(Text)
      .some((/** @type {any} */ texte) => aplatirTexte(texte.props.children).trim() === libelle));
  if (trouvees.length !== 1) {
    throw new Error(`${trouvees.length} rangee(s) portent le libelle « ${libelle} », attendu 1`);
  }
  return trouvees[0];
};

/**
 * Monte l'ecran.
 * @returns {Promise<any>}
 */
const rendre = async () => {
  mockAuthValue = contexteAuth();
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <SubscriptionOverview
        navigation={/** @type {any} */ ({ navigate: mockNavigate, replace: mockReplace })}
      />,
    );
  });
  return arbre;
};

describe('AD07 — Profil → Abonnement → Offre', () => {
  it('T6 — « Comparer les offres » montre un histogramme, plus l entonnoir', async () => {
    const arbre = await rendre();
    const rangee = rangeePortant(arbre, 'Comparer les offres');

    const glyphes = rangee.findAllByType(GlyphIcon).map((/** @type {any} */ n) => n.props.name);
    expect(glyphes).toEqual(['chartColumn']);

    const sources = rangee.findAllByType(Image).map((/** @type {any} */ n) => n.props.source);
    expect(sources).not.toContain(ENTONNOIR);
  });

  it('T6 bis — les 5 autres rangees gardent leur image PNG', async () => {
    const arbre = await rendre();

    [
      ["Changer d'offre", 'EURO'],
      ['Restaurer mes achats', 'LOUPE'],
      ['Voir mon club', 'BOUCLIER'],
    ].forEach(([libelle, sentinelle]) => {
      const rangee = rangeePortant(arbre, String(libelle));
      const sources = rangee.findAllByType(Image).map((/** @type {any} */ n) => n.props.source);
      expect(sources).toContain(sentinelle);
      expect(rangee.findAllByType(GlyphIcon)).toEqual([]);
    });
  });
});
