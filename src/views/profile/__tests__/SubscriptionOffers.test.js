import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  resetSubscriptionPriceReportForTests,
} from '@/domains/subscription/useSubscriptionCatalog';

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
/** @type {any} */
let mockStorePricesQueryState;
const mockAlert = jest.fn();
const mockPerformPurchase = jest.fn();
const mockPerformPlanChange = jest.fn();
const mockIsPurchaseAvailable = jest.fn();
const mockGetActiveRail = jest.fn();
const mockInvalidate = jest.fn();
const mockScheduleRefresh = jest.fn();
const mockNavigate = jest.fn();

// L39 — DEUX requetes vivent desormais derriere le catalogue : celle du serveur
// et celle des prix du STORE. La doublure les distingue par leur cle, sinon la
// seconde recevrait le catalogue de la premiere.
jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutateAsync: (/** @type {any} */ input) => options.mutationFn(input),
  }),
  useQuery: (/** @type {any} */ options) => (
    String(options?.queryKey?.[0]) === 'subscription-store-prices'
      ? mockStorePricesQueryState
      : mockCatalogQueryState
  ),
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
    || texte === 'Gérer mes équipes couvertes'
    || texte === 'Gérer dans le store'
    || texte === 'Offre indisponible')
  .pop() || '';

/**
 * Cases a cocher de la feuille « equipes couvertes », par nom d'equipe.
 * @param {any} arbre
 * @returns {Array<{ coche: boolean; nom: string }>}
 */
const casesACocher = (arbre) => arbre.root
  .findAllByType(TouchableOpacity)
  .filter((/** @type {any} */ noeud) => noeud.props.accessibilityRole === 'checkbox')
  .map((/** @type {any} */ noeud) => ({
    coche: Boolean(noeud.props.accessibilityState?.checked),
    nom: aplatirTexte(noeud.findAllByType(Text)[0]?.props?.children).trim(),
  }));

/**
 * Monte le carrousel avec le contexte d'authentification demande.
 * `parametres` = les params de route (L38 : la portee exigee par le mur payant).
 * @param {Record<string, any>} [surcharges]
 * @param {Record<string, any> | undefined} [parametres]
 * @returns {Promise<any>}
 */
const rendre = async (surcharges = {}, parametres = undefined) => {
  mockAuthValue = contexteAuth(surcharges);
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <SubscriptionOffers
        navigation={{ navigate: mockNavigate }}
        route={parametres ? { params: parametres } : undefined}
      />,
    );
  });
  return arbre;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCatalogQueryState = { data: { data: CATALOG_ENTRIES }, error: null, isLoading: false };
  // Defaut de TOUS les tests de ce fichier : le store ne dit rien. Le repli sur
  // les prix du serveur est donc verifie par la suite entiere, pas seulement par
  // le temoin dedie plus bas.
  mockStorePricesQueryState = { data: undefined, error: null, isLoading: false };
  resetSubscriptionPriceReportForTests();
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

