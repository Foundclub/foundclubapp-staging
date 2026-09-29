import fs from 'fs';
import path from 'path';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import { getEventById } from '@/services/event/eventService';

import { useHomeEventAnswer } from '../useHomeEventAnswer';

// FINITIONS4 — D4 (recette emulateur, tournee 6, 29/09) : LE BANDEAU D ACCUEIL
// PROPOSAIT PRESENT / ABSENT AVANT DE SAVOIR SI L ON REPOND.
//
// Constat : pour un evenement dont « Les participants repondent » est decochee,
// Present / Absent restaient affiches 20 a 40 s au lancement, jusqu a la relecture
// de l evenement. Le hook disait « tant que l evenement n est pas relu, vrai ».
// Un joueur qui appuyait dans cette fenetre envoyait une reponse que le serveur
// refuse. (`T6-DEFAUT-1b-bandeau-present-absent-avant-relecture.png`)
//
// La regle voulue (decision du chef, 29/09) : le bandeau connait l option DES le
// premier affichage — le resume de l accueil la porte (`rsvpEnabled`) — et, tant
// qu on ne sait pas, AUCUN bouton de reponse.
//
// Ecrits ROUGES contre app `12692738` (origin/staging du 29/09 soir).

jest.mock('@/services/event/eventService', () => ({
  getEventById: jest.fn(),
  respondToEventRsvp: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({ t: (/** @type {string} */ key) => key }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { documentId: 'user-1', id: 1 } }),
}));

const SOURCE_HUB = fs.readFileSync(path.resolve(__dirname, '..', 'HomeHub.js'), 'utf8');
const SOURCE_HOOK = fs.readFileSync(path.resolve(__dirname, '..', 'useHomeEventAnswer.js'), 'utf8');

const EVENEMENT = {
  documentId: 'evt-1',
  missings: [],
  participationRequests: [],
  participations: [],
};

/**
 * Une relecture qui ne revient JAMAIS : l instant du lancement, fige.
 * @returns {Promise<never>} Une promesse jamais tenue.
 */
const relectureEnVol = () => new Promise(() => {});

/**
 * La sonde : note ce que le hook dit a chaque rendu.
 * @param {{ options?: any, vues: any[] }} props - Le carnet de bord et le resume.
 * @returns {null} Rien a rendre.
 */
function Sonde({ options, vues }) {
  vues.push(useHomeEventAnswer('evt-1', options));
  return null;
}

/**
 * Laisse react-query redescendre jusqu au rendu (il repasse par les macrotaches).
 * @returns {Promise<void>} Quand la file est videe.
 */
const vidanger = async () => {
  for (let tour = 0; tour < 6; tour += 1) {
    // eslint-disable-next-line no-await-in-loop -- l attente est justement le sujet
    await act(async () => {
      await new Promise((resoudre) => { setTimeout(resoudre, 0); });
    });
  }
};

/**
 * Monte la sonde, rend son carnet et de quoi la demonter.
 * @param {any} [options] - Ce que le resume de l accueil dit de l evenement.
 * @returns {Promise<{ demonter: () => Promise<void>, vues: any[] }>} La sonde.
 */
const monter = async (options) => {
  /** @type {any[]} */
  const vues = [];
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={queryClient}>
        <Sonde options={options} vues={vues} />
      </QueryClientProvider>,
    );
  });
  await vidanger();
  return {
    demonter: async () => {
      await act(async () => { arbre.unmount(); });
      queryClient.clear();
    },
    vues,
  };
};

const dernier = (/** @type {any[]} */ vues) => vues[vues.length - 1];

beforeEach(() => {
  jest.clearAllMocks();
});

describe('FINITIONS4 D4 — le bandeau ne propose pas de reponse tant qu il ne sait pas', () => {
  it('🚨 LE TEMOIN : evenement pas encore relu, resume muet → AUCUN Present / Absent', async () => {
    getEventById.mockImplementation(relectureEnVol);
    const sonde = await monter();

    // Chaque rendu compte : le defaut vivait justement dans les premiers.
    expect(sonde.vues.length).toBeGreaterThan(0);
    sonde.vues.forEach((vue) => expect(vue.canAnswer).toBe(false));
    await sonde.demonter();
  });

  it('🚨 le resume dit « on ne repond pas » : aucun bouton, DES le premier rendu', async () => {
    getEventById.mockImplementation(relectureEnVol);
    const sonde = await monter({ rsvpEnabled: false });

    sonde.vues.forEach((vue) => expect(vue.canAnswer).toBe(false));
    await sonde.demonter();
  });

  it('le resume dit « on repond » : les boutons sont la des le premier rendu', async () => {
    getEventById.mockImplementation(relectureEnVol);
    const sonde = await monter({ rsvpEnabled: true });

    expect(sonde.vues[0].canAnswer).toBe(true);
    expect(dernier(sonde.vues).canAnswer).toBe(true);
    await sonde.demonter();
  });

  it('🚨 une fois l evenement relu, c est LUI qui tranche (meme source que la fiche)', async () => {
    getEventById.mockResolvedValue({ ...EVENEMENT, rsvpEnabled: false });
    const sonde = await monter({ rsvpEnabled: true });

    expect(dernier(sonde.vues).canAnswer).toBe(false);
    await sonde.demonter();
  });

  it('evenement relu, option cochee (ou evenement d avant POINTAGE) : on repond', async () => {
    getEventById.mockResolvedValue(EVENEMENT);
    const sonde = await monter();

    expect(dernier(sonde.vues).canAnswer).toBe(true);
    await sonde.demonter();
  });

  it('🚨 HomeHub transmet au hook ce que le resume dit de l option', () => {
    const debut = SOURCE_HUB.indexOf('} = useHomeEventAnswer(');
    expect(debut).toBeGreaterThan(-1);
    const appel = SOURCE_HUB.slice(debut, SOURCE_HUB.indexOf(');', debut));

    expect(appel).toContain('prochainEvenement?.rsvpEnabled');
  });

  it('la simplification « tant que pas relu, vrai » a disparu du hook', () => {
    expect(SOURCE_HOOK).not.toContain('on garde le comportement d avant (vrai)');
  });
});
