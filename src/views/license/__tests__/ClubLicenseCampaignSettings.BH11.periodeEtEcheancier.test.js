/* eslint-disable max-len */
import renderer, { act } from 'react-test-renderer';

import ClubLicenseCampaignSettings from '../ClubLicenseCampaignSettings';

// R01 (E6) — TEMOIN N°1, CELUI QUI COMPTE : CREER UNE CAMPAGNE N EN DETRUIT AUCUNE AUTRE.
//
// Constat d'Adel en recette le 2026-08-13 : « j'ai cree une nouvelle campagne,
// ca m'a supprime celle qui etait deja existante ».
//
// 🔬 CE QUI SE PASSAIT VRAIMENT — mesure du 2026-08-13, aucune ligne n a jamais
// ete supprimee. Le serveur ne supprime rien a la creation : `createCampaign`
// (admin/src/api/license/services/license.ts:2241-2271) n a ni `delete` ni
// fermeture automatique — il REFUSE meme un doublon (l. 2249). L ancienne
// campagne n a pas ete effacee : elle a ete ECRASEE SUR PLACE.
//
// La chaine exacte, dans CET ecran :
//   1. le hub « + Nouvelle campagne » navigue avec `{ clubId }` SEUL
//      (ClubLicenses.js:2190) — ni `campaignId`, ni `createNew` ;
//   2. `createNewCampaign` vaut donc `false`, et `campaignQuery` va chercher
//      LA CAMPAGNE COURANTE du club ;
//   3. `campaignId` retombe sur elle, et la sauvegarde part en
//      `updateLicenseCampaign(campaignId, ...)` — un PUT sur l ANCIENNE.
// ⇒ le dirigeant croit creer, il RENOMME. Une seule campagne subsiste, portant
//   le nouveau nom : a l ecran, c est indiscernable d une suppression. Et les
//   cotisations deja encaissees restent accrochees a une campagne qui decrit
//   desormais autre chose.
//
// La preuve que c est bien un OUBLI D APPELANT et non une intention : le meme
// ecran, ouvert depuis un evenement, passe `createNew: true`
// (EventDetails.js:2584). Le hub club, lui, ne l a jamais passe.
//
// Point d'observation : QUEL service la sauvegarde appelle. Aucun pixel, aucune
// profondeur d'arbre — on capture la fonction confiee a `useLicenseMutation` et
// on la joue. C est exactement la ligne de decision
// (ClubLicenseCampaignSettings.js:1895-1896).

/** @type {any[]} */
const mockFonctionsDeMutation = [];

// Valeurs FIGEES au niveau module : un objet neuf a chaque appel relance les
// `useMemo`/`useEffect` qui en dependent et fait tourner Jest en boucle infinie
// SANS message (piege paye le 2026-08-05 sur le lot L35).
const mockRequeteVide = { data: null, isError: false, isLoading: false };
/** @type {any} */
const mockCampagneEditee = { requete: { data: null, isError: false, isLoading: false } };
const mockRequeteListeVide = { data: [], isError: false, isLoading: false };
const mockInsetsFiges = {
  bottom: 0, left: 0, right: 0, top: 0,
};
const mockClientRequeteFige = { invalidateQueries: jest.fn(), setQueryData: jest.fn() };

/**
 * LA CAMPAGNE QUI EXISTE DEJA — celle qu'Adel avait, et qui ne doit pas bouger.
 * Objet FIGE : il est passe par reference aux `useMemo` de l'ecran.
 */
const campagneDejaLa = Object.freeze({
  defaultAmountCents: 12000,
  documentId: 'camp-DEJA-LA',
  endDate: '2027-06-30',
  id: 4242,
  name: 'Cotisation seniors 2026-2027',
  seasonLabel: '2026-2027',
  startDate: '2026-09-01',
  status: 'active',
});

