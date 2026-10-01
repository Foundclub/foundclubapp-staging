import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Profile from '../Profile';

// ABOCLUB (2026-09-28) — LA CARTE « MON ABONNEMENT » DU PROFIL, porte d'entree
// de l'ecran Abonnement, portait le meme mensonge que lui : « Club · actif —
// Tes droits Club sont actifs. Ton club est en cours de certification par la
// plateforme. » pour un dirigeant dont l'offre Club couvre un AUTRE club que
// celui qu'il regarde. Voir `SubscriptionOverview.clubCouvert.test.js` pour le
// constat de recette et l'origine du niveau `CLUB_UNVERIFIED`.
//
// Pilote par le TEXTE VISIBLE, et `t` resout dans le VRAI `fr.js`.

/** @type {any} */
let mockAuthValue;

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
}));

jest.mock('react-native-gesture-handler', () => ({
  ScrollView: jest.requireActual('react-native').ScrollView,
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: jest.fn() }),
}));

jest.mock('react-i18next', () => {
  const catalogue = jest.requireActual('@/theme/strings/translations/fr').default;

  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ valeurs) => {
        if (typeof repli === 'string' && valeurs) {
          return jest.requireActual('i18next').t(cle, repli, valeurs);
        }
        const valeur = String(cle || '')
          .split('.')
          .reduce((noeud, segment) => (noeud == null ? undefined : noeud[segment]), catalogue);
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

jest.mock('@/store/appContext', () => ({
  useAppContext: () => [{ fcmToken: 'token-test' }, jest.fn()],
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
      Images: {},
      Spaces: espaces,
    }),
  };
});

// COLLECTIVITES 1c — Profil lit `/collectivites/mine` (la porte « Ma collectivite ») :
// doublure, comme tout service que l ecran importe (le client HTTP ne se charge pas ici).
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useMyCollectivites: () => ({ data: [] }),
}));

jest.mock('@/services/auth/authService', () => ({
  deleteAccount: jest.fn(),
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);

jest.mock(
  '@/components/molecules/withDataWrapper/WithDataWrapper',
  () => function WithDataWrapperMock({ children }) { return children; },
);

jest.mock(
  '@/components/molecules/onboardingWrapper/OnboardingWrapper',
  () => function OnboardingWrapperMock({ children }) { return children; },
);

jest.mock(
  '@/components/molecules/tutorial/TutorialFlowBoundary',
  () => function TutorialFlowBoundaryMock({ children }) { return children; },
);

jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => function BottomModalMock() { return null; },
);

jest.mock(
  '@/components/molecules/profileAvatar/ProfileAvatar',
  () => function ProfileAvatarMock() { return null; },
);

jest.mock(
  '@/components/molecules/clubLogoMark/ClubLogoMark',
  () => function ClubLogoMarkMock() { return null; },
);

jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');

  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled, onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

const NOM_AIKI = "'AIKI-ADVENTURE'.";
const NOM_DEMO = 'FoundClub Démo';
const CLUB_AIKI = { documentId: 'club-aiki', name: NOM_AIKI };

/**
 * Le contexte d'authentification du dirigeant d'AIKI qui paie une offre Club.
 * @param {{ couvreLeClubActif: boolean }} options
 * @returns {any}
 */
const contexteAuth = ({ couvreLeClubActif }) => ({
  addAccount: jest.fn(),
  authSessions: [],
  canEditClub: () => false,
  canManageTeam: () => false,
  clubVerificationSummary: {
    clubDocumentId: 'club-aiki',
    clubVerified: false,
    hasActiveClubEntitlement: couvreLeClubActif,
    requiresClubVerification: couvreLeClubActif,
  },
  entitlementsSummary: [{
    paidBy: { documentId: 'user-mouri', firstname: 'mouri' },
    scopeClubDocumentId: couvreLeClubActif ? 'club-aiki' : 'club-demo',
    scopeClubName: couvreLeClubActif ? NOM_AIKI : NOM_DEMO,
    scopeType: 'CLUB',
    status: 'active',
    subscriptionPlanCode: 'fc_club_tier_1_yearly',
  }],
  freeUsageSummary: null,
  logoutMutation: { mutate: jest.fn() },
  refetchUserData: jest.fn(),
  subscriptionAccessLevel: 'CLUB_UNVERIFIED',
  switchAccount: jest.fn(),
  userData: {
    club: CLUB_AIKI,
    clubs: [CLUB_AIKI],
    documentId: 'user-mouri',
    firstname: 'mouri',
    lastname: 'nio',
    multisportClubs: [],
    role: { name: 'Dirigeant', type: 'president' },
  },
  userDataError: null,
  userDataLoading: false,
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
 * Monte « Mon compte » et rend tout son texte visible, puis le demonte.
 * @param {{ couvreLeClubActif: boolean }} options
 * @returns {Promise<string>}
 */
const texteDuProfil = async (options) => {
  mockAuthValue = contexteAuth(options);
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <Profile navigation={{ navigate: jest.fn(), setParams: jest.fn() }} route={{ params: {} }} />,
    );
  });
  const texte = arbre.root
    .findAllByType(Text)
    .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
    .join(' | ');
  act(() => {
    arbre.unmount();
  });
  return texte;
};

