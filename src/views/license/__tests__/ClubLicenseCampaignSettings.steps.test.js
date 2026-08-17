import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubLicenseCampaignSettings from '../ClubLicenseCampaignSettings';

// D18 (E6) : `ClubLicenseCampaignSettings.js` fait 2 845 lignes et n'avait AUCUN
// test, alors qu'il porte la machine a etapes du tunnel de cotisation — le seul
// endroit du depot ou le dirigeant manipule l'argent de son club.
//
// CE FICHIER NE DECRIT QU'UNE CHOSE : la LISTE des etapes, sa longueur et son
// ordre. Il est ecrit AVANT la refonte D19 (« 6 etapes fixes ») pour qu'au
// moment ou ce nombre passera de 13-22 a 6, on puisse dire EXACTEMENT quelles
// etapes ont ete perdues en route — et non « il y en a moins qu'avant ».
//
// Point d'observation : les props que le tunnel passe a `WizardStepLayout`
// (`stepCount`, `stepIndex`, `title`). C'est la seule couture qui survive a une
// refonte de mise en page : aucun pixel, aucune profondeur d'arbre, aucun
// `testID`. La doublure rend `null` — le corps de l'etape n'est donc jamais
// monte, ce qui rend ce filet insensible aux composants internes du tunnel.
//
// ⚠️ LE DEFAUT QUE CE FICHIER EPINGLE, et que D19 doit reparer :
// `wizardStepCount` vaut `licenseCampaignWizardSteps.length` (l. 1588), une
// liste construite par empilements conditionnels (l. 1522-1580). Le
// DENOMINATEUR du « n/N » CHANGE donc pendant que le dirigeant est dans le
// tunnel, des qu'il bascule un interrupteur : « etape 8/16 » devient « 8/19 »
// sous ses yeux. Les tests `deltas` ci-dessous mesurent ce saut.

/** @type {any[]} */
const mockWizardProps = [];

// Toutes les valeurs rendues par les doublures de hooks sont FIGEES au niveau
// module. Un objet neuf a chaque appel relance les `useMemo`/`useEffect` qui en
// dependent et fait tourner Jest en boucle infinie, SANS message d'erreur
// (piege paye le 2026-08-05 sur le lot L35).
// Le prefixe `mock` n'est pas cosmetique : Jest refuse toute autre variable
// citee depuis une fabrique `jest.mock()`.
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

/**
 * Campagne valide de bout en bout : aucune etape ne peut bloquer la marche.
 * Objet FIGE — il est passe par reference, l'effet de synchronisation du tunnel
 * depend de `campaign` et se rejouerait sans fin sur un objet neuf.
 */
const campagneBase = {
  defaultAmountCents: 10000,
  documentId: 'camp-D18',
  endDate: '2027-06-30',
  name: 'Cotisation 2026-2027',
  seasonLabel: '2026-2027',
  startDate: '2026-09-01',
  targetConfig: { includeAllMembers: true },
};

const tousModesFermes = {
  bank_transfer: false,
  card_physical: false,
  cash: false,
  check: false,
  external_link: false,
  helloasso: false,
};

/** Les 4 interrupteurs fermes : c'est le SOCLE, le plus court tunnel possible. */
const campagneToutFerme = Object.freeze({
  ...campagneBase,
  allowInstallments: false,
  paymentModes: tousModesFermes,
  reminderAutomation: { enabled: false },
});

/**
 * Les 4 interrupteurs ouverts : le plus long tunnel possible.
 * `externalPaymentUrl` et le cliche HelloAsso ne changent AUCUN compteur — ils
 * n'alimentent aucun des 4 interrupteurs. Ils sont la uniquement pour que
 * l'etape « Paiement en ligne » laisse passer (l. 2046 et 2053), donc pour que
 * le tunnel soit franchissable de bout en bout.
 */
const campagneToutOuvert = Object.freeze({
  ...campagneBase,
  allowInstallments: true,
  externalPaymentUrl: 'https://exemple.test/paiement',
  paymentModes: {
    ...tousModesFermes, bank_transfer: true, external_link: true, helloasso: true,
  },
  paymentProviderSnapshot: { helloasso: { readiness: 'ready' } },
  reminderAutomation: { enabled: true },
});

const campagneAvecFractionnement = Object.freeze({
  ...campagneToutFerme,
  allowInstallments: true,
});

const campagneAvecConsignesHorsLigne = Object.freeze({
  ...campagneToutFerme,
  paymentModes: { ...tousModesFermes, bank_transfer: true },
});

const campagneAvecPaiementEnLigne = Object.freeze({
  ...campagneToutFerme,
  paymentModes: { ...tousModesFermes, helloasso: true },
});

