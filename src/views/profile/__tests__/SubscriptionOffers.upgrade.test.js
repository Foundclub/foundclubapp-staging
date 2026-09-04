import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import SubscriptionOffers from '../SubscriptionOffers';

/**
 * UPGRADE / U5 — L ECRAN PROPOSE CE QUI PASSERA, ET GRISE CE QUI SERA REFUSE.
 *
 * DECISION D ADEL DU 2026-09-04 : « on accepte les montees en gamme, on refuse
 * l egal et le moins cher ». Depuis, le serveur n accepte un achat CLUB sur un
 * club deja couvert QUE si l offre achetee est strictement meilleure
 * (`assertClubNotAlreadyCovered`). Un ecran qui propose les quatre tranches
 * envoie l utilisateur PAYER puis se faire jeter — le scenario exact qui a
 * coute de l argent le 04/09 (Apple encaisse a 14:22:44, serveur 400).
 *
 * 🧨 LE PIEGE MESURE ICI : « Club Illimite » porte `licenseeCap: null`. `null`
 * veut dire LE SOMMET. Une comparaison naive le classerait DERNIER et griserait
 * la seule offre qui, elle, passe toujours.
 *
 * Pilote par ce que l ecran REND (pilules, bouton), jamais par des pixels.
 */
/** @type {any} */
let mockAuthValue;
/** @type {any} */
let mockCatalogQueryState;
const mockAlert = jest.fn();
const mockPerformPurchase = jest.fn();
const mockPerformPlanChange = jest.fn();
const mockNavigate = jest.fn();

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 47,
  }),
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutateAsync: (/** @type {any} */ input) => options.mutationFn(input),
  }),
  useQuery: (/** @type {any} */ options) => (
    String(options?.queryKey?.[0]) === 'subscription-store-prices'
      ? { data: undefined, error: null, isLoading: false }
      : mockCatalogQueryState
  ),
  useQueryClient: () => ({ id: 'query-client-test' }),
}));

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;

  /**
   * Lit une cle de traduction, segment par segment.
   * @param {string[]} chemin
   * @returns {any} La valeur trouvee, ou undefined.
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
        const valeur = lire(String(cle || '').split('.'));
        if (typeof valeur === 'string') return valeur;
        return typeof options === 'string' ? options : cle;
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
  getActiveSubscriptionPurchaseRail: () => 'NATIVE_STORE',
  isSubscriptionPurchaseAvailable: () => true,
  performSubscriptionPlanChange: (/** @type {any} */ ...args) => mockPerformPlanChange(...args),
  performSubscriptionPurchase: (/** @type {any} */ ...args) => mockPerformPurchase(...args),
  SUBSCRIPTION_PURCHASE_RAILS: { NATIVE_STORE: 'NATIVE_STORE', TRUSTED_TEST: 'TRUSTED_TEST' },
}));

jest.mock('@/domains/subscription/subscriptionRefresh', () => ({
  invalidateSubscriptionState: jest.fn(),
  scheduleSubscriptionStateRefresh: jest.fn(),
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
    default: (/** @type {any} */ props) => <View>{props.children}</View>,
  };
});

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
  const { View: VueRN } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <VueRN /> };
});

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { disabled, onPress, title }) => (
      <PressableRN
        accessibilityRole="button"
        accessibilityState={{ disabled: Boolean(disabled) }}
        disabled={Boolean(disabled)}
        onPress={onPress}
      >
        <TexteRN>{title}</TexteRN>
      </PressableRN>
    ),
  };
});

