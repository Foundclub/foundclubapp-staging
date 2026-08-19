import renderer, { act } from 'react-test-renderer';

import ClubLicenseCampaignSettings from '../ClubLicenseCampaignSettings';

/**
 * Y06 (E6) — LE MODELE DEPOSE PAR LE CREATEUR NE SE REGARDE PAS.
 *
 * 🗣️ Adel, 2026-08-19 : « en tant que createur il faut un endroit ou je peux
 * voir le modele que j ai uploade ».
 *
 * 🔬 MESURE AVANT DE REFAIRE : la rangee « MODÈLE À TÉLÉCHARGER » affiche le NOM
 * du fichier et offre « Remplacer » et « Retirer ». Aucun moyen de l OUVRIR —
 * alors que la rangee promet, a l ecran, « visible et telechargeable par tous
 * les membres concernes ». Par tous, sauf par celui qui l a depose.
 *
 * 🧩 LE MEME CHEMIN QUE LE MEMBRE, pas un second : `MyLicense.js`
 * (`openTemplateFile`) resout l adresse du fichier de la DEMANDE puis
 * l ouvre. On reprend ce chemin tel quel.
 *
 * ⚠️ LA DIFFERENCE QUE LE CODE FAIT DEJA, et qui decide de tout :
 *   · `pickedTemplateFile` = fichier CHOISI, pas encore envoye → il n a AUCUNE
 *     adresse. ⛔ Rien a ouvrir.
 *   · `templateFileName` / `templateFileUrl` = fichier DEJA ENREGISTRE → il a
 *     une adresse. ✅ C est le seul qu on ouvre.
 */

/** @type {any[]} */
const mockBoutons = [];
/** @type {any[]} */
const mockOuvertures = [];
/** @type {any[]} */
const mockEtapes = [];

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

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mockClientRequeteFige,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsetsFiges,
}));

jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(couleurs),
      Colors: couleurs,
      Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
      Images: {},
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

// ⛔ Jamais `requireActual` sur un service : le client HTTP refuse de se charger
// sans `API_URL` et fait tomber la suite AVANT le premier rendu.
jest.mock('@/services/license/licenseQueries', () => ({
  createLicenseCampaign: jest.fn(),
  deleteLicenseDocumentRequest: jest.fn(),
  deleteLicensePricingRule: jest.fn(),
  updateLicenseCampaign: jest.fn(),
  upsertLicenseDocumentRequest: jest.fn(),
  upsertLicensePricingRule: jest.fn(),
  useCurrentLicenseCampaign: () => mockRequeteVide,
  useLicenseCampaign: () => mockRequeteVide,
  useLicenseMutation: () => mockMutationFigee,
}));

/** @type {any} */
let mockFichierChoisi = null;
jest.mock('@/platform/media', () => ({
  __esModule: true,
  default: { pickDocument: () => Promise.resolve(mockFichierChoisi) },
}));

// Le point d observation du temoin : ce que l ecran demande a la plateforme
// d ouvrir. C est la MEME couture que celle du membre (`MyLicense`).
jest.mock('@/platform/links', () => ({
  __esModule: true,
  default: { openUrl: (/** @type {string} */ url) => { mockOuvertures.push(url); } },
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
  () => function ScreenContainerMock({ children }) { return children; },
);

jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => function PaywallMock() { return null; },
);

// `BottomModal` tire `@gorhom/bottom-sheet`, que Jest ne sait pas transformer.
// La doublure rend le CONTENU : c est dans la feuille que vit la rangee du
// modele, et c est elle qu on observe.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock(
  /** @type {any} */ { children },
) {
  return children;
});

jest.mock('@/components/molecules/inputStepper/InputStepper', () => function InputStepperMock() {
  return null;
});

jest.mock(
  '@/components/molecules/dateTimeSelector/DateTimeSelector',
  () => function DateTimeSelectorMock() { return null; },
);

jest.mock('@/components/atoms/button/Button', () => function ButtonMock(/** @type {any} */ props) {
  mockBoutons.push(props);
  return null;
});

// Contrairement au filet des ETAPES, celui-ci a besoin du CORPS de l etape :
// la doublure rend donc ses enfants, et garde les props pour avancer.
jest.mock(
  '@/components/molecules/wizardStepLayout/WizardStepLayout',
  () => function WizardStepLayoutMock(/** @type {any} */ props) {
    mockEtapes.push(props);
    return props.children;
  },
);

const MODELE_ENREGISTRE = { name: 'certificat-2026.pdf', url: '/uploads/certificat-2026.pdf' };

