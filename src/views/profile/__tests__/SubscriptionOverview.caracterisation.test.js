import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import SubscriptionOverview from '../SubscriptionOverview';

// L33 (E6) : `SubscriptionOverview.js` fait 1 929 lignes et n'avait AUCUN test,
// alors qu'il porte six mois de correctifs empiles (R09 quotas, R10 sablier et
// avertissement de certification, L08 rafraichissement, L10-A offre Club
// achetable, branchement RevenueCat). Ce fichier FIGE ce que l'ecran affiche
// AVANT la refonte en 3 ecrans, pour que la refonte dise ce qu'elle deplace au
// lieu de le perdre en silence.
//
// Il ne decrit AUCUN pixel : il n'observe que le TEXTE VISIBLE et ce qui part
// vers le rail d'achat. C'est le seul point d'appui qui survit au passage d'un
// scroll unique a un hub + un carrousel + une matrice.
//
// Le theme est le VRAI (jest.requireActual) : un mock en Proxy rend les echecs
// Jest illisibles (constat du lot paywall du 2026-08-02) et un objet invente
// masquerait un jeton absent.

/** @type {any} */
let mockAuthValue;
/** @type {any} */
let mockCatalogQueryState;
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockAlert = jest.fn();
const mockPerformPurchase = jest.fn();
const mockPerformPlanChange = jest.fn();
const mockRestorePurchases = jest.fn();
const mockIsPurchaseAvailable = jest.fn();
const mockGetActiveRail = jest.fn();
const mockInvalidate = jest.fn();
const mockScheduleRefresh = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutateAsync: (/** @type {any} */ input) => options.mutationFn(input),
  }),
  useQuery: () => mockCatalogQueryState,
  useQueryClient: () => ({ id: 'query-client-test' }),
}));

// Les VRAIES traductions : la moitie de la copie de cet ecran vit dans fr.js
// (`profile.subscription.*`) et l'autre moitie dans des replis en dur. Un mock
// qui rendrait la cle laisserait passer une suppression dans fr.js sans bruit.
jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
        const valeur = String(cle || '').split('.').reduce(
          (/** @type {any} */ noeud, /** @type {string} */ segment) => (
            noeud && typeof noeud === 'object' ? noeud[segment] : undefined
          ),
          traductions,
        );
        if (typeof valeur === 'string') return valeur;
        return typeof repli === 'string' ? repli : cle;
      },
    }),
  };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuthValue,
}));

jest.mock('@/services/subscription/subscriptionService', () => ({
  getSubscriptionCatalog: jest.fn(),
}));

jest.mock('@/domains/subscription/subscriptionPurchaseRail', () => ({
  getActiveSubscriptionPurchaseRail: (/** @type {any} */ ...args) => mockGetActiveRail(...args),
  isSubscriptionPurchaseAvailable: (/** @type {any} */ ...args) => mockIsPurchaseAvailable(...args),
  performSubscriptionPlanChange: (/** @type {any} */ ...args) => mockPerformPlanChange(...args),
  performSubscriptionPurchase: (/** @type {any} */ ...args) => mockPerformPurchase(...args),
  restoreAllSubscriptionPurchases: (/** @type {any} */ ...args) => mockRestorePurchases(...args),
  SUBSCRIPTION_PURCHASE_RAILS: {
    NATIVE_STORE: 'NATIVE_STORE',
    TRUSTED_TEST: 'TRUSTED_TEST',
  },
}));

jest.mock('@/domains/subscription/subscriptionRefresh', () => ({
  invalidateSubscriptionState: (/** @type {any} */ ...args) => mockInvalidate(...args),
  scheduleSubscriptionStateRefresh: (/** @type {any} */ ...args) => mockScheduleRefresh(...args),
}));

// Le VRAI theme, sans le contexte React qui le porte. `Images` est le seul
// element stub, pour ne pas faire dependre ce test de la resolution des assets.
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
      Images: { arrowRight: 1, clock: 1 },
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

// La feuille basse repose sur @gorhom/bottom-sheet (module natif) : la doublure
// garde le seul contrat qui compte ici — le contenu n'existe que si `isVisible`.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children, isVisible }) => (
      isVisible ? <View>{children}</View> : null
    ),
  };
});

