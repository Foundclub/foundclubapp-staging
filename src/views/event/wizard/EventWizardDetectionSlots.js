/* eslint-disable perfectionist/sort-imports */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { getPositionValuesForSport } from '@/constants/positions';
import { getEventWizardSportName, getEventWizardStepCount } from './eventWizardDetectionUtils';
// eslint-disable-next-line perfectionist/sort-imports
import { useEventWizard } from './EventWizardContext';

const MAX_SLOT_QUANTITY = 10;

const normalizeSlots = (slots = []) => (
  Array.isArray(slots)
    ? slots
      .filter((slot) => slot?.position && Number(slot?.quantity) > 0)
      .map((slot) => ({
        position: String(slot.position),
        quantity: Math.max(1, Math.min(MAX_SLOT_QUANTITY, Number(slot.quantity) || 1)),
      }))
    : []
);

/**
 *
 * @param root0
 * @param root0.navigation
 */
function EventWizardDetectionSlots({ navigation }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { dispatch, state } = useEventWizard();

  const initialSlots = useMemo(() => normalizeSlots(state.detectionSlots), [state.detectionSlots]);
  const [isEnabled, setIsEnabled] = useState(initialSlots.length > 0);
  const [slots, setSlots] = useState(initialSlots);

  const sportName = getEventWizardSportName(state);
  const positions = useMemo(() => getPositionValuesForSport(sportName), [sportName]);

  const getQuantityForPosition = (position) => {
    const slot = slots.find((item) => item.position === position);
    return slot ? slot.quantity : 0;
  };

  const isSelected = (position) => slots.some((item) => item.position === position);

  const handleTogglePosition = (position) => {
    setSlots((current) => {
      const exists = current.some((item) => item.position === position);
      if (exists) {
        return current.filter((item) => item.position !== position);
      }
      return [...current, { position, quantity: 1 }];
    });
  };

  const handleQuantityChange = (position, delta) => {
    setSlots((current) => current.map((item) => {
      if (item.position !== position) return item;
      const nextQuantity = Math.max(1, Math.min(MAX_SLOT_QUANTITY, item.quantity + delta));
      return {
        ...item,
        quantity: nextQuantity,
      };
    }));
  };

  const totalSlots = useMemo(
    () => slots.reduce((sum, slot) => sum + Number(slot.quantity || 0), 0),
    [slots],
  );

  const canProceed = !isEnabled || slots.length > 0;

  const handleNext = () => {
    dispatch({
      payload: isEnabled ? normalizeSlots(slots) : [],
      type: 'SET_DETECTION_SLOTS',
    });
    navigation.navigate(RouteNames.EventWizardValidationMode);
  };

  return (
    <WizardStepLayout
      isNextDisabled={!canProceed}
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      stepCount={getEventWizardStepCount(state)}
      stepIndex={8}
      subtitle={t(
        'eventWizard.steps.detectionSlots.subtitle',
        'Ajoutez en option des postes recherches et un nombre de places par poste.',
      )}
      title={t('eventWizard.steps.detectionSlots.title', 'Postes recherches')}
    >
      <View style={[Spaces.gap[16]]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            const nextEnabled = !isEnabled;
            setIsEnabled(nextEnabled);
            if (!nextEnabled) {
              setSlots([]);
            }
          }}
          style={[
            ApplicationStyle.card,
            Spaces.padding[16],
            Spaces.gap[8],
            {
              backgroundColor: isEnabled ? 'rgba(1, 179, 244, 0.12)' : 'rgba(4, 31, 44, 0.82)',
              borderColor: isEnabled ? Colors.primary500 : 'rgba(1, 179, 244, 0.24)',
              borderWidth: 1,
            },
          ]}
        >
          <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
            <View style={{ flex: 1 }}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {t('eventWizard.steps.detectionSlots.toggleTitle', 'Ajouter des places par poste')}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200, Spaces.marginTop[4]]}>
                {t(
                  'eventWizard.steps.detectionSlots.toggleHint',
                  'Optionnel: les joueurs candidateront ensuite sur un poste precis.',
                )}
              </Text>
            </View>
            <View
              style={[
                ApplicationStyle.card,
                Alignments.alignCenter,
                Alignments.justifyCenter,
                {
                  backgroundColor: isEnabled ? Colors.primary500 : 'transparent',
                  borderColor: Colors.primary500,
                  borderRadius: 999,
                  borderWidth: 1,
                  height: 24,
                  width: 24,
                },
              ]}
            >
              <Text style={[Fonts.p3Bold, isEnabled ? Fonts.neutral900 : Fonts.primary500]}>
                {isEnabled ? 'OK' : ''}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {isEnabled ? (
          <View style={[Spaces.gap[16]]}>
            {totalSlots > 0 ? (
              <View
                style={[
                  Spaces.padding[16],
                  {
                    alignItems: 'center',
                    backgroundColor: Colors.primary500,
                    borderRadius: 16,
                    flexDirection: 'row',
                    justifyContent: 'center',
                  },
                ]}
              >
                <Text style={[Fonts.h3Bold, { color: Colors.neutral00 }]}>{totalSlots}</Text>
                <Text style={[Fonts.p1, { color: Colors.neutral00, marginLeft: 8 }]}>
                  {t('eventWizard.steps.detectionSlots.totalSummary', 'place(s) recherchee(s)')}
                </Text>
              </View>
            ) : null}

            <View>
              <Text style={[Fonts.p2, Fonts.neutral200]}>
                {t('eventWizard.steps.detectionSlots.sportLabel', 'Sport')}
                {': '}
                <Text style={{ color: Colors.primary500 }}>{sportName || '-'}</Text>
              </Text>
            </View>

            <View style={[Spaces.gap[8]]}>
              {positions.map((position) => {
                const selected = isSelected(position);
                const quantity = getQuantityForPosition(position);

                return (
                  <TouchableOpacity
                    activeOpacity={0.75}
                    key={position}
                    onPress={() => handleTogglePosition(position)}
                    style={[
                      ApplicationStyle.card,
                      Alignments.row,
                      Alignments.alignCenter,
                      Alignments.justifySpaceBetween,
                      Spaces.padding[16],
                      {
                        backgroundColor: selected ? 'rgba(1, 179, 244, 0.10)' : Colors.neutral800,
                        borderColor: selected ? Colors.primary500 : Colors.neutral700,
                        borderWidth: selected ? 2 : 1,
                      },
                    ]}
                  >
                    <View style={[Alignments.row, Alignments.alignCenter, { flex: 1 }]}>
                      <View
                        style={[
                          Alignments.alignCenter,
                          Alignments.justifyCenter,
                          {
                            backgroundColor: selected ? Colors.primary500 : 'transparent',
                            borderColor: selected ? Colors.primary500 : Colors.neutral500,
                            borderRadius: 8,
                            borderWidth: 2,
                            height: 24,
                            width: 24,
                          },
                        ]}
                      >
                        {selected ? <Text style={{ color: Colors.neutral00, fontWeight: '700' }}>OK</Text> : null}
                      </View>
                      <Text
                        style={[
                          Fonts.p1Bold,
                          {
                            color: selected ? Colors.neutral00 : Colors.neutral200,
                            marginLeft: 12,
                          },
                        ]}
                      >
                        {position}
                      </Text>
                    </View>

                    {selected ? (
                      <View style={[Alignments.row, Alignments.alignCenter]}>
                        <TouchableOpacity
                          disabled={quantity <= 1}
                          onPress={(event) => {
                            event.stopPropagation();
                            handleQuantityChange(position, -1);
                          }}
                          style={[
                            Alignments.alignCenter,
                            Alignments.justifyCenter,
                            {
                              backgroundColor: quantity <= 1 ? `${Colors.neutral700}50` : Colors.neutral700,
                              borderRadius: 12,
                              height: 36,
                              width: 36,
                            },
                          ]}
                        >
                          <Text style={[Fonts.h4, { color: quantity <= 1 ? Colors.neutral500 : Colors.neutral00 }]}>-</Text>
                        </TouchableOpacity>
                        <View style={[Alignments.alignCenter, Alignments.justifyCenter, { minWidth: 42 }]}>
                          <Text style={[Fonts.h3Bold, { color: Colors.primary500 }]}>{quantity}</Text>
                        </View>
                        <TouchableOpacity
                          disabled={quantity >= MAX_SLOT_QUANTITY}
                          onPress={(event) => {
                            event.stopPropagation();
                            handleQuantityChange(position, 1);
                          }}
                          style={[
                            Alignments.alignCenter,
                            Alignments.justifyCenter,
                            {
                              backgroundColor: quantity >= MAX_SLOT_QUANTITY ? `${Colors.neutral700}50` : Colors.primary500,
                              borderRadius: 12,
                              height: 36,
                              width: 36,
                            },
                          ]}
                        >
                          <Text style={[Fonts.h4, { color: quantity >= MAX_SLOT_QUANTITY ? Colors.neutral500 : Colors.neutral00 }]}>+</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}
      </View>
    </WizardStepLayout>
  );
}

export default EventWizardDetectionSlots;
