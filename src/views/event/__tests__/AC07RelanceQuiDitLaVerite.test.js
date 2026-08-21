import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { buildRemindMessage } from '@/domains/event/remindReport';

import { remindUnansweredPlayers } from '@/services/event/eventService';

import { useEventMutations } from '../hooks/useEventMutations';

// AC07 (E6) — TEMOINS 2 a 5 : « LA RELANCE DIT CE QUI S EST REELLEMENT PASSE ».
//
// 🧨 LE DEFAUT : `remindEventMutation` affichait « Ta relance a bien ete
// envoyee » dans son `onSuccess`, SANS regarder la reponse — et n avait aucun
// `onError`. Or le serveur repond 200 dans trois situations differentes :
// des notifications sont parties · l anti-spam de 48 h a tout ecarte · plus
// personne n avait de reponse en attente.
// ⇒ Un coach qui appuyait deux fois lisait deux fois « c est parti » et croyait
// avoir relance. Personne n avait rien recu.
//
// 🔬 OU C EST MESURE. La phrase se decide dans une fonction PURE
// (`domains/event/remindReport`) : les temoins 2, 3 et le cas « personne » la
// lisent directement. Le CABLAGE (ce que la modale affiche vraiment, et ce
// qu elle dit quand l appel tombe en panne) est mesure sur le hook monte pour
// de vrai dans un `QueryClientProvider`, service mocke.

jest.mock('@/services/event/eventService', () => ({
  cancelEvent: jest.fn(),
  declareSelfLate: jest.fn(),
  markCoachArrival: jest.fn(),
  markSelfArrival: jest.fn(),
  missingEvent: jest.fn(),
  remindUnansweredPlayers: jest.fn(),
  requestFeatured: jest.fn(),
  resetCoachAttendance: jest.fn(),
  respondToEventRsvp: jest.fn(),
  updateCoachLateMinutes: jest.fn(),
  updateEvent: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({ t: (/** @type {string} */ key) => key }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
}));

// `useEventMutations` importe quatre services voisins. Aucun n intervient dans
// la relance, mais leur simple chargement monte le client HTTP — qui refuse de
// demarrer sans URL d API. On les remplace par des coquilles.
jest.mock('@/services/eventParticipation/eventParticipationService', () => ({
  acceptEventParticipation: jest.fn(),
  createEventParticipation: jest.fn(),
  declineEventParticipation: jest.fn(),
  deleteEventParticipation: jest.fn(),
}));

jest.mock('@/services/eventReport/eventReportService', () => ({
  createEventReport: jest.fn(),
}));

// AD01 — la 5e doublure de service, pour la meme raison que les quatre autres :
// ce fichier monte le VRAI `useEventMutations`, et tout module de service
// reellement charge tire `@/services/client`, qui refuse de demarrer sans
// `API_URL`. `saveMatchResultMutation` y est entree, sa doublure suit.
jest.mock('@/services/matchStats/matchStatsService', () => ({
  saveEventMatchResult: jest.fn(),
}));

jest.mock('@/services/reservation/reservationService', () => ({
  bookFullReservation: jest.fn(),
  joinReservation: jest.fn(),
  openForPlayers: jest.fn(),
  triggerSosAlert: jest.fn(),
}));

const EVENEMENT_ID = 'evt-1';

/** Il y a 3 heures : bien a l interieur de la fenetre anti-spam de 48 h. */
const IL_Y_A_3_HEURES = '2026-08-20T15:00:00.000Z';
/** La meme relance + 48 h : le premier instant ou relancer touchera quelqu un. */
const DANS_45_HEURES = '2026-08-22T15:00:00.000Z';

/**
 * La sonde : elle ne rend rien, elle expose les mutations du hook.
 * @param {{ vues: any[] }} props - Le carnet de bord, RECU EN PROP.
 * @returns {null} - Rien a rendre.
 */
function SondeRelance({ vues }) {
  const mutations = useEventMutations(EVENEMENT_ID, jest.fn(), jest.fn());
  vues.push(mutations);
  return null;
}

/**
 * Laisse react-query redescendre jusqu au rendu.
 *
 * 🧨 Les microtaches seules ne suffisent pas : le notificateur de react-query
 * repasse par la file des MACROtaches.
 * @param {number} [tours] - Nombre de tours de boucle d evenements.
 * @returns {Promise<void>} - Quand la file est videe.
 */
const vidangerLaFile = async (tours = 6) => {
  for (let tour = 0; tour < tours; tour += 1) {
    // eslint-disable-next-line no-await-in-loop -- l attente est justement le sujet
    await act(async () => {
      await new Promise((resoudre) => { setTimeout(resoudre, 0); });
    });
  }
};

/**
 * Monte la sonde et rend de quoi la piloter puis la demonter.
 *
 * 🧹 Le demontage n est pas une politesse : un arbre orphelin fait sortir jest
 * en 1 avec tous les tests verts (defaut paye par le lot D68).
 * @returns {Promise<{ demonter: () => Promise<void>, vues: any[] }>} - La sonde.
 */
const monterLaSonde = async () => {
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
        <SondeRelance vues={vues} />
      </QueryClientProvider>,
    );
  });
  await vidangerLaFile();

  return {
    demonter: async () => {
      await act(async () => { arbre.unmount(); });
      queryClient.clear();
    },
    vues,
  };
};

