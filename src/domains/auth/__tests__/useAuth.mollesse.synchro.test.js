import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

// MOLLESSE (05/09) — LES DEUX SYNCHRONISATIONS D'IDENTITE NE DOIVENT PAS SE
// RENVOYER LA BALLE.
//
// POURQUOI CE FICHIER EXISTE, et pourquoi il est dans le lot MOLLESSE :
//
// La pile relevee dans `logcat` le 17/08 a 16:51 avait `TourProvider` EN TETE :
//     Maximum update depth exceeded ... changes on every render
//       at TourProvider / BlockingOverlayProvider / ... / at StartupPhaseProvider
//
// Or React n'attribue pas cette pile au composant « fautif » au sens ou on
// l'entend : il l'attribue A LA FIBRE DONT L'EFFET TOURNAIT. Et `TourProvider`
// appelle `useAuth()` a sa premiere ligne (`TourContext.js:52`). ⇒ TOUS les
// effets de `useAuth` — et il y en a beaucoup, dont deux qui DISPATCHENT —
// tournent dans la fibre de `TourProvider` et s'afficheraient sous ce nom.
//
// Mesure faite le 05/09 : entre le commit du 17/08 (`3aae997a`) et `staging`,
// `AppProviders.shared.js` et les CINQ fournisseurs sont identiques AU BIT PRES
// (`git diff` vide). Le seul fichier de cette fibre qui a bouge est
// `useAuth.js` (+37 / -9, lots U05 et TRIO/A2).
//
// CE QUE CE TEMOIN MESURE, precisement :
// `useAuth` tient DEUX identites — le resume du bootstrap (`userSummary`) et le
// profil complet (`fullUserData`) — et DEUX effets qui les recopient dans le
// magasin global, chacun avec `appDispatch({ type: 'UPDATE_USER_DATA' })`.
// Si les deux identites different, chaque effet peut defaire ce que l'autre
// vient d'ecrire : c'est exactement la forme « setState dans un useEffect dont
// une dependance change a chaque rendu » que React nomme.
//
// Le compteur de dispatches EST la mesure.

const mockGetAppBootstrap = jest.fn();
const mockGetMe = jest.fn();

let compteurDispatchIdentite = 0;

// Le VRAI reducteur du magasin : c'est lui qui decide si un `UPDATE_USER_DATA`
// change quelque chose ou non (`appReducer.js:262-305`). Le doubler serait
// tester une copie de la regle.
jest.mock('@/store/appContext', () => {
  // Une fabrique jest.mock ne peut pas fermer sur un import de haut niveau.
  // eslint-disable-next-line global-require
  const { useReducer: useReducerReel } = require('react');
  // eslint-disable-next-line global-require
  const reducteurReel = require('@/store/appReducer').default;

  return {
    storage: {
      delete: jest.fn(), getAllKeys: () => [], getString: () => undefined, set: jest.fn(),
    },
    useAppContext: () => {
      const [etat, envoyer] = useReducerReel(reducteurReel, global.mollesseEtatInitial);
      return [etat, (action) => {
        if (action?.type === 'UPDATE_USER_DATA') {
          global.mollesseCompteur.dispatches += 1;
        }
        envoyer(action);
      }];
    },
  };
});

jest.mock('@/context/AppModeContext', () => ({ useAppMode: () => ({ isGold: false }) }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ key, /** @type {string} */ repli) => repli || key,
  }),
}));

// Ces modules lisent `.env`, absent de toute copie de travail : sans doublure
// c'est la SUITE ENTIERE qui meurt au chargement (0 test execute).
jest.mock('@/services/auth/authService', () => ({
  deleteDeviceToken: jest.fn(),
  getMe: (...args) => mockGetMe(...args),
  login: jest.fn(),
  logout: jest.fn(),
  signInWithPhoneNumber: jest.fn(),
}));
jest.mock('@/services/bootstrap/bootstrapService', () => ({
  getAppBootstrap: (...args) => mockGetAppBootstrap(...args),
}));
jest.mock('@/services/bootRequestGuard', () => ({
  getRetryAfterSeconds: () => 0,
  resetBootRequestGuard: jest.fn(),
}));
jest.mock('@/hooks/useNotificationController', () => ({ UNREAD_COUNT_QUERY_KEY: ['unread'] }));
jest.mock('@/platform/share', () => ({ __esModule: true, default: { share: jest.fn() } }));

