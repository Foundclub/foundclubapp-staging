import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import useTheme from '@/theme/themeContext';
import Button from '@/components/atoms/button/Button';
import ScreenContainer from '@/components/templates/ScreenContainer';

const WizardStepLayout = ({
  children,
  title,
  subtitle,
  onNext,
  onBack,
  isNextDisabled = false,
  isNextLoading = false,
  nextLabel,
  showSkip = false,
  onSkip,
  stepIndex,
  stepCount,
}) => {
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

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Alignments.fill,
        Alignments.justifySpaceBetween,
        { paddingBottom: insets.bottom + 16 },
      ]}
    >
      <View style={[Alignments.fill]}>
        <View style={[Spaces.marginTop[16], Spaces.marginBottom[24]]}>
          {hasProgress ? (
            <View style={[Spaces.marginBottom[16]]}>
              <Text style={[Fonts.p3, Fonts.neutral200, Spaces.marginBottom[8]]}>
                {t('eventWizard.common.stepCounter', {
                  current: stepIndex,
                  defaultValue: `Etape ${stepIndex}/${stepCount}`,
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

          <Text style={[Fonts.h1, Fonts.neutral00, Spaces.marginBottom[8]]}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[Fonts.p1, Fonts.neutral100]}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <ScrollView
          contentContainerStyle={[Spaces.paddingBottom[24]]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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
              title={t('common.back', 'Retour')}
              variant="Secondary"
              style={{ flex: 1 }}
            />
          ) : null}
          {onNext ? (
            <Button
              onPress={onNext}
              title={nextLabel || t('common.next', 'Suivant')}
              variant="Primary"
              disabled={isNextDisabled}
              isLoading={isNextLoading}
              style={{ flex: 1 }}
            />
          ) : null}
        </View>
      </View>
    </ScreenContainer>
  );
};

export default WizardStepLayout;