// L38 — le carrousel demarrait TOUJOURS sur Équipe (index 1). Quelqu'un a qui le
// serveur vient de dire « il te faut l'offre Club » atterrissait donc sur la
// carte Equipe : la mauvaise offre, au moment precis ou il est pret a payer.
describe('Carrousel d\'offres — il s\'ouvre sur l\'offre que le mur exigeait (L38)', () => {
  it('un mur exigeant CLUB ouvre le carrousel centre sur Club', async () => {
    const arbre = await rendre({}, { focusScope: 'CLUB' });

    expect(libelleDuCta(arbre)).toBe('Choisir Club S · 199,99 €/an');
  });

  it('un mur exigeant TEAM ouvre le carrousel centre sur Équipe', async () => {
    const arbre = await rendre({}, { focusScope: 'TEAM' });

    expect(libelleDuCta(arbre)).toBe('Choisir Équipe · 59,99 €/an');
  });

  it('TEMOIN — une entree SANS portee garde le comportement d\'origine : Équipe', async () => {
    // « Changer d'offre » depuis le hub n'exige aucune offre en particulier.
    const arbre = await rendre();

    expect(libelleDuCta(arbre)).toBe('Choisir Équipe · 59,99 €/an');
  });

  it('une portee inconnue ne casse rien : on retombe sur Équipe', async () => {
    const arbre = await rendre({}, { focusScope: 'PREMIUM' });

    expect(libelleDuCta(arbre)).toBe('Choisir Équipe · 59,99 €/an');
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

// L38 — il y avait TROIS comportements d'apres-achat sur trois surfaces. Le
// Recap du tour guide poussait vers l'ecran de succes refondu ; le carrousel,
// lui, avait repris verbatim l'`Alert.alert()` de l'ancien ecran Abonnement.
// Un client qui payait depuis le carrousel voyait donc une alerte systeme au
// lieu de l'ecran de celebration — et perdait la liste de ce qu'il vient de
// debloquer ainsi que ses premiers pas.
describe('Carrousel d\'offres — apres l\'achat, l\'ecran de succes (L38)', () => {
  it('un achat Club pousse vers SubscriptionSuccess, sans alerte systeme', async () => {
    const arbre = await rendre();
    await allerALaCarte(arbre, 2);
    await appuyerSur(arbre, 'Choisir Club S · 199,99 €/an');

    expect(mockNavigate).toHaveBeenCalledWith('SubscriptionSuccess', expect.objectContaining({
      // La portee vient de l'ACHAT, pas du cache d'abonnement : le webhook du
      // store n'a pas encore converge (L08).
      clubDocumentId: 'club-1',
      offerLabel: 'Club S',
      offerScope: 'CLUB',
    }));
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('un achat Équipe pousse lui aussi vers SubscriptionSuccess', async () => {
    const arbre = await rendre();
    await appuyerSur(arbre, 'Choisir Équipe · 59,99 €/an');
    await appuyerSur(arbre, 'Activer cette offre');

    expect(mockNavigate).toHaveBeenCalledWith('SubscriptionSuccess', expect.objectContaining({
      offerLabel: 'Équipe · 1 équipe',
      offerScope: 'TEAM',
    }));
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('le calendrier de convergence L08 est arme AVANT la bascule d\'ecran', async () => {
    const arbre = await rendre();
    await allerALaCarte(arbre, 2);
    await appuyerSur(arbre, 'Choisir Club S · 199,99 €/an');

    expect(mockScheduleRefresh).toHaveBeenCalled();
  });

  it('TEMOIN — un achat en echec ne pousse PAS vers l\'ecran de succes', async () => {
    mockPerformPurchase.mockRejectedValue(new Error('CLUB_ALREADY_COVERED'));
    const arbre = await rendre();
    await allerALaCarte(arbre, 2);
    await appuyerSur(arbre, 'Choisir Club S · 199,99 €/an');

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockAlert).toHaveBeenCalledWith('Erreur abonnement', expect.any(String));
  });

  it('TEMOIN — un achat abandonne dans la feuille ne pousse rien du tout', async () => {
    const arbre = await rendre();
    await appuyerSur(arbre, 'Choisir Équipe · 59,99 €/an');
    await appuyerSur(arbre, 'Annuler');

    expect(mockPerformPurchase).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

/* L39 — le prix AFFICHE doit etre celui du STORE : c'est le seul que le client
   paiera. Le catalogue serveur reste le repli, et tout desaccord entre les deux
   est signale, meme quand on affiche le bon prix. */
describe('L39 — le prix affiche vient du STORE, et l ecart est signale', () => {
  /* Le store annonce le MEME catalogue que le serveur, sauf le palier Équipe 1,
     ou il est VOLONTAIREMENT different (1,99 €/mois et 12,99 €/an au lieu de
     7,99 € et 59,99 €). Si l'ecran affiche 12,99, c'est bien le store qui parle. */
  const PRIX_STORE = {
    fc_club_tier_1_monthly: 1999,
    fc_club_tier_1_yearly: 19999,
    fc_club_tier_2_monthly: 3499,
    fc_club_tier_2_yearly: 34999,
    fc_club_tier_3_monthly: 5499,
    fc_club_tier_3_yearly: 54999,
    fc_team_1_monthly: 199,
    fc_team_1_yearly: 1299,
    fc_team_2_monthly: 1299,
    fc_team_2_yearly: 9999,
    fc_team_3_monthly: 1699,
    fc_team_3_yearly: 12999,
  };

  /**
   * Le store rend exactement la grille du serveur : aucun ecart a signaler.
   * @returns {Record<string, number>}
   */
  const prixStoreIdentiquesAuServeur = () => Object.fromEntries(
    CATALOG_ENTRIES.map((entry) => [entry.planCode, entry.referencePriceEurCents]),
  );

  /** @type {any} */
  let journal;

  beforeEach(() => {
    journal = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    journal.mockRestore();
  });

  it('quand le store repond, c est SON prix qui s affiche, pas celui du serveur', async () => {
    mockStorePricesQueryState = { data: PRIX_STORE, error: null, isLoading: false };
    const arbre = await rendre();
    const texte = texteVisible(arbre);

    // Le serveur annonce 59,99 €/an ; le store facturera 12,99 €. C'est 12,99
    // qui doit etre a l'ecran, sur l'ancre prix ET sur le bouton d'achat.
    expect(texte).toContain('12,99 €/an');
    expect(texte).not.toContain('59,99 €/an');
    expect(libelleDuCta(arbre)).toBe('Choisir Équipe · 12,99 €/an');

    // Le palier Club, lui, est d'accord des deux cotes : il ne bouge pas.
    await allerALaCarte(arbre, 2);
    expect(libelleDuCta(arbre)).toBe('Choisir Club S · 199,99 €/an');
  });

  it('TEMOIN DE REPLI — store muet : un prix s affiche et l ecran reste vendable', async () => {
    // Ni reseau, ni store, ni SDK (c'est aussi le cas du WEB, ou Purchases
    // n'existe pas) : la requete ne rend rien.
    mockStorePricesQueryState = { data: undefined, error: null, isLoading: true };
    const arbre = await rendre();

    // Le prix du serveur prend le relais, et le bouton reste ACTIF : un ecran de
    // vente muet serait pire qu'un prix approximatif.
    expect(texteVisible(arbre)).toContain('59,99 €/an');
    expect(libelleDuCta(arbre)).toBe('Choisir Équipe · 59,99 €/an');
    expect(pressablesPortant(arbre, 'Choisir Équipe · 59,99 €/an')[0]
      .props.accessibilityState.disabled).toBe(false);
  });

  it('la remise reste juste : les deux prix du calcul viennent de la MEME source', async () => {
    mockStorePricesQueryState = { data: PRIX_STORE, error: null, isLoading: false };
    const arbre = await rendre();
    const texte = texteVisible(arbre);

    // Prix store : 1 − 1299 / (199 × 12) = 45,6 % -> −46 %.
    expect(texte).toContain('−46 %');
    expect(texteVisible(arbre)).toContain('soit 1,08 €/mois');
    // Le melange interdit serait l'annuel du store face au mensuel du serveur :
    // 1 − 1299 / (799 × 12) = 86 %. Ce chiffre ne doit exister nulle part.
    expect(texte).not.toContain('−86 %');
    // Club est d'accord des deux cotes : sa remise ne bouge pas.
    expect(texte).toContain('−17 %');
  });

  it('un ecart est SIGNALE : le palier, les deux valeurs et la source retenue', async () => {
    mockStorePricesQueryState = { data: PRIX_STORE, error: null, isLoading: false };
    await rendre();

    const signalements = journal.mock.calls
      .filter((/** @type {any[]} */ appel) => String(appel[0]).includes('[subscription-price]'));
    expect(signalements).toHaveLength(1);

    const ecarts = signalements[0][1]?.ecarts || [];
    expect(ecarts).toEqual(expect.arrayContaining([
      {
        planCode: 'fc_team_1_yearly',
        prixServeurEurCents: 5999,
        prixStoreEurCents: 1299,
        sourceRetenue: 'store',
      },
      {
        planCode: 'fc_team_1_monthly',
        prixServeurEurCents: 799,
        prixStoreEurCents: 199,
        sourceRetenue: 'store',
      },
    ]));
    // Les dix paliers d'accord ne sont PAS listes : une alarme qui sonne
    // toujours n'est plus lue.
    expect(ecarts).toHaveLength(2);
  });

  it('TEMOIN NEGATIF — store et serveur d accord : aucun signalement', async () => {
    mockStorePricesQueryState = {
      data: prixStoreIdentiquesAuServeur(),
      error: null,
      isLoading: false,
    };
    const arbre = await rendre();

    expect(libelleDuCta(arbre)).toBe('Choisir Équipe · 59,99 €/an');
    expect(journal.mock.calls
      .filter((/** @type {any[]} */ appel) => String(appel[0]).includes('[subscription-price]')))
      .toHaveLength(0);
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

/* L40 partie A — un abonne Équipe a paye une offre qui couvre des equipes
   NOMMEES, et il ne pouvait plus jamais changer lesquelles : le seul chemin vers
   la feuille de gestion (`manage-team-slots`) passait par un CTA desactive
   EXACTEMENT quand cette condition etait vraie. Du code mort, dont le titre
   « Mettre à jour mes équipes couvertes » ne pouvait s'afficher nulle part. */
describe('L40 — un abonne Équipe peut rouvrir ses equipes couvertes', () => {
  /**
   * @param {Record<string, any>} [surcharges]
   * @returns {Record<string, any>}
   */
  const abonneEquipe = (surcharges = {}) => ({
    allMyTeams: [
      { club: { name: 'AS Test' }, documentId: 'team-1', name: 'U15' },
      { club: { name: 'AS Test' }, documentId: 'team-2', name: 'U17' },
      { club: { name: 'AS Test' }, documentId: 'team-3', name: 'U19' },
    ],
    subscriptionAccessLevel: 'TEAM',
    subscriptionSummary: {
      activePlanCodes: ['fc_team_1_yearly'],
      payerSubscriptionIds: ['sub-1'],
      teamSlotSummary: {
        assigned: 1, available: 0, coveredTeamDocumentIds: ['team-2'], total: 1,
      },
    },
    ...surcharges,
  });

  beforeEach(() => {
    mockPerformPlanChange.mockResolvedValue({ ok: true });
  });

  it('TEMOIN D\'ARRIVEE — le CTA de son offre active ouvre la gestion des equipes', async () => {
    const arbre = await rendre(abonneEquipe());

    // Le CTA ne ment pas : il n'y a rien a acheter, mais il y a quelque chose a
    // GERER. Il change de verbe au lieu de s'eteindre.
    expect(libelleDuCta(arbre)).toBe('Gérer mes équipes couvertes');
    expect(pressablesPortant(arbre, 'Gérer mes équipes couvertes')[0]
      .props.accessibilityState.disabled).toBe(false);

    await appuyerSur(arbre, 'Gérer mes équipes couvertes');

    // Ce titre est le temoin du code mort : il ne pouvait s'afficher sur aucun
    // ecran avant ce lot.
    expect(texteVisible(arbre)).toContain('Mettre à jour mes équipes couvertes');
  });

  it('la feuille s\'ouvre PRE-COCHEE sur les equipes deja couvertes', async () => {
    const arbre = await rendre(abonneEquipe());
    await appuyerSur(arbre, 'Gérer mes équipes couvertes');

    // Rouvrir la fenetre sur une selection vide ferait perdre a l'abonne la
    // trace de ce qu'il paie.
    expect(casesACocher(arbre)).toEqual([
      { coche: false, nom: 'U15' },
      { coche: true, nom: 'U17' },
      { coche: false, nom: 'U19' },
    ]);
  });

  it('changer d\'equipe passe par le MEME planCode — donc sans repasser a la caisse', async () => {
    const arbre = await rendre(abonneEquipe());
    await appuyerSur(arbre, 'Gérer mes équipes couvertes');
    // On libere U17 et on couvre U19 a la place : 1 creneau, 1 equipe.
    await appuyerSur(arbre, 'U17');
    await appuyerSur(arbre, 'U19');
    await appuyerSur(arbre, 'Confirmer le changement');

    expect(mockPerformPurchase).not.toHaveBeenCalled();
    // `currentPlanCode` EGAL a `planCode` est la condition exacte qui fait
    // prendre a `performSubscriptionPlanChange` la branche « reassignation de
    // creneaux, aucun passage store » (subscriptionPurchaseRail.js:241).
    expect(mockPerformPlanChange).toHaveBeenCalledTimes(1);
    const envoi = mockPerformPlanChange.mock.calls[0][0];
    expect(envoi.catalogEntry.planCode).toBe('fc_team_1_yearly');
    expect(envoi.currentPlanCode).toBe('fc_team_1_yearly');
    expect(envoi.subscriptionDocumentId).toBe('sub-1');
    expect(envoi.teamDocumentIds).toEqual(['team-3']);
  });

  it('une simple mise a jour de creneaux n\'invente PAS de date de renouvellement', async () => {
    const arbre = await rendre(abonneEquipe());
    await appuyerSur(arbre, 'Gérer mes équipes couvertes');
    await appuyerSur(arbre, 'Confirmer le changement');

    // La vraie echeance ne bouge pas (le serveur la preserve quand le payload
    // omet les dates, subscription-billing.ts:1181). En afficher une calculee
    // « aujourd'hui + 1 an » serait un mensonge sur l'ecran de succes.
    expect(mockNavigate).toHaveBeenCalledWith(
      'SubscriptionSuccess',
      expect.objectContaining({ offerScope: 'TEAM' }),
    );
    expect(mockNavigate.mock.calls[0][1].renewalDateLabel).toBeUndefined();
  });

  it('TEMOIN DE PORTEE — sur une offre CLUB active, le CTA reste desactive', async () => {
    // Une offre Club couvre TOUT le club : il n'y a aucun creneau a gerer. Le
    // CTA doit garder son ancien comportement, mot pour mot.
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

  it('TEMOIN D\'ACHAT — un palier NON possede reste un achat, pas une gestion', async () => {
    const arbre = await rendre(abonneEquipe());
    // Palier 2 equipes : ce n'est pas son offre, c'est une montee en gamme.
    await appuyerSur(arbre, '2');

    expect(libelleDuCta(arbre)).toBe('Choisir Équipe · 99,99 €/an');
  });
});

/* L40 partie B — le catalogue est un PASSAGE : il ne sait pas d'ou vient la
   personne, mais la porte qui l'y a envoyee, si. Il transporte donc l'origine
   sans jamais l'interpreter, jusqu'a l'ecran de succes. */
describe('L40 — le catalogue transporte l origine jusqu a l ecran de succes', () => {
  it('une origine recue en param voyage jusqu au succes, avec « Reprendre »', async () => {
    const arbre = await rendre({}, {
      resumeRouteName: 'EventStack',
      resumeRouteParams: { screen: 'EventWizardType' },
    });
    await allerALaCarte(arbre, 2);
    await appuyerSur(arbre, 'Choisir Club S · 199,99 €/an');

    expect(mockNavigate).toHaveBeenCalledWith('SubscriptionSuccess', expect.objectContaining({
      // Le libelle doit dire ou il mene : « C'est parti ! » promet l'accueil.
      resumeCtaLabel: 'Reprendre',
      resumeMode: 'route',
      resumeRouteName: 'EventStack',
      resumeRouteParams: { screen: 'EventWizardType' },
    }));
  });

  it('TEMOIN — sans origine, on repart de l accueil exactement comme avant', async () => {
    const arbre = await rendre();
    await allerALaCarte(arbre, 2);
    await appuyerSur(arbre, 'Choisir Club S · 199,99 €/an');

    const params = mockNavigate.mock.calls[0][1];
    expect(params.resumeMode).toBe('home');
    expect(params.resumeCtaLabel).toBe('C\'est parti !');
    expect(params.resumeRouteName).toBeUndefined();
  });
});

describe('Carrousel d\'offres — ce que chaque carte annonce', () => {
  it('Club ne reenumere pas les benefices Équipe : il n\'affiche que le delta', async () => {
    const arbre = await rendre();
    await allerALaCarte(arbre, 2);
    const texte = texteVisible(arbre);

    // R07 — l'amorce nomme desormais la COUVERTURE de la taille choisie
    // (« jusqu'a 3 equipes du club » pour Club S) au lieu du vague « toutes les
    // equipes du club ». Ce que ce temoin garde, lui, est inchange : la carte
    // Club n'affiche que le DELTA sur l'offre Equipe.
    expect(texte).toContain("Tout ce que fait l'offre Équipe, pour jusqu'à 3 équipes du club, plus :");
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

// R07 point 5 — L'OFFRE CLUB DIT ENFIN CE QU'ELLE CONTIENT.
//
// Constat d'Adel du 2026-08-13 : « il faut mieux expliquer l'offre Club : dire
// que c'est la meme chose que l'offre Equipe (en indiquant selon l'offre que tu
// choisis le nombre d'equipes que ca comprend), mais en plus : sponsors
// visibles, gestion cotisations, gestion des installations, etc. »
//
// La carte n'affichait que les lettres S / M / L. Un palier sans critere de
// choix : rien ne disait ce qu'on achetait de plus en montant de taille.
//
// ⚠️ LE NOMBRE N'EST PAS UNE CONSTANTE DE L'APP, et c'est le point a retenir :
// il vient du catalogue SERVEUR (`maxTeams`). Ces temoins le prouvent en
// faisant varier le catalogue, jamais en figeant un chiffre dans le code.
// ⛔ Aucun prix, aucun palier, aucune regle d'abonnement touches : du TEXTE.
describe('R07 — la carte Club nomme ce qu\'elle couvre', () => {
  it('LE TEMOIN : la taille choisie annonce SON nombre d\'equipes', async () => {
    const arbre = await rendre();
    await allerALaCarte(arbre, 2);

    // Club S, `maxTeams: 3` au catalogue.
    expect(texteVisible(arbre)).toContain("jusqu'à 3 équipes du club");
  });

  it('changer de taille change le nombre annonce', async () => {
    const arbre = await rendre();
    await allerALaCarte(arbre, 2);
    await appuyerSur(arbre, 'M');

    // Club M, `maxTeams: 8` au catalogue.
    expect(texteVisible(arbre)).toContain("jusqu'à 8 équipes du club");
    expect(texteVisible(arbre)).not.toContain("jusqu'à 3 équipes du club");
  });

  it('une taille SANS borne au catalogue ne va pas inventer un chiffre', async () => {
    const arbre = await rendre();
    await allerALaCarte(arbre, 2);
    await appuyerSur(arbre, 'L');

    // Club L, `maxTeams: null` au catalogue : aucune borne a annoncer.
    expect(texteVisible(arbre)).toContain('toutes les équipes du club');
    expect(texteVisible(arbre)).not.toContain("jusqu'à null");
  });

  it('elle dit que c\'est l\'offre Équipe, appliquee a ces equipes-la', async () => {
    const arbre = await rendre();
    await allerALaCarte(arbre, 2);

    expect(texteVisible(arbre)).toContain("Tout ce que fait l'offre Équipe");
  });

  it('et les capacites EN PLUS sont nommees, telles que le catalogue les donne', async () => {
    const arbre = await rendre();
    await allerALaCarte(arbre, 2);
    const texte = texteVisible(arbre);

    // Les trois qu'Adel cite. Elles viennent des `featureKeys` du catalogue :
    // aucune n'est ecrite en dur dans la carte.
    expect(texte).toContain('Sponsors et partenaires');
    expect(texte).toContain('Cotisations du club');
    expect(texte).toContain('Installations');
  });

  it('⛔ et « plus : » reste vrai : ce qu\'Équipe couvre deja n\'est pas recompte', async () => {
    const arbre = await rendre();
    await allerALaCarte(arbre, 2);
    // ⚠️ `texteVisible` rend TOUT l'ecran, les 3 cartes comprises : la carte
    // Équipe y porte legitimement « Cotisations de l'équipe ». On ne lit donc
    // que ce qui SUIT l'amorce de la carte Club.
    const apresAmorce = texteVisible(arbre).split('plus :')[1] || '';

    // `dues.team` et `composition` sont dans les DEUX listes du catalogue. La
    // carte Club ne doit lister que le supplement, sinon « plus : » ment.
    expect(apresAmorce).not.toContain('Cotisations de l\'équipe');
    expect(apresAmorce).not.toContain('Composition d\'équipe');
    expect(apresAmorce).toContain('Cotisations du club');
  });

  it('⛔ ET AUCUNE CONTRADICTION : la couverture bornee ne cotoie pas « toutes »', async () => {
    const arbre = await rendre();
    await allerALaCarte(arbre, 2);
    const apresAmorce = texteVisible(arbre).split('plus :')[1] || '';

    // Club S couvre 3 equipes. Le libelle « Toutes les équipes du club » de
    // `club.multi_teams` disait litteralement l'inverse, deux lignes plus bas.
    expect(apresAmorce).not.toContain('Toutes les équipes du club');
  });
});
