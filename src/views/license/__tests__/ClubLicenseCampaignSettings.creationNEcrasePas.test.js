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
  useLicenseCampaign: () => mockRequeteVide,
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
  () => function WizardStepLayoutMock() {
    return null;
  },
);

const {
  createLicenseCampaign,
  updateLicenseCampaign,
} = require('@/services/license/licenseQueries');

/**
 * Monte le tunnel avec les parametres EXACTS du bouton « + Nouvelle campagne »
 * du hub club (ClubLicenses.js:2190), puis joue la sauvegarde.
 * @param {any} params - Les parametres de route a simuler.
 * @returns {Promise<any>} L'arbre monte, a demonter par l'appelant.
 */
const monterPuisEnregistrer = async (params) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <ClubLicenseCampaignSettings navigation={navigationFigee} route={{ params }} />,
    );
  });
  // La premiere mutation rangee est `saveMutation` (l. 1814) ; la seconde est
  // `providerMutation` (l. 1906), qui ne touche pas a la campagne.
  const enregistrer = mockFonctionsDeMutation[0];
  await act(async () => {
    await enregistrer({});
  });
  return arbre;
};

describe('R01 — creer une campagne n en detruit aucune autre', () => {
  beforeEach(() => {
    mockFonctionsDeMutation.length = 0;
    createLicenseCampaign.mockClear();
    updateLicenseCampaign.mockClear();
  });

  it('temoin 1 — « + Nouvelle campagne » CREE, il n ecrase pas la campagne en cours', async () => {
    // Les parametres du hub, mot pour mot : le club, et rien d'autre.
    const arbre = await monterPuisEnregistrer({ clubId: 'club-R01' });

    expect(updateLicenseCampaign).not.toHaveBeenCalled();
    expect(createLicenseCampaign).toHaveBeenCalledTimes(1);

    arbre.unmount();
  });

  it('temoin 1 bis — la campagne existante n est JAMAIS la cible d un PUT non nomme', async () => {
    const arbre = await monterPuisEnregistrer({ clubId: 'club-R01' });

    // Formulation complementaire : meme si un PUT partait, il ne devrait en
    // aucun cas viser `camp-DEJA-LA`. On le dit separement pour que l echec
    // nomme la campagne perdue plutot qu un simple compteur d appels.
    const ciblesDesPut = updateLicenseCampaign.mock.calls.map(([cible]) => cible);
    expect(ciblesDesPut).not.toContain('camp-DEJA-LA');
    expect(ciblesDesPut).not.toContain(4242);

    arbre.unmount();
  });

  it('non-regression — quand la route NOMME une campagne, on la modifie bien', async () => {
    const arbre = await monterPuisEnregistrer({ campaignId: 'camp-DEJA-LA', clubId: 'club-R01' });

    expect(createLicenseCampaign).not.toHaveBeenCalled();
    expect(updateLicenseCampaign).toHaveBeenCalledTimes(1);
    expect(updateLicenseCampaign.mock.calls[0][0]).toBe('camp-DEJA-LA');

    arbre.unmount();
  });
});
