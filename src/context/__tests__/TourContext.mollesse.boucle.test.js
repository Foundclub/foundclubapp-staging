import { QueryClient } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import SharedAppProviders from '../../app/AppProviders.shared';
import {
  emitGuidanceAction,
  emitGuidanceRouteVisit,
  resetGuidanceRuntimeForTests,
} from '../../domains/guidance/guidanceRuntime';
import { useTour } from '../TourContext';

// MOLLESSE (05/09) — LA BOUCLE, MAIS AVEC LE TOUR GUIDE ALLUME.
//
// Le premier temoin (AppProviders.mollesse.boucle) monte la pile AU REPOS et la
// trouve saine : 3 rendus. Or le contournement releve par le banc etait « fermer
// le tour guide » — donc l'etat qui compte est le tour EN MARCHE.
//
// ⚠️ CE QUI REND CE TEMOIN FIDELE, ET NON UN EPOUVANTAIL :
// en production, `App.js:299-301` recable la sortie sur l'entree —
//     onStateChange={(routeName) => { notifyRouteChanged(routeName);
//                                     emitGuidanceRouteVisit(routeName); }}
// Autrement dit : le tour NAVIGUE, la navigation EMET un signal de guidance, et
// ce signal peut valider l'etape suivante, qui navigue a son tour. C'est cette
// boucle de retour qu'on branche ici — pas une invention du test.

const mockNavigate = jest.fn();

jest.mock('@/store/appContext', () => {
  const store = new Map();
  return {
    AppProvider: ({ children }) => children,
    storage: {
      delete: (key) => store.delete(key),
      getString: (key) => (store.has(key) ? store.get(key) : undefined),
      set: (key, value) => store.set(key, value),
    },
  };
});

jest.mock('@/theme/themeContext', () => ({
  ThemeProvider: ({ children }) => children,
}));

jest.mock('@/context/AppFeedbackContext', () => ({
  AppFeedbackProvider: ({ children }) => children,
}));

const mockAppMode = { isGold: false };
const mockAuthValue = {
  appBootstrapData: null,
  userData: {
    club: { documentId: 'club-1' },
    documentId: 'user-mollesse-tour',
    myTeams: [],
    role: { name: 'Coach', type: 'coach' },
    trainedTeams: [],
  },
};

jest.mock('@/context/AppModeContext', () => ({
  AppModeProvider: ({ children }) => children,
  useAppMode: () => mockAppMode,
}));

jest.mock('@/context/ClubScopeContext', () => ({
  ClubScopeProvider: ({ children }) => children,
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuthValue,
}));

jest.mock('@/navigation/navigationService', () => ({
  navigate: (...args) => mockNavigate(...args),
}));

jest.mock('@/platform/storage', () => {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    removeItem: (key) => store.delete(key),
    setItem: (key, value) => store.set(key, value),
  };
});

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { patch: jest.fn(() => Promise.resolve({ data: null })) },
}));

// React jette a 50 mises a jour imbriquees ; on coupe avant pour rendre un
// chiffre au lieu d'une pile de 40 000 lignes.
const PLAFOND_RENDUS = 80;

// Mesures du 2026-09-05 sur `staging` (21275322).
const RENDUS_AU_DEMARRAGE_MAX = 8;
const RENDUS_PAR_ETAPE_MAX = 6;

let compteurRendus = 0;
let tour = null;

/**
 * Sonde : consomme le contexte du tour et compte ses rendus.
 * @returns {null} - Rien a afficher.
 */
function Sonde() {
  compteurRendus += 1;
  if (compteurRendus > PLAFOND_RENDUS) {
    throw new Error(`BOUCLE : ${compteurRendus} rendus avec le tour allume`);
  }
  tour = useTour();
  return null;
}

/**
 * Un signal de route, comme `App.js:300` en emet a chaque navigation.
 * @param {string} nom - Le nom de la route visitee.
 * @returns {void}
 */
const visiterEcran = (nom) => {
  act(() => {
    emitGuidanceRouteVisit(nom);
    jest.advanceTimersByTime(300);
  });
};

/**
 * Une etape validee a la main, comme le bandeau du tour le fait.
 * @returns {void}
 */
