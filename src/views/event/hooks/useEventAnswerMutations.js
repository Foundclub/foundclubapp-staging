import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { getParticipationErrorMessage } from '@/domains/participation/participationFlow';

import { missingEvent, respondToEventRsvp } from '@/services/event/eventService';

/**
 * Les deux clés qui nomment les mutations de réponse.
 *
 * Elles ne servent pas qu à décorer : `useMutation` sans clé est anonyme, et
 * rien — ni react-query, ni un témoin — ne peut alors distinguer « je réponds
 * présent » de « je me déclare absent ». C est ce qui permet à l écran de
 * n éteindre QUE la carte qui attend sa réponse.
 * @type {Readonly<Record<string, string[]>>}
 */
export const EVENT_ANSWER_MUTATION_KEYS = Object.freeze({
  missing: ['event-answer', 'missing'],
  rsvp: ['event-answer', 'rsvp'],
});

/**
 * Invalide tout ce qu une reponse « présent » / « absent » rend faux.
 *
 * 🧊 T2 — POURQUOI UNE FONCTION, ET PAS TROIS LIGNES RECOPIEES.
 *
 * Quatre surfaces font répondre un joueur (la liste de recherche, la fiche, la
 * liste des participants, « Mon planning »). Chacune écrivait sa propre liste
 * de clés, et elles avaient déjà divergé : les deux listes oubliaient
 * `['eventAttendance', eventId]`, que la fiche invalide depuis S1. Résultat, le
 * pointage gardait l ancien instantané et affichait « Arrivé » à quelqu un qui
 * venait de se déclarer absent — le même défaut que S1 a corrigé sur la fiche.
 * Une seule définition ici : la cinquième copie n aura pas lieu.
 * @param {import('@tanstack/react-query').QueryClient} queryClient
 * @param {string} [eventId] - L événement répondu, quand on le connaît.
 * @returns {void}
 */
export const invalidateEventAnswerQueries = (queryClient, eventId) => {
  queryClient.invalidateQueries({ queryKey: ['events'] });
  queryClient.invalidateQueries({ queryKey: ['planning', 'personal'] });
  if (eventId) {
    queryClient.invalidateQueries({ queryKey: ['eventAttendance', eventId] });
  }
};

/**
 * Les deux mutations qu une CARTE de liste déclenche quand on répond.
 *
 * 🎯 T2 — LA PORTE DES RÉPONSES, PAS CELLE DES DEMANDES.
 *
 * `POST /events/:id/rsvp` inscrit un membre convié **immédiatement**
 * (`event-rsvp.ts:161-166`), là où `POST /event-participations` pose `pending`
 * par défaut — et le serveur ne recopie dans `event.participations` que les
 * `accepted`. C est toute la différence entre « Je participe ! » et « Demande
 * en attente » sur la carte.
 *
 * ⛔ Ce hook est volontairement distinct de `useEventMutations` : celui-là est
 * lié à UN événement (la fiche), alors qu une liste répond à n importe laquelle
 * de ses cartes. Le `eventId` voyage donc dans les variables de la mutation.
 * @param {() => void} [onAnswered] - Rafraîchissement propre à l écran appelant,
 *   joué après l invalidation (les listes n ont pas toutes la même requête).
 * @returns {{
 *   missingEventMutation: any,
 *   respondToEventRsvpMutation: any,
 *   submittingAnswer: string,
 *   submittingEventId: string,
 * }} Les mutations, la carte qui attend sa réponse, et laquelle des deux.
 */
export const useEventAnswerMutations = (onAnswered) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const missingEventMutation = useMutation({
    mutationFn: missingEvent,
    mutationKey: EVENT_ANSWER_MUTATION_KEYS.missing,
    onError: (/** @type {any} */ error) => {
      Alert.alert(
        t('common.error', 'Erreur'),
        getParticipationErrorMessage(error, t('common.errorOccurred')),
      );
    },
    onSuccess: (/** @type {any} */ _data, /** @type {any} */ eventId) => {
      invalidateEventAnswerQueries(queryClient, String(eventId || ''));
      onAnswered?.();
    },
  });

  const respondToEventRsvpMutation = useMutation({
    mutationFn: (
      /** @type {{ answer: 'present' | 'absent', eventId: string }} */ { answer, eventId },
    ) => respondToEventRsvp(eventId, answer),
    mutationKey: EVENT_ANSWER_MUTATION_KEYS.rsvp,
    onError: (/** @type {any} */ error) => {
      Alert.alert(
        t('common.error', 'Erreur'),
        getParticipationErrorMessage(error, t('common.errorOccurred')),
      );
    },
    onSuccess: (/** @type {any} */ _data, /** @type {any} */ variables) => {
      invalidateEventAnswerQueries(queryClient, String(variables?.eventId || ''));
      onAnswered?.();
    },
  });

  // 🕐 D5 — QUELLE CARTE ATTEND SA RÉPONSE, ET ELLE SEULE.
  //
  // `isPending` est vrai pour la mutation ENTIÈRE : l éteindre sur toutes les
  // cartes ferait clignoter la liste complète pour un seul appui. Les variables
  // de la mutation portent l événement visé — c est le motif que tient déjà
  // `AdminClaimList.js:102-115` pour la même question (« quelle ligne tourne ? »).
  let submittingEventId = '';
  let submittingAnswer = '';
  if (respondToEventRsvpMutation.isPending) {
    submittingEventId = String(respondToEventRsvpMutation.variables?.eventId || '');
    submittingAnswer = String(respondToEventRsvpMutation.variables?.answer || '');
  } else if (missingEventMutation.isPending) {
    submittingEventId = String(missingEventMutation.variables || '');
    // Cette porte-là ne dit qu une chose, et c est déjà dans son nom.
    submittingAnswer = 'absent';
  }

  return {
    missingEventMutation,
    respondToEventRsvpMutation,
    submittingAnswer,
    submittingEventId,
  };
};

export default useEventAnswerMutations;
