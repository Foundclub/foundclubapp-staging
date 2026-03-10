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
 * @param {object} props
 * @param {ChatAttachmentActionItem[]} props.actions
 * @param {(key: ChatAttachmentActionKey) => void} props.onActionPress
 * @param {string} props.title
 * @param {string} [props.subtitle]
 * @returns {import('react').ReactElement}
 */
function ChatAttachmentSheet({
  actions,
  onActionPress,
  subtitle,
  title,
}) {
  const { Colors, Fonts } = useTheme();

  return (
    <View style={styles.section}>
      <View>
        <Text style={[Fonts.h3, styles.title, { color: Colors.neutral00 }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[Fonts.p3, styles.subtitle, styles.title, { color: Colors.neutral300 }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.actionsGrid}>
        {actions.map((action) => {
          const isDisabled = !!action.disabled || !!action.loading;
          return (
            <TouchableOpacity
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