describe('ABOCLUB — carte « Mon abonnement » du Profil', () => {
  it('dit que le club actif n\'est pas couvert, et nomme celui qui l\'est', async () => {
    const texte = await texteDuProfil({ couvreLeClubActif: false });

    expect(texte).not.toContain('Tes droits Club sont actifs.');
    expect(texte).not.toContain('Ton club est en cours de certification');
    // Recette du 29/09 (tournee 4) : le nom finit deja par un point, la phrase
    // n'en ajoute pas un second (« 'AIKI-ADVENTURE'.. »).
    expect(texte).toContain(`Ton offre Club couvre ${NOM_DEMO}, pas ton club ${NOM_AIKI}`);
    expect(texte).not.toContain(`${NOM_AIKI}.`);
  });

  // TEXTES-COLLECTIVITES (point 7 du chef, 01/10) : la phrase « Tes droits Club sont actifs.
  // Ton club est en cours de certification » valait pour un essai, une offre payée et une
  // offre de la Ville. Elle nomme désormais QUI PAIE ; la certification reste dite.
  it('l offre couvre le club actif : la carte dit qui paie (ici, le club)', async () => {
    const texte = await texteDuProfil({ couvreLeClubActif: true });

    expect(texte).toContain('Club · actif');
    expect(texte).toContain(
      'Payé par ton club. Ton club est en cours de certification par la plateforme.',
    );
    expect(texte).not.toContain('pas ton club');
  });
});

// ABOPARCLUB (2026-09-29) — PIEGE A, cote Profil. Le vrai `useAuth` rend
// desormais DEUX niveaux : GRATUIT pour le club affiche (AIKI), « Club » pour
// ce que le compte paie. La carte doit montrer les deux : les compteurs gratuits
// d'AIKI, ET la phrase qui dit ou s'applique l'offre payee.
describe('ABOPARCLUB — carte « Mon abonnement » quand le club affiche est gratuit', () => {
  it('puce = etat d AIKI, phrase « couvre Demo, pas AIKI » (un seul point), et compteurs d AIKI', async () => {
    mockAuthValue = {
      ...contexteAuth({ couvreLeClubActif: false }),
      accountSubscriptionAccessLevel: 'CLUB_UNVERIFIED',
      freeUsageSummary: [{
        limit: 1, quotaType: 'EVENT_PUBLISH', remaining: 1, used: 0,
      }],
      subscriptionAccessLevel: 'FREE',
    };
    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(
        <Profile navigation={{ navigate: jest.fn(), setParams: jest.fn() }} route={{ params: {} }} />,
      );
    });
    const texte = arbre.root
      .findAllByType(Text)
      .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
      .join(' | ');
    act(() => {
      arbre.unmount();
    });

    // Recette du 29/09 (tournee 4) : le badge dit l'etat d'AIKI (gratuit), plus
    // « Club · actif » a cote de « pas ton club » ; et un seul point final.
    expect(texte).toContain('Gratuit');
    expect(texte).not.toContain('Club · actif');
    expect(texte).toContain(`Ton offre Club couvre ${NOM_DEMO}, pas ton club ${NOM_AIKI}`);
    expect(texte).not.toContain(`${NOM_AIKI}.`);
    expect(texte).toContain('Événements');
  });
});

