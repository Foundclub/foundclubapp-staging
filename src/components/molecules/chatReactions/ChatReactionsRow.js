import { Text, TouchableOpacity, View } from 'react-native';

import { getMyReactionEmoji } from '@/domains/messaging/reactionUseCases';
import useTheme from '@/theme/themeContext';

/**
 * MSGREACT — la rangee de reactions sous une bulle de message.
 *
 * 🫧 Elle ne s affiche QUE s il y a au moins une reaction : un message sans
 * reaction garde exactement la hauteur qu il avait avant ce lot, et la
 * conversation ne change pas d allure pour personne.
 * @param {object} props Les proprietes.
 * @param {boolean} [props.isMine] Vrai si la bulle est a moi (aligne la rangee a droite).
 * @param {string} [props.myUserId] Mon identifiant de compte, pour me reconnaitre.
 * @param {() => void} [props.onPress] Appelee a l appui : ouvre « qui a reagi ».
 * @param {any[]} props.reactions Les blocs { count, emoji, users } du message.
 * @returns {import('react').ReactElement | null} La rangee, ou rien.
 */
function ChatReactionsRow({
  isMine = false, myUserId = '', onPress, reactions,
}) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();

  const safeReactions = Array.isArray(reactions) ? reactions : [];
  if (safeReactions.length === 0) return null;

  const myEmoji = getMyReactionEmoji(safeReactions, myUserId);

  return (
    <View
      style={[
        Alignments.row,
        Alignments.wrap,
        Spaces.gap[4],
        {
          justifyContent: isMine ? 'flex-end' : 'flex-start',
          marginTop: 4,
          paddingHorizontal: 8,
        },
      ]}
    >
      {safeReactions.map((reaction) => {
        const isMyReaction = Boolean(myEmoji) && reaction?.emoji === myEmoji;

        return (
          <TouchableOpacity
            accessibilityRole="button"
            key={`reaction-${reaction?.emoji}`}
            onPress={onPress}
            style={[
              Alignments.row,
              Alignments.alignCenter,
              Spaces.gap[4],
              {
                // Un liseré coloré suffit à dire « celle-ci est la mienne » :
                // pas de second emoji, pas de coche, rien qui allonge la rangée.
                backgroundColor: isMyReaction ? Colors.primary700 : Colors.neutral700,
                borderColor: isMyReaction ? Colors.primary500 : Colors.transparent,
                borderRadius: 12,
                borderWidth: 1,
                paddingHorizontal: 8,
                paddingVertical: 2,
              },
            ]}
          >
            <Text style={{ fontSize: 13 }}>{reaction?.emoji}</Text>
            <Text style={[Fonts.p4, Fonts.neutral00]}>{String(reaction?.count ?? 0)}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default ChatReactionsRow;
