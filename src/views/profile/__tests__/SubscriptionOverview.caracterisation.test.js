import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import SubscriptionOverview from '../SubscriptionOverview';

// L33 (E6) : `SubscriptionOverview.js` faisait 1 929 lignes et n'avait AUCUN
// test, alors qu'il portait six mois de correctifs empiles (R09 quotas, R10
// sablier et avertissement de certification, L08 rafraichissement, L10-A offre
// Club achetable). Ce fichier a d'abord FIGE l'ecran d'origine, puis a suivi la
// refonte en trois ecrans.
//
// CE QUI EN A ETE RETIRE, ET OU C'EST PARTI — rien n'a ete supprime, tout a
// suivi le comportement qu'il decrit :
//   - catalogue, prix, equivalence mensuelle, TEMOIN L10-A (« un dirigeant sans
//     offre a un chemin pour payer »), choix des equipes couvertes, compteurs
//     gratuits  ->  `SubscriptionOffers.test.js` (le carrousel vend desormais) ;
//   - le tag global « 2 mois offerts »  ->  remplace par un badge de remise
//     CALCULE par carte, verifie dans `SubscriptionOffers.test.js` ;
//   - la section « Plans et droits actifs »  ->  fondue dans la carte statut
//     (plan, autres plans, certification, places attribuees), verifiee ici.
// Ce qui reste ici est ce que le HUB montre : gerer, jamais vendre.
//
// Il ne decrit AUCUN pixel : il n'observe que le TEXTE VISIBLE et la navigation.
// Le theme et les traductions sont les VRAIS modules : un mock en Proxy rend les
// echecs Jest illisibles (constat du lot paywall du 2026-08-02).

/** @type {any} */
let mockAuthValue;
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockAlert = jest.fn();
const mockRestorePurchases = jest.fn();
const mockInvalidate = jest.fn();
const mockScheduleRefresh = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutateAsync: (/** @type {any} */ input) => options.mutationFn(input),
  }),
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

jest.mock('@/domains/subscription/subscriptionPurchaseRail', () => ({
  restoreAllSubscriptionPurchases: (/** @type {any} */ ...args) => mockRestorePurchases(...args),
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
    default: () => (
      <TexteRN>
        Prix TTC. Renouvellement automatique, résiliable à tout moment.
      </TexteRN>
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

/**
 * Contexte d'authentification minimal, dans la forme exacte rendue par useAuth.
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

const AUTH_CLUB = {
  subscriptionAccessLevel: 'CLUB',
  subscriptionSummary: {
    activePlanCodes: ['fc_club_tier_1_monthly'],
    payerSubscriptionIds: ['sub-1'],
    teamSlotSummary: {
      assigned: 0, available: 0, coveredTeamDocumentIds: [], total: 0,
    },
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRestorePurchases.mockResolvedValue({ meta: { restoredCount: 1 } });
});

describe('Hub Abonnement — ce que voit un dirigeant en GRATUIT', () => {
  it('annonce son offre gratuite et les trois gestes de gestion', async () => {
    const arbre = await rendre();
    const texte = texteVisible(arbre);

    expect(texte).toContain('Offre gratuite FoundClub');
    expect(texte).toContain('Gratuit');
    expect(texte).toContain('Tu publies en quantité limitée.');
    expect(texte).toContain('Passe à une offre payante pour lever les limites.');
    expect(texte).toContain('Offre');
    expect(texte).toContain("Changer d'offre");
    expect(texte).toContain('Comparer les offres');
    expect(texte).toContain('Restaurer mes achats');
    expect(texte).toContain('Voir mon club');
    expect(texte).toContain('Prix TTC. Renouvellement automatique, résiliable à tout moment.');
  });

  it('GERER, PAS VENDRE — le hub ne porte AUCUN prix ni bouton d\'achat', async () => {
    const arbre = await rendre();
    const texte = texteVisible(arbre);

    // Le pendant du temoin L10-A : la vente a bien quitte cet ecran. Si un prix
    // reapparaissait ici, c'est que le catalogue est revenu s'empiler sur la
    // gestion — exactement le defaut que la refonte supprime.
    expect(texte).not.toContain('€');
    expect(texte).not.toContain('Choisir cette offre');
    expect(texte).not.toContain('Quotas gratuits');
  });
});

describe('Hub Abonnement — ce que voit un dirigeant abonne CLUB', () => {
  it('annonce son plan, sa couverture et sa certification', async () => {
    const arbre = await rendre(AUTH_CLUB);
    const texte = texteVisible(arbre);

    expect(texte).toContain('Club · actif');
    expect(texte).toContain('Toutes les équipes de ton club sont couvertes.');
    expect(texte).toContain('Certification');
    expect(texte).toContain('Club certifié');
  });

  it('annonce la date de renouvellement quand le serveur la donne', async () => {
    const arbre = await rendre({
      ...AUTH_CLUB,
      entitlementsSummary: [
        {
          paidBy: { documentId: 'user-1' },
          scopeType: 'CLUB',
          subscriptionCurrentPeriodEnd: '2026-09-04T00:00:00.000Z',
        },
      ],
    });
    const texte = texteVisible(arbre);

    expect(texte).toContain('Renouvelé le');
    expect(texte).toContain('4 septembre 2026');
  });

  it('nomme les autres plans actifs plutot que de les cacher', async () => {
    const arbre = await rendre({
      ...AUTH_CLUB,
      subscriptionSummary: {
        ...AUTH_CLUB.subscriptionSummary,
        activePlanCodes: ['fc_club_tier_1_monthly', 'fc_team_2_yearly'],
      },
    });

    expect(texteVisible(arbre)).toContain('Autres offres actives : Équipe · 2 équipes / an');
  });

  it('restaure les achats et relit le contexte apres coup (L08)', async () => {
    const arbre = await rendre(AUTH_CLUB);

    await appuyerSur(arbre, 'Restaurer mes achats');

    expect(mockRestorePurchases).toHaveBeenCalled();
    expect(mockScheduleRefresh).toHaveBeenCalled();
    expect(mockInvalidate).toHaveBeenCalled();
  });
});

describe('Hub Abonnement — les trois chemins qui en partent', () => {
  it('« Changer d\'offre » ouvre le CARROUSEL, pas une section de la meme page', async () => {
    const arbre = await rendre();
    await appuyerSur(arbre, "Changer d'offre");

    expect(mockNavigate).toHaveBeenCalledWith('SubscriptionOffers');
  });

  it('« Comparer les offres » ouvre la MATRICE', async () => {
    const arbre = await rendre();
    await appuyerSur(arbre, 'Comparer les offres');

    expect(mockNavigate).toHaveBeenCalledWith('SubscriptionCompare');
  });

  it('« Voir mon club » ouvre la fiche du club rattache', async () => {
    const arbre = await rendre();
    await appuyerSur(arbre, 'Voir mon club');

    expect(mockNavigate).toHaveBeenCalledWith('ClubStack', {
      params: { clubId: 'club-1' },
      screen: 'Club',
    });
  });
});

describe('Hub Abonnement — les deux sorties de secours', () => {
  it('quelqu\'un couvert par un tiers voit le heros dedie, pas la gestion', async () => {
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
    expect(texte).not.toContain("Changer d'offre");
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
