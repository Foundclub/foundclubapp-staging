import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { describeAttendanceError, describeBulkOutcome } from '../attendanceCallModel';
import { useAttendanceCallMutations } from '../useAttendanceCallMutations';

/**
 * L5-A · ETAPE 1 — LE TUYAU DU POINTAGE GROUPE.
 *
 * 🔬 CE QUE CES TEMOINS TIENNENT, et pourquoi chacun existe :
 *   1. « Tout pointer » passe par UNE requete groupee, avec les bons
 *      identifiants — pas par N requetes depuis le bord d un terrain.
 *   2. Le bilan se lit LIGNE PAR LIGNE. Le serveur repond HTTP 200 meme quand
 *      il a tout refuse (la fenetre est testee par personne) : un ecran qui ne
 *      lirait que le code HTTP annoncerait 22 pointages sans avoir rien ecrit.
 *   3. Un refus serveur devient une phrase FRANCAISE. Le serveur repond en
 *      anglais brut ; le coach, lui, lit du francais.
 *
 * 🪤 PIEGE DE COPIE DE TRAVAIL : importer un service pour de vrai tue la SUITE
 * entiere (le `.env` est ignore par git, donc absent de tout worktree, et le
 * client HTTP refuse de demarrer sans `API_URL`). `eventService` est donc
 * mocke — et avec lui les voisins que le hook n appelle jamais mais que le
 * chargement du module tirerait.
 */

const mockMarkCoachArrival = jest.fn();
const mockMarkCoachArrivalBulk = jest.fn();
const mockResetCoachAttendance = jest.fn();
const mockUpdateCoachLateMinutes = jest.fn();

jest.mock('@/services/event/eventService', () => ({
  markCoachArrival: (/** @type {any} */ ...args) => mockMarkCoachArrival(...args),
  markCoachArrivalBulk: (/** @type {any} */ ...args) => mockMarkCoachArrivalBulk(...args),
  resetCoachAttendance: (/** @type {any} */ ...args) => mockResetCoachAttendance(...args),
  updateCoachLateMinutes: (/** @type {any} */ ...args) => mockUpdateCoachLateMinutes(...args),
}));

