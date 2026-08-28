import { Text, TextInput, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import SubscriptionOverview from '../SubscriptionOverview';

// S12-B/D5 — AUGMENTER SON NOMBRE DE LICENCIES, DEPUIS « MON ABONNEMENT ».
//
// Fichier a part du test de caracterisation : celui-la fige le hub SANS
// catalogue (entrees vides), et ce geste-ci a justement besoin d'un catalogue
// qui vend l'offre au licencie. Melanger les deux fixtures obligerait chaque
// temoin a redire lequel des deux mondes il decrit.
//
// Pilote par le TEXTE VISIBLE et les appels sortants. Theme et traductions : les
// VRAIS modules (un mock en Proxy rend les echecs Jest illisibles).

/** @type {any} */
let mockAuthValue;
/** @type {any} */
let mockCatalogEntries;
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockAlert = jest.fn();
const mockIncrease = jest.fn();
const mockRestorePurchases = jest.fn();
const mockInvalidate = jest.fn();
const mockScheduleRefresh = jest.fn();

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

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutateAsync: (/** @type {any} */ input) => options.mutationFn(input),
  }),
  useQueryClient: () => ({ id: 'query-client-test' }),
}));

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
      t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
        const valeur = lire(String(cle || '').split('.'));
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

// ⚠️ Le hub lit le catalogue pour savoir si l'offre payee se facture AU
// LICENCIE, et a quel prix unitaire. Sans cette doublure, le vrai module tire
// `subscriptionService` -> AsyncStorage : la SUITE ENTIERE tombe.
jest.mock('@/domains/subscription/useSubscriptionCatalog', () => ({
  useSubscriptionCatalog: () => ({
    entries: mockCatalogEntries,
    error: null,
    isError: false,
    isLoading: false,
    refetch: jest.fn(),
  }),
}));

jest.mock('@/domains/subscription/subscriptionPurchaseRail', () => ({
  performSubscriptionLicenseeIncrease: (/** @type {any} */ ...args) => mockIncrease(...args),
  restoreAllSubscriptionPurchases: (/** @type {any} */ ...args) => mockRestorePurchases(...args),
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
      Images: {
        arrowRight: 1, calendar: 1, check: 1, euroCircle: 1, search: 1, shield: 1, users: 1,
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

jest.mock('@/components/molecules/legalFooter/LegalFooter', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <View /> };
});

jest.mock('@/views/profile/SubscriptionCoveredHero', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <TexteRN>HEROS DEJA COUVERT</TexteRN> };
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

jest.mock('@/components/molecules/input/Input', () => {
  const { Text: TexteRN, TextInput: SaisieRN, View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ {
      accessibilityLabel, error, label, onChangeText, value,
    }) => (
      <VueRN>
        {label ? <TexteRN>{label}</TexteRN> : null}
        <SaisieRN
          accessibilityLabel={accessibilityLabel}
          onChangeText={onChangeText}
          value={value}
        />
        {error ? <TexteRN>{error}</TexteRN> : null}
      </VueRN>
    ),
  };
});

jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: (/** @type {any} */ ...args) => mockAlert(...args),
}));

/* ------------------------------------------------------------------ */

// Copie fidele des deux entrees ajoutees par S12-A
// (admin/src/api/subscription/services/subscription-catalog.ts:107-125).
const ENTREES_LICENCIE = ['monthly', 'yearly'].map((billingPeriod) => ({
  billingPeriod,
  displayName: `Club au licencié · équipes illimitées (${billingPeriod === 'yearly' ? 'annuel' : 'mensuel'})`,
  isActive: true,
  maxTeams: null,
  planCode: `fc_club_licensee_${billingPeriod}`,
  pricingModel: 'per_licensee',
  referencePriceEurCents: billingPeriod === 'yearly' ? 250 : 25,
  scopeType: 'CLUB',
  slotCount: null,
  unitPriceEurCents: billingPeriod === 'yearly' ? 250 : 25,
}));

const ENTREE_TRANCHE = {
  billingPeriod: 'yearly',
  displayName: 'Club 100',
  isActive: true,
  licenseeCap: 100,
  maxTeams: null,
  planCode: 'fc_club_tier_1_yearly',
  pricingModel: 'flat',
  referencePriceEurCents: 24999,
  scopeType: 'CLUB',
  slotCount: null,
  unitPriceEurCents: null,
};

