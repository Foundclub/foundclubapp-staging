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
  const route = { params: { campaign: campagne, clubId: 'club-D18', createNew: true } };
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

describe('ClubLicenseCampaignSettings — la machine a etapes (filet E6, avant D19)', () => {
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
    it('compte 13 etapes quand les 4 interrupteurs sont fermes — c est le socle', () => {
      expect(compterEtapes(campagneToutFerme)).toBe(13);
    });

    it('compte 22 etapes quand les 4 interrupteurs sont ouverts — c est le maximum', () => {
      expect(compterEtapes(campagneToutOuvert)).toBe(22);
    });
  });

  describe('ce que chaque interrupteur ajoute au denominateur', () => {
    it('le paiement fractionne ajoute 3 etapes', () => {
      expect(compterEtapes(campagneAvecFractionnement) - compterEtapes(campagneToutFerme)).toBe(3);
    });

    it('un moyen de paiement hors ligne ajoute 1 etape', () => {
      expect(
        compterEtapes(campagneAvecConsignesHorsLigne) - compterEtapes(campagneToutFerme),
      ).toBe(1);
    });

    it('un moyen de paiement en ligne ajoute 2 etapes', () => {
      expect(compterEtapes(campagneAvecPaiementEnLigne) - compterEtapes(campagneToutFerme)).toBe(2);
    });

    it('les relances automatiques ajoutent 3 etapes', () => {
      expect(compterEtapes(campagneAvecRelances) - compterEtapes(campagneToutFerme)).toBe(3);
    });

    it('les 4 ajouts se cumulent exactement : 13 + 3 + 1 + 2 + 3 = 22', () => {
      const socle = compterEtapes(campagneToutFerme);
      const ajouts = [
        campagneAvecFractionnement,
        campagneAvecConsignesHorsLigne,
        campagneAvecPaiementEnLigne,
        campagneAvecRelances,
      ].reduce((total, campagne) => total + (compterEtapes(campagne) - socle), 0);

      expect(socle + ajouts).toBe(compterEtapes(campagneToutOuvert));
    });
  });

  describe('ce que voit un dirigeant qui cree une campagne neuve', () => {
    // Ce test est la surprise du lot : le socle est bien de 13 etapes, mais
    // PERSONNE ne le voit. Les valeurs par defaut du tunnel ouvrent deux
    // interrupteurs sans rien demander — `defaultPaymentModes` active virement,
    // especes et cheque (l. 276-284), et `normalizeReminderAutomation` rend
    // `enabled: true` quand la campagne ne dit rien (l. 266).
    it('voit un tunnel plus long que le socle, sans avoir touche a un seul interrupteur', () => {
      const socle = compterEtapes(campagneToutFerme);
      const campagneNeuve = compterEtapes(null);

      expect(campagneNeuve).toBeGreaterThan(socle);
    });

    it('voit exactement 17 etapes : le socle + les consignes hors ligne + les relances', () => {
      expect(compterEtapes(null)).toBe(17);
    });
  });

  describe('l ordre des etapes', () => {
    it('deroule le plus court tunnel FRANCHISSABLE dans cet ordre exact', () => {
      expect(listerTitresDesEtapes(campagneAvecConsignesHorsLigne)).toEqual([
        'Nom',
        'Description',
        'Periode',
        'Public concerne',
        'Prix',
        'Tarifs speciaux',
        'Paiement fractionne',
        'Moyens de paiement',
        'Consignes',
        'Documents',
        'Retard',
        'Relances auto',
        'Note interne',
        'Recap',
      ]);
    });

    it('insere les 8 etapes conditionnelles a leur place, sans deplacer le socle', () => {
      expect(listerTitresDesEtapes(campagneToutOuvert)).toEqual([
        'Nom',
        'Description',
        'Periode',
        'Public concerne',
        'Prix',
        'Tarifs speciaux',
        'Paiement fractionne',
        'Nombre d échéances',
        'Options d échéancier',
        'Echeances',
        'Moyens de paiement',
        'Consignes',
        'Encaissement',
        'Paiement en ligne',
        'Documents',
        'Retard',
        'Relances auto',
        'Statuts à relancer',
        'Cadence de relance',
        'Message',
        'Note interne',
        'Recap',
      ]);
    });
  });

  describe('le socle de 13 etapes existe dans la liste, mais personne ne peut le traverser', () => {
    // Trouvaille du filet, mesuree et non deduite : le socle est bien la forme
    // la plus courte que la LISTE puisse prendre, mais le dirigeant ne peut
    // jamais le parcourir. L'etape « Moyens de paiement » refuse d'avancer tant
    // qu'aucun moyen n'est actif (l. 2039), et fermer les 4 interrupteurs
    // implique justement de les avoir tous fermes.
    it('bloque a « Moyens de paiement » et n atteint jamais le recapitulatif', () => {
      const titres = listerTitresDesEtapes(campagneToutFerme);

      expect(titres[titres.length - 1]).toBe('Moyens de paiement');
      expect(titres).not.toContain('Recap');
    });

    it('previent le dirigeant par une alerte « Paiement manquant »', () => {
      listerTitresDesEtapes(campagneToutFerme);

      expect(alerteEspionnee).toHaveBeenCalledWith(
        'Paiement manquant',
        'Active au moins un moyen de paiement avant de terminer le tunnel.',
      );
    });
  });

  describe('le denominateur du « n/N » bouge sous les yeux du dirigeant', () => {
    // C'est le defaut que D19 repare. Le tunnel annonce « etape n/N » alors que
    // N depend d'interrupteurs situes DANS le tunnel : le dirigeant voit son
    // total changer en cours de route, sans avoir recule d'une seule etape.
    it('affiche deux totaux differents pour deux campagnes identiques a un interrupteur pres', () => {
      expect(compterEtapes(campagneAvecRelances)).not.toBe(compterEtapes(campagneToutFerme));
    });

    it('ecarte le plus court du plus long de 9 etapes', () => {
      expect(compterEtapes(campagneToutOuvert) - compterEtapes(campagneToutFerme)).toBe(9);
    });
  });
});
