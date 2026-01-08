
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
}) => {
  const { Alignments, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

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
        {/* Header Section */}
        <View style={[Spaces.marginTop[16], Spaces.paddingHorizontal[24], Spaces.marginBottom[32]]}>
          <Text style={[Fonts.h1, Fonts.neutral00, Spaces.marginBottom[8]]}>
            {title}
          </Text>
          {subtitle && (
            <Text style={[Fonts.p1, Fonts.neutral100]}>
              {subtitle}
            </Text>
          )}
        </View>

        {/* Content Section */}
        <ScrollView
          contentContainerStyle={[Spaces.paddingHorizontal[24], Spaces.paddingBottom[24]]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </View>

      {/* Footer Navigation */}
      <View style={[Spaces.paddingHorizontal[24], Spaces.gap[16]]}>
        {showSkip && (
          <Button
            onPress={onSkip}
            title={t('common.ignore', 'Ignorer')}
            variant="Secondary"
          />
        )}
        <View style={[Alignments.row, Spaces.gap[16]]}>
          {onBack && (
            <Button
              onPress={onBack}
              title={t('common.back', 'Retour')}
              variant="Secondary"
              style={{ flex: 1 }}
            />
          )}
          {onNext && (
            <Button
              onPress={onNext}
              title={nextLabel || t('common.next', 'Suivant')}
              variant="Primary"
              disabled={isNextDisabled}
              isLoading={isNextLoading}
              style={{ flex: 1 }}
            />
          )}
        </View>
      </View>
    </ScreenContainer>
  );
};

export default WizardStepLayout;
