import { QueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import renderer, { act } from 'react-test-renderer';

import {
  useBlockingOverlayLifecycle,
  useBlockingOverlayPrompt,
} from '../../context/BlockingOverlayContext';
import { usePopupEligibility } from '../../context/PopupManagerContext';
import { STARTUP_PHASES, useStartupPhase } from '../../context/StartupPhaseContext';
import SharedAppProviders from '../AppProviders.shared';

// MOLLESSE (05/09) — REPRODUCTION DE LA BOUCLE DE RENDUS « AU-DESSUS DE TOUTE L'APP ».
//
// Le banc d'essai a releve le 17/08 a 16:51, dans `logcat` :
//   Maximum update depth exceeded ... changes on every render
//     at TourProvider / BlockingOverlayProvider / SmartNotificationProvider
//     / PopupManagerProvider / StartupPhaseProvider
//
// Les cinq noms sont EXACTEMENT la pile de `AppProviders.shared.js`. Ce fichier
// monte donc cette pile POUR DE VRAI (aucun des cinq n'est mocke) et compte les
// rendus. Un compteur borne, pas un adjectif.
//
// Le consommateur `Sonde` n'invente rien : il recopie le motif de
// `src/App.js` (BootErrorAlertHost, :199-213) — `usePopupEligibility`, puis
// `useBlockingOverlayPrompt` / `useBlockingOverlayLifecycle`, puis un effet qui
// appelle `popup.markShown()` avec `popup` DANS SES DEPENDANCES.

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
    documentId: 'user-mollesse',
    myTeams: [],
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
  navigate: jest.fn(() => true),
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

// Un descripteur `startup_blocking`, comme les vrais bloquants du demarrage
// (BOOT_ERROR_ALERT, PUSH_PERMISSION_PREPROMPT, campagnes distantes).
const DESCRIPTEUR_BLOQUANT = Object.freeze({
  allowedStartupPhases: ['startup_prompt_window'],
  blocking: true,
  id: 'mollesse:sonde-bloquante',
  kind: 'startup_blocking',
  priority: 30,
  surface: 'modal',
});

// PLAFOND DE SECURITE. React jette au bout de 50 mises a jour imbriquees ; on
// coupe AVANT, pour rendre un chiffre plutot qu'une pile de 40 000 lignes.
const PLAFOND_RENDUS = 60;

// LES CHIFFRES MESURES LE 2026-09-05 sur `staging` (21275322), et les bornes
// qu'ils autorisent. Ce ne sont pas des marges de confort : une pile qui se
// remet a churner les depassera des le premier ecran de trop.
const RENDUS_AU_REPOS_MAX = 5; // mesure : 3
const RENDUS_POUR_20_ECRANS_MAX = 30; // mesure : 24, soit ~1,05 par changement
const RENDUS_A_L_OUVERTURE_MAX = 4; // mesure : 1

let compteurRendus = 0;
let pilote = null;

/**
 * Recopie du motif de production `src/App.js:199-213`.
 * @returns {null} - Rien a afficher : la sonde ne sert qu'a compter.
 */
function Sonde() {
  compteurRendus += 1;
  if (compteurRendus > PLAFOND_RENDUS) {
    throw new Error(`BOUCLE : ${compteurRendus} rendus de la sonde`);
  }

  const { markNavigationReady, notifyRouteChanged, phase } = useStartupPhase();
  const [visible, setVisible] = useState(false);

  const popup = usePopupEligibility(DESCRIPTEUR_BLOQUANT, true, {
    cooldownKey: 'mollesse',
  });
  const canShow = useBlockingOverlayPrompt(
    popup.descriptor.id,
    popup.canShow,
    popup.descriptor.priority,
  );
  const isVisible = Boolean(visible && popup.canShow && canShow);
  useBlockingOverlayLifecycle(popup.descriptor.id, isVisible, { releaseDelayMs: 320 });

  // ⬅️ LE MOTIF SUSPECT : `popup` est un OBJET dans la liste de dependances.
  useEffect(() => {
    if (!isVisible) return;
    popup.markShown({ source: 'mollesse' });
  }, [isVisible, popup]);

  pilote = {
    markNavigationReady,
    notifyRouteChanged,
    ouvrir: () => setVisible(true),
    phase,
  };

  return null;
}

/**
 * Un changement d'ecran, comme `App.js` le fait sur `onStateChange`.
 * @param {string} nom - Le nom de la route atteinte.
 * @returns {void}
 */
const changerEcran = (nom) => {
  act(() => {
    pilote.notifyRouteChanged(nom);
    jest.advanceTimersByTime(600);
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
  compteurRendus = 0;
  pilote = null;
});

afterEach(() => {
  demonterCeQuiTraine();
  act(() => jest.runOnlyPendingTimers());
  jest.useRealTimers();
});

describe('MOLLESSE — la pile de fournisseurs ne doit pas se re-rendre en boucle', () => {
  it('M1 — au repos, le montage se stabilise en quelques rendus', () => {
    monter();

    act(() => {
      pilote.markNavigationReady('Home');
      jest.advanceTimersByTime(1000);
    });

    expect(compteurRendus).toBeLessThanOrEqual(RENDUS_AU_REPOS_MAX);
    demonterCeQuiTraine();
  });

  it('M2 — 20 changements d ecran ne declenchent pas de boucle', () => {
    monter();

    act(() => {
      pilote.markNavigationReady('Home');
      jest.advanceTimersByTime(1000);
    });

    for (let tour = 0; tour < 20; tour += 1) {
      changerEcran(`Ecran${tour}`);
    }

    expect(compteurRendus).toBeLessThanOrEqual(RENDUS_POUR_20_ECRANS_MAX);
    demonterCeQuiTraine();
  });

  it('M3 — un bloquant qui s affiche pendant la fenetre de demarrage ne boucle pas', () => {
    monter();

    act(() => {
      pilote.markNavigationReady('Home');
      jest.advanceTimersByTime(3000);
    });

    // On amene la phase jusqu a `startup_prompt_window`, la seule ou le
    // descripteur est eligible.
    act(() => {
      pilote.notifyRouteChanged('Home');
      jest.advanceTimersByTime(600);
    });
    act(() => {
      pilote.markNavigationReady('Home');
      jest.advanceTimersByTime(600);
    });

    const rendusAvantOuverture = compteurRendus;
    act(() => {
      pilote.ouvrir();
      jest.advanceTimersByTime(1000);
    });

    expect(pilote.phase).not.toBe(STARTUP_PHASES.BOOT_CORE);
    expect(compteurRendus - rendusAvantOuverture).toBeLessThanOrEqual(RENDUS_A_L_OUVERTURE_MAX);
    demonterCeQuiTraine();
  });
});