const campagneAvecRelances = Object.freeze({
  ...campagneToutFerme,
  reminderAutomation: { enabled: true },
});

/**
 * @param {any} campagne - Campagne posee dans les parametres de route, ou `null`
 *   pour observer ce que voit un dirigeant qui CREE une campagne neuve.
 * @returns {any} L'arbre rendu.
 */
const monterTunnel = (campagne) => {
  mockWizardProps.length = 0;
  // R01 (2026-08-13) — une campagne RELUE est une campagne que la route NOMME.
  // Auparavant ce montage ne passait que l objet `campaign` et s appuyait sur le
  // repli qui devinait la cible depuis la campagne courante : c est precisement
  // ce repli qui faisait ECRASER la campagne en cours par « + Nouvelle campagne ».
  // L intention du fichier est inchangee — elle est ecrite deux tests plus bas :
  // « `campaignId` absent = creation ».
  const route = {
    params: {
      campaign: campagne,
      campaignId: campagne ? (campagne.documentId || campagne.id) : undefined,
      clubId: 'club-D18',
      createNew: true,
    },
  };
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <ClubLicenseCampaignSettings navigation={navigationFigee} route={route} />,
    );
  });
  return arbre;
};

/** @returns {any} Les dernieres props recues par la mise en page du tunnel. */
const dernieresProps = () => mockWizardProps[mockWizardProps.length - 1];

/**
 * @param {any} campagne
 * @returns {number} Le denominateur du « n/N » affiche au dirigeant.
 */
const compterEtapes = (campagne) => {
  const arbre = monterTunnel(campagne);
  const total = dernieresProps().stepCount;
  act(() => arbre.unmount());
  return total;
};

/**
 * Marche d'un bout a l'autre du tunnel en appuyant sur « Suivant », et releve
 * le titre de chaque etape traversee. S'arrete AVANT la derniere pression, qui
 * declencherait l'enregistrement.
 * @param {any} campagne
 * @returns {string[]}
 */
const listerTitresDesEtapes = (campagne) => {
  const arbre = monterTunnel(campagne);
  /** @type {string[]} */
  const titres = [];

  for (let garde = 0; garde < 40; garde += 1) {
    const props = dernieresProps();
    titres.push(props.title);
    if (props.stepIndex >= props.stepCount) break;

    const indexAvant = props.stepIndex;
    act(() => {
      props.onNext();
    });
    // Une etape qui n'avance pas signale une validation bloquante : on sort
    // plutot que de tourner en rond, et l'assertion sur la longueur le dira.
    if (dernieresProps().stepIndex === indexAvant) break;
  }

  act(() => arbre.unmount());
  return titres;
};

// ═══════════════════════════════════════════════════════════════════════════
// D26 — CE QUE CE FICHIER DECRIT A CHANGE, ET VOICI POURQUOI, POUR CHAQUE LIGNE
//
// Le filet ci-dessus a ete ecrit AVANT la refonte pour epingler la machine a
// etapes telle qu'elle etait : 13 au minimum, 17 sur une campagne neuve, 22 au
// maximum, et un denominateur qui bougeait sous les yeux du dirigeant.
//
// D26 remplace ce tableau construit par empilements conditionnels par une
// CONSTANTE de 6 entrees. Les assertions qui mesuraient la variation n'ont donc
// plus d'objet : elles sont remplacees par leur contraire exact — l'INVARIANCE —
// et c'est le meme point d'observation qui la mesure (`stepCount` passe a
// `WizardStepLayout`, aucun pixel, aucune profondeur d'arbre).
//
// ⛔ CE QUI N'EST PAS TOUCHE, et c'est volontaire : les deux tests sur le blocage
// de « Moyens de paiement ». Ils decrivent une VALIDATION, pas une longueur. La
// regle survit a la refonte — elle a seulement change d'etape.
//
// 📌 Ce que les nouveaux tests protegent, et que les anciens ne pouvaient pas :
// qu'aucun interrupteur du tunnel ne puisse plus rallonger le tunnel. C'est
// exactement le defaut de recette d'Adel du 2026-08-07.
// ═══════════════════════════════════════════════════════════════════════════

