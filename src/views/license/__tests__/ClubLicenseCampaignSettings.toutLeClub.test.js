import renderer, { act } from 'react-test-renderer';

import ClubLicenseCampaignSettings from '../ClubLicenseCampaignSettings';

// T03 (E6) — « QUAND ON CREE UNE CAMPAGNE, TOUT LE CLUB DOIT ETRE COCHE DE
// BASE » (Adel, recette du 2026-08-17).
//
// ⚠️ COCHER PAR DEFAUT, C EST ENGAGER DE L ARGENT POUR TOUT LE MONDE. Deux
// garde-fous vont donc avec, et ils sont testes ici :
//   · le NOMBRE de personnes concernees reste visible avant d enregistrer ;
//   · un seul geste (l interrupteur « Tout le club ») decoche tout.
//
// 🔬 CE QUE LA MESURE A TROUVE, ET C EST UNE INCOHERENCE, PAS UN OUBLI :
// le serveur recoit DEJA « tout le club » quand aucun filtre n est choisi —
// `normalizeTargetConfigPayload` (l. 596) et `buildTargetSummaryPayload`
// (l. 569) envoient tous les deux `includeAllMembers: !hasScopedFilters`.
// Seul le BROUILLON de l ecran disait le contraire :
// `createTargetConfigDraft` posait `includeAllMembers = false` en dur des que la
// campagne ne portait pas explicitement le booleen (l. 320-325).
// ⇒ l interrupteur affichait « non » pendant que la charge utile disait « oui ».
//   On aligne le brouillon sur la regle deja appliquee. Rien ne s elargit :
//   une campagne qui PORTE des filtres garde exactement les siens.
//
// Point d observation : la valeur de l interrupteur « Tout le club », le compte
// annonce a cote, et la presence du selecteur de role.

// Prefixe `mock` : seule facon pour une usine `jest.mock()` d atteindre une
// variable de module (jest autorise nommement ce prefixe).
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
  /**
   * @returns {any} Une mutation inerte : ce temoin n enregistre rien.
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

jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock() {
  return null;
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

/**
 * Monte le tunnel et s arrete sur l etape « Public & tarif ».
 * @param {any} [parametres] - Les parametres de route a poser.
 * @returns {Promise<any>} L arbre monte.
 */
const monterSurLEtapePublic = async (parametres = { clubId: 'club-T03' }) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <ClubLicenseCampaignSettings navigation={navigationFigee} route={{ params: parametres }} />,
    );
  });
  arbreCourant = arbre;

  // L etape « audience » est la 2e du tunnel : un seul saut suffit.
  await act(async () => {
    propsDuTunnel.onSkip();
  });
  return arbre;
};

/**
 * La valeur de l interrupteur « Tout le club ».
 * @param {any} arbre - L arbre monte.
 * @returns {boolean} Ce que l interrupteur affiche.
 */
const interrupteurToutLeClub = (arbre) => {
  const etiquette = arbre.root.findAll((noeud) => (
    typeof noeud.type === 'string' && noeud.props?.children === 'Tout le club'
  ))[0];
  expect(etiquette).toBeDefined();
  // `SwitchRow` est la SEULE rangee a interrupteur de cette etape : on prend
  // donc l unique `onValueChange` de l arbre, plutot que de remonter a une
  // profondeur de parents qui bougerait au premier remaniement du JSX.
  const interrupteurs = arbre.root.findAll((noeud) => (
    typeof noeud.props?.onValueChange === 'function' && 'value' in noeud.props
  ));
  expect(interrupteurs).toHaveLength(1);
  return interrupteurs[0].props.value;
};

/**
 * Les textes affiches sur l etape, a plat.
 * @param {any} arbre - L arbre monte.
 * @returns {string[]} Les textes.
 */
const textesAffiches = (arbre) => arbre.root
  .findAll((noeud) => typeof noeud.type === 'string' && typeof noeud.props?.children === 'string')
  .map((noeud) => noeud.props.children);

describe('T03 — a la creation, tout le club est concerne par defaut', () => {
  beforeEach(() => {
    propsDuTunnel = null;
  });

  afterEach(async () => {
    if (!arbreCourant) return;
    await act(async () => arbreCourant.unmount());
    arbreCourant = null;
  });

  it('temoin 1 — une campagne NEUVE arrive avec « Tout le club » deja coche', async () => {
    const arbre = await monterSurLEtapePublic();

    expect(interrupteurToutLeClub(arbre)).toBe(true);
  }, 30000);

  it('temoin 2 — le NOMBRE de personnes engagees est visible avant d enregistrer', async () => {
    const arbre = await monterSurLEtapePublic();

    // 3 membres au club : c est ce compte-la qu il faut lire AVANT de signer.
    expect(textesAffiches(arbre)).toContain('3 membres concernés aujourd hui');
  }, 30000);

  it('temoin 3 — cocher par defaut ne cache pas le choix : le selecteur de role reste a un geste', async () => {
    const arbre = await monterSurLEtapePublic();

    // Tant que « Tout le club » est coche, le detail par role est replie.
    expect(textesAffiches(arbre)).not.toContain('RÔLE CONCERNÉ');
    expect(textesAffiches(arbre)).toContain(
      'Désactive pour cibler un rôle : dirigeants, entraîneurs, ou joueurs par équipes.',
    );
  }, 30000);

  it('temoin 4 — 🔒 une campagne qui CIBLE deja des roles n est jamais elargie', async () => {
    const arbre = await monterSurLEtapePublic({
      campaign: {
        currency: 'EUR',
        defaultAmountCents: 9000,
        name: 'Cotisation joueurs',
        // Le cas dangereux : aucun `includeAllMembers` stocke, mais des filtres.
        targetConfig: { roles: ['joueur'] },
      },
      clubId: 'club-T03',
    });

    expect(interrupteurToutLeClub(arbre)).toBe(false);
    expect(textesAffiches(arbre)).toContain('RÔLE CONCERNÉ');
  }, 30000);
});
