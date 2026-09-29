import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import SubscriptionOverview from '../SubscriptionOverview';

// COLL1D (2026-09-29) — « MON ABONNEMENT » D'UN CLUB RATTACHE A UNE COLLECTIVITE ACTIVE.
//
// SPEC Collectivites §3, §4 (D4, D13) : tant que la collectivite est active, chaque club
// rattache a l'offre Club COMPLETE, sans limite, offerte par elle. L'ecran doit le dire
// clairement — « Offre Club offerte par la Ville de X » — sans date de renouvellement
// ni prix : personne ne paie dans l'app. ROUGE avant le lot : le droit n'avait pas de
// payeur nomme, l'ecran tombait sur « Club · actif » generique (heros « deja couvert »
// muet sans `paidBy`).
//
// Harnais repris de SubscriptionOverview.clubCouvert.test.js (memes doublures), SANS la
// doublure du heros : pilote par le TEXTE VISIBLE.

/** @type {any} */
let mockAuthValue;
const mockNavigate = jest.fn();
const mockReplace = jest.fn();

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

// Les VRAIES traductions, et le vrai i18next pour tout libelle a {{jetons}} :
// c'est lui qui echapperait une apostrophe si l'ecran oubliait SANS_ECHAPPEMENT.
jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ valeurs) => {
        if (
          (typeof repli === 'string' && valeurs)
          || (repli && typeof repli === 'object' && 'defaultValue_one' in repli)
        ) {
          return jest.requireActual('i18next').t(cle, repli, valeurs);
        }
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

jest.mock('@/domains/subscription/useSubscriptionCatalog', () => ({
  useSubscriptionCatalog: () => ({
    entries: [],
    error: null,
    isError: false,
    isLoading: false,
    refetch: jest.fn(),
  }),
}));

jest.mock('@/domains/subscription/subscriptionPurchaseRail', () => ({
  openSubscriptionManagementPortal: jest.fn(),
  performSubscriptionLicenseeIncrease: jest.fn(),
  restoreAllSubscriptionPurchases: jest.fn(),
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
      Images: {
        arrowRight: 1,
        calendar: 1,
        chart: 1,
        check: 1,
        euroCircle: 1,
        search: 1,
        shield: 1,
        users: 1,
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
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: () => <TexteRN>PIED DE PAGE</TexteRN>,
  };
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
 * Monte l'ecran avec le contexte d'authentification donne.
 * @param {any} contexte
 * @returns {Promise<any>}
 */
const rendre = async (contexte) => {
  mockAuthValue = contexte;
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
});

// Le heros « deja couvert » est le VRAI (c'est lui qui dit « offerte par ») : seules ses
// dependances de messagerie et d'avatar sont doublees.
jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ startWhisperChat: jest.fn() }),
}));

jest.mock('@/components/molecules/memberAvatar/MemberAvatar', () => function MemberAvatarMock() {
  return null;
});

const CLUB_AIKI = { documentId: 'club-aiki', name: 'AIKI' };

/**
 * Le droit Club que la Ville de Recette offre a AIKI, tel que le rend
 * `getEntitlementsSummary` (admin, lot 1d) : personne ne paie, la Ville est nommee.
 * @param {Record<string, any>} [surcharges]
 * @returns {any}
 */
const droitOffertParLaVille = (surcharges = {}) => ({
  capability: '*',
  offeredBy: { documentId: 'ville-recette', name: 'Ville de Recette' },
  paidBy: null,
  scopeClubDocumentId: 'club-aiki',
  scopeClubName: 'AIKI',
  scopeTeamDocumentId: null,
  scopeTeamName: null,
  scopeType: 'CLUB',
  status: 'active',
  subscriptionCurrentPeriodEnd: null,
  subscriptionPlanCode: 'fc_collectivite_club',
  ...surcharges,
});

/**
 * Le dirigeant d'AIKI, club rattache a la Ville de Recette, qui ne paie rien lui-meme.
 * @param {Record<string, any>} [surcharges]
 * @returns {any}
 */
