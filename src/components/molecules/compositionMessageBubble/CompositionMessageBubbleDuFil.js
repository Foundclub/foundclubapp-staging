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
 * @param {boolean} [props.isMe] - Message de l'utilisateur courant.
 * @returns {import('react').ReactElement | null} La carte.
 */
function CompositionMessageBubbleDuFil({ chatId, composition, isMe = false }) {
  const { data: fil } = useGetChatById(chatId, { enabled: false });
  return (
    <CompositionMessageBubble
      composition={composition}
      currentPeople={/** @type {any} */ (fil)?.participants}
      isMe={isMe}
    />
  );
}

export default CompositionMessageBubbleDuFil;
