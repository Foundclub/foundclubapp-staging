// NOTIF-COMPTE (D122, demande d'Adel du 13/11) — la rangée « Notifications » de « Mon compte ».
// Un iPhone qui a refusé une fois ne redemande plus jamais : seuls les Réglages rallument.
// 🎯 CE QUI EST MESURÉ : l'état lu (3 cas), le geste de chaque état, et, au retour au premier
// plan, la relecture de l'état puis le RÉ-ENREGISTREMENT du jeton dès que la permission est
// accordée (par l'activation branchée par NotificationBootstrap, la même route qu'au démarrage).
import { AppState, Linking } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { brancherActivationNotifications } from '@/utils/notifications/preDemandeNotifications';

import useNotificationsDuCompte from '@/hooks/useNotificationsDuCompte';

/** @type {string} */
let mockEtat = 'a_demander';

jest.mock('@/constants/runtimeFlags', () => ({
  ...jest.requireActual('@/constants/runtimeFlags'),
  ENABLE_PUSH_NOTIFICATIONS: true,
}));
jest.mock('@/utils/notifications/etatPermissionNotifications', () => ({
  lireEtatPermissionNotifications: jest.fn(async () => mockEtat),
}));
jest.mock('@/platform/storage', () => ({ getItem: () => null, setItem: () => {} }));

/** @type {any} */
let resultat = null;
/** @type {any} */
let arbre = null;
/** @type {Function[]} */
let ecouteursAppState = [];
/** @type {jest.Mock} */
let activer;
/** @type {() => void} */
let debrancher;

/**
 * Le composant témoin : il expose ce que rend le crochet.
 * @returns {null} - Rien à l'écran.
 */
function Temoin() {
  resultat = useNotificationsDuCompte();
  return null;
}

const attendre = async () => {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
};

const monter = async () => {
  await act(async () => { arbre = renderer.create(<Temoin />); });
  await attendre();
};

const revenirAuPremierPlan = async () => {
  await act(async () => { ecouteursAppState.forEach((ecouteur) => ecouteur('active')); });
  await attendre();
};

beforeEach(() => {
  ecouteursAppState = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, ecouteur) => {
    ecouteursAppState.push(ecouteur);
    const remove = () => {
      ecouteursAppState = ecouteursAppState.filter((e) => e !== ecouteur);
    };
    return { remove };
  });
  jest.spyOn(Linking, 'openSettings').mockImplementation(async () => {});
  activer = jest.fn(async () => 'success');
  debrancher = brancherActivationNotifications(activer);
});

afterEach(() => {
  act(() => { arbre?.unmount(); });
  arbre = null;
  debrancher();
  jest.restoreAllMocks();
});

describe('les trois états', () => {
  it('accordée : « accordee », et le geste ne fait rien', async () => {
    mockEtat = 'accordee';
    await monter();
    expect(resultat.etat).toBe('accordee');

    await act(async () => { await resultat.agir(); });

    expect(activer).not.toHaveBeenCalled();
    expect(Linking.openSettings).not.toHaveBeenCalled();
  });

  it('jamais demandée : le geste ouvre la demande système (celle de la pré-demande)', async () => {
    mockEtat = 'a_demander';
    await monter();
    expect(resultat.etat).toBe('a_demander');

    mockEtat = 'accordee';
    await act(async () => { await resultat.agir(); });
    await attendre();

    expect(activer).toHaveBeenCalledTimes(1);
    expect(Linking.openSettings).not.toHaveBeenCalled();
    expect(resultat.etat).toBe('accordee');
  });

  it('refusée : le geste ouvre les Réglages, sans redemander', async () => {
    mockEtat = 'refusee';
    await monter();
    expect(resultat.etat).toBe('refusee');

    await act(async () => { await resultat.agir(); });

    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
    expect(activer).not.toHaveBeenCalled();
  });
});

describe('au retour au premier plan', () => {
  it('relit l état et RÉ-ENREGISTRE le jeton quand les Réglages ont rallumé', async () => {
    mockEtat = 'refusee';
    await monter();
    await act(async () => { await resultat.agir(); });

    mockEtat = 'accordee';
    await revenirAuPremierPlan();

    expect(resultat.etat).toBe('accordee');
    expect(activer).toHaveBeenCalledTimes(1);
  });

  it('toujours refusée au retour : rien n est enregistré', async () => {
    mockEtat = 'refusee';
    await monter();

    await revenirAuPremierPlan();

    expect(resultat.etat).toBe('refusee');
    expect(activer).not.toHaveBeenCalled();
  });

  // Le frein FCMSTORM de useNotifications reste seul juge d'un retour ordinaire.
  it('déjà accordée : un retour ordinaire ne relance pas l enregistrement', async () => {
    mockEtat = 'accordee';
    await monter();

    await revenirAuPremierPlan();

    expect(activer).not.toHaveBeenCalled();
  });
});
