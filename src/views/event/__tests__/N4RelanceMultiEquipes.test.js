import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { remindUnansweredPlayers } from '@/services/event/eventService';

import { useEventMutations } from '../hooks/useEventMutations';

// ==========================================================================
// N4 (D3/D4) — RELANCER PLUSIEURS EQUIPES D UN SEUL GESTE.
//
// 🧨 LE FAIT SERVEUR QUI COMMANDE TOUT : `/remind-unanswered-players` n accepte
// qu UN SEUL `teamId` par appel. Un evenement a match amical, un tournoi ou un
// stage en compte plusieurs — relancer « les sans-reponse » demandait donc
// autant d appuis qu il y a d equipes, sans jamais dire lesquelles etaient
// deja faites.
//
// CE QUI SE VERIFIE ICI :
//   · 2 equipes cochees => 2 POST, chacun avec SON `teamId` ;
//   · le compte rendu rendu a l ecran est la REUNION des reponses serveur ;
//   · la charge en CHAINE marche exactement comme avant (retro-compat : c est
//     elle qui garde les 4 temoins d AC07 verts sans une ligne reecrite) ;
//   · `presentation: 'sheet'` FAIT TAIRE la modale du hook — la feuille affiche
//     elle-meme son compte rendu (1H), et deux fenetres pour un geste, ce
//     serait la modale par-dessus la feuille ;
//   · 🚨 un echec sur UNE equipe ne fait pas mentir les autres.
//
// ⛔ AUCUNE MUTATION NEUVE : 13 suites montent `useEventMutations` avec une
// liste FIGEE de mutations. La boucle vit dans le `mutationFn` de la mutation
// existante — donc une seule cle, donc un seul `isPending`, donc le grisage
// (AC07) et le motif anti-spam (AE02) restent alimentes sans rien changer.
// ==========================================================================

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

// Les services voisins ne participent pas a la relance, mais leur simple
// chargement monte le client HTTP — qui refuse de demarrer sans URL d API.
jest.mock('@/services/eventParticipation/eventParticipationService', () => ({
  acceptEventParticipation: jest.fn(),
  createEventParticipation: jest.fn(),
  declineEventParticipation: jest.fn(),
  deleteEventParticipation: jest.fn(),
}));

jest.mock('@/services/eventReport/eventReportService', () => ({
  createEventReport: jest.fn(),
}));

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
const EQUIPE_A = 'team-a';
const EQUIPE_B = 'team-b';

/**
 * Une reponse serveur complete, telle que le service la normalise.
 * @param {any} [champs] - Les champs a surcharger.
 * @returns {any} - La reponse.
 */
