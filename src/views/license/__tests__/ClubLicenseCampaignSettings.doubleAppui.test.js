import renderer, { act } from 'react-test-renderer';

import ClubLicenseCampaignSettings from '../ClubLicenseCampaignSettings';

// S06 (E6) — TEMOIN N°1, LE PLUS IMPORTANT DU LOT : DEUX APPUIS NE CREENT QU UNE
// CAMPAGNE.
//
// Constat d'Adel en recette de la `2.6.19` (point 10) : « ca marche, mais y'a eu
// du delai avec un bug : j'ai du appuyer DEUX FOIS sur le bouton "creer la
// campagne" ». Le lot R01 venait de reparer une campagne ECRASEE — on ne la
// remplace pas par une campagne creee EN DOUBLE.
//
// 🔬 LEQUEL DES DEUX CAS C ETAIT — mesure, pas hypothese. Le premier appui
// PARTAIT BIEN : le bouton final du tunnel recoit `isNextLoading={saveMutation
// .isPending}` (ClubLicenseCampaignSettings.js:2985) et `Button` rend son
// `TouchableOpacity` inerte des que `isLoading` est vrai (Button.js:75, 98).
// L ecran s est donc TU **apres** que la creation a repondu, pendant la suite de
// la chaine.
//
// La cause exacte, lue dans `@tanstack/query-core` 5.85.9
// (`mutationObserver.js:43-46` puis `81`) : `onMutationUpdate` appelle
// `#updateResult()` — l etat est deja `success`, donc `isPending` retombe a
// **false** — AVANT `#notify(action)`, qui declenche le `onSuccess` passe a
// `mutate(...)`. Or c est dans CE `onSuccess` que l ecran enchaine jusqu a
// CINQ allers-retours reseau de plus (suppression et remontee des documents
// demandes, des regles tarifaires, puis `providerMutation`) avant d afficher
// quoi que ce soit (l. 2022-2059).
// ⇒ pendant toute cette fenetre : aucun voyant, aucune alerte, **et le bouton
//   redevenu vivant**. Un deuxieme appui rappelle `persistCampaign`, ou
//   `campaignId` est encore vide (`syncSavedCampaignParams` n a pas encore
//   tourne) : il repart donc en `createLicenseCampaign` — une DEUXIEME campagne.
//
// Point d'observation : COMBIEN de fois `createLicenseCampaign` est appele quand
// on presse deux fois de suite sans attendre. Aucun pixel.
//
// ⚠️ Le faux mock qui rendrait ce temoin inutile serait un `useLicenseMutation`
// qui remet `isPending` a false APRES `onSuccess`. Celui d ici respecte l ordre
// MESURE ci-dessus — c est la seule raison pour laquelle il est ecrit a la main.

// Prefixe `mock` : c'est la seule facon pour une usine `jest.mock()` d'atteindre
// une variable de module (jest autorise nommement ce prefixe).
const mockReact = require('react');

/** @type {any} */
let propsDuTunnel = null;
/** @type {(() => void)[]} */
const resolveursDeProvider = [];

