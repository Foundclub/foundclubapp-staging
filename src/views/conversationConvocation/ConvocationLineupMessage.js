import { useMemo } from 'react';
import { View } from 'react-native';

import { getAuthRuntimeSnapshot } from '@/store/authRuntime';

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
 * @typedef {object} ConvocationCardExtras
 * @property {((target?: any) => void) | undefined} onEdit « Modifier » / toucher le terrain.
 * @property {(() => any) | undefined} renderReponses Le bloc « Reponses » sous la carte.
 */

/**
 * MESSAGERIE-1C — CE QUE 1C AJOUTE A LA CARTE D'UNE CONVOCATION DANS LE FIL.
 *
 * Le fil garde SON montage de la carte (`CompositionMessageBubbleDuFil`, abonnee a la fiche du fil
 * — garde FINITIONS15 / NOMDUJOUR) : il le passe en fonction-enfant, et ce composant lui fournit
 * ses deux props facultatives. Pour une carte `lineup_share` seulement :
 *   · la notice « Composition modifiee (vN) : X remplace Y » au-dessus de la DERNIERE version ;
 *   · `onEdit` pour qui peut convoquer (entraineur de l'equipe, super-admin) : « Modifier » mene
 *     aux Joueurs, le terrain au Placement (props posees par MESSAGERIE-1A sur la carte) ;
 *   · `renderReponses` : le bloc « Reponses » sous la carte.
 * Toute autre carte de composition est rendue exactement comme avant (aucun extra).
 *
 * 📡 Les messages viennent du cache du fil (`enabled: false`) : aucune requete de plus.
 * @param {object} props
 * @param {string} props.chatId
 * @param {(extras: ConvocationCardExtras) => any} props.children Le montage de la carte.
 * @param {any} props.composition La charge de la carte.
 * @param {(request: { composition: any, startStep: 2 | 3 }) => void} [props.onEdit] Ouvre
 *   l'assistant en modification. Absent = carte en lecture, comme avant 1C.
 * @returns {import('react').ReactElement}
 */
function ConvocationLineupMessage({
  chatId, children, composition, onEdit,
}) {
  const { data: messagesPages } = useGetChatMessages({ chatId }, { enabled: false });
  const pages = /** @type {any} */ (messagesPages)?.pages;
  const messages = useMemo(() => (Array.isArray(pages) ? pages : [])
    .flatMap((/** @type {any} */ page) => (Array.isArray(page?.data) ? page.data : [])), [pages]);

  const isLineup = composition?.type === LINEUP_SHARE_TYPE;
  const { auth } = /** @type {any} */ (getAuthRuntimeSnapshot());
  const canEdit = isLineup
    && typeof onEdit === 'function'
    && Boolean(composition?.eventId)
    && canManageTeamConvocation({ teamId: composition?.teamId, user: auth?.user });
  const isLatest = isLineup && isLatestLineupComposition({ composition, messages });

  /** @type {ConvocationCardExtras} */
  const extras = {
    onEdit: canEdit
      ? (target) => onEdit?.({ composition, startStep: getEditStartStep(target) })
      : undefined,
    renderReponses: isLineup
      ? () => <ConvocationResponsesBlock composition={composition} isLatest={isLatest} />
      : undefined,
  };

  return (
    <View testID="convocation-lineup-message">
      {isLineup ? <ConvocationUpdateNotice composition={composition} messages={messages} /> : null}
      {typeof children === 'function' ? children(extras) : null}
    </View>
  );
}

export default ConvocationLineupMessage;