const dirigeantDAiki = (surcharges = {}) => ({
  accountSubscriptionAccessLevel: 'CLUB',
  clubVerificationSummary: {
    clubDocumentId: 'club-aiki',
    clubPartner: false,
    clubVerified: true,
    hasActiveClubEntitlement: true,
    legacyIsCustomer: false,
    requiresClubVerification: false,
  },
  entitlementsSummary: [droitOffertParLaVille()],
  subscriptionAccessLevel: 'CLUB',
  subscriptionSummary: {
    activePlanCodes: ['fc_collectivite_club'],
    hasClubPlan: true,
    hasTeamPlan: false,
    hasVerifiedClubPlan: true,
    payerSubscriptionIds: [],
    payerSubscriptionsSummary: [],
    requiresClubVerification: false,
    teamSlotSummary: {
      assigned: 0, available: 0, coveredTeamDocumentIds: [], total: 0,
    },
  },
  userData: {
    club: CLUB_AIKI,
    clubs: [CLUB_AIKI],
    documentId: 'user-dirigeant',
    role: { name: 'Dirigeant', type: 'president' },
  },
  ...surcharges,
});

describe('COLL1D — « Mon abonnement » d un club rattache a une collectivite active', () => {
  it('dit clairement « Offre Club offerte par la Ville de Recette »', async () => {
    const texte = texteVisible(await rendre(dirigeantDAiki()));

    expect(texte).toContain('Offre Club offerte par la Ville de Recette');
    expect(texte).toContain('Tout est débloqué pour toi');
  });

  it('sans date de renouvellement, sans prix, sans bouton de paiement', async () => {
    const arbre = await rendre(dirigeantDAiki());
    const texte = texteVisible(arbre);

    expect(texte).not.toMatch(/renouvel/i);
    expect(texte).not.toMatch(/€|\beur\b/i);
    expect(texte).not.toMatch(/se termine/i);
    expect(pressablesPortant(arbre, 'Comparer les offres')).toHaveLength(0);
    expect(texte).not.toMatch(/Écrire à/);
  });

  it('un cadeau de bienvenue en cours (manual) ne cache pas l offre de la Ville', async () => {
    const texte = texteVisible(await rendre(dirigeantDAiki({
      subscriptionSummary: {
        ...dirigeantDAiki().subscriptionSummary,
        activePlanCodes: ['fc_collectivite_club', 'fc_trial_club'],
        payerSubscriptionIds: ['sub-cadeau'],
        payerSubscriptionsSummary: [{
          autoRenew: false,
          billingPeriod: 'manual',
          currentPeriodEnd: '2026-10-05T00:00:00.000Z',
          documentId: 'sub-cadeau',
          isTrial: true,
          planCode: 'fc_trial_club',
          provider: 'manual',
          scopeClubDocumentIds: ['club-aiki'],
          status: 'active',
        }],
      },
    })));

    expect(texte).toContain('Offre Club offerte par la Ville de Recette');
  });

  it('un dirigeant qui PAIE un abonnement de magasin garde son ecran de gestion', async () => {
    const texte = texteVisible(await rendre(dirigeantDAiki({
      subscriptionSummary: {
        ...dirigeantDAiki().subscriptionSummary,
        activePlanCodes: ['fc_collectivite_club', 'fc_team_1_yearly'],
        hasTeamPlan: true,
        payerSubscriptionIds: ['sub-apple'],
        payerSubscriptionsSummary: [{
          autoRenew: true,
          billingPeriod: 'yearly',
          currentPeriodEnd: '2027-05-01T00:00:00.000Z',
          documentId: 'sub-apple',
          isTrial: false,
          planCode: 'fc_team_1_yearly',
          provider: 'apple',
          scopeClubDocumentIds: [],
          status: 'active',
        }],
      },
    })));

    expect(texte).not.toContain('Offre Club offerte par la Ville de Recette');
  });

  it('un club SANS offre de collectivite (un membre paie) : rien de la Ville', async () => {
    const texte = texteVisible(await rendre(dirigeantDAiki({
      entitlementsSummary: [droitOffertParLaVille({
        offeredBy: null,
        paidBy: { documentId: 'user-tresorier', firstname: 'Paul', lastname: 'Martin' },
        subscriptionCurrentPeriodEnd: '2027-01-01T00:00:00.000Z',
        subscriptionPlanCode: 'fc_club_tier_1_yearly',
      })],
      subscriptionSummary: {
        ...dirigeantDAiki().subscriptionSummary,
        activePlanCodes: ['fc_club_tier_1_yearly'],
      },
    })));

    expect(texte).not.toContain('offerte par');
    expect(texte).toContain('Paul paie pour tout le club');
  });
});
