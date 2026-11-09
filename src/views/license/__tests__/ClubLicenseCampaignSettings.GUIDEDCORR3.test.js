// I18N-1 : le vrai i18next en francais (fr.js + replis).
import '@/theme/strings';

import renderer, { act } from 'react-test-renderer';

import ClubLicenseCampaignSettings from '../ClubLicenseCampaignSettings';

// GUIDE-D-CORR-3, M1081 (TestFlight 2.6.97, 09/11), sur le bonus 1 du guide Dirigeant et HORS du
// guide (meme ecran) :
//  (a) « double fleche retour en haut a gauche sur toutes les etapes » : l'en-tete du navigateur
//      (« Parametres cotisations ») ET la barre du tunnel (« Etape n/6 ») ont chacun leur fleche ;
//  (b) « Ajouter une regle », rien rempli, « Terminer » : la regle vide restait dans la liste.
// Banc : celui de `toutLeClub.test.js` (meme doublures), la feuille rendue quand elle est ouverte.

const mockReact = require('react');

/** @type {any} */
let propsDuTunnel = null;

const mockRequeteVide = { data: null, isError: false, isLoading: false };
const mockRequeteListeVide = { data: [], isError: false, isLoading: false };
const mockInsetsFiges = {
  bottom: 0, left: 0, right: 0, top: 0,
};
const mockClientRequeteFige = { invalidateQueries: jest.fn(), setQueryData: jest.fn() };
// Un club de 3 membres : le compte annonce doit etre lisible, pas « 0 ».
const mockClubRequete = {
  data: {
    documentId: 'club-T03',
    members: [
      { documentId: 'u1', firstname: 'Ana', role: { type: 'joueur' } },
      { documentId: 'u2', firstname: 'Bo', role: { type: 'joueur' } },
      { documentId: 'u3', firstname: 'Cy', role: { type: 'entraineur' } },
    ],
  },
  isError: false,
  isLoading: false,
};

const navigationFigee = {
  addListener: () => () => {},
  canGoBack: () => true,
  goBack: jest.fn(),
  navigate: jest.fn(),
  replace: jest.fn(),
  setOptions: jest.fn(),
  setParams: jest.fn(),
};

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mockClientRequeteFige,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsetsFiges,
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
  createLicenseCampaign: jest.fn(async () => ({ documentId: 'camp-T03' })),
  deleteLicenseDocumentRequest: jest.fn(async () => true),
  deleteLicensePricingRule: jest.fn(async () => true),
  updateLicenseCampaign: jest.fn(async () => ({ documentId: 'camp-T03' })),
  upsertLicenseDocumentRequest: jest.fn(async () => true),
  upsertLicensePricingRule: jest.fn(async () => true),
  useCurrentLicenseCampaign: () => mockRequeteVide,
  useLicenseCampaign: () => mockRequeteVide,
  useLicenseCampaigns: () => mockRequeteVide,
  /**
   * Mutation inerte : ce temoin n enregistre rien.
   * @returns {any} La mutation.
   */
  useLicenseMutation: () => ({
    isPending: false,
    mutate: mockReact.useCallback(() => {}, []),
    mutateAsync: mockReact.useCallback(() => Promise.resolve(true), []),
  }),
}));

jest.mock('@/platform/media', () => ({ __esModule: true, default: { pickDocument: jest.fn() } }));

jest.mock('@/services/license/licenseService', () => ({
  connectLicenseHelloAsso: jest.fn(),
}));

jest.mock('@/services/club/clubQueries', () => ({
  useGetClub: () => mockClubRequete,
}));

jest.mock('@/services/section/sectionQueries', () => ({
  useGetSections: () => mockRequeteListeVide,
}));

jest.mock('@/services/category/categoryQueries', () => ({
  useGetCategories: () => mockRequeteListeVide,
}));

jest.mock('@/services/category/categoryService', () => ({
  compareCategories: () => 0,
}));

