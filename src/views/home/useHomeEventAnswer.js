import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import {
  getCurrentUserEventParticipationState,
  resolveRsvpAnswer,
} from '@/domains/event/participationState';
import { getParticipationErrorMessage } from '@/domains/participation/participationFlow';

import { useGetEvent } from '@/services/event/eventQueries';
import { respondToEventRsvp } from '@/services/event/eventService';

// T02 — REPONDRE « PRESENT » / « ABSENT » DEPUIS L'ACCUEIL, SANS QUITTER L'ACCUEIL.
//
// Constat d'Adel du 2026-08-17 : « quand on fait Présent / Absent sur l'accueil,
// ça nous renvoie sur la page. Alors que NON : ça doit envoyer la réponse DIRECT,
// et ça se met à jour avec les statuts réels des boutons sur les détails de
// l'événement. » Deux boutons qui portent un verbe d'action ne doivent pas etre
// des liens deguises : qui appuie sur « Présent » a repondu dans sa tete, et s'il
// atterrit sur une page ou il faut reappuyer, il croit avoir repondu sans l'avoir
// fait.
//
// 🧩 TROIS CHOSES QUI EXISTAIENT DEJA, ET QU'ON NE REECRIT PAS (§1 bis, barreau 2)
//   1. LE TUYAU — `respondToEventRsvp` (`POST /events/:id/rsvp`). C'est deja la
//      voie de la reponse rapide depuis une notification (`rsvpActions.js`) et
//      celle des boutons des journees de stage (`EventDetails.js`). Cote serveur,
//      `applyRsvp` y fait TOUT : eligibilite, capacite, desactivation de la
//      reponse precedente, resynchronisation des relations, alerte au staff.
//      ⛔ Ecrire ici un second chemin de reponse serait le defaut le plus cher a
//      retrouver — deux regles qui divergent.
//   2. LA DONNEE — `useGetEvent`, clef `['event', documentId]`. C'est EXACTEMENT
//      la clef que la fiche de l'evenement emploie (`EventDetails.js:599`), donc
//      react-query ne garde qu'UNE entree pour les deux ecrans : le bandeau et la
//      fiche lisent le meme octet et ne peuvent pas se contredire.
//   3. L'ECHELLE — `resolveRsvpAnswer`, que les boutons de la fiche appellent
//      aussi (`EventAnswerButtons.js`).
//
// 🚨 LE BOUTON N'AFFICHE QUE CE QUE LE SERVEUR A CONFIRME. Il n'y a AUCUN etat
// optimiste ici, et c'est la protection centrale du lot : sur un echec, l'etat
// affiche n'a jamais bouge, donc il ne peut pas rester vert a tort. Le prix est
// une relecture de l'evenement apres la reponse — assume, c'est le seul moyen de
// dire la verite.
//
// ⚠️ CE QUE `GET /app/home-summary` NE DIT PAS, ET POURQUOI CE HOOK LIT AILLEURS :
// le resume de l'accueil ne rend que `{ id, label, startsAt, team }` pour le
// prochain evenement — AUCUNE trace de ma reponse (mesure du 2026-08-17,
// `app-home-summary.ts:478`). Sans cette relecture, le bandeau ne saurait jamais
// ce que j'ai deja repondu.

/**
 * Ma reponse a un evenement, et de quoi la changer depuis le bandeau de l'accueil.
 * @param {string | undefined} eventId - L'evenement nomme par le bandeau.
 * @returns {{
 *   answer: string | null,
 *   isAnswering: boolean,
 *   submit: (answer: 'present' | 'absent') => void,
 * }} L'etat confirme par le serveur, et le geste.
 */
export const useHomeEventAnswer = (eventId) => {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const queryClient = useQueryClient();

  // `useGetEvent` porte deja `enabled: !!documentId` : sans evenement, aucun
  // appel ne part.
  const { data: event } = useGetEvent(eventId || '');

  const answer = resolveRsvpAnswer(getCurrentUserEventParticipationState({
    missings: event?.missings,
    participationRequests: event?.participationRequests,
    participations: event?.participations,
    user: userData,
  }));

  const mutation = useMutation({
    mutationFn: (/** @type {'present' | 'absent'} */ nextAnswer) => (
      respondToEventRsvp(eventId, nextAnswer)
    ),
    onError: (error) => {
      // Meme phrase et meme traducteur d'erreur que la fiche de l'evenement
      // (`useEventMutations.js`) : un refus du serveur se dit d'une seule facon
      // dans l'app.
      //
      // ⚠️ LIMITE MESUREE LE 2026-08-17, ET ELLE EST ANTERIEURE A CE LOT :
      // `HomeHub` est AUSSI compile par le site (`web/src/routes/screenRegistry
      // .tsx:15`), or `react-native-web` livre un `Alert.alert()` qui ne fait
      // RIEN (`dist/exports/Alert/index.js` : `static alert() {}`). Sur le site,
      // le refus est donc muet. C'est le cas de TOUS les ecrans partages du
      // depot (`Profile`, `ProfileEdit`, `SearchAlerts`, `useEventMutations`…) :
      // le motif maison pour le web est un jumeau `.web.js`, et `HomeHub` n'en a
      // pas. ⛔ Ecrire ici un troisieme chemin d'alerte serait la divergence
      // qu'on cherche justement a eviter — il faut un helper PARTAGE, adopte par
      // tous les appelants, et c'est un lot a soi seul.
      // 🛟 CE QUI RESTE VRAI SUR LES DEUX PLATEFORMES : le bouton ne bouge pas.
      // Il n'y a aucun etat optimiste, donc un echec ne peut pas le laisser vert.
      Alert.alert(
        t('common.error'),
        getParticipationErrorMessage(error, "Impossible d'enregistrer ta réponse pour le moment."),
      );
    },
    onSuccess: () => {
      // La relecture qui allume le bouton. `['event', eventId]` sert AUSSI la
      // fiche : les deux ecrans se remettent a jour ensemble.
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      // Les memes deux files que la fiche vide apres une reponse
      // (`useEventMutations.js`) : les listes d'evenements et le planning
      // personnel montrent le meme etat, ils doivent le reapprendre.
      // ⛔ `home-summary` n'est PAS de la partie : il ne porte aucune trace de ma
      // reponse, le rappeler rendrait la meme charge utile pour rien.
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['planning', 'personal'] });
    },
  });

  const { mutate } = mutation;
  const submit = useCallback((/** @type {'present' | 'absent'} */ nextAnswer) => {
    if (!eventId) return;
    mutate(nextAnswer);
  }, [eventId, mutate]);

  return {
    answer,
    isAnswering: mutation.isPending,
    submit,
  };
};

export default useHomeEventAnswer;