/**
 * Declenche la relance et rend ce que la modale a affiche.
 * @returns {Promise<{ corps: string, titre: string }>} - Titre et corps de la modale.
 */
const relancerEtLireLaModale = async () => {
  const sonde = await monterLaSonde();
  const derniere = sonde.vues[sonde.vues.length - 1];

  await act(async () => { derniere.remindEventMutation.mutate(EVENEMENT_ID); });
  await vidangerLaFile();
  await sonde.demonter();

  const appels = Alert.alert.mock.calls;
  const appel = appels[appels.length - 1] || [];
  return { corps: String(appel[1] || ''), titre: String(appel[0] || '') };
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

// ---------------------------------------------------------------------------
// TEMOIN 2 — LE VRAI NOMBRE
// ---------------------------------------------------------------------------

describe('AC07/2 — la relance affiche le VRAI nombre de personnes relancees', () => {
  test('trois personnes relancees se disent « 3 personnes relancees »', () => {
    const message = buildRemindMessage({ remindedCount: 3, unansweredCount: 3 });

    expect(message.title).toBe('3 personnes relancees');
    expect(message.outcome).toBe('sent');
  });

  test('une seule personne se dit au singulier', () => {
    expect(buildRemindMessage({ remindedCount: 1 }).title).toBe('1 personne relancee');
  });

  test('le nombre affiche vient du SERVEUR, pas de l ecran', async () => {
    remindUnansweredPlayers.mockResolvedValue({
      blockedCount: 0,
      lastRemindedAt: null,
      nextReminderAt: null,
      recipients: ['u-1', 'u-2'],
      remindedCount: 2,
      unansweredCount: 2,
    });

    const modale = await relancerEtLireLaModale();
    expect(modale.titre).toBe('2 personnes relancees');
  });
});

// ---------------------------------------------------------------------------
// 🥇 TEMOIN 3 — LE 2e APPUI EN 48 H DIT LA VERITE, AVEC LA DATE
// ---------------------------------------------------------------------------

describe('AC07/3 — le 2e appui en 48 h dit « deja relance », avec la date', () => {
  test('la phrase porte la date de la relance precedente ET celle de la prochaine', () => {
    const message = buildRemindMessage({
      blockedCount: 4,
      lastRemindedAt: IL_Y_A_3_HEURES,
      nextReminderAt: DANS_45_HEURES,
      remindedCount: 0,
      unansweredCount: 4,
    });

    expect(message.outcome).toBe('blocked');
    expect(message.title).toBe('Personne n a ete relance');
    expect(message.description).toMatch(/^Deja relance le /);
    expect(message.description).toMatch(/Tu pourras relancer a partir du /);
    // La DATE, pas un « recemment » : l anti-spam se compte en heures.
    expect(message.description).toMatch(/[0-9]{2}\/[0-9]{2}\/[0-9]{4}/);
  });

  test('🚨 elle ne contient JAMAIS le mot « envoye »', () => {
    const message = buildRemindMessage({
      blockedCount: 4,
      lastRemindedAt: IL_Y_A_3_HEURES,
      nextReminderAt: DANS_45_HEURES,
      remindedCount: 0,
    });

    expect(`${message.title} ${message.description}`.toLowerCase()).not.toMatch(/envoy/);
  });

  test('bout en bout : le 2e appui affiche cette phrase-la dans la modale', async () => {
    remindUnansweredPlayers.mockResolvedValue({
      blockedCount: 4,
      lastRemindedAt: IL_Y_A_3_HEURES,
      nextReminderAt: DANS_45_HEURES,
      recipients: [],
      remindedCount: 0,
      unansweredCount: 4,
    });

    const modale = await relancerEtLireLaModale();

    expect(modale.titre).toBe('Personne n a ete relance');
    expect(modale.corps).toMatch(/^Deja relance le /);
    expect(modale.corps).toMatch(/Tu pourras relancer a partir du /);
    expect(`${modale.titre} ${modale.corps}`.toLowerCase()).not.toMatch(/envoy/);
  });

  test('« tout le monde a repondu » ne se confond pas avec « tout le monde est bloque »', () => {
    const personne = buildRemindMessage({ blockedCount: 0, remindedCount: 0, unansweredCount: 0 });

    expect(personne.outcome).toBe('nobody');
    expect(personne.description).toMatch(/Tout le monde a deja repondu/);
    expect(personne.description.toLowerCase()).not.toMatch(/envoy/);
  });

  test('une relance PARTIELLE dit les deux moities', () => {
    const message = buildRemindMessage({
      blockedCount: 2,
      lastRemindedAt: IL_Y_A_3_HEURES,
      nextReminderAt: DANS_45_HEURES,
      remindedCount: 1,
      unansweredCount: 3,
    });

    expect(message.outcome).toBe('sent');
    expect(message.title).toBe('1 personne relancee');
    expect(message.description).toMatch(/2 autres personnes ont deja ete relancees/);
  });
});

// ---------------------------------------------------------------------------
// 🔒 TEMOIN 5 — LE GARDE-FOU DU LOT
// ---------------------------------------------------------------------------

describe('AC07/5 — une relance qui ECHOUE ne dit PAS qu elle a reussi', () => {
  test(
    'une panne serveur affiche une erreur, et nomme le fait que personne n a ete prevenu',
    async () => {
      remindUnansweredPlayers.mockRejectedValue(new Error('Network Error'));

      const modale = await relancerEtLireLaModale();

      expect(modale.titre).toBe('La relance n a pas pu partir');
      expect(modale.corps).toMatch(/Personne n a ete prevenu/);
      const tout = `${modale.titre} ${modale.corps}`.toLowerCase();
      expect(tout).not.toMatch(/a bien ete envoy/);
    },
  );

  test('🚨 aucune modale de succes n est affichee quand l appel echoue', async () => {
    remindUnansweredPlayers.mockRejectedValue(new Error('boom'));

    await relancerEtLireLaModale();

    const tousLesTextes = Alert.alert.mock.calls
      .map((/** @type {any[]} */ appel) => `${appel[0]} ${appel[1]}`)
      .join(' ')
      .toLowerCase();

    expect(tousLesTextes).not.toMatch(/personnes? relancee/);
    expect(tousLesTextes).not.toMatch(/remindsuccess/);
  });
});
