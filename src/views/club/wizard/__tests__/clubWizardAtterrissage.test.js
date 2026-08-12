import {
  createNavigatorFactory,
  NavigationContainer,
  useNavigationBuilder,
} from '@react-navigation/native';
import { StackRouter } from '@react-navigation/routers';
import { createElement } from 'react';
import { Alert, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubWizardRecap from '../ClubWizardRecap';

// Filet D81 (E6 — ce fichier n'avait AUCUN test) — OU L'ON ATTERRIT APRES AVOIR
// CREE SON CLUB, et ce qui reste sous les pieds.
//
// Constat d'Adel du 2026-08-12 : « quand on a publie, les fleches retour nous
// renvoient dans le formulaire ». Ici le tunnel fait 5 etapes, et l'arrivee
// s'appelait par `navigate` : la fiche du club se posait PAR-DESSUS les 5
// etapes, qui restaient toutes en dessous. Un seul « Retour » ramenait sur le
// recapitulatif d'un club DEJA CREE, bouton « Creer mon club » sous le doigt.
//
// 🧨 POURQUOI UN VRAI ROUTEUR ET PAS UN ESPION SUR `navigation.navigate` :
// c'est le motif du filet D24 (`friendlyMatchWizardAtterrissage.test.js`), et
// pour la meme raison — `navigate` vers un ecran DEJA empile depile, vers un
// ecran ABSENT empile. Un `expect(navigate).toHaveBeenCalledWith('Club')` est
// vert des DEUX cotes du correctif : seul l'etat de la pile les separe.
//
// Piles minimales : le VRAI routeur, le VRAI bouillonnement, zero dependance
// native. On mesure la mecanique, pas le dessin.

/** @type {any[]} */
const mockProprietesEtape = [];
const mockClubCree = { club: { documentId: 'club-neuf' } };
const mockCreerClub = jest.fn(async () => mockClubCree);
const mockActivites = { data: [] };
const mockClientRequete = { invalidateQueries: jest.fn() };
// Objet FIGE : un contexte neuf a chaque rendu relance les effets qui en
// dependent et fait tourner Jest en boucle infinie, sans message.
const mockEtatTunnel = Object.freeze({
  activityDocumentIds: [],
  addressOption: {
    label: '12 rue du Stade, Lyon', lat: 45.75, lng: 4.85,
  },
  email: 'contact@club.test',
  name: 'Club de la Duchere',
  phoneNumber: '0400000000',
});
const mockAuthentification = Object.freeze({
  getNextOnboardingRoute: () => null,
  getPostOnboardingHomeRoute: () => 'HomeTab',
  refetchUserData: jest.fn(),
  userData: { documentId: 'user-1' },
});

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mockClientRequete,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (/** @type {string} */ cle, /** @type {string} */ repli) => repli || cle }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuthentification,
}));

jest.mock('@/domains/auth/authUseCases', () => ({
  markOnboardingComplete: jest.fn(),
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
jest.mock('@/services/club/clubService', () => ({
  createSelfOnboardClub: (/** @type {any} */ ...arguments_) => mockCreerClub(...arguments_),
}));

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => mockActivites,
}));

jest.mock('../ClubWizardContext', () => ({
  useClubWizard: () => ({ dispatch: jest.fn(), state: mockEtatTunnel }),
}));

jest.mock('@/components/molecules/wizardOptionCard/WizardOptionCard', () => function CarteMock() {
  return null;
});

// La doublure capture les props et rend `null` : on pilote le tunnel par ses
// boutons (`onNext`, `onBack`), pas par la forme de son arbre.
jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => function EtapeMock(/** @type {any} */ props) {
  mockProprietesEtape.push(props);
  return null;
});

/**
 * Une pile minimale batie sur le routeur reel. Elle rend TOUS ses ecrans, comme
 * une vraie pile : c'est ce qui garde une sous-pile montee quand elle passe au
 * second plan. Motif repris du filet D24.
 * @param {any} props - Les props du navigateur.
 * @returns {any} Le contenu de navigation.
 */
function PileMinimale(props) {
  const { descriptors, NavigationContent, state } = useNavigationBuilder(StackRouter, props);
  return createElement(
    NavigationContent,
    null,
    state.routes.map((/** @type {any} */ route) => descriptors[route.key].render()),
  );
}

const creerPile = createNavigatorFactory(PileMinimale);
const Racine = creerPile();
const Pile = creerPile();

/**
 * Un ecran temoin : il affiche son nom, rien d'autre.
 * @param {string} nom - Le nom de la route.
 * @returns {any} Le composant d'ecran.
 */
const Ecran = (nom) => function EcranTemoin() {
  return createElement(Text, null, nom);
};

