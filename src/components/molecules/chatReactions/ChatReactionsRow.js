import { useTranslation } from 'react-i18next';
import {
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import { getMyReactionEmoji } from '@/domains/messaging/reactionUseCases';
import useTheme from '@/theme/themeContext';

import { TOTAL_DES_REACTIONS } from '@/components/molecules/bulleDuFil/typographieDuFil';

/** Le nombre d'emojis montres dans la pilule (SPECS.md §1, comme WhatsApp). */
const EMOJIS_MONTRES = 3;

/**
 * MSGREACT puis MSG1A (§3.1) — LES REACTIONS, A CHEVAL SUR LE BAS DE LA BULLE.
 *
 * 🫧 Elle ne s affiche QUE s il y a au moins une reaction : un message sans
 * reaction garde exactement sa hauteur.
 *
 * 🎨 MSG1A — UNE seule pilule (SPECS.md §1) : hauteur 24, rayon 12, fond `primary700`,
 * un anneau de 2 a la couleur du fond du fil, les 3 emojis les plus donnes puis le
 * TOTAL (s il depasse 1), et un liseré cyan quand ma reaction en fait partie. Elle
 * remonte de 7 sur le bas de la bulle, a 10 de son bord. L appui ouvre toujours
 * « qui a reagi » : rien ne change de ce cote.
 * @param {object} props Les proprietes.
 * @param {boolean} [props.isMine] Vrai si la bulle est a moi (aligne la pilule a droite).
 * @param {string} [props.myUserId] Mon identifiant de compte, pour me reconnaitre.
 * @param {() => void} [props.onPress] Appelee a l appui : ouvre « qui a reagi ».
 * @param {any[]} props.reactions Les blocs { count, emoji, users } du message.
 * @returns {import('react').ReactElement | null} La pilule, ou rien.
 */
function ChatReactionsRow({
  isMine = false, myUserId = '', onPress, reactions,
}) {
  const { Colors } = useTheme();
  const { t } = useTranslation();

  const safeReactions = Array.isArray(reactions) ? reactions : [];
  if (safeReactions.length === 0) return null;

  const myEmoji = getMyReactionEmoji(safeReactions, myUserId);
  // Tri STABLE par nombre decroissant : a egalite, l ordre du serveur est garde.
  const triees = safeReactions
    .map((reaction, index) => ({ index, reaction }))
    .sort((a, b) => (Number(b.reaction?.count) || 0) - (Number(a.reaction?.count) || 0)
      || a.index - b.index)
    .map(({ reaction }) => reaction);
  const total = triees.reduce((somme, reaction) => somme + (Number(reaction?.count) || 0), 0);
  const detail = triees
    .map((reaction) => `${reaction?.emoji} ${Number(reaction?.count) || 0}`)
    .join(', ');

  return (
    <View
      style={[
        styles.rangee,
        { justifyContent: isMine ? 'flex-end' : 'flex-start' },
      ]}
    >
      <TouchableOpacity
        accessibilityLabel={t('conversation.reactions.summary', {
          defaultValue: 'Réactions : {{detail}}',
          detail,
        })}
        accessibilityRole="button"
        onPress={onPress}
        style={[styles.anneau, { backgroundColor: Colors.chatBackground }]}
        testID="reactions-pilule"
      >
        <View
          style={[
            styles.pilule,
            {
              backgroundColor: Colors.primary700,
              borderColor: myEmoji ? Colors.primary500 : Colors.transparent,
            },
          ]}
          testID="reactions-pilule-interieur"
        >
          {triees.slice(0, EMOJIS_MONTRES).map((reaction) => (
            <Text key={`reaction-${reaction?.emoji}`} style={styles.emoji}>{reaction?.emoji}</Text>
          ))}
          {total > 1 ? (
            <Text style={[TOTAL_DES_REACTIONS, styles.total, { color: Colors.neutral00 }]}>
              {String(total)}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  // L anneau de 2 a la couleur du fond : il « decoupe » la pilule sur la bulle.
  anneau: {
    borderRadius: 14,
    padding: 2,
  },
  emoji: {
    fontSize: 13,
    lineHeight: 16,
  },
  pilule: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 2,
    height: 24,
    paddingHorizontal: 7,
  },
  // 24 de haut, posee a -17 sous la bulle : elle remonte de 7 (+ 2 d anneau).
  rangee: {
    flexDirection: 'row',
    marginTop: -9,
    paddingHorizontal: 8,
  },
  total: {
    marginLeft: 3,
  },
});

export default ChatReactionsRow;
