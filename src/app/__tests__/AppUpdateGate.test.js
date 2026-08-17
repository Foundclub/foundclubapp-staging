import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { getAppUpdateGate } from '@/services/appUpdate/appUpdateGateService';

import AppUpdateGate from '@/app/AppUpdateGate';

// S09 — LE FILET DE L'ECRAN BLOQUANT.
//
// 🧨 Ce lot est plus dangereux que la fonctionnalite qu'il livre : un ecran
// bloquant mal regle rend l'app inutilisable pour TOUT LE PARC d'un coup, et il
// n'y a pas de correctif cote telephone — il faut republier.
//
// Les temoins ci-dessous sont donc ecrits DANS CE SENS : ils verifient d'abord
// et surtout que l'app S'OUVRE. Un seul verifie qu'elle bloque.

// Seul l'APPEL RESEAU est simule. Les regles de decision
// (`appUpdateGateRules`) tournent pour de vrai : ce sont elles que ces temoins
// protegent.
jest.mock('@/services/appUpdate/appUpdateGateService', () => ({
  APP_UPDATE_GATE_QUERY_KEY: ['app', 'update-gate'],
  getAppUpdateGate: jest.fn(),
}));

// ⚠️ Le module est consomme par son export PAR DEFAUT (`device.getAppVersion()`).
// Un faux qui n'exposerait que les exports nommes ferait planter le rendu de
// l'ecran bloquant — et le test echouerait en disant « l'app s'ouvre », donc
// dans le sens rassurant. C'est le pire sens pour une panne.
jest.mock('@/platform/device', () => ({
  __esModule: true,
  default: {
    getAppVersion: () => '2.6.7',
    getDeviceId: () => 'device-test',
  },
  getAppVersion: () => '2.6.7',
  getDeviceId: () => 'device-test',
}));

jest.mock('@/views/appUpdate/AppUpdateRequiredScreen', () => {
  const { Text: MockText } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: () => <MockText>ECRAN_BLOQUANT</MockText>,
  };
});

const ENFANT = 'APP_OUVERTE';

const CLE = ['app', 'update-gate'];

/**
 * Laisse React commettre le rendu declenche par la reponse.
 * ⚠️ Un simple `await Promise.resolve()` ne suffit pas : il ne vide que les
 * micro-taches, et l'ordonnanceur de React attend une MACRO-tache. Mesure du
 * 2026-08-17 : la requete etait en `status: success` avec la bonne charge, et
 * l'arbre rendait encore l'ancien contenu.
 * @returns {Promise<void>}
 */
const laisserReagir = async () => {
  await act(async () => {
    await new Promise((resolve) => { setTimeout(resolve, 0); });
  });
};

/**
 * Monte la porte autour d'un enfant reconnaissable et rend ce qu'on voit.
 * @param {{ attendreReponse?: boolean }} [options] - `false` fige le rendu
 * pendant que l'appel est encore en vol.
 * @returns {Promise<{ appOuverte: boolean, ecranBloquant: boolean }>} Ce que
 * l'arbre rendu contient reellement.
 */
const rendreLaPorte = async ({ attendreReponse = true } = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={queryClient}>
        <AppUpdateGate>
          <Text>{ENFANT}</Text>
        </AppUpdateGate>
      </QueryClientProvider>,
    );
  });

  // 🧪 On attend l'ETAT REEL de la requete, pas un nombre de passages.
  if (attendreReponse) {
    for (let essai = 0; essai < 40; essai += 1) {
      const etat = queryClient.getQueryState(CLE);
      // Un etat absent veut dire « pas encore enregistree » : on continue
      // d'attendre, sinon on sortirait de la boucle avant meme l'appel.
      if (etat && etat.status !== 'pending') break;
      // eslint-disable-next-line no-await-in-loop
      await laisserReagir();
    }
    // La reponse est la ; ce passage laisse React la porter a l'ecran.
    await laisserReagir();
  }

  const texte = JSON.stringify(arbre.toJSON());
  arbre.unmount();
  queryClient.clear();

  return {
    appOuverte: texte.includes(ENFANT),
    ecranBloquant: texte.includes('ECRAN_BLOQUANT'),
  };
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// TEMOIN 1 — serveur injoignable ⇒ l'app s'ouvre. LE temoin du lot.
// ---------------------------------------------------------------------------

test("serveur injoignable : l'app s'ouvre", async () => {
  getAppUpdateGate.mockRejectedValue(new Error('Network Error'));

  const { appOuverte, ecranBloquant } = await rendreLaPorte();

  expect(appOuverte).toBe(true);
  expect(ecranBloquant).toBe(false);
});

test("appel qui n'a pas encore repondu : l'app s'ouvre pendant ce temps", async () => {
  // 🔓 Le cas le plus frequent au demarrage : la reponse n'est pas la. On la
  // laisse en attente pendant tout le rendu, puis on la resout pour ne laisser
  // aucune promesse pendante derriere le test.
  let repondre;
  getAppUpdateGate.mockReturnValue(new Promise((resolve) => {
    repondre = resolve;
  }));

  const { appOuverte, ecranBloquant } = await rendreLaPorte({ attendreReponse: false });
  repondre(null);

  expect(appOuverte).toBe(true);
  expect(ecranBloquant).toBe(false);
});

// ---------------------------------------------------------------------------
// TEMOIN 2 — reponse illisible ou valeur absente ⇒ l'app s'ouvre.
// ---------------------------------------------------------------------------

test.each([
  ['reponse vide', null],
  ['reponse sans verdict', {}],
  ['verdict en texte au lieu du booleen', { blocked: 'true' }],
  ['verdict a 1 au lieu du booleen', { blocked: 1 }],
  ['verdict explicitement faux', { blocked: false }],
  ['reponse qui est une chaine', 'bloque'],
  ['reponse qui est un tableau', []],
  ['champ mal orthographie', { blockd: true }],
])("%s : l'app s'ouvre", async (_libelle, charge) => {
  getAppUpdateGate.mockResolvedValue(charge);

  const { appOuverte, ecranBloquant } = await rendreLaPorte();

  expect(appOuverte).toBe(true);
  expect(ecranBloquant).toBe(false);
});

// ---------------------------------------------------------------------------
// TEMOIN 4 + 5 — verdict EXPLICITE ⇒ ecran bloquant, et rien derriere.
// ---------------------------------------------------------------------------

test('verdict explicite du serveur : ecran bloquant', async () => {
  getAppUpdateGate.mockResolvedValue({
    blocked: true,
    minimumVersion: '2.6.9',
    platform: 'ios',
  });

  const { appOuverte, ecranBloquant } = await rendreLaPorte();

  expect(ecranBloquant).toBe(true);
  // 🔒 L'ARBRE DE NAVIGATION N'EST PAS MONTE DU TOUT — il n'est pas seulement
  // masque. C'est ce qui rend l'ecran incontournable : sans pile de navigation,
  // ni le bouton retour du telephone ni un geste de retour arriere n'ont quoi
  // que ce soit a depiler.
  expect(appOuverte).toBe(false);
});