describe('ClubLicenseCampaignSettings — la machine a etapes (D26 : 6 etapes fixes)', () => {
  /** @type {any} */
  let alerteEspionnee;

  beforeEach(() => {
    mockWizardProps.length = 0;
    // Une validation bloquante passe par `Alert.alert` : on l'espionne pour que
    // la marche ne soit jamais interrompue en silence.
    alerteEspionnee = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alerteEspionnee.mockRestore();
  });

  describe('la longueur de la liste', () => {
    // AVANT D26 : 13 avec les 4 interrupteurs fermes, 22 avec les 4 ouverts.
    it('compte 6 etapes quand les 4 interrupteurs sont fermes', () => {
      expect(compterEtapes(campagneToutFerme)).toBe(6);
    });

    it('compte 6 etapes quand les 4 interrupteurs sont ouverts', () => {
      expect(compterEtapes(campagneToutOuvert)).toBe(6);
    });
  });

  describe('ce que chaque interrupteur ajoute au denominateur : PLUS RIEN', () => {
    // AVANT D26, ces memes campagnes ajoutaient respectivement 3, 1, 2 et 3
    // etapes. C'est le coeur du lot : les options ont quitte la barre de
    // progression pour des feuilles, elles ne rallongent plus le chemin.
    it.each([
      ['le paiement fractionne', campagneAvecFractionnement],
      ['un moyen de paiement hors ligne', campagneAvecConsignesHorsLigne],
      ['un moyen de paiement en ligne', campagneAvecPaiementEnLigne],
      ['les relances automatiques', campagneAvecRelances],
    ])('%s n ajoute aucune etape', (_libelle, campagne) => {
      expect(compterEtapes(campagne) - compterEtapes(campagneToutFerme)).toBe(0);
    });
  });

  describe('ce que voit un dirigeant qui cree une campagne neuve', () => {
    // AVANT D26 : 17 etapes, alors que le socle en annoncait 13. Les valeurs par
    // defaut ouvraient deux interrupteurs sans rien demander, et personne ne
    // voyait jamais le socle. Un total constant supprime la question.
    it('voit exactement le meme tunnel que n importe quelle autre campagne', () => {
      expect(compterEtapes(null)).toBe(compterEtapes(campagneToutFerme));
    });

    it('voit 6 etapes', () => {
      expect(compterEtapes(null)).toBe(6);
    });
  });

  describe('l ordre des etapes', () => {
    // AVANT D26 : deux listes differentes selon les interrupteurs (14 titres
    // dans un cas, 22 dans l'autre), avec 8 etapes conditionnelles inserees au
    // milieu. Il n'y a plus qu'une liste, et elle ne depend de rien.
    const LES_SIX = [
      'Identité',
      'Public & tarif',
      'Paiement',
      'Documents',
      'Relances',
      'Récapitulatif',
    ];

    it('deroule les 6 memes titres, dans cet ordre, quels que soient les interrupteurs', () => {
      expect(listerTitresDesEtapes(campagneAvecConsignesHorsLigne)).toEqual(LES_SIX);
      expect(listerTitresDesEtapes(campagneToutOuvert)).toEqual(LES_SIX);
    });

    it('titre la premiere etape « Nouvelle campagne » a la creation', () => {
      // Nuance voulue : `campaignId` absent = creation. Une campagne relue porte
      // « Identité », parce qu'elle n'est plus nouvelle.
      expect(listerTitresDesEtapes(null)[0]).toBe('Nouvelle campagne');
    });
  });

  describe('les regles de validation ont survecu au raccourcissement', () => {
    // ⛔ CES DEUX TESTS NE SONT PAS INVERSES. Ils decrivent une VALIDATION, pas
    // une longueur : sans moyen de paiement actif, le tunnel refuse d'avancer.
    // La regle a seulement change d'etape — de « Moyens de paiement » a
    // « Paiement ». Un tunnel plus court ne doit pas etre un tunnel plus laxiste.
    it('bloque a « Paiement » et n atteint jamais le recapitulatif', () => {
      const titres = listerTitresDesEtapes(campagneToutFerme);

      expect(titres[titres.length - 1]).toBe('Paiement');
      expect(titres).not.toContain('Récapitulatif');
    });

    it('previent le dirigeant par une alerte « Paiement manquant »', () => {
      listerTitresDesEtapes(campagneToutFerme);

      expect(alerteEspionnee).toHaveBeenCalledWith(
        'Paiement manquant',
        'Active au moins un moyen de paiement avant de terminer le tunnel.',
      );
    });
  });

  describe('le denominateur du « n/N » ne bouge plus sous les yeux du dirigeant', () => {
    // C'EST LE DEFAUT QUE D26 REPARE, et ces deux tests sont sa preuve. Avant, le
    // total changeait des qu'on basculait un interrupteur situe DANS le tunnel :
    // « etape 8/16 » devenait « 8/19 » sans avoir recule d'une seule etape.
    it('affiche le meme total pour deux campagnes qui different d un interrupteur', () => {
      expect(compterEtapes(campagneAvecRelances)).toBe(compterEtapes(campagneToutFerme));
    });

    it('n ecarte plus le plus court du plus long : l ecart est de 0', () => {
      expect(compterEtapes(campagneToutOuvert) - compterEtapes(campagneToutFerme)).toBe(0);
    });
  });
});
