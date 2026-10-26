/* eslint-disable max-len */
// I18N-1 : le code teste lit ses textes par i18next / t() (replis, interpolation) ;
// ce temoin initialise le VRAI i18next en francais (fr.js + replis), sans rien
// changer a ce qu'il affirme.
import '@/theme/strings';

import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubLicenses from '../ClubLicenses';

// LICRESTECODE (26/10, planche LICRESTE VALIDEE « 5- ok », reponses d'Adel 1a/1b/1c/1d = A) :
// le « Reste a encaisser » du hub des cotisations.
//   E1 — les campagnes ARCHIVEES ne comptent plus (et une ligne le dit) ;
//   1c — les BROUILLONS et les PROGRAMMEES ne comptent pas ;
//   1a — une TERMINEE compte, avec « dont X sur des campagnes terminees » ;
//   E2 — une ligne et une barre PAR DEVISE, la devise qui attend le plus d'abord ;
//        les retards restent UN seul total ;
//   E3 — si le total compte des campagnes absentes des cartes, il le dit ;
//   1b — archiver une campagne ou de l'argent est du previent dans la confirmation.
// Banc repris de ClubLicenses.BH11.campagneEncaissee.test.js (feuille rendue).

/** @type {any} */
let mockAuthContexte;
/** @type {any} */
let mockDonneesAuth;
/** @type {any} */
let mockCampagnesRequete;
/** @type {any} */
let mockCampagneCouranteRequete;
/** @type {any[]} */
const mockBoutons = [];
const mockRequeteVide = { data: null, isError: false, isLoading: false };
const mockMutationFigee = { isPending: false, mutate: jest.fn(), mutateAsync: jest.fn() };
const mockInsetsFiges = {
  bottom: 0, left: 0, right: 0, top: 0,
};

// PERF2 - l ecran importe desormais WithDataWrapper -> SkeletonLoader, qui
// tire MaskedView / LinearGradient / Reanimated : hors sujet dans cette
// suite. Meme mock que les suites EventPublishedShowcase.
jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonLoaderMock() { return null; },
);

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => mockMutationFigee,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsetsFiges,
}));

jest.mock('@/store/appContext', () => ({
  useAppContext: () => mockAuthContexte,
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockDonneesAuth,
}));

// `authUseCases` tire le magasin de session et la navigation : on le double
// entierement plutot que de faire dependre ce filet de la couche de stockage.
jest.mock('@/domains/auth/authUseCases', () => ({
  getUserRoleKey: (/** @type {string} */ nomDeRole) => (
    String(nomDeRole || '').toLowerCase().includes('dirigeant') ? 'president' : 'new'
  ),
}));

// Le VRAI theme, sans le contexte React qui le porte. Un mock en Proxy rend les
// echecs Jest illisibles (constat du lot paywall, 2026-08-02).
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

// ⛔ Jamais `requireActual` sur un service : le client HTTP refuse de se charger
// sans `API_URL` et fait tomber la suite AVANT le premier rendu.
jest.mock('@/services/license/licenseQueries', () => ({
  deleteDraftLicenseCampaign: jest.fn(),
  duplicateLicenseCampaign: jest.fn(),
  sendBulkLicenseReminder: jest.fn(),
  sendLicenseReminder: jest.fn(),
  transitionLicenseCampaign: jest.fn(),
  useCurrentLicenseCampaign: () => mockCampagneCouranteRequete,
  useLicenseAssignments: () => mockRequeteVide,
  useLicenseCampaign: () => mockRequeteVide,
  useLicenseCampaigns: () => mockCampagnesRequete,
  useLicenseDashboard: () => mockRequeteVide,
  /**
   * La mutation de SUPPRESSION est distinguee des autres par sa position : elle
   * est la derniere posee par l ecran (ClubLicenses.js:1036).
   * @returns {any} Une mutation inerte, observable.
   */
  useLicenseMutation: () => mockMutationFigee,
  useLicensePaymentReviews: () => mockRequeteVide,
}));

jest.mock('@/services/auth/authService', () => ({
  switchManagedClub: jest.fn(),
}));

jest.mock('@/services/license/licenseService', () => ({
  connectLicenseHelloAsso: jest.fn(),
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) {
    return children;
  },
);

// ⚠️ LA DIFFERENCE AVEC ClubLicenses.test.js : ici la feuille rend ses enfants.
jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => function BottomModalMock({ children }) {
    return children;
  },
);

jest.mock('@/components/molecules/clubSelector/ClubSelector', () => function ClubSelectorMock() {
  return null;
});

jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => function ProfileAvatarMock() {
  return null;
});

jest.mock(
  '@/components/molecules/segmentedControl/SegmentedControl',
  () => function SegmentedControlMock() {
    return null;
  },
);

jest.mock('../MyLicenses', () => function MyLicensesMock() {
  return null;
});

jest.mock('@/components/atoms/button/Button', () => function ButtonMock(/** @type {any} */ props) {
  mockBoutons.push(props);
  return null;
});