const validerEtape = () => {
  act(() => {
    tour.completeCurrentStep();
    jest.advanceTimersByTime(3000);
  });
};

// Un temoin ROUGE jette AVANT sa ligne de demontage : sans ce registre, l'arbre
// de la boucle precedente survit et continue de tourner pendant le test suivant
// (et jest ne s'eteint plus). Lecon du temoin FCMSTORM, on ne la repaie pas.
let arbreEnCours = null;

/**
 * Demonte ce qui traine, meme quand le temoin a jete avant sa derniere ligne.
 * @returns {void}
 */
const demonterCeQuiTraine = () => {
  if (!arbreEnCours) return;
  const arbre = arbreEnCours;
  arbreEnCours = null;
  act(() => { arbre.unmount(); });
};

const monter = () => {
  const queryClient = new QueryClient();
  let arbre;
  act(() => {
    arbre = renderer.create(
      <SharedAppProviders queryClient={queryClient}>
        <Sonde />
      </SharedAppProviders>,
    );
  });
  arbreEnCours = arbre;
  return arbre;
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  resetGuidanceRuntimeForTests();
  compteurRendus = 0;
  tour = null;
  // LE RECABLAGE DE PRODUCTION : naviguer emet un signal de route.
  mockNavigate.mockImplementation((routeName) => {
    emitGuidanceRouteVisit(String(routeName || ''));
    return true;
  });
});

afterEach(() => {
  demonterCeQuiTraine();
  act(() => jest.runOnlyPendingTimers());
  jest.useRealTimers();
  resetGuidanceRuntimeForTests();
});

describe('MOLLESSE — le tour guide en marche ne doit pas emballer la pile', () => {
  it('M4 — demarrer le tour coach ne declenche pas de boucle', () => {
    monter();
    const avant = compteurRendus;

    act(() => {
      tour.startTour('coach');
      jest.advanceTimersByTime(5000);
    });

    expect(tour.isTourActive).toBe(true);
    expect(compteurRendus - avant).toBeLessThanOrEqual(RENDUS_AU_DEMARRAGE_MAX);
    demonterCeQuiTraine();
  });

  it('M5 — une etape validee par un SIGNAL enchaine sans s emballer', () => {
    monter();
    act(() => {
      tour.startTour('coach');
      jest.advanceTimersByTime(100);
    });

    const avant = compteurRendus;
    // L'etape 1 du tour coach se valide sur l'action `team.created`.
    act(() => {
      emitGuidanceAction('team.created');
      // 1 800 ms de message de succes, puis navigation vers l'etape suivante,
      // qui emet a son tour un signal de route (recablage de production).
      jest.advanceTimersByTime(5000);
    });

    expect(compteurRendus - avant).toBeLessThanOrEqual(RENDUS_PAR_ETAPE_MAX);
    demonterCeQuiTraine();
  });

  it('M6 — 20 signaux de route pendant le tour ne font pas boucler la pile', () => {
    monter();
    act(() => {
      tour.startTour('coach');
      jest.advanceTimersByTime(100);
    });

    const avant = compteurRendus;
    for (let tourDeBoucle = 0; tourDeBoucle < 20; tourDeBoucle += 1) {
      visiterEcran(`Ecran${tourDeBoucle}`);
    }

    // Aucun de ces ecrans n'est la cle de succes de l'etape courante : le tour
    // ne doit PAS bouger, donc la pile ne doit pas se re-rendre.
    expect(compteurRendus - avant).toBeLessThanOrEqual(RENDUS_PAR_ETAPE_MAX);
    demonterCeQuiTraine();
  });

  it('M7 — le tour va jusqu au bout sans jamais depasser le plafond', () => {
    monter();
    act(() => {
      tour.startTour('coach');
      jest.advanceTimersByTime(100);
    });

    // On valide chaque etape a la main, comme le bandeau le fait.
    for (let etape = 0; etape < 12; etape += 1) {
      validerEtape();
    }

    expect(compteurRendus).toBeLessThanOrEqual(PLAFOND_RENDUS);
    expect(tour.isTourActive).toBe(false);
    demonterCeQuiTraine();
  });
});
