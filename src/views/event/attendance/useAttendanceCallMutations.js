import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import {
  markCoachArrival,
  markCoachArrivalBulk,
  resetCoachAttendance,
  updateCoachLateMinutes,
} from '@/services/event/eventService';

import { getServerErrorCode } from '@/utils/errors/displayError';

import { chunkUserIds, summarizeBulkOutcome, WINDOW_CLOSED_CODE } from './attendanceCallModel';

/**
 * L5-A — LES ECRITURES DE L ECRAN D APPEL, ET RIEN D AUTRE.
 *
 * 🧭 POURQUOI UN HOOK A PART, ET PAS `useEventMutations` : celui-la porte 20
 * mutations pour l ecran de detail, et exige DEUX rappels de rafraichissement
 * (`refetch`, `refetchParticipations`) que l ecran d appel n a pas — il n a
 * qu une seule requete a relire. Le brancher ici aurait oblige a lui inventer
 * deux fonctions vides, c est-a-dire a mentir sur ce qui se rafraichit.
 *
 * ⚠️ EN REVANCHE LES INVALIDATIONS SONT LES MEMES, LES CINQ : un pointage
 * change la liste des evenements, le planning personnel, l evenement, la
 * feuille de presence ET les statistiques d equipe. En oublier une laisse un
 * ecran voisin afficher un chiffre faux jusqu au prochain demarrage.
 * @param {string} eventId
 * @returns {any}
 */
export const useAttendanceCallMutations = (eventId) => {
  const queryClient = useQueryClient();

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['events'] });
    queryClient.invalidateQueries({ queryKey: ['planning', 'personal'] });
    queryClient.invalidateQueries({ queryKey: ['event', eventId] });
    queryClient.invalidateQueries({ queryKey: ['eventAttendance', eventId] });
    queryClient.invalidateQueries({ queryKey: ['teamStats'] });
  }, [eventId, queryClient]);

  const coachArrivalMutation = useMutation({
    mutationFn: (/** @type {any} */ { payload, userId }) => (
      markCoachArrival(eventId, userId, payload)
    ),
    onSuccess: invalidateAll,
  });

  const lateMinutesMutation = useMutation({
    mutationFn: (/** @type {any} */ { payload, userId }) => (
      updateCoachLateMinutes(eventId, userId, payload)
    ),
    onSuccess: invalidateAll,
  });

  const resetMutation = useMutation({
    mutationFn: (/** @type {any} */ { userId }) => resetCoachAttendance(eventId, userId),
    onSuccess: invalidateAll,
  });

  /**
   * « Tout pointer » — UNE requete pour N personnes, par paquets de 100.
   *
   * 🧨 Le bilan se lit dans `items`, pas dans le code HTTP : hors fenetre le
   * serveur repond 200 avec N refus. Le resume est donc rendu a l appelant,
   * qui doit le dire a l ecran.
   */
  const bulkMutation = useMutation({
    mutationFn: async (/** @type {any} */ { note, userIds }) => {
      const chunks = chunkUserIds(userIds);
      const summaries = [];
      // Sequentiel, et c est voulu : ces paquets ecrivent tous la meme
      // feuille. Les lancer ensemble ferait courir N transactions sur les
      // memes lignes pour gagner quelques centaines de millisecondes.
      for (let index = 0; index < chunks.length; index += 1) {
        // eslint-disable-next-line no-await-in-loop
        const response = await markCoachArrivalBulk(eventId, { note, userIds: chunks[index] });
        summaries.push(summarizeBulkOutcome(response));
      }
      return summaries.reduce((total, summary) => ({
        failedCount: total.failedCount + summary.failedCount,
        failures: [...total.failures, ...summary.failures],
        markedCount: total.markedCount + summary.markedCount,
        sharedFailureCode: null,
      }), {
        failedCount: 0, failures: [], markedCount: 0, sharedFailureCode: null,
      });
    },
    onSuccess: invalidateAll,
  });

  return {
    bulkMutation,
    coachArrivalMutation,
    invalidateAll,
    lateMinutesMutation,
    resetMutation,
  };
};

/**
 * La phrase FRANCAISE d un refus serveur.
 *
 * ⛔ Le serveur repond en anglais brut (« Attendance can only be marked from 30
 * minutes before… ») : la laisser passer telle quelle mettrait de l anglais
 * sous le doigt d un coach au bord d un terrain. Le code, lui, est stable.
 * @param {any} error
 * @param {(key: string, fallback: string) => string} t
 * @returns {string}
 */
export const describeAttendanceError = (error, t) => {
  const code = getServerErrorCode(error);
  if (code === WINDOW_CLOSED_CODE) {
    return t(
      'eventDetails.attendanceCall.errors.windowClosed',
      "L'appel n'est pas ouvert en ce moment. Il s'ouvre 30 minutes avant le début"
      + ' et se ferme 2 h après la fin.',
    );
  }
  return t(
    'eventDetails.attendanceCall.errors.generic',
    "Impossible d'enregistrer le pointage. Réessaie dans un instant.",
  );
};

/**
 * La phrase qui resume un envoi groupe — UNE seule quand la cause est unique.
 *
 * 🧨 22 refus pour la meme raison, c est UNE phrase. En afficher 22 rendrait
 * l ecran illisible au moment precis ou le coach a besoin de comprendre vite.
 * @param {{ failedCount: number, failures: Array<{ code: string }>, markedCount: number }} summary
 * @param {(key: string, fallback: string) => string} t
 * @returns {string}
 */
export const describeBulkOutcome = (summary, t) => {
  const marked = Number(summary?.markedCount || 0);
  const failed = Number(summary?.failedCount || 0);
  if (failed === 0) {
    return t('eventDetails.attendanceCall.bulk.allMarked', 'Tout le monde est pointé.');
  }

  const codes = Array.from(new Set((summary?.failures || []).map((failure) => failure.code)));
  if (codes.length === 1 && codes[0] === WINDOW_CLOSED_CODE) {
    return t(
      'eventDetails.attendanceCall.bulk.windowClosed',
      "Personne n'a été pointé : l'appel n'est pas ouvert en ce moment.",
    );
  }
  if (codes.length === 1 && marked === 0) {
    return t(
      'eventDetails.attendanceCall.bulk.allRefused',
      "Personne n'a été pointé : le serveur a refusé pour la même raison.",
    );
  }
  const reste = t(
    'eventDetails.attendanceCall.bulk.partial',
    'pointé·e·s, le reste a été refusé.',
  );
  return `${marked} ${reste}`;
};

export default useAttendanceCallMutations;
