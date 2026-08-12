import {
  createNavigatorFactory,
  NavigationContainer,
  useNavigationBuilder,
} from '@react-navigation/native';
import { StackRouter } from '@react-navigation/routers';
import { createElement } from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import AdminClubWizardRecap from '../AdminClubWizardRecap';

// Filet D81 (E6 — ce fichier n'avait AUCUN test) — OU L'ON ATTERRIT APRES AVOIR
// CREE UN CLUB DEPUIS LA CONSOLE SUPERADMIN, et ce qui reste sous les pieds.
//
// Le tunnel fait 8 etapes et l'arrivee s'appelait par `replace` : `replace` ne
// retire QUE l'ecran courant. Les 7 etapes precedentes restaient donc en
// dessous de la fiche du club, et le premier « Retour » retombait sur
// « Sponsors » — avec, deux pas plus loin, un « Creer le club » qui repartait.
//
// 🧨 Meme raison qu'au filet D24 de le mesurer avec le VRAI routeur plutot
// qu'avec un espion : `expect(replace).toHaveBeenCalled()` etait vert AVANT le
// correctif comme apres. Seul l'etat de la pile separe les deux.

/** @type {any[]} */
const mockProprietesEtape = [];
const mockClubCree = { data: { documentId: 'club-admin-neuf' } };
const mockCreerClub = jest.fn(async () => mockClubCree);
// Objet FIGE : un etat neuf a chaque rendu relance les `useMemo` qui en
// dependent et fait tourner Jest en boucle infinie, sans message.
const mockEtatTunnel = Object.freeze({
  activites: [],
  addressLabel: '12 rue du Stade',
  city: 'Lyon',
  email: 'contact@club.test',
  name: 'Club de la Duchere',
  phoneNumber: '0400000000',
  postcode: '69009',
  saveReason: 'Recette D81',
  sponsor: [],
});
const mockMutationCreation = Object.freeze({
  isPending: false,
  mutateAsync: (/** @type {any} */ ...arguments_) => mockCreerClub(...arguments_),
});

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
jest.mock('@/services/admin/adminClubContentQueries', () => ({
  useCreateAdminClubContent: () => mockMutationCreation,
}));

jest.mock('../AdminClubWizardContext', () => ({
  ADMIN_CLUB_WIZARD_TOTAL_STEPS: 8,
  isAdminClubWizardPristine: () => true,
  useAdminClubWizard: () => ({ reset: jest.fn(), setField: jest.fn(), state: mockEtatTunnel }),
}));

jest.mock('@/components/molecules/input/Input', () => function InputMock() {
  return null;
});

// La doublure capture les props et rend `null` : on pilote le tunnel par ses
// boutons (`onNext`, `onBack`), pas par la forme de son arbre.
jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => function EtapeMock(/** @type {any} */ props) {
  mockProprietesEtape.push(props);
  return null;
});

/**
 * Une pile minimale batie sur le routeur reel. Motif repris du filet D24.
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

const LES_SEPT_PREMIERES = [
  'AdminClubWizardIdentity',
  'AdminClubWizardContact',
  'AdminClubWizardAddress',
  'AdminClubWizardActivities',
  'AdminClubWizardBusiness',
  'AdminClubWizardMultisport',
  'AdminClubWizardSponsors',
];

/** La console SuperAdmin, reduite a la liste, la fiche et les 8 etapes. */
function PileAdmin() {
  return createElement(
    Pile.Navigator,
    { id: undefined, initialRouteName: 'AdminClubList' },
    createElement(Pile.Screen, { component: Ecran('AdminClubList'), key: 'liste', name: 'AdminClubList' }),
    createElement(Pile.Screen, { component: Ecran('AdminClubDetail'), key: 'fiche', name: 'AdminClubDetail' }),
    ...LES_SEPT_PREMIERES.map((nom) => createElement(Pile.Screen, {
      component: Ecran(nom),
      key: nom,
      name: nom,
    })),
    createElement(Pile.Screen, {
      component: AdminClubWizardRecap,
      key: 'recap',
      name: 'AdminClubWizardRecap',
    }),
  );
}

/** @type {any} */
let conteneur = null;
/** @type {any} */
let arbre = null;

/**
 * Monte la console reduite, puis empile les 8 etapes depuis la liste des clubs.
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
        { id: undefined, initialRouteName: 'SuperAdminHome' },
        createElement(Racine.Screen, { component: Ecran('SuperAdminHome'), key: 'accueil', name: 'SuperAdminHome' }),
        createElement(Racine.Screen, { component: PileAdmin, key: 'admin', name: 'AdminStack' }),
      ),
    ));
  });

  [...LES_SEPT_PREMIERES, 'AdminClubWizardRecap'].forEach((etape) => {
    act(() => conteneur.navigate('AdminStack', { screen: etape }));
  });
};

/** @returns {string[]} Les routes de `AdminStack`, dans l'ordre de la pile. */
const pileAdmin = () => {
  const racine = conteneur.getRootState().routes
    .find((/** @type {any} */ route) => route.name === 'AdminStack');
  return racine?.state
    ? racine.state.routes.map((/** @type {any} */ route) => route.name)
    : [];
};

/** @returns {any} Les dernieres props recues par la mise en page du tunnel. */
const dernieresProps = () => mockProprietesEtape[mockProprietesEtape.length - 1];

describe('D81 — apres la creation du club SuperAdmin, le tunnel quitte la pile', () => {
  beforeEach(() => {
    mockCreerClub.mockClear();
  });

  afterEach(() => {
    if (arbre) act(() => arbre.unmount());
    arbre = null;
  });

  it('les 8 etapes ont disparu, il reste la liste et la fiche du club', async () => {
    entrerDansLeTunnel();
    expect(pileAdmin()).toEqual([...LES_SEPT_PREMIERES, 'AdminClubWizardRecap']);

    await act(async () => { dernieresProps().onNext(); });

    expect(pileAdmin()).toEqual(['AdminClubList', 'AdminClubDetail']);
    expect(pileAdmin().some((nom) => nom.startsWith('AdminClubWizard'))).toBe(false);
  });

  it('le retour depuis la fiche mene a la liste des clubs, jamais aux sponsors', async () => {
    entrerDansLeTunnel();
    await act(async () => { dernieresProps().onNext(); });

    act(() => conteneur.goBack());

    expect(pileAdmin()).toEqual(['AdminClubList']);
  });

  it('aucun second envoi possible : le club n est cree qu une fois', async () => {
    entrerDansLeTunnel();
    await act(async () => { dernieresProps().onNext(); });

    expect(mockCreerClub).toHaveBeenCalledTimes(1);
    expect(pileAdmin()).not.toContain('AdminClubWizardRecap');
  });

  it('AVANT la creation, le retour ramene toujours a l etape precedente', () => {
    entrerDansLeTunnel();

    act(() => { dernieresProps().onBack(); });

    expect(pileAdmin()).toEqual(LES_SEPT_PREMIERES);
    expect(mockCreerClub).not.toHaveBeenCalled();
  });
});
