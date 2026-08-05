import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import SubscriptionOffers from '../SubscriptionOffers';

// L33 — le carrousel est la SEULE surface de vente atteinte depuis un mur payant
// ou depuis un compteur. Ce fichier reprend les controles que le test de
// caracterisation de `SubscriptionOverview` portait avant la refonte (catalogue,
// prix, temoin L10-A, choix des equipes couvertes, compteurs gratuits) et ajoute
// ce que la refonte apporte : un badge de remise CALCULE par carte.
//
// Pilote par le TEXTE VISIBLE. Theme et traductions : les VRAIS modules.

/** @type {any} */
let mockAuthValue;
/** @type {any} */
let mockCatalogQueryState;
const mockAlert = jest.fn();
const mockPerformPurchase = jest.fn();
const mockPerformPlanChange = jest.fn();
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

// Les VRAIES traductions, PLURIELS COMPRIS : « {{count}} offert restant » vit
// dans fr.js sous les cles `remaining_one` / `remaining_other`. Un mock qui
// rendrait la cle brute masquerait la moitie du rappel de quotas.
jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;

  /**
   * @param {string[]} chemin
   * @returns {any}
   */
  const lire = (chemin) => chemin.reduce(
    (/** @type {any} */ noeud, /** @type {string} */ segment) => (
      noeud && typeof noeud === 'object' ? noeud[segment] : undefined
    ),
    traductions,
  );

  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ options) => {
        const chemin = String(cle || '').split('.');
        const compte = options && typeof options === 'object' ? Number(options.count) : NaN;
        let valeur = lire(chemin);
        if (typeof valeur !== 'string' && Number.isFinite(compte)) {
          const suffixe = compte === 1 ? '_one' : '_other';
          valeur = lire([...chemin.slice(0, -1), `${chemin[chemin.length - 1]}${suffixe}`]);
        }
        if (typeof valeur !== 'string') {
          return typeof options === 'string' ? options : cle;
        }
        return Number.isFinite(compte)
          ? valeur.replace(/\{\{count\}\}/g, String(compte))
          : valeur;
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
  SUBSCRIPTION_PURCHASE_RAILS: {
    NATIVE_STORE: 'NATIVE_STORE',
    TRUSTED_TEST: 'TRUSTED_TEST',
  },
}));

jest.mock('@/domains/subscription/subscriptionRefresh', () => ({
  invalidateSubscriptionState: (/** @type {any} */ ...args) => mockInvalidate(...args),
  scheduleSubscriptionStateRefresh: (/** @type {any} */ ...args) => mockScheduleRefresh(...args),
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
      Images: { arrowRight: 1 },
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

jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: (/** @type {any} */ ...args) => mockAlert(...args),
}));

/* Catalogue : copie fidele du catalogue STATIQUE du serveur
   (admin/src/api/subscription/services/subscription-catalog.ts, grille validee
   le 2026-07-09 et reconfirmee par Adel le 2026-08-05). Les prix ne sont JAMAIS
   ecrits en dur dans l'app : ils viennent de GET /subscriptions/catalog. */
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
const CLUB_FEATURE_KEYS = [
  ...TEAM_FEATURE_KEYS,
  'club.profile',
  'club.multi_teams',
  'club.roles',
  'facilities',
  'sponsors',
  'dues.club',
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
    featureKeys: CLUB_FEATURE_KEYS,
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
 * Tous les pressables portant EXACTEMENT ce libelle.
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
 * Le pressable portant ce libelle d'accessibilite (points du carrousel).
 * @param {any} arbre
 * @param {string} libelle
 * @returns {any}
 */
const pressableParLibelleA11y = (arbre, libelle) => arbre.root
  .findAllByType(TouchableOpacity)
  .find((/** @type {any} */ noeud) => noeud.props.accessibilityLabel === libelle);

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
 * Fait defiler le carrousel jusqu'a la carte demandee (1 = Equipe, 2 = Club).
 * @param {any} arbre
 * @param {number} index
 * @returns {Promise<void>}
 */
const allerALaCarte = async (arbre, index) => {
  const point = pressableParLibelleA11y(arbre, `Carte ${index + 1} sur 3`);
  await act(async () => {
    point.props.onPress();
  });
};

/**
 * Libelle du CTA collant. Il vit APRES les cartes dans l'arbre : on prend donc
 * la DERNIERE occurrence, sinon la chip « Ton plan actuel » de la carte Gratuit
 * serait lue a sa place.
 * @param {any} arbre
 * @returns {string}
 */
const libelleDuCta = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
  .filter((/** @type {string} */ texte) => texte.startsWith('Choisir ')
    || texte === 'Ton plan actuel'
    || texte === 'Ton offre actuelle'
    || texte === 'Gérer dans le store'
    || texte === 'Offre indisponible')
  .pop() || '';

/**
 * Monte le carrousel avec le contexte d'authentification demande.
 * @param {Record<string, any>} [surcharges]
 * @returns {Promise<any>}
 */
const rendre = async (surcharges = {}) => {
  mockAuthValue = contexteAuth(surcharges);
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<SubscriptionOffers />);
  });
  return arbre;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCatalogQueryState = { data: { data: CATALOG_ENTRIES }, error: null, isLoading: false };
  mockIsPurchaseAvailable.mockReturnValue(true);
  mockGetActiveRail.mockReturnValue('NATIVE_STORE');
  mockPerformPurchase.mockResolvedValue({ ok: true });
});