/**
 * Contexte d'un dirigeant abonne AU LICENCIE.
 * @param {Record<string, any>} [surcharges]
 * @returns {any}
 */
const contexteAuth = (surcharges = {}) => ({
  clubVerificationSummary: {
    clubDocumentId: 'club-1',
    clubVerified: true,
    requiresClubVerification: false,
  },
  entitlementsSummary: [],
  subscriptionAccessLevel: 'CLUB',
  subscriptionSummary: {
    activePlanCodes: ['fc_club_licensee_yearly'],
    payerSubscriptionIds: ['sub-licencie-1'],
    payerSubscriptionsSummary: [{
      autoRenew: true,
      billingPeriod: 'yearly',
      currentPeriodEnd: null,
      documentId: 'sub-licencie-1',
      isTrial: false,
      planCode: 'fc_club_licensee_yearly',
      provider: 'stripe',
      status: 'active',
    }],
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
 * @param {any} arbre
 * @returns {string}
 */
const texteVisible = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
  .join(' | ');

/**
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
 * @param {any} arbre
 * @param {string} libelle
 * @returns {Promise<void>}
 */
const appuyerSur = async (arbre, libelle) => {
  const candidats = pressablesPortant(arbre, libelle);
  if (candidats.length === 0) {
    throw new Error(`Aucun pressable ne porte le libelle « ${libelle} »`);
  }
  await act(async () => {
    candidats[0].props.onPress();
  });
};

/**
 * @param {any} arbre
 * @param {string} texte
 * @returns {Promise<void>}
 */
const taperNombre = async (arbre, texte) => {
  const champ = arbre.root.findAllByType(TextInput)
    .find((/** @type {any} */ noeud) => noeud.props.accessibilityLabel === 'Nouveau nombre de licenciés');
  await act(async () => {
    champ.props.onChangeText(texte);
  });
};

/**
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
      <SubscriptionOverview
        navigation={/** @type {any} */ ({ navigate: mockNavigate, replace: mockReplace })}
        route={parametres ? { params: parametres } : undefined}
      />,
    );
  });
  return arbre;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCatalogEntries = [ENTREE_TRANCHE, ...ENTREES_LICENCIE];
  mockIncrease.mockResolvedValue({
    licenseeCount: 150,
    previousLicenseeCount: 120,
    status: 'increased',
    // ⚠️ La reponse serveur est un SUPERSET du contrat : ces deux champs en
    // plus ne doivent JAMAIS etre lus en egalite stricte.
    stripeSubscriptionId: 'sub_stripe_1',
    subscriptionDocumentId: 'sub-licencie-1',
  });
  mockRestorePurchases.mockResolvedValue({ meta: { restoredCount: 0 } });
});

describe('S12-B/D5 — la porte vers l augmentation', () => {
  it('LE TEMOIN — un abonne AU LICENCIE trouve « Augmenter mes licenciés »', async () => {
    expect(texteVisible(await rendre())).toContain('Augmenter mes licenciés');
  });

  it('⛔ un abonne PAR PALIER ne la voit pas : ce serait une impasse', async () => {
    // Le serveur refuse l'augmentation sur une offre forfaitaire
    // (subscription-stripe.ts:237-241) : proposer le geste serait mentir.
    const arbre = await rendre({
      subscriptionSummary: {
        activePlanCodes: ['fc_club_tier_1_yearly'],
        payerSubscriptionIds: ['sub-palier-1'],
        payerSubscriptionsSummary: [{
          billingPeriod: 'yearly',
          documentId: 'sub-palier-1',
          planCode: 'fc_club_tier_1_yearly',
          status: 'active',
        }],
        teamSlotSummary: {
          assigned: 0, available: 0, coveredTeamDocumentIds: [], total: 0,
        },
      },
    });

    expect(texteVisible(arbre)).not.toContain('Augmenter mes licenciés');
  });

  it('c est `pricingModel` qui tranche, jamais le code de plan', async () => {
    // Catalogue qui ne porte PAS l'offre au licencie : meme planCode actif, mais
    // rien ne prouve son modele de prix -> on ne propose pas le geste.
    mockCatalogEntries = [ENTREE_TRANCHE];
    expect(texteVisible(await rendre())).not.toContain('Augmenter mes licenciés');
  });

  it('l offre est NOMMEE correctement sur la carte statut', async () => {
    // Sans la branche dediee, l'ecran affichait « Fc Club Licensee Yearly ».
    expect(texteVisible(await rendre())).toContain('Club au licencié / an');
  });
});