// TEXTES-COLLECTIVITES (lot 1, 01/10/2026) — quand l offre Club du club vient de la VILLE,
// la carte « Mon abonnement » ne le disait pas : « Club · actif — Tes droits Club sont actifs.
// Ton club est en cours de certification » (capture B1b, Karim en dirigeant, 01/10). Le
// serveur NOMME la collectivite sur le droit (`entitlementsSummary[].offeredBy`, lot 1d) :
// la carte le dit, au « tu » (c est un club qui lit).
// eslint-disable-next-line max-len
describe('TEXTES-COLLECTIVITES — carte « Mon abonnement » quand la Ville offre l offre Club', () => {
  // eslint-disable-next-line max-len
  const OFFERT_PAR_LA_VILLE = 'Offert par la Ville de Montrivage : toutes les équipes de ton club sont couvertes.';

  // eslint-disable-next-line max-len
  it('dit « Offert par la Ville de Montrivage », et plus « en cours de certification »', async () => {
    mockAuthValue = contexteAuth({ couvreLeClubActif: true });
    mockAuthValue.entitlementsSummary = [{
      ...mockAuthValue.entitlementsSummary[0],
      offeredBy: { documentId: 'ville-montrivage', name: 'Ville de Montrivage' },
      paidBy: null,
      subscriptionPlanCode: 'fc_collectivite_club',
    }];
    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(
        // eslint-disable-next-line max-len
        <Profile navigation={{ navigate: jest.fn(), setParams: jest.fn() }} route={{ params: {} }} />,
      );
    });
    const texte = arbre.root
      .findAllByType(Text)
      .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
      .join(' | ');
    act(() => {
      arbre.unmount();
    });

    expect(texte).toContain('Club · actif');
    expect(texte).toContain(OFFERT_PAR_LA_VILLE);
    expect(texte).not.toContain('en cours de certification');
  });

  it('une offre que le club PAIE lui-même : « Payé par ton club », sans Ville', async () => {
    const texte = await texteDuProfil({ couvreLeClubActif: true });
    expect(texte).toContain('Payé par ton club');
    expect(texte).not.toContain('Offert par');
  });

  it('un ESSAI : « Essai Club jusqu’au … », jamais « offert » ni « certification »', async () => {
    mockAuthValue = contexteAuth({ couvreLeClubActif: true });
    mockAuthValue.entitlementsSummary = [{
      ...mockAuthValue.entitlementsSummary[0],
      subscriptionPlanCode: 'fc_trial_club',
    }];
    mockAuthValue.subscriptionSummary = {
      payerSubscriptionsSummary: [{
        // eslint-disable-next-line max-len
        currentPeriodEnd: '2026-10-08T10:00:00.000Z', isTrial: true, planCode: 'fc_trial_club', status: 'active',
      }],
    };
    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(
        // eslint-disable-next-line max-len
        <Profile navigation={{ navigate: jest.fn(), setParams: jest.fn() }} route={{ params: {} }} />,
      );
    });
    const texte = arbre.root
      .findAllByType(Text)
      .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
      .join(' | ');
    act(() => {
      arbre.unmount();
    });

    // Le mois suit la langue de l app (date-fns) : seul le jour est fige ici.
    expect(texte).toMatch(/Essai Club jusqu’au 8 \S+\./);
    expect(texte).not.toContain('offert');
    expect(texte).not.toContain('en cours de certification');
  });
});
