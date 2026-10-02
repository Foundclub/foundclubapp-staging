/* eslint-disable max-len -- donnees de test : les phrases se lisent mieux sur une ligne */
import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import SubscriptionOverview from '../SubscriptionOverview';

// 🏟️ COLL-C2C (02/10) — « MON ABONNEMENT » QUAND LA VILLE PAIE (planche P8-abonnement-tel, état 1,
// écran 16 ; D63). Qui paie, pour quel club, depuis quand, ce qui est inclus, qui contacter, et ce
// qui se passe si la Ville arrête. Rien à acheter.
//
// Ce que ce témoin exige (ROUGE avant le lot : la page ne portait que le titre et la pastille) :
//   - l écusson de la Ville (son initiale), « Pour AIKI », « Depuis le 1 oct. 2026 » ;
//   - « Ce qui est inclus » (5 lignes, au tu) ; « Une question sur cette offre » (la Ville, pas la
//     boutique) ; « Si la Ville arrête » (texte validé par Adel le 01/10) ;
//   - « Offre » : « Comparer les offres » et « Voir mon club » (Demandes · certification), le pied
//     légal ; JAMAIS « Changer d offre », « Restaurer mes achats », « Gérer ou résilier »,
//     « Augmenter mes licenciés » (il n a rien à acheter ni à résilier).
//
// Harnais repris de SubscriptionOverview.COLL1D.offreCollectivite.test.js (mêmes doublures).

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

const DEPUIS = '2026-10-01T06:00:00.000Z';
const avecDate = () => dirigeantDAiki({
  entitlementsSummary: [droitOffertParLaVille({ offeredBy: { documentId: 'ville-recette', name: 'Ville de Recette', since: DEPUIS } })],
});

describe('COLL-C2C — « Mon abonnement » quand la Ville paie', () => {
  it('l écusson de la Ville, l offre, pour quel club et depuis quand', async () => {
    const arbre = await rendre(avecDate());
    const texte = texteVisible(arbre);
    expect(texte).toContain('R');
    expect(arbre.root.findAll((/** @type {any} */ n) => n.props?.accessibilityLabel === 'Écusson de la Ville de Recette')).not.toHaveLength(0);
    expect(texte).toContain('Offre Club offerte par la Ville de Recette');
    expect(texte).toContain('Toutes les équipes de ton club sont couvertes, sans limite.');
    expect(texte).toContain('Tout est débloqué pour toi');
    expect(texte).toContain('Pour AIKI');
    expect(texte).toContain('Depuis le 1 oct. 2026');
  });

  it('sans date sur le droit, la ligne « Depuis le » ne s invente pas', async () => {
    const texte = texteVisible(await rendre(dirigeantDAiki()));
    expect(texte).toContain('Pour AIKI');
    expect(texte).not.toMatch(/Depuis le/);
  });

  it('ce qui est inclus, qui contacter, et ce qui se passe si la Ville arrête', async () => {
    const texte = texteVisible(await rendre(avecDate()));
    [
      'Ce qui est inclus',
      'Créer tes équipes et ajouter tes membres',
      'Publier tes événements, sans limite',
      'Créer tes campagnes de cotisations',
      'Rechercher des matchs',
      'Communiquer à tous tes licenciés',
      'Une question sur cette offre',
      'Adresse-toi à la Ville de Recette, pas à la boutique.',
      'Si la Ville arrête',
      'Ton club repasse à l’offre gratuite. Tes équipes, membres et événements restent. Tu pourras alors t’abonner toi-même.',
      'PIED DE PAGE',
    ].forEach((ligne) => expect(texte).toContain(ligne));
  });

  it('« Comparer les offres » et « Voir mon club » ; rien à acheter ni à résilier', async () => {
    const arbre = await rendre(avecDate());
    const texte = texteVisible(arbre);
    act(() => { pressablesPortant(arbre, 'Comparer les offres')[0].props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('SubscriptionCompare');
    expect(texte).toContain('Demandes · certification');
    const voirMonClub = arbre.root.findAllByType(TouchableOpacity).find((/** @type {any} */ n) => n.findAllByType(Text)
      .some((/** @type {any} */ t) => aplatirTexte(t.props.children).trim() === 'Voir mon club'));
    act(() => { voirMonClub.props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('ClubStack', expect.objectContaining({ params: { clubId: 'club-aiki' } }));
    ["Changer d'offre", 'Restaurer mes achats', 'Gerer ou resilier mon abonnement', 'Augmenter mes licenciés']
      .forEach((geste) => expect(pressablesPortant(arbre, geste)).toHaveLength(0));
  });
});