describe('Carrousel d\'offres — le temoin anti-regression de L10-A', () => {
  it('un dirigeant sans offre a un chemin pour PAYER, des l\'ouverture', async () => {
    const arbre = await rendre();

    // Le carrousel demarre sur Équipe (index 1) : le CTA doit deja proposer un
    // achat chiffre. S'il tombait sur un ecran sans offre, un dirigeant carte
    // bleue en main n'aurait plus aucun moyen de payer — le trou le plus cher
    // de la campagne.
    expect(libelleDuCta(arbre)).toBe('Choisir Équipe · 59,99 €/an');
  });

  it('l\'offre Club est achetable elle aussi, club certifie ou non', async () => {
    const arbre = await rendre({
      clubVerificationSummary: { clubDocumentId: 'club-1', clubVerified: false },
    });
    await allerALaCarte(arbre, 2);

    expect(libelleDuCta(arbre)).toBe('Choisir Club S · 199,99 €/an');
  });

  it('acheter Club part vraiment vers le rail d\'achat', async () => {
    const arbre = await rendre();
    await allerALaCarte(arbre, 2);
    await appuyerSur(arbre, 'Choisir Club S · 199,99 €/an');

    expect(mockPerformPurchase).toHaveBeenCalledWith(expect.objectContaining({
      clubDocumentId: 'club-1',
      payerUserDocumentId: 'user-1',
    }));
    expect(mockPerformPurchase.mock.calls[0][0].catalogEntry.planCode)
      .toBe('fc_club_tier_1_yearly');
  });

  it('acheter Équipe demande D\'ABORD quelles equipes couvrir', async () => {
    const arbre = await rendre();
    await appuyerSur(arbre, 'Choisir Équipe · 59,99 €/an');
    const texte = texteVisible(arbre);

    expect(texte).toContain('Choisir les équipes couvertes');
    expect(texte).toContain("Cette offre couvre jusqu'à 1 équipe.");
    expect(texte).toContain('U15');
    expect(mockPerformPurchase).not.toHaveBeenCalled();
  });
});

describe('Carrousel d\'offres — les prix viennent du catalogue', () => {
  it('affiche les six paliers de la grille serveur, jamais un prix ecrit en dur', async () => {
    const arbre = await rendre();
    const texteAnnuel = texteVisible(arbre);

    expect(texteAnnuel).toContain('59,99 €/an');
    expect(texteAnnuel).toContain('199,99 €/an');

    await appuyerSur(arbre, 'Mensuel');
    const texteMensuel = texteVisible(arbre);

    expect(texteMensuel).toContain('7,99 €/mois');
    expect(texteMensuel).toContain('19,99 €/mois');
  });

  it('donne l\'equivalence mensuelle exacte de chaque annuel', async () => {
    const arbre = await rendre();

    // 5 999 / 12 = 4,999… -> 5,00 € ; 19 999 / 12 = 16,665… -> 16,67 €.
    expect(texteVisible(arbre)).toContain('soit 5,00 €/mois');
    expect(texteVisible(arbre)).toContain('soit 16,67 €/mois');
  });

  it('REMISE PAR CARTE — Équipe et Club n\'ont PAS la meme, et aucun tag global ne ment', async () => {
    const arbre = await rendre();
    const texte = texteVisible(arbre);

    // La grille serveur porte deux familles : Equipe x7,5-7,7 (≈ 37 %) et
    // Club x10,00 pile (≈ 17 %). Un tag unique « 2 mois offerts » pose sur la
    // pilule Annuel serait faux pour la moitie du catalogue.
    expect(texte).toContain('−37 %');
    expect(texte).toContain('−17 %');
    expect(texte).not.toContain('2 mois offerts');
  });

  it('en mensuel, aucune carte n\'annonce de remise ni d\'equivalence', async () => {
    const arbre = await rendre();
    await appuyerSur(arbre, 'Mensuel');
    const texte = texteVisible(arbre);

    expect(texte).not.toContain('−37 %');
    expect(texte).not.toContain('soit ');
  });

  it('un palier absent du catalogue est MASQUE, jamais invente', async () => {
    // Le serveur ne rend que l'annuel Equipe 1 equipe et l'annuel Club S.
    mockCatalogQueryState = {
      data: {
        data: CATALOG_ENTRIES.filter((entry) => entry.billingPeriod === 'yearly'
          && ['fc_club_tier_1_yearly', 'fc_team_1_yearly'].includes(entry.planCode)),
      },
      error: null,
      isLoading: false,
    };
    const arbre = await rendre();
    const texte = texteVisible(arbre);

    expect(texte).toContain('59,99 €/an');
    // Sans jumelle mensuelle, aucune remise ne peut etre calculee : on n'en
    // affiche pas plutot que d'en inventer une.
    expect(texte).not.toContain('−37 %');

    await appuyerSur(arbre, 'Mensuel');

    expect(texteVisible(arbre)).toContain('Aucune offre Équipe pour cette période.');
    expect(libelleDuCta(arbre)).toBe('Offre indisponible');
  });
});