// Un JETON DIFFERENT par temoin. Les garde-fous de `useAuth`
// (`lastBootstrapSyncedKey`, `lastFullUserSyncedKey`) sont des variables de
// MODULE, partagees par tous ses appelants et par tous les tests du fichier ;
// on ne peut pas les remettre a zero avec `jest.resetModules()` sans recharger
// un SECOND React (le rendu meurt alors sur « Cannot read properties of null
// (reading 'useState') »). Leur cle contient le jeton : changer de jeton suffit
// a rendre les temoins independants.
// 📌 Ce detail EST un constat : ces garde-fous survivent au demontage du
// composant et sont communs a toute l'application.
let JETON = 'JETON-MOLLESSE-1';
const IDENTITE = 'user-mollesse';

// Le resume du bootstrap et le profil complet DIFFERENT — c'est le cas qui
// rend la partie de ping-pong possible. Ils decrivent la meme personne.
const RESUME_BOOTSTRAP = {
  documentId: IDENTITE,
  firstname: 'Mouri',
  id: 134,
  lastname: 'Nio',
  role: { name: 'President', type: 'president' },
};

const PROFIL_COMPLET = {
  ...RESUME_BOOTSTRAP,
  clubs: [{ documentId: 'club-1', name: 'AIKI' }],
  myTeams: [],
  phone: '+33644444444',
  trainedTeams: [],
};

// React jette a 50 mises a jour imbriquees ; on coupe avant pour rendre un
// chiffre plutot qu'une pile.
const PLAFOND_RENDUS = 60;

// MESURES du 2026-09-05 sur `staging` (21275322) : **3 rendus, 1 dispatch**,
// dans les deux temoins. Les bornes laissent le double, pas dix fois.
const RENDUS_MAX = 6;
const DISPATCHES_IDENTITE_MAX = 2;

// ⚠️ ET IL FAUT QUE CA MESURE QUELQUE CHOSE. Un temoin vert qui n'execute aucun
// effet ne prouve rien (c'est le piege du banc SQLite : un voyant vert branche
// sur rien). On exige donc qu'AU MOINS UN dispatch soit parti.
const DISPATCHES_IDENTITE_MIN = 1;

let compteurRendus = 0;

// Un temoin ROUGE jette AVANT sa ligne de demontage : sans ce registre, l'arbre
// survit et jest ne s'eteint plus. Lecon du temoin FCMSTORM.
let demontageEnCours = null;

/**
 * Demonte ce qui traine, meme quand le temoin a jete avant sa derniere ligne.
 * @returns {void}
 */
const demonterCeQuiTraine = () => {
  if (!demontageEnCours) return;
  const demonter = demontageEnCours;
  demontageEnCours = null;
  demonter();
};

/**
 * Monte le VRAI hook, avec un jeton, un resume de bootstrap et un profil
 * complet deja en cache, puis laisse vivre le temps demande.
 * @param {{ dureeMs?: number, profilEnCache?: any }} [options] - Duree simulee
 *   apres le montage, et le profil complet a mettre en cache.
 * @returns {Promise<{ demonter: () => void }>} - Poignee de demontage.
 */