// 🗣️ R7-a (vague R, 24/08) — le hook TRADUIT desormais le refus serveur : il
// lui faut donc un `t`. Le double rend le REPLI, comme i18next sur une clef
// absente — c est le motif des 166 autres suites du depot.
jest.mock('react-i18next', () => ({
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

const EVENEMENT_ID = 'evt-appel-1';

/**
 * Le double de `t` : il rend le REPLI, comme i18next sur une clef absente.
 * @param {string} _cle - La clef i18n, ignoree ici.
 * @param {string} repli - Le texte francais de repli.
 * @returns {string} - Le repli, tel quel.
 */
const traduire = (_cle, repli) => repli;

/**
 * Laisse react-query redescendre jusqu au rendu.
 *
 * 🧨 Les microtaches seules ne suffisent pas : le notificateur de react-query
 * repasse par la file des MACROtaches.
 * @param {number} [tours]
 * @returns {Promise<void>}
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
 * Sonde : elle ne rend rien, elle expose le hook monte pour de vrai.
 * @param {{ vues: any[] }} props
 * @returns {null}
 */
function SondeAppel({ vues }) {
  vues.push(useAttendanceCallMutations(EVENEMENT_ID));
  return null;
}

/**
 * Monte la sonde dans un vrai `QueryClientProvider`.
 *
 * 🧹 Le demontage n est pas une politesse : un arbre orphelin fait sortir jest
 * en 1 avec tous les tests verts.
 * @returns {Promise<{ demonter: () => Promise<void>, vues: any[] }>}
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
        <SondeAppel vues={vues} />
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

beforeEach(() => {
  jest.clearAllMocks();
});

describe('L5-A · etape 1 — le tuyau du pointage groupe', () => {
  test('« Tout pointer » envoie UNE requete groupee avec les bons identifiants', async () => {
    mockMarkCoachArrivalBulk.mockResolvedValue({
      data: {
        eventDocumentId: EVENEMENT_ID,
        failedCount: 0,
        items: [
          { ok: true, userDocumentId: 'user-a' },
          { ok: true, userDocumentId: 'user-b' },
          { ok: true, userDocumentId: 'user-c' },
        ],
        markedCount: 3,
      },
    });

    const { demonter, vues } = await monterLaSonde();
    /** @type {any} */
    let resultat = null;
    await act(async () => {
      resultat = await vues[vues.length - 1].bulkMutation.mutateAsync({
        userIds: ['user-a', 'user-b', 'user-c'],
      });
    });
    await vidangerLaFile();

    expect(mockMarkCoachArrivalBulk).toHaveBeenCalledTimes(1);
    expect(mockMarkCoachArrivalBulk).toHaveBeenCalledWith(
      EVENEMENT_ID,
      expect.objectContaining({ userIds: ['user-a', 'user-b', 'user-c'] }),
    );
    expect(resultat.markedCount).toBe(3);
    expect(resultat.failedCount).toBe(0);

    await demonter();
  });

  test('un refus par ligne est CONSERVE, pas avale par un HTTP 200', async () => {
    mockMarkCoachArrivalBulk.mockResolvedValue({
      data: {
        failedCount: 1,
        items: [
          { ok: true, userDocumentId: 'user-a' },
          {
            error: { code: 'EVENT_ATTENDANCE_AUDIENCE', message: 'not in audience' },
            ok: false,
            userDocumentId: 'user-b',
          },
        ],
        markedCount: 1,
      },
    });

    const { demonter, vues } = await monterLaSonde();
    /** @type {any} */
    let resultat = null;
    await act(async () => {
      resultat = await vues[vues.length - 1].bulkMutation.mutateAsync({
        userIds: ['user-a', 'user-b'],
      });
    });
    await vidangerLaFile();

    expect(resultat.markedCount).toBe(1);
    expect(resultat.failedCount).toBe(1);
    expect(resultat.failures).toEqual([
      expect.objectContaining({ code: 'EVENT_ATTENDANCE_AUDIENCE', userDocumentId: 'user-b' }),
    ]);

    await demonter();
  });

  test('au-dela de 100 personnes, l envoi part en paquets — aucune ligne perdue', async () => {
    const identifiants = Array.from({ length: 143 }, (_valeur, index) => `user-${index}`);
    mockMarkCoachArrivalBulk.mockImplementation((/** @type {any} */ _id, /** @type {any} */ e) => (
      Promise.resolve({
        data: {
          failedCount: 0,
          items: e.userIds.map(
            (/** @type {string} */ userDocumentId) => ({ ok: true, userDocumentId }),
          ),
          markedCount: e.userIds.length,
        },
      })
    ));

    const { demonter, vues } = await monterLaSonde();
    /** @type {any} */
    let resultat = null;
    await act(async () => {
      resultat = await vues[vues.length - 1].bulkMutation.mutateAsync({ userIds: identifiants });
    });
    await vidangerLaFile();

    expect(mockMarkCoachArrivalBulk).toHaveBeenCalledTimes(2);
    expect(mockMarkCoachArrivalBulk.mock.calls[0][1].userIds).toHaveLength(100);
    expect(mockMarkCoachArrivalBulk.mock.calls[1][1].userIds).toHaveLength(43);
    expect(resultat.markedCount).toBe(143);

    await demonter();
  });

  test('EVENT_ATTENDANCE_WINDOW_CLOSED devient une phrase francaise', () => {
    const erreurServeur = {
      response: {
        data: {
          error: {
            details: { code: 'EVENT_ATTENDANCE_WINDOW_CLOSED' },
            message: 'Attendance can only be marked from 30 minutes before'
              + ' the event until 2 hours after it ends',
          },
        },
      },
    };

    const phrase = describeAttendanceError(erreurServeur, traduire);

    expect(phrase).toContain("L'appel n'est pas ouvert");
    expect(phrase).not.toMatch(/Attendance can only/i);
  });

  test('22 refus pour la MEME cause donnent UNE phrase, pas vingt-deux', () => {
    const bilan = {
      failedCount: 22,
      failures: Array.from({ length: 22 }, (_valeur, index) => ({
        code: 'EVENT_ATTENDANCE_WINDOW_CLOSED',
        message: 'Attendance can only be marked…',
        userDocumentId: `user-${index}`,
      })),
      markedCount: 0,
    };

    const phrase = describeBulkOutcome(bilan, traduire);

    expect(phrase).toBe("Personne n'a été pointé : l'appel n'est pas ouvert en ce moment.");
    expect(phrase.split('\n')).toHaveLength(1);
  });
});

// ===========================================================================
// R7-a (vague R, 2026-08-24) — UN POINTAGE REFUSE NE PART PLUS EN SILENCE.
//
// 🔴 LE DEFAUT, lu le 24/08 sur app a3040f1 :
//   `useAttendanceCallMutations` n avait AUCUN `onError`. L ecran d appel
//   ferme sa feuille juste APRES `mutate` (EventAttendanceCall.js:230) : quand
//   le serveur refusait, la feuille se fermait quand meme, la ligne restait
//   « Sans reponse », et le coach ne voyait RIEN. Ni message, ni pointage.
//   C est mot pour mot le constat de recette « pointer un joueur en retard ne
//   marche pas ».
//
// 🧨 ET LA PHRASE EXISTAIT DEJA : `describeAttendanceError`
//   (attendanceCallModel.js:482) avait ete ecrite pour traduire ce refus, et
//   elle avait ZERO appelant de production — seulement son propre temoin.
//   Le serveur repond « Attendance can only be marked from 30 minutes… » :
//   sans elle, c est de l anglais brut qui serait tombe sous le doigt du
//   coach, au bord d un terrain.
// ===========================================================================