jest.mock('@/components/molecules/legalFooter/LegalFooter', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: () => (
      <TexteRN>
        Prix TTC. Renouvellement automatique, résiliable à tout moment.
      </TexteRN>
    ),
  };
});

// Le bouton est rendu comme un vrai pressable portant son libelle : les tests
// appuient « sur le texte », que le libelle soit porte par un Button (avant) ou
// par un TouchableOpacity (apres la refonte).
jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ {
      disabled, isLoading, onPress, title,
    }) => (
      <PressableRN
        accessibilityRole="button"
        accessibilityState={{ busy: Boolean(isLoading), disabled: Boolean(disabled) }}
        disabled={Boolean(disabled)}
        onPress={onPress}
      >
        <TexteRN>{title}</TexteRN>
      </PressableRN>
    ),
  };
});

jest.mock('@/components/atoms/checkable/Checkable', () => {
  const { TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children, isChecked, setIsChecked }) => (
      <PressableRN
        accessibilityRole="checkbox"
        accessibilityState={{ checked: Boolean(isChecked) }}
        onPress={setIsChecked}
      >
        {children}
      </PressableRN>
    ),
  };
});

jest.mock('@/views/profile/SubscriptionCoveredHero', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: () => <TexteRN>HEROS DEJA COUVERT</TexteRN>,
  };
});

jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: (/** @type {any} */ ...args) => mockAlert(...args),
}));

/* Catalogue : copie fidele du catalogue STATIQUE du serveur
   (admin/src/api/subscription/services/subscription-catalog.ts, grille validee
   le 2026-07-09 et reconfirmee par Adel le 2026-08-05). Meme fixture que
   GuideOffersRecap.test.js — les prix ne sont JAMAIS ecrits en dur dans l'app,
   ils viennent de GET /subscriptions/catalog. */
const TEAM_PRICES = {
  1: { monthly: 799, yearly: 5999 },
  2: { monthly: 1299, yearly: 9999 },
  3: { monthly: 1699, yearly: 12999 },
};
const CLUB_TIERS = {
  1: {
    label: 'Club S', maxTeams: 3, monthly: 1999, yearly: 19999,
  },
  2: {
    label: 'Club M', maxTeams: 8, monthly: 3499, yearly: 34999,
  },
  3: {
    label: 'Club L', maxTeams: null, monthly: 5499, yearly: 54999,
  },
};

const TEAM_FEATURE_KEYS = [
  'events.unlimited',
  'matches.unlimited',
  'composition',
  'convocation',
  'recruitment.unlimited',
  'dues.team',
];

const CATALOG_ENTRIES = [
  ...[1, 2, 3].flatMap((slotCount) => ['monthly', 'yearly'].map((billingPeriod) => ({
    billingPeriod,
    displayName: `Équipe · ${slotCount} équipe${slotCount > 1 ? 's' : ''}`,
    featureKeys: TEAM_FEATURE_KEYS,
    isActive: true,
    maxTeams: null,
    planCode: `fc_team_${slotCount}_${billingPeriod}`,
    providerProductId: `fc_team_${slotCount}_${billingPeriod}`,
    referencePriceEurCents: TEAM_PRICES[slotCount][billingPeriod],
    requiresClubVerification: false,
    scopeType: 'TEAM',
    slotCount,
  }))),
  ...[1, 2, 3].flatMap((tier) => ['monthly', 'yearly'].map((billingPeriod) => ({
    billingPeriod,
    displayName: CLUB_TIERS[tier].label,
    featureKeys: [...TEAM_FEATURE_KEYS, 'club.profile', 'facilities', 'sponsors', 'dues.club'],
    isActive: true,
    maxTeams: CLUB_TIERS[tier].maxTeams,
    planCode: `fc_club_tier_${tier}_${billingPeriod}`,
    providerProductId: `fc_club_tier_${tier}_${billingPeriod}`,
    referencePriceEurCents: CLUB_TIERS[tier][billingPeriod],
    requiresClubVerification: true,
    scopeType: 'CLUB',
    slotCount: null,
  }))),
];

/**
 * Contexte d'authentification minimal, dans la forme exacte rendue par useAuth.
 * @param {Record<string, any>} [surcharges]
 * @returns {any}
 */
