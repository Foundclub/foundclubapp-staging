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
import PositionSelectionList from '@/components/organisms/positionSelectionList/PositionSelectionList';

import { RouteNames } from '@/navigation/routeNames';

import { getPositionValuesForSport } from '@/constants/positions';
import {
  getEventWizardDetectionSlotsStepIndex,
  getEventWizardNextRoute,
  getEventWizardSportName,
  getEventWizardStepCount,
} from './eventWizardDetectionUtils';
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
 * @param {{ navigation: any }} props
 * @returns {import('react').ReactElement}
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
      if (item.position !== position) {
        return item;
      }

      return {
        ...item,
        quantity: Math.max(1, Math.min(MAX_SLOT_QUANTITY, item.quantity + delta)),
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
  const stackStyle = { paddingBottom: 40, rowGap: 24 };
  const cardInsetStyle = { padding: 24, rowGap: 16 };
  const compactCardInsetStyle = { padding: 20, rowGap: 12 };
  const bodyCopyStyle = { lineHeight: 20 };
  const helperCopyStyle = { lineHeight: 18 };
  const chipStyle = {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  };

  const selectedQuantityLabel = (quantity) => t(
    'eventWizard.steps.detectionSlots.positionSummary',
    '{{count}} place(s) sur ce poste',
    { count: quantity },
  );

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
    navigation.navigate(getEventWizardNextRoute(RouteNames.EventWizardDetectionSlots, state));
  };

  return (
    <WizardStepLayout
      isNextDisabled={!canProceed}
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      stepCount={getEventWizardStepCount(state)}
      stepIndex={getEventWizardDetectionSlotsStepIndex(state)}
      subtitle={t(
        'eventWizard.steps.detectionSlots.subtitle',
        'Ajoute en option des postes recherchés et un nombre de places par poste.',
      )}
      title={t('eventWizard.steps.detectionSlots.title', 'Postes recherchés')}
    >
      <View style={stackStyle}>
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
            surfaceStyle,
            cardInsetStyle,
            isEnabled ? { backgroundColor: 'rgba(1, 179, 244, 0.12)', borderColor: Colors.primary500 } : null,
          ]}
        >
          <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
            <View style={{ flex: 1 }}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {t('eventWizard.steps.detectionSlots.toggleTitle', 'Ajouter des places par poste')}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200, Spaces.marginTop[8], bodyCopyStyle]}>
                {t(
                  'eventWizard.steps.detectionSlots.toggleHint',
                  'Optionnel : les joueurs candidateront ensuite sur un poste précis.',
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
          <View style={{ rowGap: 24 }}>
            <View
              style={[
                ApplicationStyle.card,
                surfaceStyle,
                cardInsetStyle,
                {
                  backgroundColor: 'rgba(1, 179, 244, 0.08)',
                },
              ]}
            >
              <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
                <View style={{ flex: 1, minWidth: 180, rowGap: 12 }}>
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                    {selectedPositionsCount > 0
                      ? t('eventWizard.steps.detectionSlots.summaryFilledTitle', '{{count}} poste(s) configuré(s)', { count: selectedPositionsCount })
                      : t('eventWizard.steps.detectionSlots.summaryEmptyTitle', 'Aucun poste sélectionné')}
                  </Text>
                  <Text style={[Fonts.p4, Fonts.neutral200, helperCopyStyle]}>
                    {selectedPositionsCount > 0
                      ? t('eventWizard.steps.detectionSlots.summaryFilledHint', '{{count}} place(s) demandée(s) sur cette détection.', { count: totalSlots })
                      : t('eventWizard.steps.detectionSlots.summaryEmptyHint', 'Active des postes ci-dessous ou applique un volume à tous les postes.')}
                  </Text>
                </View>

                <View
                  style={[
                    chipStyle,
                    {
                      backgroundColor: `${Colors.primary500}18`,
                      borderColor: `${Colors.primary500}40`,
                    },
                  ]}
                >
                  <Text style={[Fonts.p3Bold, Fonts.primary500]}>{sportName || '-'}</Text>
                </View>
              </View>

              <View style={[Alignments.row, Alignments.wrap, Spaces.gap[12]]}>
                <View
                  style={[
                    chipStyle,
                    {
                      backgroundColor: `${Colors.primary500}18`,
                      borderColor: `${Colors.primary500}55`,
                    },
                  ]}
                >
                  <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                    {t('eventWizard.steps.detectionSlots.summaryPositions', '{{count}} poste(s)', { count: selectedPositionsCount })}
                  </Text>
                </View>

                <View
                  style={[
                    chipStyle,
                    {
                      backgroundColor: `${Colors.primary500}12`,
                      borderColor: `${Colors.primary500}40`,
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
                      chipStyle,
                      {
                        backgroundColor: 'rgba(255,255,255,0.04)',
                        borderColor: `${Colors.neutral300}33`,
                      },
                    ]}
                  >
                    <Text style={[Fonts.p4, Fonts.neutral200]}>
                      {t('eventWizard.steps.detectionSlots.summaryCapacity', 'Capacité {{count}}', { count: capacityLimit })}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {exceedsCapacity ? (
              <View
                style={[
                  ApplicationStyle.card,
                  compactCardInsetStyle,
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
                    'Le total des places par poste dépasse la capacité de l événement.',
                  )}
                </Text>
                <Text style={[Fonts.p4, Fonts.neutral200, { lineHeight: 18, marginTop: 8 }]}>
                  {t(
                    'eventWizard.steps.detectionSlots.capacityWarningHint',
                    'Augmente la capacité ou reduis les quantités pour garder une détection coherente.',
                  )}
                </Text>
              </View>
            ) : null}

            {positions.length > 0 ? (
              <View
                style={[
                  ApplicationStyle.card,
                  surfaceStyle,
                  cardInsetStyle,
                ]}
              >
                <View style={{ rowGap: 8 }}>
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                    {t('eventWizard.steps.detectionSlots.quickActionsTitle', 'Appliquer à tous les postes')}
                  </Text>
                  <Text style={[Fonts.p4, Fonts.neutral200, helperCopyStyle]}>
                    {t(
                      'eventWizard.steps.detectionSlots.quickActionsHint',
                      'Le compteur met à jour toute la liste instantanement. 0 réinitialise la sélection globale.',
                    )}
                  </Text>
                </View>

                <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifyCenter, { columnGap: 12, flexWrap: 'wrap', rowGap: 12 }]}>
                  <View
                    style={[
                      Alignments.row,
                      Alignments.alignCenter,
                      Alignments.justifyCenter,
                      {
                        backgroundColor: 'rgba(1, 179, 244, 0.08)',
                        borderColor: 'rgba(1, 179, 244, 0.18)',
                        borderRadius: 16,
                        borderWidth: 1,
                        columnGap: 12,
                        minWidth: 236,
                        paddingHorizontal: 12,
                        paddingVertical: 12,
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
                      <Text style={[Fonts.p4, Fonts.neutral200, { lineHeight: 18, textAlign: 'center' }]}>
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

            {positions.length > 0 ? (
              <View style={{ marginTop: 4 }}>
                <PositionSelectionList
                  getQuantity={getQuantityForPosition}
                  isSelected={isSelected}
                  onQuantityChange={handleQuantityChange}
                  onToggle={handleTogglePosition}
                  positions={positions}
                  selectedQuantityLabel={selectedQuantityLabel}
                  selectedSectionTitle={t('eventWizard.steps.detectionSlots.selectedSectionTitle', 'Postes actifs')}
                  sportName={sportName}
                  unselectedActionLabel={t('eventWizard.steps.detectionSlots.unselectedActionLabel', 'Activer')}
                />
              </View>
            ) : (
              <View style={[ApplicationStyle.card, surfaceStyle, compactCardInsetStyle]}>
                <Text style={[Fonts.p1, Fonts.neutral100, { textAlign: 'center' }]}>
                  {t('eventWizard.steps.detectionSlots.emptyPositions', 'Aucun poste n est actuellement défini pour ce sport.')}
                </Text>
              </View>
            )}
          </View>
        ) : null}
      </View>
    </WizardStepLayout>
  );
}

export default EventWizardDetectionSlots;
