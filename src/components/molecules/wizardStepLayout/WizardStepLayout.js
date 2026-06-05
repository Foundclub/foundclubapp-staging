import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ScreenContainer from '@/components/templates/ScreenContainer';

/**
 *
 * @param root0
 * @param root0.children
 * @param root0.collapsibleHeader
 * @param root0.isNextDisabled
 * @param root0.isNextLoading
 * @param root0.nextLabel
 * @param root0.onBack
 * @param root0.onClose
 * @param root0.onNext
 * @param root0.onSkip
 * @param root0.showSkip
 * @param root0.stepCount
 * @param root0.stepIndex
 * @param root0.subtitle
 * @param root0.title
 */
function WizardStepLayout({
  children,
  collapsibleHeader = false,
  isNextDisabled = false,
  isNextLoading = false,
  nextLabel,
  onBack,
  onClose,
  onNext,
  onSkip,
  showSkip = false,
  stepCount,
  stepIndex,
  subtitle,
  title,
}) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  const hasProgress = Number.isFinite(stepIndex) && Number.isFinite(stepCount) && stepCount > 0;
  const normalizedProgress = hasProgress ? Math.max(0, Math.min(1, stepIndex / stepCount)) : 0;
  const handleScroll = useCallback((event) => {
    if (!collapsibleHeader) return;

    const offsetY = Number(event?.nativeEvent?.contentOffset?.y || 0);
    setIsHeaderCollapsed((currentValue) => {
      const nextValue = offsetY > 24;
      return currentValue === nextValue ? currentValue : nextValue;
    });
  }, [collapsibleHeader]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !onNext || isNextDisabled || isNextLoading) {
      return undefined;
    }

    /**
     * @param {KeyboardEvent} event
     */
    const handleWindowKeyDown = (event) => {
      if (
        event.defaultPrevented
        || event.key !== 'Enter'
        || event.shiftKey
        || event.altKey
        || event.ctrlKey
        || event.metaKey
      ) {
        return;
      }

      const { target } = event;
      const htmlElementCtor = typeof window !== 'undefined' ? window.HTMLElement : undefined;
      const htmlInputCtor = typeof window !== 'undefined' ? window.HTMLInputElement : undefined;
      const isElement = typeof htmlElementCtor !== 'undefined'
        && target instanceof htmlElementCtor;
      const tagName = isElement ? target.tagName.toLowerCase() : '';
      const isEditable = isElement && target.isContentEditable;
      const inputType = typeof htmlInputCtor !== 'undefined'
        && target instanceof htmlInputCtor
        ? target.type
        : '';

      if (
        isEditable
        || tagName === 'textarea'
        || tagName === 'button'
        || tagName === 'a'
        || tagName === 'select'
        || (tagName === 'input'
          && ['button', 'checkbox', 'file', 'radio', 'submit'].includes(inputType))
      ) {
        return;
      }

      event.preventDefault();
      onNext();
    };

    window.addEventListener('keydown', handleWindowKeyDown);

    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown);
    };
  }, [isNextDisabled, isNextLoading, onNext]);

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Alignments.fill,
        Alignments.justifySpaceBetween,
        { paddingBottom: insets.bottom + 32 },
      ]}
      contentWidth="readable"
      responsivePadding
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        style={[Alignments.fill]}
      >
        <View style={[Alignments.fill]}>
          <View style={[Spaces.marginTop[24], isHeaderCollapsed ? Spaces.marginBottom[16] : Spaces.marginBottom[32], { position: 'relative' }]}>
            {onClose ? (
              <TouchableOpacity
                accessibilityLabel={t('common.close', 'Fermer')}
                hitSlop={{
                  bottom: 10, left: 10, right: 10, top: 10,
                }}
                onPress={onClose}
                style={{
                  alignItems: 'center',
                  borderColor: Colors.primary500,
                  borderRadius: 14,
                  borderWidth: 1,
                  height: 28,
                  justifyContent: 'center',
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  width: 28,
                  zIndex: 2,
                }}
              >
                <Text style={[Fonts.p2Bold, Fonts.primary500]}>X</Text>
              </TouchableOpacity>
            ) : null}
            {hasProgress ? (
              <View style={[isHeaderCollapsed ? Spaces.marginBottom[12] : Spaces.marginBottom[24], { paddingRight: onClose ? 40 : 0 }]}>
                <Text style={[Fonts.p3, Fonts.neutral200, Spaces.marginBottom[12]]}>
                  {t('eventWizard.common.stepCounter', {
                    current: stepIndex,
                    defaultValue: `Étape ${stepIndex}/${stepCount}`,
                    total: stepCount,
                  })}
                </Text>
                <View
                  style={[
                    ApplicationStyle.card,
                    {
                      backgroundColor: 'rgba(1, 179, 244, 0.08)',
                      borderColor: 'rgba(1, 179, 244, 0.22)',
                      borderRadius: 999,
                      height: isHeaderCollapsed ? 4 : 8,
                      overflow: 'hidden',
                    },
                  ]}
                >
                  <View
                    style={{
                      backgroundColor: Colors.primary500,
                      borderRadius: 999,
                      height: '100%',
                      width: `${normalizedProgress * 100}%`,
                    }}
                  />
                </View>
              </View>
            ) : null}

            <Text
              numberOfLines={isHeaderCollapsed ? 1 : undefined}
              style={[
                isHeaderCollapsed ? Fonts.h2 : Fonts.h1,
                Fonts.neutral00,
                isHeaderCollapsed ? Spaces.marginBottom[8] : Spaces.marginBottom[20],
              ]}
            >
              {title}
            </Text>
            {subtitle && !isHeaderCollapsed ? (
              <Text style={[Fonts.p1, Fonts.neutral100, { lineHeight: 30, maxWidth: 720 }]}>
                {subtitle}
              </Text>
            ) : null}
          </View>

          <ScrollView
            automaticallyAdjustKeyboardInsets
            contentContainerStyle={[Spaces.paddingBottom[48]]}
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            keyboardShouldPersistTaps="handled"
            onScroll={handleScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </View>

        <View style={[Spaces.gap[24], Spaces.marginTop[24]]}>
          {showSkip ? (
            <Button
              onPress={onSkip}
              title={t('common.ignore')}
              variant="Secondary"
            />
          ) : null}
          <View style={[Alignments.row, Spaces.gap[16]]}>
            {onBack ? (
              <Button
                onPress={onBack}
                style={{ flex: 1 }}
                title={t('common.back', 'Retour')}
                variant="Secondary"
              />
            ) : null}
            {onNext ? (
              <Button
                disabled={isNextDisabled}
                isLoading={isNextLoading}
                onPress={onNext}
                style={{ flex: 1 }}
                submitOnEnter
                title={nextLabel || t('common.next', 'Suivant')}
                variant="Primary"
              />
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

export default WizardStepLayout;
