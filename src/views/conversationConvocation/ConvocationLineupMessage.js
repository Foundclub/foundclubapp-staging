import { useMemo } from 'react';
import { View } from 'react-native';

import { getAuthRuntimeSnapshot } from '@/store/authRuntime';

import CompositionMessageBubbleDuFil
  from '@/components/molecules/compositionMessageBubble/CompositionMessageBubbleDuFil';

import { useGetChatMessages } from '@/services/chat/chatQueriesCompat';

import ConvocationResponsesBlock from './ConvocationResponsesBlock';
import ConvocationUpdateNotice from './ConvocationUpdateNotice';
import {
  canManageTeamConvocation,
  getEditStartStep,
  isLatestLineupComposition,
  LINEUP_SHARE_TYPE,
} from './convocationWizardUtils';

/**
 * MESSAGERIE-1C — LA CARTE D'UNE CONVOCATION DANS LE FIL, AVEC CE QUE 1C Y AJOUTE.
 *
 * Le fil (`Conversation.js`) n'appelle QUE ce composant pour une carte de composition : le
 * point d'accroche y tient en une ligne. Ici, et seulement pour une carte `lineup_share` :
 *   · la notice « Composition modifiee (vN) : X remplace Y » au-dessus de la DERNIERE version ;
 *   · « Modifier » et le toucher du terrain pour qui peut convoquer (props facultatives
 *     `onEdit` / `renderReponses` de la carte, posees par MESSAGERIE-1A) ;
 *   · le bloc « Reponses » sous la carte.
 * Toute autre carte de composition est rendue exactement comme avant.
 *
 * 📡 Les messages viennent du cache du fil (`enabled: false`) : aucune requete de plus.
 * @param {object} props
 * @param {string} props.chatId
 * @param {any} props.composition La charge de la carte.
 * @param {any} [props.currentEvent] Le match joint au message, du jour.
 * @param {boolean} [props.isMe]
 * @param {(request: { composition: any, startStep: 2 | 3 }) => void} [props.onEdit] Ouvre
 *   l'assistant en modification. Absent = carte en lecture, comme avant 1C.
 * @returns {import('react').ReactElement}
 */
function ConvocationLineupMessage({
  chatId, composition, currentEvent = null, isMe = false, onEdit,
}) {
  const { data: messagesPages } = useGetChatMessages({ chatId }, { enabled: false });
  const messages = useMemo(() => (Array.isArray(messagesPages?.pages) ? messagesPages.pages : [])
    .flatMap((/** @type {any} */ page) => (Array.isArray(page?.data) ? page.data : [])), [
    messagesPages,
  ]);

  const isLineup = composition?.type === LINEUP_SHARE_TYPE;
  const { auth } = getAuthRuntimeSnapshot();
  const canEdit = isLineup
    && typeof onEdit === 'function'
    && Boolean(composition?.eventId)
    && canManageTeamConvocation({ teamId: composition?.teamId, user: auth?.user });
  const isLatest = isLineup && isLatestLineupComposition({ composition, messages });

  return (
    <View testID="convocation-lineup-message">
      {isLineup ? <ConvocationUpdateNotice composition={composition} messages={messages} /> : null}
      <CompositionMessageBubbleDuFil
        chatId={chatId}
        composition={composition}
        currentEvent={currentEvent}
        isMe={isMe}
        onEdit={canEdit
          ? (/** @type {any} */ target) => onEdit?.({
            composition, startStep: getEditStartStep(target),
          })
          : undefined}
        renderReponses={isLineup
          ? () => <ConvocationResponsesBlock composition={composition} isLatest={isLatest} />
          : undefined}
      />
    </View>
  );
}

export default ConvocationLineupMessage;