const reponse = (/** @type {any} */ champs = {}) => ({
  blockedCount: 0,
  lastRemindedAt: null,
  nextReminderAt: null,
  recipients: [],
  remindedCount: 0,
  unansweredCount: 0,
  ...champs,
});

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
const vidangerLaFile = async (tours = 8) => {
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
 * Declenche une relance et rend l etat final de la mutation.
 * @param {any} charge - Ce qu on passe a `mutate`.
 * @returns {Promise<any>} - La derniere vue des mutations.
 */
const relancerAvec = async (charge) => {
  const sonde = await monterLaSonde();
  const derniere = sonde.vues[sonde.vues.length - 1];

  await act(async () => { derniere.remindEventMutation.mutate(charge); });
  await vidangerLaFile();

  const finale = sonde.vues[sonde.vues.length - 1];
  await sonde.demonter();

  return finale.remindEventMutation;
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

// ---------------------------------------------------------------------------
// D3 — DEUX EQUIPES, DEUX APPELS
// ---------------------------------------------------------------------------

describe('N4/D3 — deux equipes cochees font DEUX appels', () => {
  test('🎯 chaque appel porte SON equipe, et le meme evenement', async () => {
    /** @type {any} */ (remindUnansweredPlayers).mockResolvedValue(reponse());

    await relancerAvec({
      eventId: EVENEMENT_ID,
      presentation: 'sheet',
      teamIds: [EQUIPE_A, EQUIPE_B],
    });

    expect(remindUnansweredPlayers).toHaveBeenCalledTimes(2);
    expect(remindUnansweredPlayers).toHaveBeenNthCalledWith(
      1,
      { eventId: EVENEMENT_ID, teamId: EQUIPE_A },
    );
    expect(remindUnansweredPlayers).toHaveBeenNthCalledWith(
      2,
      { eventId: EVENEMENT_ID, teamId: EQUIPE_B },
    );
  });

  test('🔢 le compte rendu rendu a l ecran est la REUNION des reponses serveur', async () => {
    /** @type {any} */ (remindUnansweredPlayers)
      .mockResolvedValueOnce(reponse({ blockedCount: 1, remindedCount: 3, unansweredCount: 4 }))
      .mockResolvedValueOnce(reponse({ blockedCount: 2, remindedCount: 5, unansweredCount: 7 }));

    const mutation = await relancerAvec({
      eventId: EVENEMENT_ID,
      presentation: 'sheet',
      teamIds: [EQUIPE_A, EQUIPE_B],
    });

    expect(mutation.data.remindedCount).toBe(8);
    expect(mutation.data.blockedCount).toBe(3);
    expect(mutation.data.unansweredCount).toBe(11);
    expect(mutation.data.parEquipe.map((/** @type {any} */ l) => l.teamId))
      .toEqual([EQUIPE_A, EQUIPE_B]);
  });

  test('la prochaine relance possible est la PLUS TARDIVE des deux', async () => {
    /** @type {any} */ (remindUnansweredPlayers)
      .mockResolvedValueOnce(reponse({ nextReminderAt: '2026-08-25T10:00:00.000Z' }))
      .mockResolvedValueOnce(reponse({ nextReminderAt: '2026-08-25T12:00:00.000Z' }));

    const mutation = await relancerAvec({
      eventId: EVENEMENT_ID,
      presentation: 'sheet',
      teamIds: [EQUIPE_A, EQUIPE_B],
    });

    expect(mutation.data.nextReminderAt).toBe('2026-08-25T12:00:00.000Z');
  });

  test('🚨 un echec sur la 2e equipe ne fait pas mentir la 1re', async () => {
    /** @type {any} */ (remindUnansweredPlayers)
      .mockResolvedValueOnce(reponse({ remindedCount: 3 }))
      .mockRejectedValueOnce(new Error('502'));

    const mutation = await relancerAvec({
      eventId: EVENEMENT_ID,
      presentation: 'sheet',
      teamIds: [EQUIPE_A, EQUIPE_B],
    });

    expect(mutation.data.remindedCount).toBe(3);
    expect(mutation.data.echecCount).toBe(1);
    expect(mutation.data.parEquipe[0].echec).toBe(false);
    expect(mutation.data.parEquipe[1].echec).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// D3 — LA CHARGE EN CHAINE N A PAS BOUGE
// ---------------------------------------------------------------------------

describe('N4/D3 — la charge en CHAINE fait exactement ce qu elle faisait', () => {
  test('un seul appel, et le service recoit la chaine telle quelle', async () => {
    /** @type {any} */ (remindUnansweredPlayers).mockResolvedValue(reponse({ remindedCount: 2 }));

    await relancerAvec(EVENEMENT_ID);

    expect(remindUnansweredPlayers).toHaveBeenCalledTimes(1);
    expect(remindUnansweredPlayers).toHaveBeenCalledWith(EVENEMENT_ID);
  });

  test('🔔 et la modale s affiche, comme avant le lot', async () => {
    /** @type {any} */ (remindUnansweredPlayers).mockResolvedValue(reponse({ remindedCount: 2 }));

    await relancerAvec(EVENEMENT_ID);

    expect(/** @type {any} */ (Alert.alert)).toHaveBeenCalledTimes(1);
    expect(/** @type {any} */ (Alert.alert).mock.calls[0][0]).toBe('2 personnes relancees');
  });
});

// ---------------------------------------------------------------------------
// D4 — LA FEUILLE PARLE, LE HOOK SE TAIT
// ---------------------------------------------------------------------------

describe('N4/D4 — `presentation: sheet` fait taire la modale du hook', () => {
  test('🔇 une relance reussie depuis la feuille n affiche AUCUNE modale', async () => {
    /** @type {any} */ (remindUnansweredPlayers).mockResolvedValue(reponse({ remindedCount: 4 }));

    const mutation = await relancerAvec({
      eventId: EVENEMENT_ID,
      presentation: 'sheet',
      teamIds: [EQUIPE_A],
    });

    expect(/** @type {any} */ (Alert.alert)).not.toHaveBeenCalled();
    // ⛔ Se taire n est PAS perdre l information : elle est dans `data`, que la
    // feuille lit pour afficher son compte rendu (1H).
    expect(mutation.data.remindedCount).toBe(4);
  });

  test('🔇 un ECHEC depuis la feuille n affiche AUCUNE modale non plus', async () => {
    /** @type {any} */ (remindUnansweredPlayers).mockRejectedValue(new Error('502'));

    const mutation = await relancerAvec({
      eventId: EVENEMENT_ID,
      presentation: 'sheet',
      teamIds: [],
    });

    expect(/** @type {any} */ (Alert.alert)).not.toHaveBeenCalled();
    expect(mutation.error).toBeTruthy();
  });

  test('sans `presentation`, la modale reste la : rien n a ete retire', async () => {
    /** @type {any} */ (remindUnansweredPlayers).mockResolvedValue(reponse({ remindedCount: 1 }));

    await relancerAvec({ eventId: EVENEMENT_ID, teamId: EQUIPE_A });

    expect(/** @type {any} */ (Alert.alert)).toHaveBeenCalledTimes(1);
  });
});
