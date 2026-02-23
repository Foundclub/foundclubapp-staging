import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useEventWizard } from './EventWizardContext';

/**
 *
 * @param root0
 * @param root0.navigation
 */
function EventWizardValidationMode({ navigation }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { dispatch, state } = useEventWizard();
  const [validationMode, setValidationMode] = useState(state.validationMode || 'auto');

  const selectedAccentBg = `${Colors.primary500}2A`;
  const selectedCardBg = `${Colors.primary500}17`;
  const unselectedCardBg = `${Colors.primary700}D0`;
  const cardBorder = `${Colors.primary500}52`;
  const cardBorderSoft = `${Colors.primary500}36`;
  const recommendedChipBg = `${Colors.primary500}21`;
  const recommendedChipBorder = `${Colors.primary500}55`;
  const helperCardBg = `${Colors.primary500}0F`;
  const helperCardBorder = `${Colors.primary500}3A`;

  const options = [
    {
      detailOne: t(
        'eventWizard.steps.validation.autoRuleOne',
        'Check-in simplifie pour les joueurs',
      ),
      detailTwo: t(
        'eventWizard.steps.validation.autoRuleTwo',
        'Ideal pour les sessions ouvertes',
      ),
      icon: 'A',
      isRecommended: true,
      key: 'auto',
      subtitle: t(
        'eventWizard.steps.validation.autoDesc',
        'Les participants peuvent confirmer automatiquement leur presence.',
      ),
      title: t('eventEdit.fields.validationMode.options.auto'),
    },
    {
      detailOne: t(
        'eventWizard.steps.validation.manualRuleOne',
        'Controle total par le staff',
      ),
      detailTwo: t(
        'eventWizard.steps.validation.manualRuleTwo',
        'Recommande pour groupes fermes',
      ),
      icon: 'M',
      isRecommended: false,
      key: 'manual',
      subtitle: t(
        'eventWizard.steps.validation.manualDesc',
        'Le coach valide manuellement les participants.',
      ),
      title: t('eventEdit.fields.validationMode.options.manual'),
    },
  ];

  const handleNext = () => {
    dispatch({
      payload: validationMode,
      type: 'SET_VALIDATION_MODE',
    });
    navigation.navigate(RouteNames.EventWizardDescription);
  };

  return (
    <WizardStepLayout
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      stepCount={10}
      stepIndex={6}
      subtitle={t('eventWizard.steps.validation.subtitle', "Definis comment valider les presences a l'evenement.")}
      title={t('eventWizard.steps.validation.title', 'Mode de validation')}
    >
      <View style={[Spaces.marginTop[8], Spaces.gap[16]]}>
        <View style={[Spaces.gap[16]]}>
          {options.map((option) => {
            const selected = validationMode === option.key;
            return (
              <TouchableOpacity
                accessibilityHint={selected
                  ? t('eventWizard.steps.validation.selectedHint', 'Mode actuellement selectionne.')
                  : t('eventWizard.steps.validation.selectHint', 'Selectionne ce mode de validation.')}
                accessibilityLabel={t(
                  'eventWizard.steps.validation.optionLabel',
                  'Mode {{title}}',
                  { title: option.title },
                )}
                accessibilityRole="button"
                key={option.key}
                onPress={() => setValidationMode(option.key)}
                style={[
                  ApplicationStyle.card,
                  Spaces.paddingHorizontal[16],
                  Spaces.paddingVertical[16],
                  {
                    backgroundColor: selected ? selectedCardBg : unselectedCardBg,
                    borderColor: selected ? cardBorder : cardBorderSoft,
                    borderRadius: 18,
                    borderWidth: 1,
                  },
                ]}
              >
                <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
                  <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12], { flex: 1 }]}>
                    <View
                      style={[
                        ApplicationStyle.card,
                        Alignments.alignCenter,
                        Alignments.justifyCenter,
                        {
                          backgroundColor: selected ? selectedAccentBg : `${Colors.primary500}14`,
                          borderColor: selected ? Colors.primary500 : `${Colors.primary500}2F`,
                          borderRadius: 999,
                          height: 32,
                          width: 32,
                        },
                      ]}
                    >
                      <Text style={[Fonts.p3Bold, Fonts.primary500]}>{option.icon}</Text>
                    </View>
                    <View style={[Spaces.gap[8], { flex: 1 }]}>
                      <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
                        <Text style={[Fonts.h4, selected ? Fonts.primary100 : Fonts.neutral00]}>
                          {option.title}
                        </Text>
                        {option.isRecommended ? (
                          <View
                            style={[
                              ApplicationStyle.card,
                              Spaces.paddingHorizontal[8],
                              Spaces.paddingVertical[4],
                              {
                                backgroundColor: recommendedChipBg,
                                borderColor: recommendedChipBorder,
                                borderRadius: 999,
                              },
                            ]}
                          >
                            <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                              {t('eventWizard.steps.validation.recommended', 'Recommande')}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={[Fonts.p2, Fonts.neutral100, { lineHeight: 24 }]}>
                        {option.subtitle}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      ApplicationStyle.card,
                      Alignments.alignCenter,
                      Alignments.justifyCenter,
                      {
                        backgroundColor: selected ? Colors.primary500 : 'transparent',
                        borderColor: selected ? Colors.primary500 : `${Colors.primary500}54`,
                        borderRadius: 999,
                        height: 22,
                        width: 22,
                      },
                    ]}
                  >
                    <Text style={[Fonts.p3Bold, selected ? Fonts.neutral900 : Fonts.primary500]}>
                      {selected ? 'OK' : ''}
                    </Text>
                  </View>
                </View>

                <View style={[Spaces.marginTop[12], Spaces.gap[8]]}>
                  <Text style={[Fonts.p3, Fonts.neutral100, { lineHeight: 20 }]}>
                    {`- ${option.detailOne}`}
                  </Text>
                  <Text style={[Fonts.p3, Fonts.neutral100, { lineHeight: 20 }]}>
                    {`- ${option.detailTwo}`}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View
          style={[
            Alignments.row,
            Alignments.alignCenter,
            Spaces.gap[8],
            Spaces.paddingVertical[12],
            Spaces.paddingHorizontal[12],
            Spaces.marginTop[16],
            {
              backgroundColor: helperCardBg,
              borderColor: helperCardBorder,
              borderRadius: 14,
              borderWidth: 1,
            },
          ]}
        >
          <Text style={[Fonts.p3Bold, Fonts.primary500]}>
            {t('eventWizard.steps.validation.previewTitle', 'Mode selectionne')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {validationMode === 'manual'
              ? t('eventEdit.fields.validationMode.options.manual')
              : t('eventEdit.fields.validationMode.options.auto')}
          </Text>
        </View>
      </View>
    </WizardStepLayout>
  );
}

export default EventWizardValidationMode;
