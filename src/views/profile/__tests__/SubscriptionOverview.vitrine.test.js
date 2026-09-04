import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { getCoveringEntitlement } from '@/domains/subscription/subscriptionDecision';

import SubscriptionOverview from '../SubscriptionOverview';

/**
 * VITRINE / W4 — UN ECRAN QUI EXISTE ET NE PEUT JAMAIS S AFFICHER.
 *
 * L ecran « quelqu un paie deja pour ton club » est protege par une condition
 * du type « si des offres sont actives, on n affiche rien ». Or la liste des
 * offres actives (`subscriptionSummary.activePlanCodes`) est construite serveur
 * a partir de TOUS les droits actifs du compte — y compris ceux payes par
 * quelqu un d autre (subscription-permission.ts, `getSubscriptionSummary`).
 * Etre couvert par le club suffit donc a remplir la liste, et l ecran devient
 * structurellement inatteignable — precisement quand il serait utile.
 *
 * ⚠️ LE FILET EST DANS CE FICHIER : quelqu un qui a bien SON PROPRE abonnement
 * doit continuer a voir son ecran habituel, inchange.
 */

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
  const { View: VueRN } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <VueRN /> };
});

jest.mock('@/views/profile/SubscriptionCoveredHero', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: () => <TexteRN>HEROS DEJA COUVERT</TexteRN>,
  };
});

jest.mock('react-native/Libraries/Alert/Alert', () => {
  const mockModule = { alert: jest.fn() };
  return { ...mockModule, default: mockModule };
});

/**
 * Le contexte d authentification, dans la forme exacte rendue par useAuth.
 * @param {Record<string, any>} [surcharges]
 * @returns {any} Le contexte a servir a l ecran.
 */
const contexteAuth = (surcharges = {}) => ({
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
 * Tout le texte visible de l arbre rendu, concatene.
 * @param {any} arbre
 * @returns {string} Le texte de l ecran.
 */
const texteVisible = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
  .join(' | ');

/**
 * Monte le hub abonnement avec le contexte d authentification demande.
 * @param {Record<string, any>} [surcharges]
 * @returns {Promise<any>} L arbre rendu.
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

// Karim paie l offre Club du club. Moi je ne paie RIEN — mais le serveur me
// compte son plan comme « actif », puisque j en profite.
const COUVERT_PAR_KARIM = {
  entitlementsSummary: [{
    capability: 'all',
    paidBy: { documentId: 'user-2', firstname: 'Karim', lastname: 'B.' },
    scopeClubDocumentId: 'club-1',
    scopeTeamDocumentId: null,
    scopeTeamName: null,
    scopeType: 'CLUB',
    status: 'active',
    subscriptionCurrentPeriodEnd: '2027-07-10T09:00:00.000Z',
    subscriptionPlanCode: 'fc_club_tier_4_yearly',
  }],
  subscriptionAccessLevel: 'CLUB',
  subscriptionSummary: {
    activePlanCodes: ['fc_club_tier_4_yearly'],
    // ⚠️ VIDE : je ne paie rien. C est la seule difference avec le filet.
    payerSubscriptionIds: [],
    teamSlotSummary: {
      assigned: 0, available: 0, coveredTeamDocumentIds: [], total: 0,
    },
  },
};

// Moi, je paie mon propre abonnement Club. Mon ecran ne doit pas bouger.
const MON_PROPRE_ABONNEMENT = {
  entitlementsSummary: [{
    capability: 'all',
    paidBy: { documentId: 'user-1', firstname: 'Adel', lastname: 'F.' },
    scopeClubDocumentId: 'club-1',
    scopeTeamDocumentId: null,
    scopeTeamName: null,
    scopeType: 'CLUB',
    status: 'active',
    subscriptionCurrentPeriodEnd: '2027-07-10T09:00:00.000Z',
    subscriptionPlanCode: 'fc_club_tier_4_yearly',
  }],
  subscriptionAccessLevel: 'CLUB',
  subscriptionSummary: {
    activePlanCodes: ['fc_club_tier_4_yearly'],
    payerSubscriptionIds: ['sub-1'],
    teamSlotSummary: {
      assigned: 0, available: 0, coveredTeamDocumentIds: [], total: 0,
    },
  },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('T5 — l ecran « quelqu un paie deja pour ton club » s affiche', () => {
  it('un club couvert par le paiement d un TIERS ouvre la page heros', async () => {
    const arbre = await rendre(COUVERT_PAR_KARIM);

    expect(texteVisible(arbre)).toContain('HEROS DEJA COUVERT');
  });

  it('LE FILET — quelqu un qui paie SON PROPRE abonnement voit son ecran habituel', async () => {
    const arbre = await rendre(MON_PROPRE_ABONNEMENT);

    expect(texteVisible(arbre)).not.toContain('HEROS DEJA COUVERT');
    // La signature de l ecran habituel du PAYEUR : son offre, son echeance, et
    // le chemin pour en changer.
    expect(texteVisible(arbre)).toContain('Club Illimité');
    expect(texteVisible(arbre)).toContain('10 juillet 2027');
    expect(texteVisible(arbre)).toContain('Changer d\'offre');
  });

  it('le meme calcul, cote selecteur partage : couvert par un tiers = un entitlement nomme', () => {
    expect(getCoveringEntitlement({
      entitlementsSummary: COUVERT_PAR_KARIM.entitlementsSummary,
      subscriptionAccessLevel: 'CLUB',
      subscriptionSummary: COUVERT_PAR_KARIM.subscriptionSummary,
      userDocumentId: 'user-1',
    })).toMatchObject({ paidBy: { firstname: 'Karim' } });
  });

  it('LE FILET du selecteur — je paie moi-meme : personne ne me couvre', () => {
    expect(getCoveringEntitlement({
      entitlementsSummary: MON_PROPRE_ABONNEMENT.entitlementsSummary,
      subscriptionAccessLevel: 'CLUB',
      subscriptionSummary: MON_PROPRE_ABONNEMENT.subscriptionSummary,
      userDocumentId: 'user-1',
    })).toBeNull();
  });
});
