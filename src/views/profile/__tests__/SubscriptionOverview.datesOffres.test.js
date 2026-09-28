import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import SubscriptionOverview from '../SubscriptionOverview';

// ABOCLUB2 (2026-09-28) — CHAQUE OFFRE PORTE SA PROPRE DATE, AVEC LE BON MOT.
//
// Photo « AVANT » de la testeuse, recette du 28/09 au soir
// (`.recette/2026-09-28/T3-bonus-mon-abonnement-AVANT.png`). Le dirigeant d'AIKI a
// DEUX offres : un essai « Aperçu Club » qui couvre AIKI et se termine le 31/10,
// et « Club 100 / an », posee a la main, qui couvre « FoundClub Demo » et n'a
// AUCUNE date de fin. L'ecran affichait :
//   « Club 100 / an · Club · actif … rien n'est bloque … Autres offres actives :
//     Apercu Club (offert) … Renouvele le 31 octobre 2026 »
// ⇒ la date de FIN de l'essai presentee comme un RENOUVELLEMENT du Club 100.
//
// 🧭 D'OU VENAIT LA DATE : la ligne « Renouvele le » prenait le PREMIER droit paye
// par le compte qui portait une echeance (`payerRenewalEntitlement`), sans regarder
// a quelle offre il appartenait ni si elle se renouvelle. Le serveur dit pourtant
// les deux, offre par offre, dans `payerSubscriptionsSummary` (`autoRenew`,
// `isTrial`, `currentPeriodEnd`).
//
// Les dates sont posees a MIDI UTC : le jour affiche ne depend d'aucun fuseau.
// Pilote par le TEXTE VISIBLE, jamais par la forme de l'arbre.

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

jest.mock('@/views/profile/SubscriptionCoveredHero', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: () => <TexteRN>HEROS DEJA COUVERT</TexteRN>,
  };
});

const CLUB_AIKI = { documentId: 'club-aiki', name: "'AIKI-ADVENTURE'." };

/**
 * Un abonnement paye par le compte, tel que le rend `payerSubscriptionsSummary`.
 * @param {Record<string, any>} champs
 * @returns {any}
 */
const abonnementPaye = (champs) => ({
  autoRenew: false,
  billingPeriod: 'yearly',
  currentPeriodEnd: null,
  isTrial: false,
  provider: 'manual',
  status: 'active',
  ...champs,
});

/**
 * Un droit CLUB paye par le compte, tel que le rend `getEntitlementsSummary`.
 * @param {Record<string, any>} champs
 * @returns {any}
 */
const droitClub = (champs) => ({
  capability: 'ALL',
  paidBy: { documentId: 'user-mouri', firstname: 'mouri', lastname: 'nio' },
  scopeTeamDocumentId: null,
  scopeTeamName: null,
  scopeType: 'CLUB',
  status: 'active',
  subscriptionCurrentPeriodEnd: null,
  ...champs,
});

/**
 * Le contexte d'un dirigeant qui regarde depuis AIKI.
 * @param {{ clubCouvert: boolean, droits: any[], planCodes: string[], abonnements: any[] }} decor
 * @returns {any}
 */
const dirigeantAiki = ({
  abonnements, clubCouvert, droits, planCodes,
}) => ({
  clubVerificationSummary: {
    clubDocumentId: 'club-aiki',
    clubPartner: false,
    clubVerified: false,
    hasActiveClubEntitlement: clubCouvert,
    legacyIsCustomer: false,
    requiresClubVerification: clubCouvert,
  },
  entitlementsSummary: droits,
  subscriptionAccessLevel: 'CLUB_UNVERIFIED',
  subscriptionSummary: {
    activePlanCodes: planCodes,
    hasClubPlan: true,
    hasTeamPlan: false,
    hasVerifiedClubPlan: false,
    payerSubscriptionIds: abonnements.map((abonnement) => abonnement.documentId),
    payerSubscriptionsSummary: abonnements,
    requiresClubVerification: true,
    teamSlotSummary: {
      assigned: 0, available: 0, coveredTeamDocumentIds: [], total: 0,
    },
  },
  userData: {
    club: CLUB_AIKI,
    clubs: [CLUB_AIKI],
    documentId: 'user-mouri',
    role: { name: 'Dirigeant', type: 'president' },
  },
});

// La photo du 28/09 au soir, champ pour champ : l'ordre des offres est celui
// du serveur (Club 100 d'abord), l'essai couvre AIKI et finit le 31/10.
const PHOTO_DU_SOIR = dirigeantAiki({
  abonnements: [
    abonnementPaye({ documentId: 'sub-demo', planCode: 'fc_club_tier_1_yearly' }),
    abonnementPaye({
      currentPeriodEnd: '2026-10-31T12:00:00.000Z',
      documentId: 'sub-essai',
      isTrial: true,
      planCode: 'fc_trial_club',
      provider: 'trial',
    }),
  ],
  clubCouvert: true,
  droits: [
    droitClub({
      scopeClubDocumentId: 'club-demo',
      scopeClubName: 'FoundClub Démo',
      subscriptionPlanCode: 'fc_club_tier_1_yearly',
    }),
    droitClub({
      scopeClubDocumentId: 'club-aiki',
      scopeClubName: "'AIKI-ADVENTURE'.",
      subscriptionCurrentPeriodEnd: '2026-10-31T12:00:00.000Z',
      subscriptionPlanCode: 'fc_trial_club',
    }),
  ],
  planCodes: ['fc_club_tier_1_yearly', 'fc_trial_club'],
});