/** Les 5 etapes du tunnel, plus la liste et la fiche de club de `ClubStack`. */
function PileClub() {
  return createElement(
    Pile.Navigator,
    { id: undefined, initialRouteName: 'ClubList' },
    createElement(Pile.Screen, { component: Ecran('ClubList'), key: 'liste', name: 'ClubList' }),
    createElement(Pile.Screen, { component: Ecran('Club'), key: 'fiche', name: 'Club' }),
    createElement(Pile.Screen, { component: Ecran('ClubWizardName'), key: 'e1', name: 'ClubWizardName' }),
    createElement(Pile.Screen, { component: Ecran('ClubWizardAddress'), key: 'e2', name: 'ClubWizardAddress' }),
    createElement(Pile.Screen, { component: Ecran('ClubWizardActivities'), key: 'e3', name: 'ClubWizardActivities' }),
    createElement(Pile.Screen, { component: Ecran('ClubWizardContact'), key: 'e4', name: 'ClubWizardContact' }),
    createElement(Pile.Screen, { component: ClubWizardRecap, key: 'e5', name: 'ClubWizardRecap' }),
  );
}

/** @type {any} */
let conteneur = null;
/** @type {any} */
let arbre = null;

/**
 * Monte l'application reduite, puis entre dans le tunnel comme le fait la
 * recherche de clubs (`ClubListContent.js:507`) : les 5 etapes s'empilent.
 * @returns {void}
 */
const entrerDansLeTunnel = () => {
  mockProprietesEtape.length = 0;
  act(() => {
    arbre = renderer.create(createElement(
      NavigationContainer,
      { ref: (/** @type {any} */ reference) => { if (reference) conteneur = reference; } },
      createElement(
        Racine.Navigator,
        { id: undefined, initialRouteName: 'SearchStack' },
        createElement(Racine.Screen, { component: Ecran('SearchStack'), key: 'recherche', name: 'SearchStack' }),
        createElement(Racine.Screen, { component: PileClub, key: 'club', name: 'ClubStack' }),
      ),
    ));
  });

  ['ClubWizardName', 'ClubWizardAddress', 'ClubWizardActivities', 'ClubWizardContact', 'ClubWizardRecap']
    .forEach((etape) => {
      act(() => conteneur.navigate('ClubStack', { screen: etape }));
    });
};

/** @returns {string[]} Les routes de `ClubStack`, dans l'ordre de la pile. */
const pileClub = () => {
  const racine = conteneur.getRootState().routes
    .find((/** @type {any} */ route) => route.name === 'ClubStack');
  return racine?.state
    ? racine.state.routes.map((/** @type {any} */ route) => route.name)
    : [];
};

/** @returns {string[]} Les routes de la pile racine. */
const pileRacine = () => conteneur.getRootState().routes
  .map((/** @type {any} */ route) => route.name);

/** @returns {any} Les dernieres props recues par la mise en page du tunnel. */
const dernieresProps = () => mockProprietesEtape[mockProprietesEtape.length - 1];

/**
 * Appuie sur « Creer mon club », puis sur le « OK » de l'alerte de succes —
 * c'est CE bouton qui decide de l'atterrissage.
 * @returns {Promise<void>}
 */
const creerLeClub = async () => {
  await act(async () => { dernieresProps().onNext(); });

  const boutonOk = /** @type {any} */ (Alert.alert).mock.calls
    .map((/** @type {any[]} */ appel) => appel[2])
    .filter(Boolean)
    .flat()
    .find((/** @type {any} */ bouton) => typeof bouton?.onPress === 'function');

  await act(async () => { boutonOk?.onPress(); });
};

describe('D81 — apres la creation du club, le tunnel quitte la pile', () => {
  /** @type {any} */
  let alerteEspionnee;

  beforeEach(() => {
    mockCreerClub.mockClear();
    alerteEspionnee = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alerteEspionnee.mockRestore();
    if (arbre) act(() => arbre.unmount());
    arbre = null;
  });

  it('les 5 etapes ont disparu, il ne reste que la fiche du club', async () => {
    entrerDansLeTunnel();
    expect(pileClub()).toEqual([
      'ClubWizardName', 'ClubWizardAddress', 'ClubWizardActivities',
      'ClubWizardContact', 'ClubWizardRecap',
    ]);

    await creerLeClub();

    expect(pileClub()).toEqual(['Club']);
    expect(pileClub().some((nom) => nom.startsWith('ClubWizard'))).toBe(false);
  });

  it('le retour depuis la fiche sort du tunnel, il ne revient pas dedans', async () => {
    entrerDansLeTunnel();
    await creerLeClub();

    act(() => conteneur.goBack());

    // Plus rien de `ClubStack` : on ressort la ou on etait avant d'entrer.
    expect(pileRacine()).toEqual(['SearchStack']);
  });

  it('aucun second envoi possible : le club n est cree qu une fois', async () => {
    entrerDansLeTunnel();
    await creerLeClub();

    expect(mockCreerClub).toHaveBeenCalledTimes(1);
    // Le recapitulatif n'est plus dans la pile : aucun retour ne peut le
    // ramener, donc aucun second appui sur « Creer mon club ».
    expect(pileClub()).not.toContain('ClubWizardRecap');
  });

  it('AVANT la creation, le retour ramene toujours a l etape precedente', () => {
    entrerDansLeTunnel();

    act(() => { dernieresProps().onBack(); });

    expect(pileClub()).toEqual([
      'ClubWizardName', 'ClubWizardAddress', 'ClubWizardActivities', 'ClubWizardContact',
    ]);
    expect(mockCreerClub).not.toHaveBeenCalled();
  });
});