const monterEtLaisserVivre = async ({ dureeMs = 20000, profilEnCache = PROFIL_COMPLET } = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  // Le profil complet est DEJA en cache : c'est la situation que le lot U05 a
  // rendue possible (`hasCachedFullUser`, useAuth.js:326-330).
  queryClient.setQueryData(['get-me', JETON], profilEnCache);

  // eslint-disable-next-line global-require
  const useAuth = require('../useAuth').default;

  /**
   * Sonde : elle ne rend rien, elle fait vivre le hook et compte les rendus.
   * @returns {null} - Rien a afficher.
   */
  function Sonde() {
    compteurRendus += 1;
    if (compteurRendus > PLAFOND_RENDUS) {
      throw new Error(`BOUCLE : ${compteurRendus} rendus de useAuth`);
    }
    useAuth();
    return null;
  }

  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={queryClient}>
        <Sonde />
      </QueryClientProvider>,
    );
  });

  for (let tour = 0; tour < 20; tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      jest.advanceTimersByTime(Math.ceil(dureeMs / 20));
      await Promise.resolve();
    });
  }

  demontageEnCours = () => {
    act(() => { arbre.unmount(); });
    queryClient.clear();
  };

  return { demonter: demontageEnCours };
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  // Les compteurs passent par `global` : la fabrique jest.mock est hissee
  // au-dessus des imports et ne peut pas fermer sur une variable de module.
  global.mollesseCompteur = { dispatches: 0 };
  global.mollesseEtatInitial = {
    activeSessionDocumentId: IDENTITE,
    auth: { token: JETON, user: RESUME_BOOTSTRAP },
    authSessions: [{ token: JETON, user: RESUME_BOOTSTRAP }],
    isAddingAccount: false,
  };
  compteurRendus = 0;
  compteurDispatchIdentite = 0;
  mockGetAppBootstrap.mockResolvedValue({
    serverTime: '2026-09-05T18:00:00.000Z',
    unreadNotificationsCount: 0,
    userSummary: RESUME_BOOTSTRAP,
  });
  mockGetMe.mockResolvedValue(PROFIL_COMPLET);
});

afterEach(() => {
  demonterCeQuiTraine();
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe('MOLLESSE — useAuth tourne dans la fibre de TourProvider : il ne doit pas boucler', () => {
  it('M8 — resume et profil complet cohabitent sans partie de ping-pong', async () => {
    JETON = 'JETON-MOLLESSE-M8';
    global.mollesseEtatInitial.auth.token = JETON;
    global.mollesseEtatInitial.authSessions[0].token = JETON;

    await monterEtLaisserVivre();
    compteurDispatchIdentite = global.mollesseCompteur.dispatches;

    expect(compteurDispatchIdentite).toBeGreaterThanOrEqual(DISPATCHES_IDENTITE_MIN);
    expect(compteurRendus).toBeLessThanOrEqual(RENDUS_MAX);
    expect(compteurDispatchIdentite).toBeLessThanOrEqual(DISPATCHES_IDENTITE_MAX);
    demonterCeQuiTraine();
  });

  it('M9 — meme quand le profil complet DIFFERE du resume, ca se stabilise', async () => {
    // Le profil complet porte un nom different : les deux effets de
    // synchronisation ne peuvent PAS etre d'accord du premier coup.
    JETON = 'JETON-MOLLESSE-M9';
    global.mollesseEtatInitial.auth.token = JETON;
    global.mollesseEtatInitial.authSessions[0].token = JETON;
    // ⚠️ C'est le CACHE qui alimente `fullUserData`, pas le mock : la query est
    // eteinte des que le profil complet est deja en cache (U05). Doubler
    // `getMe` sans amorcer le cache ne mesurerait RIEN — le premier jet de ce
    // temoin faisait exactement cette erreur (1 dispatch au lieu de 2).
    const profilDivergent = { ...PROFIL_COMPLET, lastname: 'Nio-Modifie' };
    mockGetMe.mockResolvedValue(profilDivergent);

    await monterEtLaisserVivre({ dureeMs: 60000, profilEnCache: profilDivergent });
    compteurDispatchIdentite = global.mollesseCompteur.dispatches;

    expect(compteurDispatchIdentite).toBeGreaterThanOrEqual(DISPATCHES_IDENTITE_MIN);
    expect(compteurRendus).toBeLessThanOrEqual(RENDUS_MAX);
    expect(compteurDispatchIdentite).toBeLessThanOrEqual(DISPATCHES_IDENTITE_MAX);
    demonterCeQuiTraine();
  });
});