describe('R7-a — le refus serveur devient une phrase, jamais un silence', () => {
  /**
   * Fabrique le refus tel que le client HTTP le remonte.
   * @param {string | null} code - Le code serveur, ou `null` pour une panne nue.
   * @returns {any} - L erreur rejetee par le service.
   */
  const refusServeur = (code) => ({
    response: {
      data: {
        error: {
          details: code ? { code } : {},
          message: 'Attendance can only be marked from 30 minutes before'
            + ' the event until 2 hours after it ends',
        },
      },
    },
  });

  test('« pointer » hors fenetre : une alerte FRANCAISE, jamais le silence', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockMarkCoachArrival.mockRejectedValue(refusServeur('EVENT_ATTENDANCE_WINDOW_CLOSED'));

    const { demonter, vues } = await monterLaSonde();
    await act(async () => {
      vues[vues.length - 1].coachArrivalMutation.mutate({
        payload: { arrivedAt: '2026-08-24T17:10:00.000Z', lateMinutes: 10 },
        userId: 'user-a',
      });
    });
    await vidangerLaFile();

    expect(alerte).toHaveBeenCalledTimes(1);
    const phrase = String(alerte.mock.calls[0][1]);
    expect(phrase).toContain("L'appel n'est pas ouvert");
    expect(phrase).not.toMatch(/Attendance can only/i);

    alerte.mockRestore();
    await demonter();
  });

  test('« corriger le retard » refuse parle aussi, avec la phrase de repli', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockUpdateCoachLateMinutes.mockRejectedValue(refusServeur(null));

    const { demonter, vues } = await monterLaSonde();
    await act(async () => {
      vues[vues.length - 1].lateMinutesMutation.mutate({
        payload: { lateMinutes: 5 },
        userId: 'user-a',
      });
    });
    await vidangerLaFile();

    expect(alerte).toHaveBeenCalledTimes(1);
    expect(String(alerte.mock.calls[0][1])).toContain('Impossible d');

    alerte.mockRestore();
    await demonter();
  });

  test('🔒 un pointage qui REUSSIT ne derange personne', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockMarkCoachArrival.mockResolvedValue({ data: { userDocumentId: 'user-a' } });

    const { demonter, vues } = await monterLaSonde();
    await act(async () => {
      vues[vues.length - 1].coachArrivalMutation.mutate({ payload: {}, userId: 'user-a' });
    });
    await vidangerLaFile();

    expect(alerte).not.toHaveBeenCalled();

    alerte.mockRestore();
    await demonter();
  });
});

// ===========================================================================
// R7-d — LES SIX CLEFS QU UN POINTAGE PERIME.
//
// 🧨 `eventParticipations` a ete AJOUTEE le 24/08 : `performCoachArrival`
//   rattache la personne aux `participations` et la retire des `missings`.
//   Sur l ecran d appel, ou cette requete n est pas montee, l oubli ne se
//   voyait pas. Depuis que la liste des participants ecrit elle aussi
//   (« À l'heure »), il se verrait a l oeil nu : quelqu un qu on vient de
//   pointer resterait range dans « Sans réponse », une pastille « Arrivé » a
//   cote.
//   ⚠️ Un temoin qui compterait les appels ne suffirait pas — c est la LISTE
//   des clefs qui doit etre juste. Il les lit donc une par une.
// ===========================================================================

describe('R7-d — un pointage perime les six bonnes clefs', () => {
  test('les 6 clefs, nommees, apres un pointage reussi', async () => {
    mockMarkCoachArrival.mockResolvedValue({ data: {} });

    /** @type {any[]} */
    const invalidees = [];
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    const vraiInvalidate = queryClient.invalidateQueries.bind(queryClient);
    queryClient.invalidateQueries = (/** @type {any} */ filtres) => {
      invalidees.push(filtres?.queryKey);
      return vraiInvalidate(filtres);
    };

    /** @type {any[]} */
    const vues = [];
    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(
        <QueryClientProvider client={queryClient}>
          <SondeAppel vues={vues} />
        </QueryClientProvider>,
      );
    });
    await vidangerLaFile();

    await act(async () => {
      vues[vues.length - 1].coachArrivalMutation.mutate({ payload: {}, userId: 'user-a' });
    });
    await vidangerLaFile();

    expect(invalidees).toEqual([
      ['events'],
      ['planning', 'personal'],
      ['event', EVENEMENT_ID],
      ['eventAttendance', EVENEMENT_ID],
      ['eventParticipations', EVENEMENT_ID],
      ['teamStats'],
    ]);

    await act(async () => { arbre.unmount(); });
    queryClient.clear();
  });
});