const campagneAvecModele = Object.freeze({
  allowInstallments: false,
  defaultAmountCents: 10000,
  documentId: 'camp-Y06',
  documentRequests: [
    {
      documentId: 'doc-certif',
      name: 'Certificat médical',
      required: true,
      templateFile: MODELE_ENREGISTRE,
    },
  ],
  endDate: '2027-06-30',
  name: 'Cotisation 2026-2027',
  paymentModes: { cash: true },
  reminderAutomation: { enabled: false },
  seasonLabel: '2026-2027',
  startDate: '2026-09-01',
  targetConfig: { includeAllMembers: true },
});

const campagneSansModele = Object.freeze({
  ...campagneAvecModele,
  documentRequests: [
    {
      documentId: 'doc-certif', name: 'Certificat médical', required: true, templateFile: null,
    },
  ],
});

/** @type {any} */
let arbreCourant = null;

afterEach(() => {
  if (arbreCourant) {
    act(() => arbreCourant.unmount());
    arbreCourant = null;
  }
});

/**
 * Monte le tunnel, avance jusqu a l etape « Documents » et ouvre la feuille du
 * document demande — la ou vit la rangee du modele.
 * @param {any} campagne - La campagne relue.
 * @returns {void}
 */
const ouvrirLaFeuilleDuDocument = (campagne) => {
  mockBoutons.length = 0;
  mockOuvertures.length = 0;
  mockEtapes.length = 0;

  act(() => {
    arbreCourant = renderer.create(
      <ClubLicenseCampaignSettings
        navigation={navigationFigee}
        route={{
          params: {
            campaign: campagne,
            campaignId: campagne.documentId,
            clubId: 'club-Y06',
          },
        }}
      />,
    );
  });

  // Identité → Public & tarif → Paiement → Documents.
  for (let saut = 0; saut < 3; saut += 1) {
    act(() => { mockEtapes[mockEtapes.length - 1].onNext(); });
  }

  const rangeeDuDocument = arbreCourant.root.findAll((/** @type {any} */ noeud) => (
    noeud.props?.accessibilityLabel === 'Certificat médical'
    && typeof noeud.props?.onPress === 'function'
  ), { deep: true });

  mockBoutons.length = 0;
  act(() => { rangeeDuDocument[0].props.onPress(); });
};

/**
 * Recolte les intitules des boutons rendus depuis le dernier nettoyage.
 * @returns {string[]} Les intitules.
 */
const intitules = () => mockBoutons.map((props) => props.title).filter(Boolean);

/**
 * Retrouve un bouton par son intitule.
 * @param {string} titre - L intitule cherche.
 * @returns {any} Les props du bouton, ou `undefined`.
 */
const bouton = (titre) => mockBoutons.find((props) => props.title === titre);

describe('Y06 · geste 2 — le createur peut regarder le modele qu il a depose', () => {
  it('temoin 4 — un modele DEJA ENREGISTRE propose « Voir le modèle »', () => {
    ouvrirLaFeuilleDuDocument(campagneAvecModele);

    expect(intitules()).toContain('Voir le modèle');
  });

  it('temoin 4b — le bouton n est pas inerte : il ouvre bien le fichier', () => {
    ouvrirLaFeuilleDuDocument(campagneAvecModele);

    act(() => { bouton('Voir le modèle').onPress(); });

    expect(mockOuvertures).toHaveLength(1);
    expect(mockOuvertures[0]).toContain('/uploads/certificat-2026.pdf');
  });

  it('🔒 temoin 5 — aucun bouton d ouverture quand aucun modele n est enregistre', () => {
    ouvrirLaFeuilleDuDocument(campagneSansModele);

    expect(intitules()).not.toContain('Voir le modèle');
  });

  it('🔒 temoin 5b — un fichier choisi, pas encore envoye, n a pas d adresse', async () => {
    // Le dirigeant remplace le modele : la rangee affiche le nom du nouveau
    // fichier, mais il n est PAS parti — il n a donc aucune adresse.
    // ⛔ Proposer de l ouvrir serait promettre un lien qui n existe pas.
    mockFichierChoisi = { name: 'nouveau-certificat.pdf', uri: 'file:///tmp/nouveau.pdf' };
    ouvrirLaFeuilleDuDocument(campagneAvecModele);
    expect(intitules()).toContain('Voir le modèle');

    const remplacer = bouton('Remplacer le modèle');
    mockBoutons.length = 0;
    await act(async () => { await remplacer.onPress(); });

    // La rangee a bien ete re-rendue (temoin de mesure), et elle ne propose
    // plus d ouvrir quoi que ce soit.
    expect(intitules()).toContain('Remplacer le modèle');
    expect(intitules()).not.toContain('Voir le modèle');
    mockFichierChoisi = null;
  });
});
