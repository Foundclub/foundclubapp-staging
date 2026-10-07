import { useGetChatById } from '@/services/chat/chatQueriesCompat';

import CompositionMessageBubble from './CompositionMessageBubble';

/**
 * 🐞 FINITIONS15 point 6 (tournée T14, S03c) — LA CARTE DU FIL S'ABONNE ELLE-MÊME À LA FICHE DU FIL.
 *
 * FINITIONS13-STATS donnait les participants du fil à la carte par ses props, pour qu'un compte
 * renommé (Hugo, « Paul Veuillet » jusqu'au 29/09) y prenne son nom du jour. Mais GiftedChat
 * mémorise chaque bulle et ne la redessine que si l'objet message change : les messages arrivent
 * souvent AVANT la fiche du fil, la carte était dessinée sans participants, et ne l'était plus
 * jamais ensuite. ⇒ ancien nom figé dans les anciennes cartes.
 *
 * L'abonnement lit la MÊME entrée de cache que l'écran (`useGetChatById(chatId)`), sans la
 * demander (`enabled: false`) : aucune requête de plus (règle « bulle A », 29/09). Quand la fiche
 * arrive, react-query redessine la carte, quoi que décide la mémoïsation au-dessus d'elle.
 * @param {object} props
 * @param {string} props.chatId - Le fil, celui que l'écran lit déjà.
 * @param {any} props.composition - La charge de la carte.
 * @param {any} [props.currentEvent] - FINITIONS16 (8) : le match joint au message, du jour.
 * @param {boolean} [props.dansLaBulle] - MSG1A : posee dans le cadre commun du fil.
 * @param {boolean} [props.isMe] - Message de l'utilisateur courant.
 * @param {import('react').ReactNode} [props.meta] - MSG1A : l'heure et les coches.
 * @param {(target?: any) => void} [props.onEdit] - MESSAGERIE-1C : « Modifier » pour qui peut
 *   convoquer ; transmis tel quel a la carte.
 * @param {() => any} [props.renderReponses] - MESSAGERIE-1C : le bloc « Reponses » sous la carte.
 * @returns {import('react').ReactElement | null} La carte.
 */
function CompositionMessageBubbleDuFil({
  chatId,
  composition,
  currentEvent = null,
  dansLaBulle = false,
  isMe = false,
  meta = null,
  onEdit = undefined,
  renderReponses = undefined,
}) {
  const { data: fil } = useGetChatById(chatId, { enabled: false });
  return (
    <CompositionMessageBubble
      composition={composition}
      currentEvent={currentEvent}
      currentPeople={/** @type {any} */ (fil)?.participants}
      dansLaBulle={dansLaBulle}
      isMe={isMe}
      meta={meta}
      onEdit={onEdit}
      renderReponses={renderReponses}
    />
  );
}

export default CompositionMessageBubbleDuFil;