describe('S12-B/D5 — la feuille : nombre actuel, nouveau nombre, ce que ca coute', () => {
  it('la notification de quota OUVRE la feuille directement, avec les deux nombres', async () => {
    const arbre = await rendre({}, {
      licenseeCount: 120,
      memberCount: 120,
      openLicenseeIncrease: true,
    });
    const texte = texteVisible(arbre);

    expect(texte).toContain('Augmenter mes licenciés');
    expect(texte).toContain('Ton abonnement couvre 120 licenciés');
    expect(texte).toContain('ton club compte 120 membres');
  });

  it('D3 — le prix se calcule sous les yeux, et l AJOUT est dit a part', async () => {
    const arbre = await rendre({}, { licenseeCount: 120, openLicenseeIncrease: true });
    await taperNombre(arbre, '150');
    const texte = texteVisible(arbre);

    expect(texte).toContain('150 licenciés × 2,50 € = 375,00 €/an');
    // Le total seul ne dit pas ce qu'on paie EN PLUS.
    expect(texte).toContain('+ 30 licenciés × 2,50 € = 75,00 €/an');
  });

  it('⛔ une DIMINUTION est refusee par l ecran, avant meme le serveur', async () => {
    // Le serveur ne l'accepte pas en v1 (subscription-stripe.ts:247-253) : la
    // feuille ne la propose donc pas, et elle DIT pourquoi.
    const arbre = await rendre({}, { licenseeCount: 120, openLicenseeIncrease: true });
    await taperNombre(arbre, '100');

    expect(texteVisible(arbre)).toContain('Ton abonnement couvre déjà 120 licenciés : indique un nombre plus grand.');
    expect(pressablesPortant(arbre, "Confirmer l'augmentation")[0].props.accessibilityState.disabled)
      .toBe(true);
  });

  it('LE TEMOIN — confirmer appelle le serveur avec le nouveau TOTAL', async () => {
    const arbre = await rendre({}, { licenseeCount: 120, openLicenseeIncrease: true });
    await taperNombre(arbre, '150');
    await appuyerSur(arbre, "Confirmer l'augmentation");

    expect(mockIncrease).toHaveBeenCalledWith({
      licenseeCount: 150,
      subscriptionDocumentId: 'sub-licencie-1',
    });
  });

  it('la confirmation dit le MOUVEMENT (120 -> 150), pas seulement le resultat', async () => {
    const arbre = await rendre({}, { licenseeCount: 120, openLicenseeIncrease: true });
    await taperNombre(arbre, '150');
    await appuyerSur(arbre, "Confirmer l'augmentation");

    expect(mockAlert).toHaveBeenCalledWith(
      'Nouveau nombre de licenciés enregistré',
      expect.stringContaining('de 120 à 150 licenciés'),
    );
    // Le plafond est relu par le serveur : on rearme la convergence (L08).
    expect(mockScheduleRefresh).toHaveBeenCalled();
    expect(mockInvalidate).toHaveBeenCalled();
  });

  it('sans nombre connu, on ne l INVENTE pas : on demande le nouveau total', async () => {
    // `payerSubscriptionsSummary` n'expose pas `licenseeCount` : quand ni la
    // notification ni le refus ne l'ont transporte, l'ecran se tait plutot que
    // d'afficher un zero faux.
    const arbre = await rendre({}, { openLicenseeIncrease: true });
    const texte = texteVisible(arbre);

    expect(texte).toContain('Indique le nouveau nombre TOTAL de licenciés');
    expect(texte).not.toContain('couvre 0 licenciés');
  });

  it('un echec serveur se dit, et la feuille ne ment pas sur le resultat', async () => {
    mockIncrease.mockRejectedValue(new Error('Cet abonnement n est pas actif.'));
    const arbre = await rendre({}, { licenseeCount: 120, openLicenseeIncrease: true });
    await taperNombre(arbre, '150');
    await appuyerSur(arbre, "Confirmer l'augmentation");

    expect(mockAlert).toHaveBeenCalledWith('Erreur abonnement', 'Cet abonnement n est pas actif.');
  });
});
