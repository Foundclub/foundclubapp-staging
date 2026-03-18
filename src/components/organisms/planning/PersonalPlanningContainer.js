import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';

import Loader from '@/components/atoms/loader/Loader';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import PlanningCalendarView from '@/components/organisms/planningCalendarView';
import PlanningWeekTimelineView from '@/components/organisms/planningWeekTimelineView';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { getMyPlanning } from '@/services/event/eventService';

import {
  getPlanningRange,
  normalizePlanningItems,
} from '@/utils/planning/planningSlots';

/**
 * Small action button used to open the planning in fullscreen.
 * @param {{ borderColor: string, onPress: () => void }} props
 * @returns {import('react').ReactElement}
 */
function PlanningFullscreenButton({ borderColor, onPress }) {
  const cornerStyle = {
    borderColor,
    height: 7,
    position: 'absolute',
    width: 7,
  };

  return (
    <TouchableOpacity
      accessibilityLabel="Ouvrir le planning en plein ecran"
      accessibilityRole="button"
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderColor,
        borderRadius: 14,
        borderWidth: 1,
        height: 42,
        justifyContent: 'center',
        width: 42,
      }}
    >
      <View style={{ height: 18, position: 'relative', width: 18 }}>
        <View
          style={[cornerStyle, {
            borderLeftWidth: 2,
            borderTopWidth: 2,
            left: 0,
            top: 0,
          }]}
        />
        <View
          style={[cornerStyle, {
            borderRightWidth: 2,
            borderTopWidth: 2,
            right: 0,
            top: 0,
          }]}
        />
        <View
          style={[cornerStyle, {
            borderBottomWidth: 2,
            borderLeftWidth: 2,
            bottom: 0,
            left: 0,
          }]}
        />
        <View
          style={[cornerStyle, {
            borderBottomWidth: 2,
            borderRightWidth: 2,
            bottom: 0,
            right: 0,
          }]}
        />
      </View>
    </TouchableOpacity>
  );
}

/**
 * Personal planning content.
 * @param {{ onSummaryPress?: () => void }} props
 * @returns {import('react').ReactElement}
 */
function PersonalPlanningContainer({ onSummaryPress }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isFullscreenVisible, setIsFullscreenVisible] = useState(false);
  const [viewMode, setViewMode] = useState('3days');

  const planningRange = useMemo(
    () => getPlanningRange(currentDate, viewMode),
    [currentDate, viewMode],
  );

  const { data: eventsData, isLoading } = useQuery({
    queryFn: () => getMyPlanning(planningRange),
    queryKey: ['planning', 'personal', planningRange.from, planningRange.to],
  });

  const handleEventPress = useCallback((event, { closeFullscreen = false } = {}) => {
    if (!event?.documentId) return;
    if (closeFullscreen) {
      setIsFullscreenVisible(false);
    }

    navigation.navigate('EventStack', {
      params: { eventId: event.documentId },
      screen: 'EventDetails',
    });
  }, [navigation]);

  const viewOptions = useMemo(() => ([
    { label: 'Semaine', value: 'week' },
    { label: '3 Jours', value: '3days' },
    { label: 'Mois', value: 'month' },
  ]), []);

  const modeDescription = useMemo(() => {
    if (viewMode === 'month') {
      return t('planning.mode.monthDescription', 'Vue globale du mois');
    }

    if (viewMode === 'week') {
      return t('planning.mode.weekDescription', 'Vue détaillée de la semaine');
    }

    return t('planning.mode.threeDaysDescription', 'Vue condensée sur 3 jours');
  }, [t, viewMode]);

  if (isLoading) {
    return <Loader />;
  }

  const events = normalizePlanningItems(eventsData?.data || []);

  const renderPlanningViewport = (isFullscreen = false) => {
    const planningView = viewMode === 'month' ? (
      <PlanningCalendarView
        currentDate={currentDate}
        events={events}
        onDateSelect={setCurrentDate}
        onEventPress={(event) => handleEventPress(event, { closeFullscreen: isFullscreen })}
      />
    ) : (
      <PlanningWeekTimelineView
        currentDate={currentDate}
        events={events}
        mode={viewMode}
        onDateChange={setCurrentDate}
        onEventPress={(event) => handleEventPress(event, { closeFullscreen: isFullscreen })}
        onSummaryPress={isFullscreen ? undefined : onSummaryPress}
        scrollEnabled={isFullscreen}
      />
    );

    return (
      <View style={isFullscreen ? { flex: 1, width: '100%' } : { width: '100%' }}>
        <View style={[Alignments.alignCenter, Spaces.marginBottom[16], { width: '100%' }]}>
          <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12], { width: '100%' }]}>
            <View style={{ flex: 1 }}>
              <SegmentedControl
                centerContent
                onChange={setViewMode}
                options={viewOptions}
                value={viewMode}
              />
            </View>
            {!isFullscreen ? (
              <PlanningFullscreenButton
                borderColor={`${Colors.primary500}66`}
                onPress={() => setIsFullscreenVisible(true)}
              />
            ) : null}
          </View>
          <Text style={[Fonts.p3, Fonts.primary100, Fonts.textCenter, Spaces.marginTop[8]]}>
            {modeDescription}
          </Text>
        </View>

        <View style={isFullscreen ? { flex: 1, minHeight: 0 } : { width: '100%' }}>
          {planningView}
        </View>
      </View>
    );
  };

  return (
    <>
      {renderPlanningViewport(false)}

      <Modal
        animationType="slide"
        onRequestClose={() => setIsFullscreenVisible(false)}
        presentationStyle="fullScreen"
        visible={isFullscreenVisible}
      >
        <ScreenContainer
          bgImage="bg2"
          contentContainerStyle={[{ paddingBottom: Math.max(insets.bottom, 16) }]}
          withHeaderPadding={false}
        >
          <View style={{ flex: 1, paddingTop: Math.max(insets.top + 8, 16) }}>
            <View
              style={[
                Alignments.row,
                Alignments.alignCenter,
                Alignments.justifySpaceBetween,
                Spaces.marginBottom[16],
              ]}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[Fonts.h2, Fonts.neutral00]}>Mon planning</Text>
                <Text style={[Fonts.p3, Fonts.primary100, Spaces.marginTop[4]]}>
                  {t(
                    'planning.fullscreen.subtitle',
                    'Mode plein ecran pour mieux naviguer dans le calendrier.',
                  )}
                </Text>
              </View>
              <TouchableOpacity
                accessibilityLabel="Fermer le planning plein ecran"
                accessibilityRole="button"
                onPress={() => setIsFullscreenVisible(false)}
                style={{
                  alignItems: 'center',
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderColor: `${Colors.primary500}66`,
                  borderRadius: 16,
                  borderWidth: 1,
                  height: 44,
                  justifyContent: 'center',
                  width: 44,
                }}
              >
                <Image
                  source={Images.close}
                  style={{ height: 18, tintColor: Colors.neutral00, width: 18 }}
                />
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1 }}>
              {renderPlanningViewport(true)}
            </View>
          </View>
        </ScreenContainer>
      </Modal>
    </>
  );
}

export default PersonalPlanningContainer;
