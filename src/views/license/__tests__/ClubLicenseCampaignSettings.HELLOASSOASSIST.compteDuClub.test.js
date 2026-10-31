import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubLicenseCampaignSettings from '../ClubLicenseCampaignSettings';

// HELLOASSOASSIST (31/10/2026) — DEFAUT PROUVE EN PROD (club de test, sandbox) :
// « Verifier la connexion » au vert (compte actif, OAuth et checkout de test
// valides), MAIS l assistant refusait HelloAsso : « HelloAsso non prêt — La
// connexion HelloAsso n est pas encore configurée pour ce club ».
// Cause : l assistant ne lisait l etat du compte que sur
// `campaign.paymentProviderSnapshot`, que le serveur ne remplit que si la
// campagne a DEJA HelloAsso coche. Une campagne neuve n en a jamais.
// Le compte du CLUB arrive desormais avec la liste des campagnes du club
// (`meta.helloAssoAccounts`, admin listCampaigns) : l assistant s y replie.
//
// Point d observation : le meme que ClubLicenseCampaignSettings.steps.test.js,
// les props de `WizardStepLayout` (titre de l etape, « Suivant ») et l alerte.

/** @type {any[]} */
const mockWizardProps = [];

const mockRequeteVide = { data: null, isError: false, isLoading: false };
const mockRequeteListeVide = { data: [], isError: false, isLoading: false };
const mockMutationFigee = { isPending: false, mutate: jest.fn(), mutateAsync: jest.fn() };
const mockInsetsFiges = {
  bottom: 0, left: 0, right: 0, top: 0,
};
const mockClientRequeteFige = { invalidateQueries: jest.fn(), setQueryData: jest.fn() };
const navigationFigee = {
  addListener: () => () => {},
  goBack: jest.fn(),
  navigate: jest.fn(),
  setOptions: jest.fn(),
};

// Ce que renvoie GET /licenses/campaigns?clubId : un club SANS campagne, et
// l etat de son compte HelloAsso. Objets FIGES (voir steps.test.js).
const compteActif = Object.freeze({
  lastError: null,
  readiness: 'webhook_pending',
  scope: 'section',
  status: 'active',
});
const compteEnErreur = Object.freeze({
  lastError: 'invalid_client',
  readiness: 'oauth_failed',
  scope: 'section',
  status: 'error',
});
const compteNonConfigure = Object.freeze({
  lastError: 'Configuration incomplete HelloAsso',
  readiness: 'credentials_missing',
  scope: 'section',
  status: 'not_configured',
});
const listeDuClub = (section) => Object.freeze({
  data: Object.freeze({
    data: [],
    meta: { helloAssoAccounts: { multisport: null, section }, pagination: { total: 0 } },
  }),
  isError: false,
  isLoading: false,
});
const mockListes = {
  absent: listeDuClub(null),
  actif: listeDuClub(compteActif),
  erreur: listeDuClub(compteEnErreur),
  nonConfigure: listeDuClub(compteNonConfigure),
};
/** @type {{ courante: any }} */
const mockListeCourante = { courante: mockListes.absent };

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mockClientRequeteFige,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsetsFiges,
}));

// Le VRAI theme, sans le contexte React qui le porte. Un mock en Proxy rend les
// echecs Jest illisibles (constat du lot paywall, 2026-08-02) et un objet
// invente masquerait un jeton absent.
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
// sans `API_URL` et fait tomber la suite AVANT le premier rendu. On double le
// module ENTIEREMENT, fonctions pures comprises.
jest.mock('@/services/license/licenseQueries', () => ({
  createLicenseCampaign: jest.fn(),
  deleteLicenseDocumentRequest: jest.fn(),
  deleteLicensePricingRule: jest.fn(),
  updateLicenseCampaign: jest.fn(),
  upsertLicenseDocumentRequest: jest.fn(),
  upsertLicensePricingRule: jest.fn(),
  useCurrentLicenseCampaign: () => mockRequeteVide,
  useLicenseCampaign: () => mockRequeteVide,
  useLicenseCampaigns: () => mockListeCourante.courante,
  useLicenseMutation: () => mockMutationFigee,
}));
jest.mock('@/platform/media', () => ({ __esModule: true, default: { pickDocument: jest.fn() } }));

jest.mock('@/services/license/licenseService', () => ({
  connectLicenseHelloAsso: jest.fn(),
}));

