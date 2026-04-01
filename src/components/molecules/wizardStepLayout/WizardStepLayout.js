import { useEffect } from 'react';
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

  const hasProgress = Number.isFinite(stepIndex) && Number.isFinite(stepCount) && stepCount > 0;
  const normalizedProgress = hasProgress ? Math.max(0, Math.min(1, stepIndex / stepCount)) : 0;

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

      const target = event.target;
      const isElement = typeof HTMLElement !== 'undefined' && target instanceof HTMLElement;
      const tagName = isElement ? target.tagName.toLowerCase() : '';
      const isEditable = isElement && target.isContentEditable;
      const inputType = typeof HTMLInputElement !== 'undefined' && target instanceof HTMLInputElement
        ? target.type
        : '';

      if (
        isEditable
        || tagName === 'textarea'
        || tagName === 'button'
        || tagName === 'a'
        || tagName === 'select'
        || (tagName === 'input' && ['button', 'submit', 'checkbox', 'radio', 'file'].includes(inputType))
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
      contentWidth="readable"
      contentContainerStyle={[
        Alignments.fill,
        Alignments.justifySpaceBetween,
        { paddingBottom: insets.bottom + 16 },
      ]}
      responsivePadding
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        style={[Alignments.fill]}
      >
        <View style={[Alignments.fill]}>
          <View style={[Spaces.marginTop[16], Spaces.marginBottom[24], { position: 'relative' }]}>
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
              <View style={[Spaces.marginBottom[16], { paddingRight: onClose ? 40 : 0 }]}>
                <Text style={[Fonts.p3, Fonts.neutral200, Spaces.marginBottom[8]]}>
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
                      height: 8,
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

            <Text style={[Fonts.h1, Fonts.neutral00, Spaces.marginBottom[10]]}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={[Fonts.p1, Fonts.neutral100, { lineHeight: 28 }]}>
                {subtitle}
              </Text>
            ) : null}
          </View>

          <ScrollView
            automaticallyAdjustKeyboardInsets
            contentContainerStyle={[Spaces.paddingBottom[24]]}
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </View>

        <View style={[Spaces.gap[16]]}>
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