const contexteAuth = (surcharges = {}) => ({
  allMyTeams: [{ club: { name: 'AS Test' }, documentId: 'team-1', name: 'U15' }],
  clubVerificationSummary: {
    clubDocumentId: 'club-1',
    clubVerified: true,
    requiresClubVerification: false,
  },
  entitlementsSummary: [],
  freeUsageSummary: [
    {
      limit: 3, quotaType: 'EVENT_PUBLISH', remaining: 2, used: 1,
    },
  ],
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
  ...surcharges,
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
 * Tout le texte visible de l'arbre rendu, concatene.
 * @param {any} arbre
 * @returns {string}
 */
const texteVisible = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
  .join(' | ');

/**
 * Vrai si un noeud de texte porte EXACTEMENT ce libelle. Utile quand le libelle
 * est aussi un prefixe d'autre chose (« Événements » vs « Événements illimités »).
 * @param {any} arbre
 * @param {string} libelle
 * @returns {boolean}
 */
const porteExactement = (arbre, libelle) => arbre.root
  .findAllByType(Text)
  .some((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children).trim() === libelle);

/**
 * Tous les pressables portant EXACTEMENT ce libelle, dans l'ordre de rendu.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {any[]}
 */
const pressablesPortant = (arbre, libelle) => arbre.root
  .findAllByType(TouchableOpacity)
  .filter((/** @type {any} */ noeud) => noeud
    .findAllByType(Text)
    .some((/** @type {any} */ texte) => aplatirTexte(texte.props.children).trim() === libelle));

/**
 * Appuie sur le pressable de rang donne portant ce libelle.
 * @param {any} arbre
 * @param {string} libelle
 * @param {number} [rang]
 * @returns {Promise<void>}
 */
const appuyerSur = async (arbre, libelle, rang = 0) => {
  const candidats = pressablesPortant(arbre, libelle);
  if (candidats.length <= rang) {
    throw new Error(`Aucun pressable n°${rang} ne porte le libelle « ${libelle} »`);
  }
  await act(async () => {
    candidats[rang].props.onPress();
  });
};

/**
 * Monte l'ecran avec le contexte d'authentification demande.
 * @param {Record<string, any>} [surcharges]
 * @returns {Promise<any>}
 */
const rendre = async (surcharges = {}) => {
  mockAuthValue = contexteAuth(surcharges);
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

beforeEach(() => {
  jest.clearAllMocks();
  mockCatalogQueryState = { data: { data: CATALOG_ENTRIES }, error: null, isLoading: false };
  mockIsPurchaseAvailable.mockReturnValue(true);
  mockGetActiveRail.mockReturnValue('NATIVE_STORE');
  mockPerformPurchase.mockResolvedValue({ ok: true });
  mockRestorePurchases.mockResolvedValue({ meta: { restoredCount: 1 } });
});

describe('SubscriptionOverview — ce que voit un dirigeant en GRATUIT', () => {
  it('annonce son offre gratuite, ses quotas et le catalogue complet', async () => {
    const arbre = await rendre();
    const texte = texteVisible(arbre);

    expect(texte).toContain('Mon abonnement');
    expect(texte).toContain('Offre gratuite FoundClub');
    expect(texte).toContain('Gratuit');
    expect(texte).toContain('Tu publies en quantité limitée.');
    expect(texte).toContain('Passe à une offre payante pour lever les limites.');
    expect(texte).toContain('Quotas gratuits');
    expect(porteExactement(arbre, 'Événements')).toBe(true);
    expect(texte).toContain('Ton offre actuelle');
  });

  it('propose la periode annuelle par defaut, avec le tag global « 2 mois offerts »', async () => {
    const arbre = await rendre();
    const texte = texteVisible(arbre);

    // Etat d'ORIGINE : un tag unique porte par la pilule Annuel, identique pour
    // Equipe et pour Club — c'est exactement ce que la refonte L33 corrige,
    // parce qu'il est faux pour Equipe (remise reelle ~36 %, pas ~17 %).
    expect(texte).toContain('Mensuel');
    expect(texte).toContain('Annuel');
    expect(texte).toContain('2 mois offerts');
  });

  it('affiche des prix qui viennent du catalogue, jamais ecrits en dur', async () => {
    const arbre = await rendre();
    const texte = texteVisible(arbre);

    // Equipe 1 equipe / annuel = 59,99 € et son equivalence mensuelle exacte.
    expect(texte).toContain('59,99 €/an');
    expect(texte).toContain('soit 5,00 €/mois');
    // Les trois paliers Club de la periode annuelle, avec leur prix.
    expect(texte).toContain('Club S');
    expect(texte).toContain('199,99 €/an');
    expect(texte).toContain('Club M');
    expect(texte).toContain('349,99 €/an');
    expect(texte).toContain('Club L');
    expect(texte).toContain('549,99 €/an');
  });

  it('TEMOIN L10-A — un dirigeant sans offre a un chemin pour PAYER', async () => {
    const arbre = await rendre();

    // Deux boutons d'achat : un par famille d'offre (Equipe, puis Club).
    // Si ce compte tombe a zero, un dirigeant carte bleue en main n'a plus
    // aucun moyen de payer : c'est le trou le plus cher de la campagne.
    expect(pressablesPortant(arbre, 'Choisir cette offre')).toHaveLength(2);
  });

  it('ouvrir l\'offre Equipe demande d\'abord quelles equipes couvrir', async () => {
    const arbre = await rendre();
    await appuyerSur(arbre, 'Choisir cette offre', 0);
    const texte = texteVisible(arbre);

    expect(texte).toContain('Choisir les équipes couvertes');
    expect(texte).toContain("Cette offre couvre jusqu'à 1 équipe.");
    expect(texte).toContain('U15');
    expect(texte).toContain('Activer cette offre');
  });
});

describe('SubscriptionOverview — ce que voit un dirigeant abonne CLUB', () => {
  const auteurClub = {
    subscriptionAccessLevel: 'CLUB',
    subscriptionSummary: {
      activePlanCodes: ['fc_club_tier_1_monthly'],
      payerSubscriptionIds: ['sub-1'],
      teamSlotSummary: {
        assigned: 0, available: 0, coveredTeamDocumentIds: [], total: 0,
      },
    },
  };

  it('annonce son plan, sa couverture et sa certification', async () => {
    const arbre = await rendre(auteurClub);
    const texte = texteVisible(arbre);

    expect(texte).toContain('Club · actif');
    expect(texte).toContain('Toutes les équipes de ton club sont couvertes.');
    expect(texte).toContain('Certification');
    expect(texte).toContain('Club certifié');
    expect(texte).toContain('Plans et droits actifs');
  });

  it('R09 — aucun compteur gratuit n\'est revendu a un abonne', async () => {
    const arbre = await rendre(auteurClub);
    const texte = texteVisible(arbre);

    expect(texte).toContain("Aucun compteur gratuit n'est affiché pour cette offre.");
    // La jauge « Événements » du contexte gratuit ne doit apparaitre nulle part :
    // la comparaison est EXACTE, sinon « Événements illimités » (un benefice de
    // l'offre, pas un compteur) ferait passer le controle pour rien.
    expect(porteExactement(arbre, 'Événements')).toBe(false);
  });

  it('offre la restauration des achats et le renvoi vers son club', async () => {
    const arbre = await rendre(auteurClub);
    const texte = texteVisible(arbre);

    expect(texte).toContain('Restaurer mes achats');
    expect(texte).toContain('Voir le club concerné');

    await appuyerSur(arbre, 'Restaurer mes achats');
    expect(mockRestorePurchases).toHaveBeenCalled();
  });
});

describe('SubscriptionOverview — les deux sorties de secours', () => {
  it('quelqu\'un couvert par un tiers voit le heros dedie, pas le catalogue', async () => {
    const arbre = await rendre({
      entitlementsSummary: [
        {
          paidBy: { documentId: 'autre-user', firstname: 'Zoe' },
          scopeType: 'CLUB',
        },
      ],
    });
    const texte = texteVisible(arbre);

    expect(texte).toContain('HEROS DEJA COUVERT');
    expect(texte).not.toContain('Quotas gratuits');
  });

  it('un joueur ne voit rien et est renvoye sur son compte', async () => {
    const arbre = await rendre({
      userData: {
        club: { documentId: 'club-1' },
        documentId: 'user-1',
        role: { name: 'Joueur', type: 'player' },
      },
    });

    expect(arbre.toJSON()).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith('Profile');
  });
});
