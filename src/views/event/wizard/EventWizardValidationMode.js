// @ts-nocheck
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { isTrainingEventType } from '@/domains/event/eventUseCases';
import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useEventWizard } from './EventWizardContext';
import {
  getEventWizardStepCount,
  getEventWizardValidationStepIndex,
} from './eventWizardDetectionUtils';

const buildValidationOptions = (t) => ([
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
      'Recommande pour les groupes fermes',
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
]);

function ValidationChoiceGroup({
  Alignments,
  ApplicationStyle,
  Colors,
  Fonts,
  helperBorderColor,
  helperCardBg,
  options,
  recommendedChipBg,
  recommendedChipBorder,
  selectedAccentBg,
  selectedCardBg,
  selectedValue,
  setSelectedValue,
  Spaces,
  title,
  unselectedCardBg,
}) {
  const cardBorder = `${Colors.primary500}52`;
  const cardBorderSoft = `${Colors.primary500}36`;

  return (
    <View style={[Spaces.gap[12]]}>
      <Text style={[Fonts.h4, Fonts.neutral00]}>
        {title}
      </Text>
      <View style={[Spaces.gap[16]]}>
        {options.map((option) => {
          const selected = selectedValue === option.key;
          return (
            <TouchableOpacity
              accessibilityRole="button"
              key={`${title}-${option.key}`}
              onPress={() => setSelectedValue(option.key)}
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
                            Recommande
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
          {
            backgroundColor: helperCardBg,
            borderColor: helperBorderColor,
            borderRadius: 14,
            borderWidth: 1,
          },
        ]}
      >
        <Text style={[Fonts.p3Bold, Fonts.primary500]}>
          Selection:
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral100]}>
          {selectedValue === 'manual' ? 'Manuelle' : 'Automatique'}
        </Text>
      </View>
    </View>
  );
}

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
  const [externalParticipantValidationMode, setExternalParticipantValidationMode] = useState(
    state.externalParticipantValidationMode || 'manual',
  );
  const validationOptions = useMemo(() => buildValidationOptions(t), [t]);
  const isTraining = isTrainingEventType(state.type?.name);
  const isOpenTraining = isTraining && state.sessionStatus !== 'closed';

  const selectedAccentBg = `${Colors.primary500}2A`;
  const selectedCardBg = `${Colors.primary500}17`;
  const unselectedCardBg = `${Colors.primary700}D0`;
  const recommendedChipBg = `${Colors.primary500}21`;
  const recommendedChipBorder = `${Colors.primary500}55`;
  const helperCardBg = `${Colors.primary500}0F`;
  const helperCardBorder = `${Colors.primary500}3A`;

  const handleNext = () => {
    dispatch({
      payload: {
        externalParticipantValidationMode: isOpenTraining
          ? externalParticipantValidationMode
          : (state.externalParticipantValidationMode || externalParticipantValidationMode),
        validationMode,
      },
      type: 'SET_VALIDATION_MODE',
    });
    navigation.navigate(RouteNames.EventWizardDescription);
  };

  return (
    <WizardStepLayout
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      stepCount={getEventWizardStepCount(state)}
      stepIndex={getEventWizardValidationStepIndex(state)}
      subtitle={t(
        isOpenTraining
          ? 'eventWizard.steps.validation.trainingSubtitle'
          : 'eventWizard.steps.validation.subtitle',
        isOpenTraining
          ? 'Definis la validation des membres internes puis celle des joueurs externes.'
          : "Definis comment valider les presences a l'evenement.",
      )}
      title={t('eventWizard.steps.validation.title', 'Mode de validation')}
    >
      <View style={[Spaces.marginTop[8], Spaces.gap[16]]}>
        <ValidationChoiceGroup
          Alignments={Alignments}
          ApplicationStyle={ApplicationStyle}
          Colors={Colors}
          Fonts={Fonts}
          helperBorderColor={helperCardBorder}
          helperCardBg={helperCardBg}
          options={validationOptions}
          recommendedChipBg={recommendedChipBg}
          recommendedChipBorder={recommendedChipBorder}
          selectedAccentBg={selectedAccentBg}
          selectedCardBg={selectedCardBg}
          selectedValue={validationMode}
          setSelectedValue={setValidationMode}
          Spaces={Spaces}
          title={t(
            isTraining
              ? 'eventWizard.steps.validation.internalTitle'
              : 'eventWizard.steps.validation.defaultTitle',
            isTraining ? 'Validation des membres internes' : 'Validation principale',
          )}
          unselectedCardBg={unselectedCardBg}
        />

        {isOpenTraining ? (
          <ValidationChoiceGroup
            Alignments={Alignments}
            ApplicationStyle={ApplicationStyle}
            Colors={Colors}
            Fonts={Fonts}
            helperBorderColor={helperCardBorder}
            helperCardBg={helperCardBg}
            options={validationOptions}
            recommendedChipBg={recommendedChipBg}
            recommendedChipBorder={recommendedChipBorder}
            selectedAccentBg={selectedAccentBg}
            selectedCardBg={selectedCardBg}
            selectedValue={externalParticipantValidationMode}
            setSelectedValue={setExternalParticipantValidationMode}
            Spaces={Spaces}
            title={t(
              'eventWizard.steps.validation.externalTitle',
              'Validation des joueurs externes',
            )}
            unselectedCardBg={unselectedCardBg}
          />
        ) : null}
      </View>
    </WizardStepLayout>
  );
}

export default EventWizardValidationMode;