/**
 * Une seule offre PAYANTE qui couvre le club actif.
 * @param {Record<string, any>} abonnement
 * @returns {any}
 */
const offrePayanteSeule = (abonnement) => dirigeantAiki({
  abonnements: [abonnementPaye({
    documentId: 'sub-aiki', planCode: 'fc_club_tier_1_yearly', ...abonnement,
  })],
  clubCouvert: true,
  droits: [droitClub({
    scopeClubDocumentId: 'club-aiki',
    scopeClubName: "'AIKI-ADVENTURE'.",
    subscriptionCurrentPeriodEnd: abonnement.currentPeriodEnd || null,
    subscriptionPlanCode: 'fc_club_tier_1_yearly',
  })],
  planCodes: ['fc_club_tier_1_yearly'],
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
 * Monte l'ecran et rend tout son texte visible, concatene dans l'ordre.
 * @param {any} contexte
 * @returns {Promise<string>}
 */
const texteDeLEcran = async (contexte) => {
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
  return arbre.root
    .findAllByType(Text)
    .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
    .join(' | ');
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ABOCLUB2 — la photo du soir : essai sur AIKI, Club 100 sur Démo', () => {
  it('ne presente plus la fin de l\'essai comme un renouvellement', async () => {
    const texte = await texteDeLEcran(PHOTO_DU_SOIR);

    expect(texte).not.toContain('Renouvelé le');
    expect(texte).not.toContain('renouvelé le');
  });

  it('la carte decrit l\'offre qui couvre AIKI, avec SA date de fin', async () => {
    const texte = await texteDeLEcran(PHOTO_DU_SOIR);

    expect(texte).toContain('Aperçu Club (offert) | Club · actif');
    expect(texte).toContain('Toutes les équipes de ton club sont couvertes.');
    expect(texte).toContain('Se termine le | 31 octobre 2026');
  });

  it('nomme l\'offre payee avec son club, sans date qu\'elle n\'a pas', async () => {
    const texte = await texteDeLEcran(PHOTO_DU_SOIR);

    expect(texte).toContain('Autres offres actives : Club 100 / an (couvre FoundClub Démo)');
    expect(texte).not.toContain('Club 100 / an (couvre FoundClub Démo), ');
  });
});

describe('ABOCLUB2 — chaque offre, son mot', () => {
  it('une offre payee sans renouvellement dit « Se termine le »', async () => {
    const texte = await texteDeLEcran(offrePayanteSeule({
      autoRenew: false,
      currentPeriodEnd: '2027-03-15T12:00:00.000Z',
    }));

    expect(texte).toContain('Club 100 / an | Club · actif');
    expect(texte).toContain('Se termine le | 15 mars 2027');
    expect(texte).not.toContain('Renouvelé le');
  });

  it('une offre sans date n\'affiche aucune date', async () => {
    const texte = await texteDeLEcran(offrePayanteSeule({
      autoRenew: false,
      currentPeriodEnd: null,
    }));

    expect(texte).not.toContain('Renouvelé le');
    expect(texte).not.toContain('Se termine le');
  });

  it('une autre offre qui se renouvelle porte sa date a cote de son nom', async () => {
    const texte = await texteDeLEcran(dirigeantAiki({
      abonnements: [
        abonnementPaye({
          autoRenew: true,
          currentPeriodEnd: '2027-09-04T12:00:00.000Z',
          documentId: 'sub-aiki',
          planCode: 'fc_club_tier_1_yearly',
          provider: 'apple',
        }),
        abonnementPaye({
          autoRenew: true,
          currentPeriodEnd: '2027-01-20T12:00:00.000Z',
          documentId: 'sub-team',
          planCode: 'fc_team_2_yearly',
          provider: 'apple',
        }),
      ],
      clubCouvert: true,
      droits: [droitClub({
        scopeClubDocumentId: 'club-aiki',
        subscriptionCurrentPeriodEnd: '2027-09-04T12:00:00.000Z',
        subscriptionPlanCode: 'fc_club_tier_1_yearly',
      })],
      planCodes: ['fc_club_tier_1_yearly', 'fc_team_2_yearly'],
    }));

    expect(texte).toContain('Renouvelé le | 4 septembre 2027');
    expect(texte).toContain(
      'Autres offres actives : Équipe · 2 équipes / an, renouvelé le 20 janvier 2027',
    );
  });
});

describe('ABOCLUB2 — offre payante seule qui se renouvelle : RIEN ne change', () => {
  it('garde « Renouvelé le » et sa date, sans autre offre', async () => {
    const texte = await texteDeLEcran(offrePayanteSeule({
      autoRenew: true,
      currentPeriodEnd: '2027-09-04T12:00:00.000Z',
      provider: 'apple',
    }));

    expect(texte).toContain('Club 100 / an | Club · actif');
    expect(texte).toContain("Tes droits Club sont actifs sur tout ton club — rien n'est bloqué.");
    expect(texte).toContain('Toutes les équipes de ton club sont couvertes.');
    expect(texte).toContain('Renouvelé le | 4 septembre 2027');
    expect(texte).not.toContain('Se termine le');
    expect(texte).not.toContain('Autres offres actives');
  });
});