describe('Carrousel d\'offres — la carte Gratuit dit la verite sur les compteurs', () => {
  it('rappelle les quotas restants a qui ne paie rien', async () => {
    const arbre = await rendre();
    const texte = texteVisible(arbre);

    expect(texte).toContain('Ton plan actuel');
    expect(texte).toContain('Événements');
    expect(texte).toContain('2 offerts restants');
  });

  it('R09 — aucun compteur gratuit n\'est revendu a un abonne', async () => {
    const arbre = await rendre({
      subscriptionAccessLevel: 'CLUB',
      subscriptionSummary: {
        activePlanCodes: ['fc_club_tier_1_yearly'],
        payerSubscriptionIds: ['sub-1'],
        teamSlotSummary: {
          assigned: 0, available: 0, coveredTeamDocumentIds: [], total: 0,
        },
      },
    });
    const texte = texteVisible(arbre);

    expect(texte).not.toContain('2 offerts restants');
    expect(texte).not.toContain('Ton plan actuel');
  });

  it('un abonne ne se voit pas proposer de « revenir en gratuit » dans l\'app', async () => {
    const arbre = await rendre({
      subscriptionAccessLevel: 'CLUB',
      subscriptionSummary: {
        activePlanCodes: ['fc_club_tier_1_yearly'],
        payerSubscriptionIds: ['sub-1'],
        teamSlotSummary: {
          assigned: 0, available: 0, coveredTeamDocumentIds: [], total: 0,
        },
      },
    });
    await allerALaCarte(arbre, 0);

    // La resiliation se gere dans le store : le CTA le dit et ne promet rien
    // que l'app ne sache faire.
    expect(libelleDuCta(arbre)).toBe('Gérer dans le store');
  });

  it('l\'offre deja payee n\'est pas revendue : son CTA est desactive', async () => {
    const arbre = await rendre({
      subscriptionAccessLevel: 'CLUB',
      subscriptionSummary: {
        activePlanCodes: ['fc_club_tier_1_yearly'],
        payerSubscriptionIds: ['sub-1'],
        teamSlotSummary: {
          assigned: 0, available: 0, coveredTeamDocumentIds: [], total: 0,
        },
      },
    });
    await allerALaCarte(arbre, 2);

    expect(libelleDuCta(arbre)).toBe('Ton offre actuelle');
    expect(pressablesPortant(arbre, 'Ton offre actuelle')[0].props.accessibilityState.disabled)
      .toBe(true);
  });
});

describe('Carrousel d\'offres — ce que chaque carte annonce', () => {
  it('Club ne reenumere pas les benefices Équipe : il n\'affiche que le delta', async () => {
    const arbre = await rendre();
    await allerALaCarte(arbre, 2);
    const texte = texteVisible(arbre);

    expect(texte).toContain('Tout Équipe, pour toutes les équipes du club, plus :');
    expect(texte).toContain('Fiche club complète');
    expect(texte).toContain('Installations');
    expect(texte).toContain('Cotisations du club');
  });

  it('un joueur n\'atteint jamais cette surface de vente', async () => {
    const arbre = await rendre({
      userData: {
        club: { documentId: 'club-1' },
        documentId: 'user-1',
        role: { name: 'Joueur', type: 'player' },
      },
    });

    expect(arbre.toJSON()).toBeNull();
  });
});