const mockRequeteCampagneCourante = {
  data: campagneDejaLa,
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
  createLicenseCampaign: jest.fn(async () => ({ documentId: 'camp-NEUVE' })),
  deleteLicenseDocumentRequest: jest.fn(),
  deleteLicensePricingRule: jest.fn(),
  updateLicenseCampaign: jest.fn(async () => ({ documentId: 'camp-DEJA-LA' })),
  upsertLicenseDocumentRequest: jest.fn(),
  upsertLicensePricingRule: jest.fn(),
  useCurrentLicenseCampaign: () => mockRequeteCampagneCourante,
  useLicenseCampaign: () => mockCampagneEditee.requete,
  /**
   * Range la fonction de sauvegarde sans la jouer : c'est le test qui decide
   * quand la declencher, pour observer QUEL service elle appelle.
   * @param {any} fonction - La fonction de mutation confiee par l'ecran.
   * @returns {any} Une mutation inerte.
   */
  useLicenseMutation: (fonction) => {
    mockFonctionsDeMutation.push(fonction);
    return { isPending: false, mutate: jest.fn(), mutateAsync: jest.fn() };
  },
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

jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock({ children }) {
  return children || null;
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
  () => function WizardStepLayoutMock({ children }) {
    return children || null;
  },
);

const {
  createLicenseCampaign,
  updateLicenseCampaign,
} = require('@/services/license/licenseQueries');

// BH11 (BUGHUNT 24/10) — banc copie de ClubLicenseCampaignSettings.creationNEcrasePas.test.js.
//   P5-02 : une nouvelle campagne « Saison » s enregistre sur la saison, pas du jour J au jour J ;
//   P5-13 : une campagne a dates libres chargee APRES le premier rendu rouvre en « Dates libres » ;
//   P5-01 : changer le montant regenere l echeancier en plusieurs fois.

/**
 * La derniere fonction d enregistrement.
 * @returns {any} la derniere fonction d enregistrement rangee par l ecran
 */
const derniereSauvegarde = () => mockFonctionsDeMutation[mockFonctionsDeMutation.length - 2];

/**
 * Monte l ecran de reglages.
 * @param {any} params - Parametres de route.
 * @returns {Promise<any>} l arbre monte
 */
const monter = async (params) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <ClubLicenseCampaignSettings navigation={navigationFigee} route={{ params }} />,
    );
  });
  return arbre;
};

describe('BH11 — période et échéancier d une campagne', () => {
  beforeEach(() => {
    mockFonctionsDeMutation.length = 0;
    mockCampagneEditee.requete = mockRequeteVide;
    createLicenseCampaign.mockClear();
    updateLicenseCampaign.mockClear();
  });

  it('P5-02 — une nouvelle campagne s enregistre sur la saison en cours', async () => {
    const arbre = await monter({ clubId: 'club-BH11' });
    await act(async () => { await derniereSauvegarde()({}); });
    const payload = createLicenseCampaign.mock.calls[0][0];
    expect(payload.startDate).toMatch(/^\d{4}-08-01$/);
    expect(payload.endDate).toMatch(/^\d{4}-07-31$/);
    arbre.unmount();
  });

  it('P5-13 — une campagne à dates libres chargée tard rouvre en « Dates libres »', async () => {
    mockCampagneEditee.requete = { data: null, isError: false, isLoading: true };
    const arbre = await monter({ campaignId: 'camp-LIBRE', clubId: 'club-BH11' });
    mockCampagneEditee.requete = {
      data: {
        defaultAmountCents: 4000,
        documentId: 'camp-LIBRE',
        endDate: '2026-11-15',
        name: 'Stage Toussaint',
        startDate: '2026-10-20',
        status: 'draft',
      },
      isError: false,
      isLoading: false,
    };
    await act(async () => {
      arbre.update(
        <ClubLicenseCampaignSettings
          navigation={navigationFigee}
          route={{ params: { campaignId: 'camp-LIBRE', clubId: 'club-BH11' } }}
        />,
      );
    });
    const choix = arbre.root.findAll((n) => n.props?.selectedKey === 'season' || n.props?.selectedKey === 'custom');
    expect(choix.length).toBeGreaterThan(0);
    expect(choix[0].props.selectedKey).toBe('custom');
    arbre.unmount();
  });

  it('P5-01 — passer de 100 € à 200 € regénère l échéancier en 3 fois', async () => {
    mockCampagneEditee.requete = {
      data: {
        allowInstallments: true,
        defaultAmountCents: 10000,
        documentId: 'camp-3FOIS',
        endDate: '2027-07-31',
        installmentCount: 3,
        installmentFrequency: 'monthly',
        installmentSchedule: [
          { amountCents: 3334, dueDate: '2026-09-01', label: '1/3' },
          { amountCents: 3333, dueDate: '2026-10-01', label: '2/3' },
          { amountCents: 3333, dueDate: '2026-11-01', label: '3/3' },
        ],
        name: 'Cotisation 3 fois',
        startDate: '2026-08-01',
        status: 'draft',
      },
      isError: false,
      isLoading: false,
    };
    const arbre = await monter({ campaignId: 'camp-3FOIS', clubId: 'club-BH11' });
    const champMontant = () => arbre.root.findAll((n) => typeof n.props?.onAmountChange === 'function')[0];
    // Le montant vit a une etape suivante de l assistant : on avance jusqu a lui.
    for (let etape = 0; etape < 6 && !champMontant(); etape += 1) {
      const assistant = arbre.root.findAll((n) => typeof n.props?.onNext === 'function')[0];
      // eslint-disable-next-line no-await-in-loop -- une etape apres l autre, exprès.
      await act(async () => { await assistant.props.onNext(); });
    }
    const champ = champMontant();
    await act(async () => { champ.props.onAmountChange('200'); });
    await act(async () => { await derniereSauvegarde()({}); });
    const [, payload] = updateLicenseCampaign.mock.calls[0];
    const somme = payload.installmentSchedule.reduce((total, ligne) => total + ligne.amountCents, 0);
    expect(somme).toBe(20000);
    arbre.unmount();
  });
});