jest.mock('@/components/molecules/input/Input', () => {
  const { TextInput: SaisieRN, View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onChangeText, value }) => (
      <VueRN><SaisieRN onChangeText={onChangeText} value={value} /></VueRN>
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

jest.mock('react-native/Libraries/Alert/Alert', () => {
  const mockModule = { alert: (/** @type {any} */ ...args) => mockAlert(...args) };
  return { ...mockModule, default: mockModule };
});

/**
 * Une tranche Club du catalogue serveur.
 * @param {number} tier - le numero de tranche (1 a 4).
 * @param {string} displayName - son nom commercial.
 * @param {number | null} licenseeCap - son plafond de licencies (null = illimite).
 * @param {number} priceEurCents - son prix de reference.
 * @returns {any} - l entree de catalogue.
 */
const trancheClub = (tier, displayName, licenseeCap, priceEurCents) => ({
  billingPeriod: 'yearly',
  displayName,
  featureKeys: ['events.unlimited', 'club.profile'],
  isActive: true,
  licenseeCap,
  maxTeams: null,
  planCode: 'fc_club_tier_' + tier + '_yearly',
  providerProductId: 'fc_club_tier_' + tier + '_yearly',
  referencePriceEurCents: priceEurCents,
  requiresClubVerification: true,
  scopeType: 'CLUB',
  slotCount: null,
});

const CATALOG_ENTRIES = [
  {
    billingPeriod: 'yearly',
    displayName: 'Équipe · 1 équipe',
    featureKeys: ['events.unlimited'],
    isActive: true,
    licenseeCap: null,
    maxTeams: null,
    planCode: 'fc_team_1_yearly',
    providerProductId: 'fc_team_1_yearly',
    referencePriceEurCents: 5999,
    requiresClubVerification: false,
    scopeType: 'TEAM',
    slotCount: 1,
  },
  trancheClub(1, 'Club 100', 100, 24999),
  trancheClub(2, 'Club 500', 500, 59999),
  trancheClub(3, 'Club 1000', 1000, 89999),
  trancheClub(4, 'Club Illimite', null, 93999),
];

/**
 * Le contexte d authentification, dans la forme exacte rendue par useAuth.
 * @param {Record<string, any>} [surcharges]
 * @returns {any} Le contexte a servir a l ecran.
 */
const contexteAuth = (surcharges = {}) => ({
  allMyTeams: [{ club: { name: 'AS Test' }, documentId: 'team-1', name: 'U15' }],
  clubVerificationSummary: {
    clubDocumentId: 'club-1',
    clubVerified: true,
    requiresClubVerification: false,
  },
  entitlementsSummary: [],
  freeUsageSummary: [],
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
 * @returns {string} Le texte concatene.
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

/**
 * Appuie sur le DERNIER pressable dont le libelle commence ainsi (le CTA collant).
 * @param {any} arbre
 * @param {string} debutDuLibelle
 * @returns {Promise<void>} Quand le rendu a fini de reagir.
 */
const appuyerSurLeCta = async (arbre, debutDuLibelle) => {
  const cible = arbre.root
    .findAllByType(TouchableOpacity)
    .filter((/** @type {any} */ noeud) => noeud
      .findAllByType(Text)
      .some((/** @type {any} */ texte) => aplatirTexte(texte.props.children)
        .trim()
        .startsWith(debutDuLibelle)))
    .pop();
  if (!cible) {
    throw new Error(`Aucun pressable ne commence par « ${debutDuLibelle} »`);
  }
  await act(async () => { cible.props.onPress(); });
};

/**
 * Va sur la carte Club (index 2 du carrousel : Gratuit, Équipe, Club).
 * @param {any} arbre
 * @returns {Promise<void>}
 */
const allerSurLaCarteClub = async (arbre) => {
  const point = arbre.root
    .findAllByType(TouchableOpacity)
    .find((/** @type {any} */ noeud) => noeud.props.accessibilityLabel === 'Carte 3 sur 3');
  await act(async () => { point.props.onPress(); });
};

/**
 * Monte le carrousel avec le contexte d authentification demande.
 * @param {Record<string, any>} [surcharges]
 * @returns {Promise<any>} L arbre rendu.
 */
const rendre = async (surcharges = {}) => {
  mockAuthValue = contexteAuth(surcharges);
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <SubscriptionOffers navigation={{ navigate: mockNavigate }} route={undefined} />,
    );
  });
  return arbre;
};


/**
 * Le droit CLUB actif d un club, paye par quelqu un, tel que le serveur le rend.
 * @param {string} planCode - l offre qui couvre le club.
 * @param {string} payeurDocumentId - qui la paie.
 * @returns {any} - l entree de `entitlementsSummary`.
 */
const couvertureClub = (planCode, payeurDocumentId) => ({
  capability: '*',
  paidBy: { documentId: payeurDocumentId, firstname: 'Sofiane', lastname: 'B' },
  scopeClubDocumentId: 'club-1',
  scopeTeamDocumentId: null,
  scopeType: 'CLUB',
  status: 'active',
  subscriptionPlanCode: planCode,
});

/**
 * Les pilules de palier Club rendues, avec leur etat.
 * @param {any} arbre - l arbre rendu.
 * @returns {Array<{ desactivee: boolean, libelle: string }>} - une entree par pilule.
 */
const pilulesDePalier = (arbre) => arbre.root
  .findAllByType(TouchableOpacity)
  .filter((/** @type {any} */ noeud) => ['100', '500', '1000', 'illim.'].includes(
    aplatirTexte(noeud.findAllByType(Text)[0]?.props?.children).trim(),
  ))
  .map((/** @type {any} */ noeud) => ({
    desactivee: noeud.props.accessibilityState?.disabled === true,
    libelle: aplatirTexte(noeud.findAllByType(Text)[0]?.props?.children).trim(),
  }));

/**
 * Tout le texte de l ecran, en une chaine.
 * @param {any} arbre - l arbre rendu.
 * @returns {string} - le texte concatene.
 */
const texteDeLEcran = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
  .join(' | ');

beforeEach(() => {
  jest.clearAllMocks();
  mockCatalogQueryState = { data: { data: CATALOG_ENTRIES }, error: null, isLoading: false };
  mockPerformPurchase.mockResolvedValue({ subscription: { currentPeriodEnd: null } });
});

describe('UPGRADE / U5 — un club deja couvert par QUELQU UN D AUTRE', () => {
  it('T6 — couvert en Club 100 : les tranches SUPERIEURES restent tapables, l egale est grisee', async () => {
    const arbre = await rendre({
      entitlementsSummary: [couvertureClub('fc_club_tier_1_yearly', 'user-autre')],
      subscriptionAccessLevel: 'CLUB',
    });
    await allerSurLaCarteClub(arbre);

    expect(pilulesDePalier(arbre)).toEqual([
      { desactivee: true, libelle: '100' },
      { desactivee: false, libelle: '500' },
      { desactivee: false, libelle: '1000' },
      { desactivee: false, libelle: 'illim.' },
    ]);
  });

  it('T6 bis — la MENTION est lisible a l ecran, pas seulement dans le code', async () => {
    const arbre = await rendre({
      entitlementsSummary: [couvertureClub('fc_club_tier_2_yearly', 'user-autre')],
      subscriptionAccessLevel: 'CLUB',
    });
    await allerSurLaCarteClub(arbre);

    expect(texteDeLEcran(arbre)).toContain('Ton club a déjà une offre supérieure');
  });

  it('T6 ter — couvert en Club Illimite : TOUT est grise, y compris l illimite lui-meme', async () => {
    // Le piege du `null` : si le rang de l illimite etait lu comme zero, les
    // trois tranches chiffrees passeraient pour des montees en gamme.
    const arbre = await rendre({
      entitlementsSummary: [couvertureClub('fc_club_tier_4_yearly', 'user-autre')],
      subscriptionAccessLevel: 'CLUB',
    });
    await allerSurLaCarteClub(arbre);

    expect(pilulesDePalier(arbre).every((pilule) => pilule.desactivee)).toBe(true);
    expect(texteDeLEcran(arbre)).toContain('Déjà couvert par ton club');
  });

  it('T6 quater — sans couverture d un tiers, AUCUNE tranche n est grisee', async () => {
    const arbre = await rendre();
    await allerSurLaCarteClub(arbre);

    expect(pilulesDePalier(arbre).some((pilule) => pilule.desactivee)).toBe(false);
    expect(texteDeLEcran(arbre)).not.toContain('Ton club a déjà');
  });

  it('T6 quinquies — MA PROPRE couverture ne grise rien : je change d offre quand je veux', async () => {
    const arbre = await rendre({
      entitlementsSummary: [couvertureClub('fc_club_tier_3_yearly', 'user-1')],
      subscriptionAccessLevel: 'CLUB',
    });
    await allerSurLaCarteClub(arbre);

    expect(pilulesDePalier(arbre).some((pilule) => pilule.desactivee)).toBe(false);
  });

  it('T6 sexies — un CADEAU ne grise rien : il ne fait jamais refuser un paiement', async () => {
    const arbre = await rendre({
      entitlementsSummary: [couvertureClub('fc_trial_club', 'user-autre')],
      subscriptionAccessLevel: 'CLUB',
    });
    await allerSurLaCarteClub(arbre);

    expect(pilulesDePalier(arbre).some((pilule) => pilule.desactivee)).toBe(false);
  });
});

describe('UPGRADE / U6 — ce qui arrive au cadeau si on achete maintenant', () => {
  it('T7 — pendant le cadeau, l ecran dit qu on est debite tout de suite', async () => {
    const arbre = await rendre({
      subscriptionSummary: {
        activePlanCodes: ['fc_trial_club'],
        payerSubscriptionIds: [],
        payerSubscriptionsSummary: [{
          billingPeriod: 'manual',
          currentPeriodEnd: '2026-09-11T10:00:00.000Z',
          documentId: 'sub-cadeau',
          isTrial: true,
          planCode: 'fc_trial_club',
          provider: 'manual',
          status: 'active',
        }],
        teamSlotSummary: {
          assigned: 0, available: 0, coveredTeamDocumentIds: [], total: 0,
        },
      },
    });
    await allerSurLaCarteClub(arbre);

    const texte = texteDeLEcran(arbre);
    expect(texte).toContain('Ton essai gratuit est en cours');
    expect(texte).toContain('11/09/2026');
    expect(texte).toContain('facturée tout de suite');
  });

  it('T7 bis — sans cadeau en cours, cette phrase n apparait PAS', async () => {
    const arbre = await rendre();
    await allerSurLaCarteClub(arbre);

    expect(texteDeLEcran(arbre)).not.toContain('Ton essai gratuit est en cours');
  });
});
