import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import {
  markCoachAbsence,
  markCoachArrival,
  markCoachArrivalBulk,
  resetCoachAttendance,
  updateCoachLateMinutes,
} from '@/services/event/eventService';

import { chunkUserIds, describeAttendanceError, summarizeBulkOutcome } from './attendanceCallModel';

/**
 * L5-A — LES ECRITURES DE L ECRAN D APPEL, ET RIEN D AUTRE.
 *
 * 🧭 POURQUOI UN HOOK A PART, ET PAS `useEventMutations` : celui-la porte 20
 * mutations pour l ecran de detail, et exige DEUX rappels de rafraichissement
 * (`refetch`, `refetchParticipations`) que l ecran d appel n a pas — il n a
 * qu une seule requete a relire. Le brancher ici aurait oblige a lui inventer
 * deux fonctions vides, c est-a-dire a mentir sur ce qui se rafraichit.
 *
 * ⚠️ EN REVANCHE LES INVALIDATIONS SONT LES MEMES, LES SIX : un pointage
 * change la liste des evenements, le planning personnel, l evenement, la
 * feuille de presence, LES PARTICIPATIONS et les statistiques d equipe. En
 * oublier une laisse un ecran voisin afficher un chiffre faux jusqu au
 * prochain demarrage.
 *
 * 🧨 R7-d — `eventParticipations` a ete AJOUTEE, et ce n est pas un confort :
 * `performCoachArrival` rattache la personne aux `participations` et la retire
 * des `missings`. Sur l ecran d appel, ou cette requete n est pas montee, ca ne
 * se voyait pas. Depuis que `EventParticipants` ecrit lui aussi (« À l'heure »),
 * l oubli se verrait a l oeil nu : quelqu un qu on vient de pointer resterait
 * range dans « Sans réponse » avec une pastille « Arrivé » a cote.
 * `useEventMutations` la rafraichit deja, mais par un rappel imperatif
 * (`refetchParticipations`) que ce hook-ci n a pas.
 * @param {string} eventId
 * @returns {any}
 */
export const useAttendanceCallMutations = (eventId) => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['events'] });
    queryClient.invalidateQueries({ queryKey: ['planning', 'personal'] });
    queryClient.invalidateQueries({ queryKey: ['event', eventId] });
    queryClient.invalidateQueries({ queryKey: ['eventAttendance', eventId] });
    queryClient.invalidateQueries({ queryKey: ['eventParticipations', eventId] });
    queryClient.invalidateQueries({ queryKey: ['teamStats'] });
  }, [eventId, queryClient]);

  /**
   * R7-a (vague R, 24/08) — LE REFUS SE DIT, ET IL SE DIT EN FRANCAIS.
   *
   * 🔴 Ce hook n avait AUCUN `onError`. L ecran ferme sa feuille juste apres
   * `mutate` (EventAttendanceCall.js) : un refus serveur laissait donc la
   * ligne « Sans reponse », sans un mot. C est le constat de recette du 24/08,
   * « pointer un joueur en retard ne marche pas » — ca ne marchait pas ET ca
   * ne le disait pas.
   *
   * 🧨 La phrase existait deja : `describeAttendanceError` avait ete ecrite
   * pour traduire ce refus et n avait AUCUN appelant de production. Le serveur
   * repond en anglais brut ; sans elle, c est cet anglais qui tombait sous le
   * doigt du coach.
   *
   * 🧭 UN SEUL gestionnaire pour les quatre ecritures : deux chemins d erreur
   * paralleles divergeraient au premier correctif — c est deja le motif de
   * `performCoachArrival` cote serveur.
   * @param {any} error - L erreur remontee par le service.
   * @returns {void}
   */
  const direLeRefus = useCallback((error) => {
    Alert.alert(t('common.error', 'Erreur'), describeAttendanceError(error, t));
  }, [t]);

  const coachArrivalMutation = useMutation({
    mutationFn: (/** @type {any} */ { payload, userId }) => (
      markCoachArrival(eventId, userId, payload)
    ),
    onError: direLeRefus,
    onSuccess: invalidateAll,
  });

  const lateMinutesMutation = useMutation({
    mutationFn: (/** @type {any} */ { payload, userId }) => (
      updateCoachLateMinutes(eventId, userId, payload)
    ),
    onError: direLeRefus,
    onSuccess: invalidateAll,
  });

  /**
   * APPEL / D7bis (26/08) — POSER UNE ABSENCE.
   *
   * Memes invalidations et meme gestionnaire de refus que les trois autres :
   * une absence change la feuille de presence, les participations ET les
   * statistiques d equipe (`countsInTeamStats.absence` lit `no_show`).
   */
  const absenceMutation = useMutation({
    mutationFn: (/** @type {any} */ { userId }) => markCoachAbsence(eventId, userId),
    onError: direLeRefus,
    onSuccess: invalidateAll,
  });

  const resetMutation = useMutation({
    mutationFn: (/** @type {any} */ { userId }) => resetCoachAttendance(eventId, userId),
    onError: direLeRefus,
    onSuccess: invalidateAll,
  });

  /**
   * « Tout pointer » — UNE requete pour N personnes, par paquets de 100.
   *
   * 🧨 Le bilan se lit dans `items`, pas dans le code HTTP : hors fenetre le
   * serveur repond 200 avec N refus. Le resume est donc rendu a l appelant,
   * qui doit le dire a l ecran.
   *
   * ⚠️ `onError` ne double PAS ce bilan : il ne se declenche que si la requete
   * elle-meme tombe (reseau, 403), cas ou `items` n existe pas.
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
    onError: direLeRefus,
    onSuccess: invalidateAll,
  });

  return {
    absenceMutation,
    bulkMutation,
    coachArrivalMutation,
    invalidateAll,
    lateMinutesMutation,
    resetMutation,
  };
};

export default useAttendanceCallMutations;
