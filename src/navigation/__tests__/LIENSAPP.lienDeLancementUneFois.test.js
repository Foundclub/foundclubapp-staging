import {
  getActionFromState,
  getStateFromPath,
} from '@react-navigation/native';

/**
 * LIENS-APP (07/10/2026, decision du chef d orchestre sur le ⚖️ 4 du lot) -- LE LIEN QUI A
 * LANCE L APP SE REJOUAIT A CHAQUE CHANGEMENT DE COMPTE.
 *
 * appNavigator.js remonte le NavigationContainer a chaque changement de compte (cle
 * `navigationContainerKey` : connexion, inscription, deconnexion, ajout de compte). Or React
 * Navigation relit `Linking.getInitialURL()` a CHAQUE montage
 * (node_modules/@react-navigation/native/src/useLinking.native.tsx, getInitialState) : le lien
 * qui avait lance l app se rejouait apres la connexion. Son ecran devenait l etat INITIAL de la
 * pile connectee : seul (aucun Retour), et pour un compte NEUF il passait devant l accueil -- le
 * controle d age compris -- jusqu au lancement suivant. Un trou dans la protection des mineurs.
 *
 * Ce qui est exige, pour les liens que l app ouvre (evenement, club, equipe, Ville) :
 *   A. lance par le lien sans compte, puis connexion : le lien ne se rejoue pas ; la pile
 *      connectee part de son propre debut (l accueil d un compte neuf, controle d age d abord) ;
 *   B. lance par le lien deja connecte : la pile ne s ouvre pas sur le lien ; le lien attend que
 *      l accueil soit fait, puis passe par l ecoute ordinaire des liens ;
 *   C. cette ecoute EMPILE l ecran (une navigation, jamais une remise a zero) : le Retour existe.
 * ROUGE avant le correctif (A et B : le lien revenait a chaque montage).
 */

const mockLinkings = /** @type {any[]} */ ([]);
let mockEtatApp = /** @type {any} */ ({ auth: null, isAddingAccount: false });
let mockPileprete = true;
let mockLienDeLancement = /** @type {string | null} */ (null);

// Le Linking de React Native, double A LA SOURCE : chaque lancement (registre isole) en recree
// un, et au premier registre isole l objet lu par le test n est pas celui lu par l app (mesure
// du 07/10). La variable de lancement, elle, est la meme pour tous.
jest.mock('react-native/Libraries/Linking/Linking', () => ({
  __esModule: true,
  default: {
    addEventListener: () => ({ remove: () => {} }),
    getInitialURL: () => Promise.resolve(mockLienDeLancement),
  },
}));

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  __esModule: true,
  NavigationContainer: (/** @type {any} */ props) => {
    mockLinkings.push(props.linking);
    return null;
  },
}));
jest.mock('@/store/appContext', () => ({
  __esModule: true,
  useAppContext: () => [mockEtatApp],
}));
jest.mock('@/theme/themeContext', () => ({
  __esModule: true,
  default: () => ({
    ApplicationStyle: { darkNavigationTheme: {}, lightNavigationTheme: {} },
    Colors: {},
    scheme: 'light',
  }),
}));
jest.mock('@/utils/logger/logger', () => ({
  __esModule: true,
  createLogger: () => ({
    debug: () => {}, error: () => {}, info: () => {}, warn: () => {},
  }),
}));
jest.mock('@/navigation/navigationService', () => ({
  __esModule: true,
  navigate: () => true,
  navigationRef: { getCurrentRoute: () => ({ name: 'HomeTab' }), isReady: () => mockPileprete },
}));
jest.mock('@/platform/storage', () => ({
  getItem: () => undefined,
  removeItem: () => {},
  setItem: () => {},
}));
jest.mock('@/components/molecules/tour/TourBanner', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/navigation/private/PrivateNavigator', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../public/PublicMainNavigator', () => ({
  __esModule: true,
  default: () => null,
}));

const CONNECTE = { auth: { token: 'jeton-temoin' }, isAddingAccount: false };
const DECONNECTE = { auth: null, isAddingAccount: false };

// Les liens que l app ouvre : https reclames (evenement, Ville) et schema de l app (club, equipe).
const LIENS = [
  ['evenement', 'https://foundclub.app/events/evt-42', 'events/evt-42'],
  ['club', 'foundclub://club/club-42', 'club/club-42'],
  ['equipe', 'foundclub://team/team-42', 'team/team-42'],
  ['Ville', 'https://foundclub.app/invitation-ville/jeton-42', 'invitation-ville/jeton-42'],
];

/**
 * Un LANCEMENT de l app par `url` : un registre de modules neuf (le lien de lancement se lit
 * une fois par lancement, pas une fois par fichier de temoins).
 * @param {string} url le lien qui lance l app
 * @returns {any} les modules de ce lancement
 */