const campagne = (documentId, status, totals, currency = 'EUR') => ({
  currency,
  defaultAmountCents: 12000,
  documentId,
  name: `Campagne ${documentId}`,
  seasonLabel: '2026-2027',
  status,
  totals: {
    expectedCents: 0,
    manualReviewCount: 0,
    overdueCount: 0,
    paidCents: 0,
    remainingCents: 0,
    total: 0,
    ...totals,
  },
});

// Les chiffres de la planche (club de l'exemple).
const LICENCES = campagne('licences', 'active', {
  expectedCents: 1840000, overdueCount: 7, paidCents: 1215000, remainingCents: 625000,
});
const GENEVE = campagne('geneve', 'active', {
  expectedCents: 120000, overdueCount: 1, paidCents: 40000, remainingCents: 80000,
}, 'CHF');
const STAGE_ARCHIVE = campagne('stage', 'archived', {
  expectedCents: 360000, overdueCount: 2, paidCents: 324000, remainingCents: 36000,
});
const SAISON_TERMINEE = campagne('saison', 'closed', {
  expectedCents: 1700000, overdueCount: 3, paidCents: 1646000, remainingCents: 54000,
});

/** @type {any} */
let arbreCourant = null;

const monterLeHub = (campagnes, pagination = null) => {
  mockAuthContexte = [{ auth: { user: { role: { name: 'Dirigeant', type: 'dirigeant' } } } }];
  mockDonneesAuth = {
    activeClubId: 'club-hub',
    clubs: [{ documentId: 'club-hub', name: 'FC Test' }],
    refetchUserData: jest.fn(),
  };
  mockCampagneCouranteRequete = { data: campagnes[0] || null, isError: false, isLoading: false };
  mockCampagnesRequete = {
    data: { data: campagnes, ...(pagination ? { meta: { pagination } } : {}) },
    isError: false,
    isLoading: false,
  };
  const navigation = {
    addListener: () => () => {},
    goBack: jest.fn(),
    navigate: jest.fn(),
    setOptions: jest.fn(),
  };
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <ClubLicenses navigation={navigation} route={{ name: 'ClubLicenses', params: { clubId: 'club-hub' } }} />,
    );
  });
  arbreCourant = arbre;
  return arbre;
};

const espaces = (texte) => String(texte).replace(/[\u00a0\u202f]/g, ' ');

/**
 * Le texte de la carte de synthese, morceau par morceau.
 * @param {any} arbre - L'arbre rendu du hub.
 * @returns {string} Les textes, separes par « | ».
 */
const texteDeLaSynthese = (arbre) => {
  const carte = arbre.root.findAll((noeud) => noeud.props?.testID === 'club-licenses-summary')[0];
  const morceaux = [];
  const lire = (noeud) => {
    if (typeof noeud === 'string') {
      morceaux.push(noeud);
      return;
    }
    (noeud.children || []).forEach(lire);
  };
  lire(carte);
  return espaces(morceaux.join('|'));
};