// Valeurs FIGEES au niveau module : un objet neuf a chaque appel relance les
// `useMemo`/`useEffect` qui en dependent et fait tourner Jest en boucle infinie
// SANS message (piege paye le 2026-08-05 sur le lot L35).
const mockRequeteVide = { data: null, isError: false, isLoading: false };
const mockRequeteListeVide = { data: [], isError: false, isLoading: false };
const mockInsetsFiges = {
  bottom: 0, left: 0, right: 0, top: 0,
};
const mockClientRequeteFige = { invalidateQueries: jest.fn(), setQueryData: jest.fn() };

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
  deleteLicenseDocumentRequest: jest.fn(async () => true),
  deleteLicensePricingRule: jest.fn(async () => true),
  updateLicenseCampaign: jest.fn(async () => ({ documentId: 'camp-DEJA-LA' })),
  upsertLicenseDocumentRequest: jest.fn(async () => true),
  upsertLicensePricingRule: jest.fn(async () => true),
  useCurrentLicenseCampaign: () => mockRequeteVide,
  useLicenseCampaign: () => mockRequeteVide,
  /**
   * Reproduit l ORDRE MESURE de `@tanstack/query-core` 5.85.9 :
   * `isPending` retombe a `false` AVANT que le `onSuccess` passe a `mutate(...)`
   * ne soit joue. C est precisement cet ordre qui rouvre le bouton pendant la
   * suite de la chaine.
   * @param {any} fonction - La fonction de mutation confiee par l'ecran.
   * @returns {any} Une mutation qui suit l'ordre reel.
   */
  useLicenseMutation: (fonction) => {
    const [isPending, setIsPending] = mockReact.useState(false);
    const mutate = mockReact.useCallback((variables, options) => {
      setIsPending(true);
      Promise.resolve()
        .then(() => fonction(variables))
        .then(async (donnees) => {
          setIsPending(false);
          await options?.onSuccess?.(donnees);
        })
        .catch(async (erreur) => {
          setIsPending(false);
          await options?.onError?.(erreur);
        });
    }, [fonction]);
    // `mutateAsync` est tenu OUVERT : c'est `providerMutation.mutateAsync()`
    // (l. 2029), le dernier maillon attendu DANS le `onSuccess`. Le laisser en
    // vol place le test exactement dans la fenetre silencieuse.
    const mutateAsync = mockReact.useCallback(() => new Promise((resolve) => {
      resolveursDeProvider.push(() => resolve(true));
    }), []);
    return { isPending, mutate, mutateAsync };
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

// Le gabarit du tunnel n'est pas rendu : on garde ses PROPS, c'est la ou vivent
// le bouton final (`onNext`) et son etat inerte (`isNextLoading`).
jest.mock(
  '@/components/molecules/wizardStepLayout/WizardStepLayout',
  () => function WizardStepLayoutMock(props) {
    propsDuTunnel = props;
    return null;
  },
);

const { createLicenseCampaign } = require('@/services/license/licenseQueries');

/**
 * Monte le tunnel avec les parametres EXACTS du bouton « + Nouvelle campagne »
 * du hub club (ClubLicenses.js), et le pose sur sa DERNIERE etape — celle qui
 * porte « Ouvrir la campagne ».
 * @returns {Promise<any>} L'arbre monte, a demonter par l'appelant.
 */
const monterSurLaDerniereEtape = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <ClubLicenseCampaignSettings
        navigation={navigationFigee}
        route={{ params: { clubId: 'club-S06' } }}
      />,
    );
  });

  // On avance jusqu'a la derniere etape par le lien texte du gabarit, qui ne
  // rejoue pas la validation du formulaire : ce temoin porte sur le VERROU du
  // bouton, pas sur le remplissage des 6 etapes.
  let garde = 0;
  while (propsDuTunnel.stepIndex < propsDuTunnel.stepCount && garde < 20) {
    garde += 1;
    // Fige le rappel du tour courant : la fonction jouee dans `act` ne doit
    // fermer sur rien de mutable (regle `no-loop-func`).
    const avancer = propsDuTunnel.onSkip;
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      avancer();
    });
  }
  return arbre;
};

// ⚠️ CE QUE LE TEMOIN PRESSE, ET POURQUOI C'EST LE MEME DEFAUT. A la derniere
// etape, les DEUX boutons (« Ouvrir la campagne » et « Enregistrer en
// brouillon ») appellent le meme `persistCampaign` — c'est la que la
// re-entrance vit, donc c'est la que le verrou doit etre pose (§1 bis : la cause
// racine, pas un garde-fou par appelant). Le lien texte est choisi ici parce
// qu'il n'exige pas d'avoir rempli les 6 etapes ; le verrou qu'il mesure protege
// les deux.
describe('S06 — deux appuis sur le bouton final ne creent QU UNE campagne', () => {
  beforeEach(() => {
    propsDuTunnel = null;
    resolveursDeProvider.length = 0;
    createLicenseCampaign.mockClear();
    navigationFigee.replace.mockClear();
  });

  it('temoin 1 — deux appuis rapides n envoient QU UNE creation', async () => {
    const arbre = await monterSurLaDerniereEtape();
    expect(propsDuTunnel.stepIndex).toBe(propsDuTunnel.stepCount);

    // Premier appui. La creation repond tout de suite, puis la chaine d'apres
    // reste en vol sur `providerMutation` : c'est EXACTEMENT la fenetre ou
    // l'ecran se taisait, `isPending` etant deja retombe a false.
    await act(async () => {
      propsDuTunnel.onSkip();
    });
    expect(createLicenseCampaign).toHaveBeenCalledTimes(1);
    expect(resolveursDeProvider).toHaveLength(1);

    // Adel appuie une seconde fois, faute de retour.
    await act(async () => {
      propsDuTunnel.onSkip();
    });

    expect(createLicenseCampaign).toHaveBeenCalledTimes(1);

    // On rend la main pour ne pas laisser une promesse en vol apres le test.
    await act(async () => {
      resolveursDeProvider.forEach((debloquer) => debloquer());
    });
    arbre.unmount();
  });

  it('temoin 1 bis — le bouton reste INERTE jusqu au BOUT de la chaine', async () => {
    const arbre = await monterSurLaDerniereEtape();

    await act(async () => {
      propsDuTunnel.onSkip();
    });

    // La creation a repondu, la chaine d'apres tourne encore. Avant ce lot,
    // `isNextLoading` valait deja `false` ici — le bouton etait rendu au doigt.
    expect(propsDuTunnel.isNextLoading).toBe(true);

    await act(async () => {
      resolveursDeProvider.forEach((debloquer) => debloquer());
    });
    arbre.unmount();
  });
});
