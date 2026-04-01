import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

const resolveTone = (tone, Colors) => {
  switch (tone) {
    case 'critical':
      return {
        accent: Colors.error500,
        background: 'rgba(54, 17, 24, 0.96)',
        border: 'rgba(239, 68, 68, 0.50)',
        eyebrowBackground: 'rgba(239, 68, 68, 0.16)',
      };
    case 'league':
      return {
        accent: Colors.gold500,
        background: 'rgba(20, 33, 45, 0.97)',
        border: 'rgba(255, 219, 102, 0.40)',
        eyebrowBackground: 'rgba(255, 219, 102, 0.16)',
      };
    default:
      return {
        accent: Colors.primary500,
        background: 'rgba(10, 28, 43, 0.97)',
        border: 'rgba(1, 179, 244, 0.38)',
        eyebrowBackground: 'rgba(1, 179, 244, 0.16)',
      };
  }
};

/**
 * @param {{
 *  visible: boolean;
 *  title: string;
 *  body?: string;
 *  supportingText?: string;
 *  eyebrow?: string;
 *  tone?: 'primary' | 'critical' | 'league';
 *  headerContent?: import('react').ReactNode;
 *  children?: import('react').ReactNode;
 *  primaryAction?: { label: string; onPress: () => void; variant?: 'Primary' | 'PrimaryLight' | 'Secondary' | 'SecondaryLight' };
 *  secondaryAction?: { label: string; onPress: () => void; variant?: 'Primary' | 'PrimaryLight' | 'Secondary' | 'SecondaryLight' };
 *  onRequestClose?: () => void;
 * }} props
 */
function GlobalPromptModal({
  body,
  children,
  eyebrow,
  headerContent,
  onRequestClose,
  primaryAction,
  secondaryAction,
  supportingText,
  title,
  tone = 'primary',
  visible,
}) {
  const {
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const palette = resolveTone(tone, Colors);

  if (!visible) return null;

  return (
    <Modal
      animationType="fade"
      onRequestClose={onRequestClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <Pressable onPress={onRequestClose} style={styles.backdrop} />
        <View
          style={[
            styles.card,
            {
              backgroundColor: palette.background,
              borderColor: palette.border,
            },
          ]}
        >
          <ScrollView
            contentContainerStyle={[Spaces.gap[12]]}
            showsVerticalScrollIndicator={false}
          >
            {headerContent}
            {eyebrow ? (
              <View
                style={[
                  styles.eyebrow,
                  {
                    backgroundColor: palette.eyebrowBackground,
                    borderColor: palette.border,
                  },
                ]}
              >
                <Text style={[Fonts.p4Bold, { color: palette.accent }]}>{eyebrow}</Text>
              </View>
            ) : null}

            <Text style={[Fonts.h3Bold, { color: Colors.neutral00 }]}>{title}</Text>

            {body ? (
              <Text style={[Fonts.p2, { color: Colors.neutral100, lineHeight: 24 }]}>
                {body}
              </Text>
            ) : null}

            {supportingText ? (
              <Text style={[Fonts.p3, { color: Colors.neutral200, lineHeight: 20 }]}>
                {supportingText}
              </Text>
            ) : null}

            {children}
          </ScrollView>

          <View style={[Spaces.gap[16], Spaces.marginTop[16]]}>
            {primaryAction ? (
              <Button
                onPress={primaryAction.onPress}
                title={primaryAction.label}
                variant={primaryAction.variant || 'Primary'}
              />
            ) : null}
            {secondaryAction ? (
              <Button
                onPress={secondaryAction.onPress}
                title={secondaryAction.label}
                variant={secondaryAction.variant || 'Secondary'}
              />
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    maxWidth: 420,
    padding: 24,
    width: '100%',
  },
  eyebrow: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.60)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
});

export default GlobalPromptModal;