const lancer = (url) => {
  /** @type {any} */
  let app;
  mockLienDeLancement = url;
  jest.isolateModules(() => {
    app = {
      // eslint-disable-next-line global-require
      AppNavigator: require('../appNavigator').default,
      // eslint-disable-next-line global-require
      React: require('react'),
      // eslint-disable-next-line global-require
      renderer: require('react-test-renderer'),
    };
    try {
      // Le crochet du MEME lancement (meme registre que appNavigator).
      // eslint-disable-next-line global-require
      app.useLiensEnAttente = require('../useLiensEnAttente').default;
    } catch {
      app.useLiensEnAttente = null;
    }
  });
  return app;
};

/**
 * Monte appNavigator.js (un montage = un changement de compte) et rend son objet linking.
 * @param {any} app les modules du lancement
 * @param {any} etatApp { auth, isAddingAccount }
 * @returns {any} l objet linking passe au NavigationContainer
 */
const monter = (app, etatApp) => {
  mockEtatApp = etatApp;
  app.renderer.act(() => {
    app.renderer.create(app.React.createElement(app.AppNavigator, {
      navigationIntegration: { registerNavigationContainer: () => {} },
    }));
  });
  return mockLinkings[mockLinkings.length - 1];
};

/**
 * Ce que React Navigation lit au montage : la fonction du linking, sinon la sienne par defaut,
 * qui relit Linking.getInitialURL a chaque montage (useLinking.native.tsx:27-35).
 * @param {any} linking l objet linking
 * @returns {Promise<string | null | undefined>} le lien lu
 */
const lire = (linking) => (
  typeof linking.getInitialURL === 'function'
    ? linking.getInitialURL()
    : Promise.resolve(mockLienDeLancement)
);

beforeEach(() => {
  mockLinkings.length = 0;
  mockPileprete = true;
});

describe('A. lance par le lien SANS compte, puis connexion : le lien ne se rejoue pas', () => {
  it.each(LIENS)('%s', async (_nom, url) => {
    const app = lancer(url);

    // Sans compte : la page du lien s ouvre, comme avant.
    expect(await lire(monter(app, DECONNECTE))).toBe(url);
    // Connexion (ou inscription) : le conteneur est remonte. La pile connectee part de son
    // propre debut -- l accueil d un compte neuf, controle d age d abord.
    expect(await lire(monter(app, CONNECTE))).toBeNull();
    // Deconnexion : rien ne revient non plus.
    expect(await lire(monter(app, DECONNECTE))).toBeNull();
  });
});

describe('B. lance par le lien DEJA connecte : l accueil d abord, puis le lien s empile', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it.each(LIENS)('%s', async (_nom, url) => {
    const app = lancer(url);
    const linking = monter(app, CONNECTE);

    // La pile ne s ouvre pas sur le lien.
    expect(await lire(linking)).toBeNull();

    // React Navigation s abonne aux liens (useLinking.native.tsx:177-218) : on capte ce qu il
    // recoit.
    const recus = /** @type {string[]} */ ([]);
    expect(typeof linking.subscribe).toBe('function');
    linking.subscribe((/** @type {string} */ recu) => recus.push(recu));

    const { useLiensEnAttente } = app;
    expect(typeof useLiensEnAttente).toBe('function');
    /**
     * Monte un composant qui appelle le crochet, puis laisse passer le temps.
     * @param {boolean} pret compte charge et accueil fait
     * @returns {void}
     */
    const sonde = (pret) => {
      /**
       * Le composant sonde.
       * @returns {null} rien
       */
      function Sonde() {
        useLiensEnAttente(pret);
        return null;
      }
      app.renderer.act(() => { app.renderer.create(app.React.createElement(Sonde)); });
      app.renderer.act(() => { jest.advanceTimersByTime(2000); });
    };

    sonde(false);
    expect(recus).toEqual([]);
    sonde(true);
    expect(recus).toEqual([url]);
    // Une seule fois.
    sonde(true);
    expect(recus).toEqual([url]);
  });
});

describe('C. l ecoute des liens EMPILE l ecran : le Retour existe', () => {
  it.each(LIENS)('%s', (_nom, _url, chemin) => {
    const app = lancer('https://foundclub.app/');
    const { config } = monter(app, CONNECTE);
    const action = /** @type {any} */ (getActionFromState(
      /** @type {any} */ (getStateFromPath(chemin, config)),
      config,
    ));

    // useLinking.native.tsx:203-215 : une action -> dispatch par-dessus la pile en place ;
    // sans action, resetRoot (la pile remplacee : plus de Retour).
    expect(action?.type).toBe('NAVIGATE');
  });
});