jest.mock('@/services/club/clubQueries', () => ({
  useGetClub: () => mockRequeteVide,
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

jest.mock('@/components/templates/ScreenContainer', () => function ScreenContainerMock({ children }) {
  return children;
});

jest.mock('@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet', () => function PaywallMock() {
  return null;
});

// D26 : le tunnel ouvre desormais des feuilles. `BottomModal` tire
// `@gorhom/bottom-sheet`, qui tire `react-native-gesture-handler`, que Jest ne
// sait pas transformer — la suite tombe AVANT le premier rendu. Le hub la
// doublait deja pour la meme raison.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock() {
  return null;
});

jest.mock('@/components/molecules/inputStepper/InputStepper', () => function InputStepperMock() {
  return null;
});

jest.mock('@/components/molecules/dateTimeSelector/DateTimeSelector', () => function DateTimeSelectorMock() {
  return null;
});

jest.mock('@/components/atoms/button/Button', () => function ButtonMock() {
  return null;
});

// La doublure capture les props et rend `null` : le corps de l'etape n'est
// jamais monte. C'est volontaire — ce filet decrit la LISTE, pas le contenu.
jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => function WizardStepLayoutMock(/** @type {any} */ props) {
  mockWizardProps.push(props);
  return null;
});

const tousModesFermes = {
  bank_transfer: false,
  card_physical: false,
  cash: false,
  check: false,
  external_link: false,
  helloasso: false,
};

/**
 * Une campagne NEUVE (aucun `documentId`, donc aucun cliche serveur), HelloAsso
 * coche par le dirigeant. Objet FIGE.
 */
const campagneNeuveHelloAsso = Object.freeze({
  allowInstallments: false,
  defaultAmountCents: 10000,
  endDate: '2027-06-30',
  name: 'Cotisation 2026-2027',
  paymentModes: { ...tousModesFermes, helloasso: true },
  reminderAutomation: { enabled: false },
  seasonLabel: '2026-2027',
  startDate: '2026-09-01',
  targetConfig: { includeAllMembers: true },
});

/**
 * Marche dans le tunnel jusqu au premier blocage et rend les titres traverses.
 * @returns {string[]}
 */
const marcher = () => {
  mockWizardProps.length = 0;
  const route = { params: { campaign: campagneNeuveHelloAsso, clubId: 'club-HA', createNew: true } };
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<ClubLicenseCampaignSettings navigation={navigationFigee} route={route} />);
  });
  /** @type {string[]} */
  const titres = [];
  for (let garde = 0; garde < 40; garde += 1) {
    const props = mockWizardProps[mockWizardProps.length - 1];
    titres.push(props.title);
    if (props.stepIndex >= props.stepCount) break;
    const indexAvant = props.stepIndex;
    act(() => {
      props.onNext();
    });
    if (mockWizardProps[mockWizardProps.length - 1].stepIndex === indexAvant) break;
  }
  act(() => arbre.unmount());
  return titres;
};

describe('HELLOASSOASSIST — l assistant lit le compte HelloAsso du CLUB', () => {
  /** @type {any} */
  let alerte;

  beforeEach(() => {
    alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alerte.mockRestore();
    mockListeCourante.courante = mockListes.absent;
  });

  it('campagne neuve + compte du club actif : HelloAsso passe l etape « Paiement »', () => {
    mockListeCourante.courante = mockListes.actif;

    const titres = marcher();

    expect(alerte).not.toHaveBeenCalledWith('HelloAsso non prêt', expect.anything());
    expect(titres).toContain('Documents');
  });

  it('aucun compte : refus, « pas encore configurée pour ce club »', () => {
    mockListeCourante.courante = mockListes.absent;

    const titres = marcher();

    expect(titres[titres.length - 1]).toBe('Paiement');
    expect(alerte).toHaveBeenCalledWith(
      'HelloAsso non prêt',
      expect.stringMatching(/pas encore configurée pour ce club/),
    );
  });

  it('compte en erreur : refus, avec la raison donnee par HelloAsso', () => {
    mockListeCourante.courante = mockListes.erreur;

    const titres = marcher();

    expect(titres[titres.length - 1]).toBe('Paiement');
    expect(alerte).toHaveBeenCalledWith(
      'HelloAsso non prêt',
      expect.stringMatching(/OAuth HelloAsso en erreur.*invalid_client/),
    );
  });

  it('compte non configure : refus, il manque les identifiants', () => {
    mockListeCourante.courante = mockListes.nonConfigure;

    const titres = marcher();

    expect(titres[titres.length - 1]).toBe('Paiement');
    expect(alerte).toHaveBeenCalledWith(
      'HelloAsso non prêt',
      expect.stringMatching(/Renseigne le slug, le client id et le client secret/),
    );
  });
});