jest.mock('@/services/level/levelQueries', () => ({
  useGetLevels: () => mockRequeteListeVide,
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) {
    return children;
  },
);

jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => function PaywallMock() {
    return null;
  },
);

/** @type {any[]} */
let mockFeuillesOuvertes = [];

jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock(props) {
  if (!props.isVisible) return null;
  mockFeuillesOuvertes.push(props);
  return props.children;
});

jest.mock('@/components/molecules/inputStepper/InputStepper', () => function InputStepperMock() {
  return null;
});

jest.mock(
  '@/components/molecules/dateTimeSelector/DateTimeSelector',
  () => function DateTimeSelectorMock() {
    return null;
  },
);

jest.mock('@/components/atoms/button/Button', () => function ButtonMock() {
  return null;
});

jest.mock(
  '@/components/molecules/wizardStepLayout/WizardStepLayout',
  () => function WizardStepLayoutMock(props) {
    propsDuTunnel = props;
    return props.children;
  },
);

/** @type {any} */
let arbreCourant = null;

const monterSurLEtapePublic = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <ClubLicenseCampaignSettings
        navigation={navigationFigee}
        route={{ params: { clubId: 'club-T03' } }}
      />,
    );
  });
  arbreCourant = arbre;
  await act(async () => {
    propsDuTunnel.onSkip();
  });
  return arbre;
};

const textesAffiches = (arbre) => arbre.root
  .findAll((noeud) => typeof noeud.type === 'string' && typeof noeud.props?.children === 'string')
  .map((noeud) => noeud.props.children);

const toucherLeTexte = async (arbre, texte) => {
  const pressable = arbre.root.findAll((noeud) => typeof noeud.props?.onPress === 'function'
    && noeud.findAll((enfant) => enfant.props?.children === texte).length > 0);
  expect(pressable.length).toBeGreaterThan(0);
  await act(async () => { pressable[pressable.length - 1].props.onPress(); });
};

const fermerLaFeuille = async () => {
  const feuille = mockFeuillesOuvertes[mockFeuillesOuvertes.length - 1];
  expect(feuille).toBeDefined();
  await act(async () => { feuille.close(); });
};

describe('GUIDE-D-CORR-3 M1081 — tunnel de cotisation', () => {
  beforeEach(() => {
    propsDuTunnel = null;
    mockFeuillesOuvertes = [];
    navigationFigee.setOptions.mockClear();
  });

  afterEach(async () => {
    if (!arbreCourant) return;
    await act(async () => arbreCourant.unmount());
    arbreCourant = null;
  });

  it('(a) une seule fleche : le tunnel masque l en-tete du navigateur', async () => {
    await monterSurLEtapePublic();
    expect(navigationFigee.setOptions).toHaveBeenCalledWith(
      expect.objectContaining({ headerShown: false }),
    );
    expect(typeof propsDuTunnel.onBack).toBe('function');
  }, 30000);

  it('(b) une regle ajoutee puis laissee vide n est pas gardee', async () => {
    const arbre = await monterSurLEtapePublic();
    await toucherLeTexte(arbre, '+ Ajouter une règle');
    await fermerLaFeuille();
    expect(textesAffiches(arbre).join(' | ')).not.toMatch(/1 RÈGLE/);
  }, 30000);

  it('(b) une regle complete reste', async () => {
    const arbre = await monterSurLEtapePublic();
    await toucherLeTexte(arbre, '+ Ajouter une règle');
    const editeur = arbre.root.findAll((noeud) => typeof noeud.props?.onChange === 'function'
      && noeud.props?.item?.localId)[0];
    expect(editeur).toBeDefined();
    await act(async () => { editeur.props.onChange({ amount: '50', roleName: 'joueur' }); });
    await fermerLaFeuille();
    expect(textesAffiches(arbre).join(' | ')).toMatch(/1 RÈGLE/);
  }, 30000);
});