describe('LICRESTECODE — le Reste à encaisser du hub', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockMutationFigee.mutate.mockClear();
  });

  afterEach(() => {
    Alert.alert.mockRestore();
    if (arbreCourant) act(() => arbreCourant.unmount());
    arbreCourant = null;
  });

  it('E1 — une campagne archivée ne compte plus, et une ligne le dit', () => {
    const texte = texteDeLaSynthese(monterLeHub([LICENCES, STAGE_ARCHIVE]));
    expect(texte).toContain('12 150,00 €');
    expect(texte).toContain('18 400,00 €');
    expect(texte).toContain('6 250,00 €');
    expect(texte).toContain('7 retards');
    expect(texte).toContain('Hors 1 campagne archivée');
    expect(texte).not.toContain('15 390,00 €');
  });

  it('1c — les brouillons et les campagnes programmées ne comptent pas', () => {
    const brouillon = campagne('brouillon', 'draft', { expectedCents: 500000, remainingCents: 500000 });
    const programmee = campagne('prog', 'scheduled', { expectedCents: 300000, overdueCount: 4, remainingCents: 300000 });
    const texte = texteDeLaSynthese(monterLeHub([LICENCES, brouillon, programmee]));
    expect(texte).toContain('18 400,00 €');
    expect(texte).toContain('6 250,00 €');
    expect(texte).toContain('7 retards');
    expect(texte).not.toContain('Hors');
  });

  it('1a — une campagne terminée compte, avec « dont X sur des campagnes terminées »', () => {
    const texte = texteDeLaSynthese(monterLeHub([LICENCES, SAISON_TERMINEE]));
    expect(texte).toContain('28 610,00 €');
    expect(texte).toContain('35 400,00 €');
    expect(texte).toContain('6 790,00 €');
    expect(texte).toContain('10 retards');
    expect(texte).toContain('dont 540,00 € sur des campagnes terminées');
  });

  it('1a — sans argent dû sur une terminée, la mention disparaît', () => {
    const soldee = campagne('soldee', 'closed', { expectedCents: 100000, paidCents: 100000 });
    const texte = texteDeLaSynthese(monterLeHub([LICENCES, soldee]));
    expect(texte).not.toContain('campagnes terminées');
  });

  it('E2 — deux devises : une ligne chacune, jamais additionnées, retards en un seul total', () => {
    const texte = texteDeLaSynthese(monterLeHub([LICENCES, GENEVE, STAGE_ARCHIVE]));
    expect(texte).toContain('12 150,00 €');
    expect(texte).toContain('400,00 CHF');
    expect(texte).toContain('1 200,00 CHF');
    expect(texte).toContain('800,00 CHF');
    expect(texte).toContain('8 retards');
    expect(texte).not.toContain('15 790,00 €');
    expect(texte).not.toContain('12 550,00 €');
    // une barre par devise
    const barres = arbreCourant.root.findAll(
      (noeud) => noeud.props?.accessibilityRole === 'progressbar' && typeof noeud.type === 'string',
    );
    expect(barres).toHaveLength(2);
    // la devise qui attend le plus d'argent d'abord : EUR (18 400) avant CHF (1 200)
    expect(texte.indexOf('EUR')).toBeGreaterThan(-1);
    expect(texte.indexOf('EUR')).toBeLessThan(texte.indexOf('CHF'));
  });

  it('E2 — l’ordre suit l’argent attendu, pas l’ordre de la liste', () => {
    const grosseGeneve = campagne('geneve2', 'active', { expectedCents: 5000000, remainingCents: 5000000 }, 'CHF');
    const texte = texteDeLaSynthese(monterLeHub([LICENCES, grosseGeneve]));
    expect(texte.indexOf('CHF')).toBeLessThan(texte.indexOf('EUR'));
  });

  it('club sans campagne : pas de carte de synthèse, comme avant', () => {
    const arbre = monterLeHub([]);
    expect(arbre.root.findAll((noeud) => noeud.props?.testID === 'club-licenses-summary')).toHaveLength(0);
  });

  it('seulement des brouillons : une carte à « 0,00 € », comme avant', () => {
    const texte = texteDeLaSynthese(monterLeHub([campagne('b', 'draft', { expectedCents: 500000 })]));
    expect(texte).toContain('0,00 €');
    expect(texte).not.toContain('5 000,00 €');
    expect(texte).toContain('Aucun retard');
  });

  it('E3 — le total dit qu’il compte des campagnes absentes des cartes', () => {
    const sept = Array.from({ length: 7 }, (_, index) => campagne(`c${index}`, 'active', {
      expectedCents: 10000, remainingCents: 10000,
    }));
    const texte = texteDeLaSynthese(monterLeHub(sept));
    expect(texte).toContain('700,00 €');
    expect(texte).toContain('Compte aussi 2 campagnes non affichées ci-dessous');
  });

  it('E3 — tout est visible : aucune mention', () => {
    const texte = texteDeLaSynthese(monterLeHub([LICENCES, SAISON_TERMINEE]));
    expect(texte).not.toContain('non affichée');
    expect(texte).not.toContain('Calculé sur');
  });

  it('E3 — le serveur n’a pas tout envoyé : le total le dit', () => {
    const texte = texteDeLaSynthese(monterLeHub([LICENCES], {
      page: 1, pageCount: 2, pageSize: 50, total: 60,
    }));
    expect(texte).toContain('Calculé sur 1 campagne sur 60');
  });
});

describe('LICRESTECODE 1b — archiver une campagne où de l’argent est dû', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockBoutons.length = 0;
  });

  afterEach(() => {
    Alert.alert.mockRestore();
    if (arbreCourant) act(() => arbreCourant.unmount());
    arbreCourant = null;
  });

  const archiver = (laCampagne) => {
    const arbre = monterLeHub([laCampagne]);
    const ouvrirActions = arbre.root.findAll(
      (noeud) => typeof noeud.props?.accessibilityLabel === 'string'
        && noeud.props.accessibilityLabel.startsWith('Autres actions pour la campagne'),
    )[0];
    mockBoutons.length = 0;
    act(() => ouvrirActions.props.onPress());
    const bouton = mockBoutons.find((props) => props.title === 'Archiver');
    act(() => bouton.onPress());
    const appel = Alert.alert.mock.calls.find((call) => call[0] === 'Archiver la campagne');
    return espaces(appel[1]);
  };

  it('la confirmation prévient du montant non encaissé', () => {
    const corps = archiver(SAISON_TERMINEE);
    expect(corps).toContain('Il reste 540,00 € non encaissés. Ils ne compteront plus dans le Reste.');
  });

  it('dans la devise de la campagne', () => {
    const corps = archiver(campagne('chf', 'closed', { expectedCents: 50000, remainingCents: 36000 }, 'CHF'));
    expect(corps).toContain('Il reste 360,00 CHF non encaissés');
  });

  it('rien de dû : la confirmation reste celle d’avant', () => {
    const corps = archiver(campagne('soldee', 'closed', { expectedCents: 50000, paidCents: 50000 }));
    expect(corps).toBe('La campagne restera consultable dans les archives.');
  });
});
