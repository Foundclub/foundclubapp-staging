import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubLicenseCampaignSettings from '../ClubLicenseCampaignSettings';

// D81 (E6) — LE TUNNEL DE COTISATION REFUSE DE SE REFERMER APRES PUBLICATION.
//
// Constat d'Adel du 2026-08-12 : « quand on a publie, les fleches retour nous
// renvoient dans le formulaire ». Sur les cotisations c'est pire qu'un retour
// mal oriente — l'ecran ne part JAMAIS : le garde `beforeRemove` pose pour
// reculer d'une etape ANNULE aussi la sortie vers la fiche de campagne. Le
// dirigeant est redepose dans le formulaire qu'il vient de publier, avec le
// bouton « Publier » sous le doigt. C'est un piege a DOUBLE ENVOI.
//
// 🔬 CE QUE CE FICHIER SIMULE, ET POURQUOI C'EST FIDELE :
// le vrai routeur emet `beforeRemove` sur TOUT retrait de route — `replace`
// compris, pas seulement un retour. Lu dans la version installee ici :
// `node_modules/@react-navigation/core/lib/module/useOnAction.js` l. 55 appelle
// `shouldPreventRemove(...)` pour toute action qui change l'etat, SANS filtrer
// son type ; et `useOnPreventRemove.js` l. 19-41 emet l'evenement sur chaque
// route qui disparait. La doublure de `replace` ci-dessous rejoue exactement
// cette chaine : elle previent les ecouteurs, et n'enregistre la sortie que si
// personne ne l'a empechee.
//
// Point d'observation : `sortiesReussies` / `sortiesEmpechees`. Aucun pixel,
// aucune profondeur d'arbre — le meme genre de couture que le filet D18/D26
// voisin, dont ce fichier reprend les doublures.

/** @type {any[]} */
const mockWizardProps = [];

// Valeurs FIGEES au niveau module : un objet neuf a chaque appel relance les
// `useMemo`/`useEffect` qui en dependent et fait tourner Jest en boucle infinie
// SANS message (piege paye le 2026-08-05 sur le lot L35).
const mockRequeteVide = { data: null, isError: false, isLoading: false };
const mockRequeteListeVide = { data: [], isError: false, isLoading: false };
const mockCampagneEnregistree = { documentId: 'camp-D81' };
const mockMutationQuiReussit = {
  isPending: false,
  mutate: (/** @type {any} */ _variables, /** @type {any} */ options) => {
    options?.onSuccess?.(mockCampagneEnregistree);
  },
  mutateAsync: async () => true,
};
const mockInsetsFiges = {
  bottom: 0, left: 0, right: 0, top: 0,
};
const mockClientRequeteFige = { invalidateQueries: jest.fn(), setQueryData: jest.fn() };

const journalNavigation = {
  /** @type {any[]} */
  ecouteursBeforeRemove: [],
  /** @type {string[]} */
  sortiesEmpechees: [],
  /** @type {any[]} */
  sortiesReussies: [],
};

/**
 * Rejoue ce que fait le routeur avant de retirer l'ecran de la pile.
 * @param {any} action - L'action de navigation qui retire la route.
 * @returns {boolean} `true` si un ecouteur a empeche le retrait.
 */
const simulerRetraitDeLEcran = (action) => {
  let empeche = false;
  [...journalNavigation.ecouteursBeforeRemove].forEach((ecouteur) => {
    ecouteur({
      data: { action },
      preventDefault: () => { empeche = true; },
    });
  });
  return empeche;
};

const navigationFigee = {
  /**
   * Range l'ecouteur `beforeRemove` de l'ecran, et ignore tous les autres
   * evenements de navigation.
   * @param {string} nom - Le nom de l'evenement ecoute.
   * @param {any} ecouteur - La fonction a rappeler.
   * @returns {() => void} Le desabonnement.
   */
  addListener: (nom, ecouteur) => {
    if (nom !== 'beforeRemove') return () => {};
    journalNavigation.ecouteursBeforeRemove.push(ecouteur);
    return () => {
      const position = journalNavigation.ecouteursBeforeRemove.indexOf(ecouteur);
      if (position >= 0) journalNavigation.ecouteursBeforeRemove.splice(position, 1);
    };
  },
  /**
   * La fleche de retour et le geste du telephone : la sortie passe d'abord par
   * les ecouteurs `beforeRemove`, qui peuvent l'annuler.
   */
  goBack: () => {
    if (simulerRetraitDeLEcran({ type: 'GO_BACK' })) {
      journalNavigation.sortiesEmpechees.push('GO_BACK');
      return;
    }
    journalNavigation.sortiesReussies.push({ nom: 'GO_BACK', params: null });
  },
  navigate: jest.fn(),
  /**
   * Remplace l'ecran courant — un retrait de route, donc lui aussi soumis aux
   * ecouteurs `beforeRemove`.
   * @param {string} nom - L'ecran vise.
   * @param {any} params - Ses parametres.
   */
  replace: (nom, params) => {
    if (simulerRetraitDeLEcran({ payload: { name: nom, params }, type: 'REPLACE' })) {
      journalNavigation.sortiesEmpechees.push(nom);
      return;
    }
    journalNavigation.sortiesReussies.push({ nom, params });
  },
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
  createLicenseCampaign: jest.fn(),
  deleteLicenseDocumentRequest: jest.fn(),
  deleteLicensePricingRule: jest.fn(),
  updateLicenseCampaign: jest.fn(),
  upsertLicenseDocumentRequest: jest.fn(),
  upsertLicensePricingRule: jest.fn(),
  useCurrentLicenseCampaign: () => mockRequeteVide,
  useLicenseCampaign: () => mockRequeteVide,
  useLicenseMutation: () => mockMutationQuiReussit,
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
  () => function WizardStepLayoutMock(/** @type {any} */ props) {
    mockWizardProps.push(props);
    return null;
  },
);

