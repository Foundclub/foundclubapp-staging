import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import ChatAttachmentActionIcon from './ChatAttachmentActionIcon';
import styles from './chatAttachmentSheet.styles';

/**
 * @typedef {'photos' | 'camera' | 'location' | 'contact' | 'document' | 'poll' | 'event'} ChatAttachmentActionKey
 */

/**
 * @typedef {object} ChatAttachmentActionItem
 * @property {ChatAttachmentActionKey} key
 * @property {string} label
 * @property {string} [icon]
 * @property {boolean} [disabled]
 * @property {boolean} [loading]
 * @property {string} [unavailableReason]
 */

/**
 * Attachment action grid shown from the chat plus button.
 *
 * 🩹 WHATSAPP2 — LE TITRE N'EST PLUS ICI, et c'est la correction du defaut : il
 * vivait dans la zone qui DEFILE, donc il partait sous le bord haut des que le
 * contenu depassait. Il est desormais rendu par l'en-tete FIXE de la feuille
 * (`headerComponent` de `BottomModal`, pose dans `Conversation.js`), qui ne
 * defile jamais.
 * @param {object} props
 * @param {ChatAttachmentActionItem[]} props.actions
 * @param {(key: ChatAttachmentActionKey) => void} props.onActionPress
 * @returns {import('react').ReactElement}
 */
function ChatAttachmentSheet({
  actions,
  onActionPress,
}) {
  const { Colors, Fonts } = useTheme();

  // 🎨 MSG1A (§3.5) — LA GRILLE DU PACK (`AttachSheet`) : quatre colonnes de pastilles
  // rondes de 58 (cyan a 14 %, glyphe cyan), libelle 12,5 dessous. Deux rangees pour sept
  // entrees : la feuille est plus courte que la grille de cartes d'avant (trois rangees).
  return (
    <View style={styles.section}>
      <View style={styles.actionsGrid}>
        {actions.map((action) => {
          const isDisabled = !!action.disabled || !!action.loading;
          return (
            <TouchableOpacity
              accessibilityLabel={action.unavailableReason
                ? `${action.label}, ${action.unavailableReason}`
                : action.label}
              accessibilityRole="button"
              accessibilityState={{ disabled: isDisabled }}
              activeOpacity={0.8}
              disabled={isDisabled}
              key={action.key}
              onPress={() => onActionPress(action.key)}
              style={styles.actionButton}
            >
              <View
                style={[
                  styles.actionIconCircle,
                  {
                    backgroundColor: isDisabled
                      ? withAlpha(Colors.neutral00, 0.06)
                      : withAlpha(Colors.primary500, 0.14),
                  },
                ]}
              >
                {action.loading ? (
                  <ActivityIndicator color={Colors.primary500} />
                ) : (
                  <ChatAttachmentActionIcon
                    actionKey={action.key}
                    color={isDisabled ? withAlpha(Colors.neutral00, 0.42) : Colors.primary500}
                    size={26}
                  />
                )}
              </View>
              <Text
                numberOfLines={2}
                style={[
                  styles.actionLabel,
                  { color: isDisabled ? Colors.neutral400 : Colors.neutral00 },
                ]}
              >
                {action.label}
              </Text>
              {action.unavailableReason ? (
                <Text
                  numberOfLines={2}
                  style={[
                    Fonts.p4,
                    styles.actionReason,
                    { color: Colors.neutral400 },
                  ]}
                >
                  {action.unavailableReason}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default ChatAttachmentSheet;
