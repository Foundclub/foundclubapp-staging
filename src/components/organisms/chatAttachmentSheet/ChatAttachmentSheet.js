import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

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

  return (
    <View style={styles.section}>
      <View style={styles.actionsGrid}>
        {actions.map((action) => {
          const isDisabled = !!action.disabled || !!action.loading;
          return (
            <TouchableOpacity
              accessibilityLabel={action.label}
              accessibilityRole="button"
              accessibilityState={{ disabled: isDisabled }}
              activeOpacity={0.9}
              disabled={isDisabled}
              key={action.key}
              onPress={() => onActionPress(action.key)}
              style={[
                styles.actionButton,
                {
                  backgroundColor: isDisabled ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)',
                  borderColor: isDisabled ? 'rgba(255,255,255,0.08)' : 'rgba(1,179,244,0.45)',
                },
              ]}
            >
              <View
                style={[
                  styles.actionIconCircle,
                  {
                    backgroundColor: isDisabled ? 'rgba(255,255,255,0.08)' : 'rgba(1,179,244,0.2)',
                    borderColor: isDisabled ? 'rgba(255,255,255,0.12)' : 'rgba(1,179,244,0.45)',
                    borderWidth: 1,
                  },
                ]}
              >
                {action.loading ? (
                  <ActivityIndicator color={Colors.primary500} />
                ) : (
                  <ChatAttachmentActionIcon
                    actionKey={action.key}
                    color={isDisabled ? 'rgba(255,255,255,0.42)' : Colors.primary500}
                  />
                )}
              </View>
              <Text
                numberOfLines={2}
                style={[
                  Fonts.p2Bold,
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
