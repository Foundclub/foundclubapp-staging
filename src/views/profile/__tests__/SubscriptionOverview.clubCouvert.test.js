import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import SubscriptionOverview from '../SubscriptionOverview';

// ABOCLUB (2026-09-28) — « MON ABONNEMENT » DOIT DIRE QUEL CLUB EST COUVERT.
//
// Constat de la recette sur emulateur du 28/09 (defaut 1) : le compte de
// recette dirige le club AIKI et PAIE une offre Club active
// (`fc_club_tier_1_yearly`), mais le droit CLUB de cette offre couvre un AUTRE
// club, « FoundClub Demo ». Le serveur refuse donc a juste titre de publier une
// convocation dans AIKI (403 SUBSCRIPTION_REQUIRED). Et pendant ce temps, cet
// ecran affichait : « Club · actif — rien n'est bloque. Toutes les equipes de
// ton club sont couvertes. » C'est FAUX pour le club affiche.
//
// 🧭 D'OU VENAIT LA PHRASE : `subscriptionAccessLevel` vaut `CLUB_UNVERIFIED`
// des que le COMPTE a un droit Club QUELCONQUE et que SON club actif n'est pas
// certifie (`getSubscriptionSummary`, admin subscription-permission.ts :
// `requiresClubVerification: hasActiveClubEntitlement && !clubVerified`). Rien
// ne verifie que ce droit couvre le club actif. Le serveur le calcule pourtant,
// club par club : `clubVerificationSummary.hasActiveClubEntitlement` ne regarde
// QUE le club actif (`getClubPlanState(user.club)`).
//
// Le decor reproduit la base de recette, champ pour champ, telle que le chef
// d'orchestre l'a lue le 28/09. Le nom du club AIKI est garde tel quel, avec
// son apostrophe : une interpolation qui echapperait le texte l'afficherait en
// `&#39;` (voir la memoire « i18next echappe »).
//
// Pilote par le TEXTE VISIBLE et la navigation, jamais par la forme de l'arbre.

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

const NOM_AIKI = "'AIKI-ADVENTURE'.";
const NOM_DEMO = 'FoundClub Démo';

const CLUB_AIKI = { documentId: 'club-aiki', name: NOM_AIKI };
const CLUB_DEMO = { documentId: 'club-demo', name: NOM_DEMO };

/**
 * Le droit CLUB paye par le compte de recette, tel que le rend
 * `getEntitlementsSummary` : il couvre Demo, pas AIKI.
 * @param {Record<string, any>} [surcharges]
 * @returns {any}
 */
const droitClubDemo = (surcharges = {}) => ({
  capability: 'ALL',
  paidBy: { documentId: 'user-mouri', firstname: 'mouri', lastname: 'nio' },
  scopeClubDocumentId: 'club-demo',
  scopeClubName: NOM_DEMO,
  scopeTeamDocumentId: null,
  scopeTeamName: null,
  scopeType: 'CLUB',
  status: 'active',
  subscriptionCurrentPeriodEnd: '2027-09-10T00:00:00.000Z',
  subscriptionPlanCode: 'fc_club_tier_1_yearly',
  ...surcharges,
});

/**
 * Le payeur qui regarde depuis AIKI, alors que son offre couvre Demo.
 * @param {Record<string, any>} [surcharges]
 * @returns {any}
 */