/**
 * La campagne la plus permissive possible : aucune validation ne peut bloquer
 * la marche jusqu'au recapitulatif. Objet FIGE — il est passe par reference.
 */
const campagneFranchissable = Object.freeze({
  allowInstallments: true,
  defaultAmountCents: 10000,
  documentId: 'camp-D81',
  endDate: '2027-06-30',
  externalPaymentUrl: 'https://exemple.test/paiement',
  name: 'Cotisation 2026-2027',
  paymentModes: {
    bank_transfer: true,
    card_physical: false,
    cash: false,
    check: false,
    external_link: true,
    helloasso: false,
  },
  reminderAutomation: { enabled: true },
  seasonLabel: '2026-2027',
  startDate: '2026-09-01',
  targetConfig: { includeAllMembers: true },
});

/**
 * Relit le dernier rendu de l'etape courante, capture par la doublure.
 * @returns {any} Les dernieres props recues par la mise en page du tunnel.
 */
const dernieresProps = () => mockWizardProps[mockWizardProps.length - 1];

/**
 * Monte le tunnel, marche jusqu'au bout, publie, puis appuie sur « OK » de
 * l'alerte de succes — c'est CE bouton qui doit sortir du formulaire.
 * @returns {Promise<any>} L'arbre monte, a demonter par l'appelant.
 */
const publierPuisAccepterLAlerte = async () => {
  const route = {
    params: { campaign: campagneFranchissable, clubId: 'club-D81', createNew: true },
  };
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <ClubLicenseCampaignSettings navigation={navigationFigee} route={route} />,
    );
  });

  // On marche jusqu'a la derniere etape sans jamais la depasser.
  for (let garde = 0; garde < 20; garde += 1) {
    const props = dernieresProps();
    if (props.stepIndex >= props.stepCount) break;
    const indexAvant = props.stepIndex;
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { props.onNext(); });
    if (dernieresProps().stepIndex === indexAvant) break;
  }

  // La derniere pression declenche l'enregistrement, qui ouvre l'alerte.
  await act(async () => { dernieresProps().onNext(); });

  const alerteDeSucces = /** @type {any} */ (Alert.alert).mock.calls
    .map((/** @type {any[]} */ appel) => appel[2])
    .filter(Boolean)
    .flat()
    .find((/** @type {any} */ bouton) => typeof bouton?.onPress === 'function');

  await act(async () => { alerteDeSucces?.onPress(); });
  return arbre;
};

describe('D81 — le tunnel de cotisation se referme apres publication', () => {
  /** @type {any} */
  let alerteEspionnee;

  beforeEach(() => {
    mockWizardProps.length = 0;
    journalNavigation.ecouteursBeforeRemove.length = 0;
    journalNavigation.sortiesEmpechees.length = 0;
    journalNavigation.sortiesReussies.length = 0;
    alerteEspionnee = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alerteEspionnee.mockRestore();
  });

  it('quitte le formulaire pour la fiche de campagne, sans etre retenu', async () => {
    const arbre = await publierPuisAccepterLAlerte();

    expect(journalNavigation.sortiesEmpechees).toEqual([]);
    expect(journalNavigation.sortiesReussies.map((sortie) => sortie.nom))
      .toEqual(['ClubLicenseCampaignDetail']);

    await act(async () => arbre.unmount());
  });

  it('le garde qui recule d une etape ne retient plus l ecran une fois publie', async () => {
    const arbre = await publierPuisAccepterLAlerte();

    // Le formulaire est parti : la barre de progression ne recule pas.
    // Sans le laissez-passer, `beforeRemove` renvoyait le dirigeant a
    // l'etape precedente, bouton « Publier » toujours accessible.
    expect(dernieresProps().stepIndex).toBe(dernieresProps().stepCount);

    await act(async () => arbre.unmount());
  });

  it('AVANT publication, le retour ramene toujours a l etape precedente', async () => {
    const route = {
      params: { campaign: campagneFranchissable, clubId: 'club-D81', createNew: true },
    };
    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(
        <ClubLicenseCampaignSettings navigation={navigationFigee} route={route} />,
      );
    });

    await act(async () => { dernieresProps().onNext(); });
    const indexApresUnPas = dernieresProps().stepIndex;
    await act(async () => { dernieresProps().onBack(); });

    expect(dernieresProps().stepIndex).toBe(indexApresUnPas - 1);
    expect(journalNavigation.sortiesReussies).toEqual([]);

    await act(async () => arbre.unmount());
  });
});
