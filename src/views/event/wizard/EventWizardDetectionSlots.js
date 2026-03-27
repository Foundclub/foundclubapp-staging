/* eslint-disable perfectionist/sort-imports */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Switch,
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
  const hasFixedCapacity = Number(state.capacity) > 0;
  const capacityLimit = hasFixedCapacity ? Number(state.capacity) : null;

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
  const selectedPositionsCount = slots.length;
  const exceedsCapacity = capacityLimit !== null && totalSlots > capacityLimit;
  const bulkQuantity = useMemo(() => {
    if (slots.length === 0 || slots.length !== positions.length) {
      return 0;
    }

    const firstQuantity = Number(slots[0]?.quantity || 0);
    const sameQuantity = slots.every((slot) => Number(slot?.quantity || 0) === firstQuantity);
    return sameQuantity ? firstQuantity : 0;
  }, [positions.length, slots]);

  const canProceed = (!isEnabled || slots.length > 0) && !exceedsCapacity;
  const surfaceStyle = {
    backgroundColor: 'rgba(4, 31, 44, 0.82)',
    borderColor: 'rgba(1, 179, 244, 0.24)',
    borderWidth: 1,
  };

  const handleBulkQuantityChange = (delta) => {
    const nextQuantity = Math.max(0, Math.min(MAX_SLOT_QUANTITY, bulkQuantity + delta));

    if (nextQuantity === 0) {
      setSlots([]);
      return;
    }

    setSlots(positions.map((position) => ({
      position,
      quantity: nextQuantity,
    })));
  };

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
      <View style={[Spaces.gap[16], Spaces.paddingBottom[40]]}>
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
            surfaceStyle,
            isEnabled ? { backgroundColor: 'rgba(1, 179, 244, 0.12)', borderColor: Colors.primary500 } : null,
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
            <Switch
              onValueChange={(nextEnabled) => {
                setIsEnabled(nextEnabled);
                if (!nextEnabled) {
                  setSlots([]);
                }
              }}
              thumbColor={isEnabled ? Colors.neutral00 : Colors.neutral300}
              trackColor={{
                false: 'rgba(255,255,255,0.16)',
                true: Colors.primary500,
              }}
              value={isEnabled}
            />
          </View>
        </TouchableOpacity>

        {isEnabled ? (
          <View style={[Spaces.gap[16]]}>
            <View
              style={[
                ApplicationStyle.card,
                Spaces.padding[16],
                Spaces.gap[14],
                surfaceStyle,
                {
                  backgroundColor: 'rgba(1, 179, 244, 0.08)',
                },
              ]}
            >
              <View style={[Spaces.gap[6]]}>
                <View style={{ flex: 1, minWidth: 160 }}>
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                    {selectedPositionsCount > 0
                      ? t('eventWizard.steps.detectionSlots.summaryFilledTitle', '{{count}} poste(s) configuré(s)', { count: selectedPositionsCount })
                      : t('eventWizard.steps.detectionSlots.summaryEmptyTitle', 'Aucun poste sélectionné')}
                  </Text>
                  <Text style={[Fonts.p4, Fonts.neutral200, Spaces.marginTop[6]]}>
                    {selectedPositionsCount > 0
                      ? t('eventWizard.steps.detectionSlots.summaryFilledHint', '{{count}} place(s) demandée(s) sur cette détection.', { count: totalSlots })
                      : t('eventWizard.steps.detectionSlots.summaryEmptyHint', 'Active des postes ci-dessous ou applique un volume à tous les postes.')}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  Alignments.row,
                  Alignments.alignCenter,
                  {
                    columnGap: 8,
                    flexWrap: 'wrap',
                    rowGap: 8,
                  },
                ]}
              >
                <View
                  style={[
                    Spaces.paddingHorizontal[12],
                    Spaces.paddingVertical[8],
                    {
                      backgroundColor: `${Colors.primary500}18`,
                      borderColor: `${Colors.primary500}40`,
                      borderRadius: 999,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Text style={[Fonts.p3Bold, Fonts.primary500]}>{sportName || '-'}</Text>
                </View>
              </View>

              {selectedPositionsCount > 0 ? (
                <View
                  style={[
                    Alignments.row,
                    { columnGap: 8, flexWrap: 'wrap', rowGap: 8 },
                  ]}
                >
                  <View
                    style={[
                      Spaces.paddingHorizontal[12],
                      Spaces.paddingVertical[8],
                      {
                        backgroundColor: `${Colors.primary500}18`,
                        borderColor: `${Colors.primary500}55`,
                        borderRadius: 999,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                      {t('eventWizard.steps.detectionSlots.summaryPositions', '{{count}} poste(s)', { count: selectedPositionsCount })}
                    </Text>
                  </View>
                  <View
                    style={[
                      Spaces.paddingHorizontal[12],
                      Spaces.paddingVertical[8],
                      {
                        backgroundColor: `${Colors.primary500}12`,
                        borderColor: `${Colors.primary500}40`,
                        borderRadius: 999,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                      {t('eventWizard.steps.detectionSlots.summaryTotal', '{{count}} place(s)', { count: totalSlots })}
                    </Text>
                  </View>
                  {capacityLimit !== null ? (
                    <View
                      style={[
                        Spaces.paddingHorizontal[12],
                        Spaces.paddingVertical[8],
                        {
                          backgroundColor: 'rgba(255,255,255,0.04)',
                          borderColor: `${Colors.neutral300}33`,
                          borderRadius: 999,
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <Text style={[Fonts.p4, Fonts.neutral200]}>
                        {t('eventWizard.steps.detectionSlots.summaryCapacity', 'Capacite {{count}}', { count: capacityLimit })}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>

            {exceedsCapacity ? (
              <View
                style={[
                  ApplicationStyle.card,
                  Spaces.padding[14],
                  {
                    backgroundColor: `${Colors.warning500}14`,
                    borderColor: `${Colors.warning500}55`,
                    borderWidth: 1,
                  },
                ]}
              >
                <Text style={[Fonts.p3Bold, { color: Colors.warning500 }]}>
                  {t(
                    'eventWizard.steps.detectionSlots.capacityWarning',
                    'Le total des places par poste depasse la capacite de l evenement.',
                  )}
                </Text>
                <Text style={[Fonts.p4, Fonts.neutral200, Spaces.marginTop[4]]}>
                  {t(
                    'eventWizard.steps.detectionSlots.capacityWarningHint',
                    'Augmente la capacite ou reduis les quantites pour garder une detection coherente.',
                  )}
                </Text>
              </View>
            ) : null}

            {positions.length > 0 ? (
              <View
                style={[
                  ApplicationStyle.card,
                  Spaces.padding[16],
                  Spaces.gap[12],
                  surfaceStyle,
                ]}
              >
                <View style={[Spaces.gap[6]]}>
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                    {t('eventWizard.steps.detectionSlots.quickActionsTitle', 'Appliquer à tous les postes')}
                  </Text>
                  <Text style={[Fonts.p4, Fonts.neutral200]}>
                    {t('eventWizard.steps.detectionSlots.quickActionsHint', 'Le compteur met à jour toute la liste instantanément. 0 réinitialise la sélection globale.')}
                  </Text>
                </View>

                <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifyCenter, { columnGap: 12, flexWrap: 'wrap', rowGap: 10 }]}>
                  <View
                    style={[
                      Alignments.row,
                      Alignments.alignCenter,
                      Alignments.justifyCenter,
                      Spaces.paddingHorizontal[10],
                      Spaces.paddingVertical[10],
                      {
                        backgroundColor: 'rgba(1, 179, 244, 0.08)',
                        borderColor: 'rgba(1, 179, 244, 0.18)',
                        borderRadius: 16,
                        borderWidth: 1,
                        columnGap: 10,
                        minWidth: 228,
                      },
                    ]}
                  >
                    <TouchableOpacity
                      activeOpacity={0.8}
                      disabled={bulkQuantity <= 0}
                      onPress={() => handleBulkQuantityChange(-1)}
                      style={[
                        Alignments.alignCenter,
                        Alignments.justifyCenter,
                        {
                          backgroundColor: bulkQuantity <= 0 ? 'rgba(1, 179, 244, 0.08)' : 'rgba(1, 179, 244, 0.14)',
                          borderColor: `${Colors.primary500}40`,
                          borderRadius: 12,
                          borderWidth: 1,
                          height: 40,
                          opacity: bulkQuantity <= 0 ? 0.5 : 1,
                          width: 40,
                        },
                      ]}
                    >
                      <Text style={[Fonts.h4, Fonts.primary500]}>-</Text>
                    </TouchableOpacity>

                    <View
                      style={[
                        Alignments.alignCenter,
                        Alignments.justifyCenter,
                        {
                          minWidth: 88,
                        },
                      ]}
                    >
                      <Text style={[Fonts.h2, Fonts.primary500, { textAlign: 'center' }]}>
                        {bulkQuantity}
                      </Text>
                      <Text style={[Fonts.p4, Fonts.neutral200, { textAlign: 'center' }]}>
                        {t('eventWizard.steps.detectionSlots.bulkQuantityLabel', 'places par poste')}
                      </Text>
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      disabled={bulkQuantity >= MAX_SLOT_QUANTITY}
                      onPress={() => handleBulkQuantityChange(1)}
                      style={[
                        Alignments.alignCenter,
                        Alignments.justifyCenter,
                        {
                          backgroundColor: bulkQuantity >= MAX_SLOT_QUANTITY ? 'rgba(1, 179, 244, 0.08)' : Colors.primary500,
                          borderColor: Colors.primary500,
                          borderRadius: 12,
                          borderWidth: 1,
                          height: 40,
                          opacity: bulkQuantity >= MAX_SLOT_QUANTITY ? 0.5 : 1,
                          width: 40,
                        },
                      ]}
                    >
                      <Text style={[Fonts.h4, bulkQuantity >= MAX_SLOT_QUANTITY ? Fonts.neutral500 : Fonts.neutral00]}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : null}

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
                      surfaceStyle,
                      selected
                        ? {
                          backgroundColor: 'rgba(1, 179, 244, 0.16)',
                          borderColor: Colors.primary500,
                          borderWidth: 2,
                        }
                        : {
                          backgroundColor: 'rgba(1, 179, 244, 0.05)',
                          borderColor: 'rgba(1, 179, 244, 0.18)',
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
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text
                          style={[
                            Fonts.p1Bold,
                            {
                              color: selected ? Colors.neutral00 : Colors.neutral200,
                            },
                          ]}
                        >
                          {position}
                        </Text>
                        <Text style={[Fonts.p4, Fonts.neutral200, Spaces.marginTop[4]]}>
                          {selected
                            ? t('eventWizard.steps.detectionSlots.positionSummary', '{{count}} place(s) sur ce poste', { count: quantity })
                            : t('eventWizard.steps.detectionSlots.positionHint', 'Touchez pour activer ce poste')}
                        </Text>
                      </View>
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
                              backgroundColor: quantity <= 1 ? 'rgba(1, 179, 244, 0.08)' : 'rgba(1, 179, 244, 0.12)',
                              borderColor: 'rgba(1, 179, 244, 0.18)',
                              borderRadius: 12,
                              borderWidth: 1,
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
                              backgroundColor: quantity >= MAX_SLOT_QUANTITY ? 'rgba(1, 179, 244, 0.08)' : Colors.primary500,
                              borderColor: quantity >= MAX_SLOT_QUANTITY ? 'rgba(1, 179, 244, 0.18)' : Colors.primary500,
                              borderRadius: 12,
                              borderWidth: 1,
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