const payeurDepuisAiki = (surcharges = {}) => ({
  clubVerificationSummary: {
    clubDocumentId: 'club-aiki',
    clubPartner: false,
    clubVerified: false,
    // Calcule par le serveur pour le club ACTIF seulement (getClubPlanState).
    hasActiveClubEntitlement: false,
    legacyIsCustomer: false,
    requiresClubVerification: false,
  },
  entitlementsSummary: [droitClubDemo()],
  // Ce que calcule `getSubscriptionAccessLevel` a partir du resume ci-dessous.
  subscriptionAccessLevel: 'CLUB_UNVERIFIED',
  subscriptionSummary: {
    activePlanCodes: ['fc_club_tier_1_yearly'],
    hasClubPlan: true,
    hasTeamPlan: false,
    hasVerifiedClubPlan: false,
    payerSubscriptionIds: ['sub-demo'],
    payerSubscriptionsSummary: [{
      autoRenew: false,
      billingPeriod: 'yearly',
      currentPeriodEnd: '2027-09-10T00:00:00.000Z',
      documentId: 'sub-demo',
      isTrial: false,
      planCode: 'fc_club_tier_1_yearly',
      provider: 'manual',
      status: 'active',
    }],
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
  ...surcharges,
});

/**
 * Le meme payeur, quand son offre couvre bien le club qu'il regarde.
 * @returns {any}
 */
const payeurDepuisSonClubCouvert = () => payeurDepuisAiki({
  clubVerificationSummary: {
    clubDocumentId: 'club-aiki',
    clubPartner: false,
    clubVerified: false,
    hasActiveClubEntitlement: true,
    legacyIsCustomer: false,
    requiresClubVerification: true,
  },
  entitlementsSummary: [
    droitClubDemo({ scopeClubDocumentId: 'club-aiki', scopeClubName: NOM_AIKI }),
  ],
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

describe('ABOCLUB — le payeur regarde depuis un club que son offre NE couvre PAS', () => {
  it('ne dit plus « rien n\'est bloqué » ni « toutes les équipes … couvertes »', async () => {
    const texte = texteVisible(await rendre(payeurDepuisAiki()));

    expect(texte).not.toContain("rien n'est bloqué");
    expect(texte).not.toContain('Toutes les équipes de ton club sont couvertes.');
    expect(texte).not.toContain('Ton club est en cours de certification');
  });

  it('nomme le club couvert et dit que le club actif ne l\'est pas', async () => {
    const texte = texteVisible(await rendre(payeurDepuisAiki()));

    expect(texte).toContain(`Couvre : ${NOM_DEMO}`);
    expect(texte).toContain(`Ton club ${NOM_AIKI} n'est pas couvert par cette offre.`);
  });

  it('garde le nom de ce qu\'il paie : l\'offre existe, elle est ailleurs', async () => {
    const texte = texteVisible(await rendre(payeurDepuisAiki()));

    expect(texte).toContain('Club 100 / an');
  });

  it('retrouve le nom du club couvert dans SES clubs si le serveur ne le donne pas', async () => {
    // Un serveur d'avant ABOCLUB ne rend que `scopeClubDocumentId`.
    const texte = texteVisible(await rendre(payeurDepuisAiki({
      entitlementsSummary: [droitClubDemo({ scopeClubName: undefined })],
      userData: {
        club: CLUB_AIKI,
        clubs: [CLUB_AIKI, CLUB_DEMO],
        documentId: 'user-mouri',
        role: { name: 'Dirigeant', type: 'president' },
      },
    })));

    expect(texte).toContain(`Couvre : ${NOM_DEMO}`);
  });

  it('dit « un autre club » sans inventer de nom quand personne ne le connait', async () => {
    const texte = texteVisible(await rendre(payeurDepuisAiki({
      entitlementsSummary: [droitClubDemo({ scopeClubName: undefined })],
    })));

    expect(texte).toContain('Cette offre couvre un autre club.');
    expect(texte).not.toContain('Couvre : ');
    expect(texte).not.toContain('Toutes les équipes de ton club sont couvertes.');
  });

  it('propose de changer de club actif quand le club couvert est l\'un des siens', async () => {
    const arbre = await rendre(payeurDepuisAiki({
      userData: {
        club: CLUB_AIKI,
        clubs: [CLUB_AIKI, CLUB_DEMO],
        documentId: 'user-mouri',
        role: { name: 'Dirigeant', type: 'president' },
      },
    }));

    const rangees = pressablesPortant(arbre, 'Changer de club actif');
    expect(rangees.length).toBeGreaterThan(0);
    await act(async () => {
      rangees[0].props.onPress();
    });

    // La fiche du club ACTIF porte le selecteur de club (ClubDetails, des 2 clubs) :
    // l'ouvrir sur le club couvert l'y afficherait deja « actif », sans rien basculer.
    expect(mockNavigate).toHaveBeenCalledWith('ClubStack', {
      params: { clubId: 'club-aiki' },
      screen: 'Club',
    });
  });

  it('ne propose PAS de changer de club quand il n\'a qu\'un club', async () => {
    const arbre = await rendre(payeurDepuisAiki());

    expect(pressablesPortant(arbre, 'Changer de club actif')).toHaveLength(0);
  });
});

describe('ABOCLUB — l\'offre couvre le club actif : RIEN ne change', () => {
  it('garde mot pour mot le texte d\'un club couvert en cours de certification', async () => {
    const texte = texteVisible(await rendre(payeurDepuisSonClubCouvert()));

    expect(texte).toContain('Club 100 / an');
    expect(texte).toContain('Club · actif');
    expect(texte).toContain("Tes droits Club sont actifs sur tout ton club — rien n'est bloqué.");
    expect(texte).toContain('Toutes les équipes de ton club sont couvertes.');
    expect(texte).not.toContain("n'est pas couvert par cette offre");
    expect(texte).not.toContain('Couvre : ');
  });

  it('ne dit rien de neuf si le serveur ne dit pas quel club est couvert', async () => {
    // Sans preuve, pas d'accusation : un droit sans `scopeClubDocumentId` et un
    // resume sans `hasActiveClubEntitlement` gardent l'ecran d'avant.
    const texte = texteVisible(await rendre(payeurDepuisAiki({
      clubVerificationSummary: {
        clubDocumentId: 'club-aiki',
        clubVerified: false,
        requiresClubVerification: true,
      },
      entitlementsSummary: [droitClubDemo({ scopeClubDocumentId: null, scopeClubName: null })],
    })));

    expect(texte).toContain('Toutes les équipes de ton club sont couvertes.');
    expect(texte).not.toContain("n'est pas couvert par cette offre");
  });
});

// ABOPARCLUB (2026-09-29) — PIEGE A. Depuis la decision « niveau oui »,
// `useAuth` rend le niveau du club AFFICHE : GRATUIT dans AIKI. Les decors
// ci-dessus posent ce niveau A LA MAIN (piege c) ; celui-ci pose les DEUX
// valeurs que rend desormais le vrai hook, et mesure que l'ecran qui gere
// l'offre lit toujours ce que le compte PAIE.
describe('ABOPARCLUB — niveau du club affiche GRATUIT : l ecran garde l offre payee', () => {
  const depuisAikiApresLeLot = () => payeurDepuisAiki({
    accountSubscriptionAccessLevel: 'CLUB_UNVERIFIED',
    subscriptionAccessLevel: 'FREE',
  });

  it('le Club 100 paye reste a l ecran, avec le club qu il couvre et celui qu il ne couvre pas', async () => {
    const texte = texteVisible(await rendre(depuisAikiApresLeLot()));

    expect(texte).toContain('Club 100 / an');
    expect(texte).toContain(`Couvre : ${NOM_DEMO}`);
    expect(texte).toContain(`Ton club ${NOM_AIKI} n'est pas couvert par cette offre.`);
    expect(texte).not.toContain('Offre gratuite FoundClub');
  });
});
