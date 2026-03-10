import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView, Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

const REQUIRED_PLAYERS = 5;

const dayMap = {
  friday: 'Vendredi',
  monday: 'Lundi',
  saturday: 'Samedi',
  sunday: 'Dimanche',
  thursday: 'Jeudi',
  tuesday: 'Mardi',
  wednesday: 'Mercredi',
};

const formatHour = (timeValue) => {
  if (!timeValue || typeof timeValue !== 'string') return '--';
  const [rawHour = '00', rawMinute = '00'] = timeValue.split(':');
  const hour = Number.parseInt(rawHour, 10);
  const minute = String(rawMinute).padStart(2, '0');
  if (!Number.isFinite(hour)) return '--';
  return `${hour}h${minute}`;
};

const getStatus = (count, t) => {
  if (count >= REQUIRED_PLAYERS) {
    return { label: t('teamSlotList.status.complete', 'Complet'), tone: 'ready' };
  }
  if (count >= REQUIRED_PLAYERS - 2) {
    return {
      label: t('teamSlotList.status.remaining', `Encore ${REQUIRED_PLAYERS - count}`, {
        count: REQUIRED_PLAYERS - count,
      }),
      tone: 'warning',
    };
  }
  return {
    label: t('teamSlotList.status.confirmed', `${count}/${REQUIRED_PLAYERS} confirmés`, {
      count,
      required: REQUIRED_PLAYERS,
    }),
    tone: 'default',
  };
};

/**
 * Component to display and manage Team Slots (Availability)
 * @param {object} props
 * @param {Array<any>} [props.slots]
 * @param {boolean} [props.isCaptain]
 * @param {boolean} [props.isMember]
 * @param {(slot: any) => void} [props.onCheckIn]
 * @param {(slot: any) => void} [props.onSlotPress]
 * @param {() => void} [props.onAddSlot]
 * @param {boolean} [props.actionsEnabled]
 * @param {string} [props.currentUserId]
 * @param {'carousel' | 'list'} [props.layout]
 * @param {'responsive' | 'fixed'} [props.cardWidthMode]
 * @param {boolean} [props.showMemberHelperText]
 * @returns {import('react').ReactElement}
 */
export default function TeamSlotList({
  actionsEnabled = true,
  cardWidthMode = 'responsive',
  currentUserId,
  isCaptain = false,
  isMember = true,
  layout = 'carousel',
  onAddSlot,
  onCheckIn,
  onSlotPress,
  showMemberHelperText = true,
  slots = [],
}) {
  const { Colors, Fonts } = useTheme();
  const { t } = useTranslation();
  const { width: viewportWidth } = useWindowDimensions();

  const slotCardWidth = useMemo(() => {
    if (layout === 'list') return '100%';
    if (cardWidthMode === 'fixed') return 198;
    const horizontalPadding = 56;
    const calculatedWidth = viewportWidth - horizontalPadding;
    return Math.max(188, Math.min(246, calculatedWidth));
  }, [cardWidthMode, layout, viewportWidth]);

  const isCarouselLayout = layout === 'carousel';
  const cardTone = {
    addBg: `${Colors.gold500}1F`,
    addBorder: `${Colors.gold500}6B`,
    emptyBg: `${Colors.primary900}CC`,
    emptyBorder: `${Colors.primary500}33`,
    slotBg: `${Colors.primary900}E0`,
    slotBorderDefault: `${Colors.primary500}47`,
    slotBorderReady: `${Colors.gold500}73`,
    statusBg: `${Colors.neutral00}14`,
    statusBorder: `${Colors.neutral00}29`,
    trackBg: `${Colors.neutral00}1F`,
    unavailableBg: `${Colors.primary500}1F`,
    unavailableBorder: `${Colors.primary500}52`,
  };

  return (
    <View style={{ marginTop: 24 }}>
      <View style={{
        alignItems: 'flex-start',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}
      >
        <Text style={[Fonts.h3, {
          color: Colors.gold500, flex: 1, flexShrink: 1, paddingRight: 10,
        }]}
        >
          {t('teamSlotList.title', 'Disponibilités (créneaux)')}
        </Text>
        {isCaptain && actionsEnabled ? (
          <TouchableOpacity
            onPress={onAddSlot}
            style={{
              backgroundColor: cardTone.addBg,
              borderColor: cardTone.addBorder,
              borderRadius: 999,
              borderWidth: 1,
              flexShrink: 0,
              marginLeft: 8,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <Text style={[Fonts.p2Bold, { color: Colors.gold500 }]}>
              {t('teamSlotList.add', '+ Ajouter')}
            </Text>
          </TouchableOpacity>
        ) : null}
        {isCaptain && !actionsEnabled ? (
          <View
            style={{
              backgroundColor: cardTone.unavailableBg,
              borderColor: cardTone.unavailableBorder,
              borderRadius: 999,
              borderWidth: 1,
              flexShrink: 0,
              marginLeft: 8,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
              {t('teamSlotList.comingSoon', 'Bientôt disponible')}
            </Text>
          </View>
        ) : null}
      </View>

      {slots.length === 0 ? (
        <View style={{
          backgroundColor: cardTone.emptyBg,
          borderColor: cardTone.emptyBorder,
          borderRadius: 12,
          borderWidth: 1,
          padding: 14,
        }}
        >
          <Text style={[Fonts.p2, { color: Colors.neutral200 }]}>
            {t('teamSlotList.empty', 'Aucun créneau défini.')}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingRight: 6 }}
          horizontal={isCarouselLayout}
          showsHorizontalScrollIndicator={false}
        >
          {slots.map((slot, index) => {
            const participantsCount = slot?.participants?.length || 0;
            const checkedIn = slot?.participants?.some((p) => p?.documentId === currentUserId);
            const status = getStatus(participantsCount, t);
            const progressRatio = Math.min(1, participantsCount / REQUIRED_PLAYERS);
            const slotKey = slot?.documentId || `${slot?.recurrence_day || 'slot'}-${index}`;

            let statusColor = Colors.neutral300;
            if (status.tone === 'ready') {
              statusColor = Colors.success500;
            } else if (status.tone === 'warning') {
              statusColor = Colors.gold500;
            }

            return (
              <TouchableOpacity
                activeOpacity={isCaptain ? 0.85 : 1}
                key={slotKey}
                onPress={() => {
                  if (isCaptain && onSlotPress) {
                    onSlotPress(slot);
                  }
                }}
                style={{
                  backgroundColor: cardTone.slotBg,
                  borderColor: status.tone === 'ready'
                    ? cardTone.slotBorderReady
                    : cardTone.slotBorderDefault,
                  borderRadius: 14,
                  borderWidth: 1,
                  marginBottom: isCarouselLayout ? 0 : 10,
                  marginRight: isCarouselLayout ? 10 : 0,
                  padding: 12,
                  width: slotCardWidth,
                }}
              >
                <View style={{
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
                >
                  <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>
                    {dayMap[slot?.recurrence_day] || slot?.recurrence_day || 'Jour'}
                  </Text>
                  <View style={{
                    backgroundColor: cardTone.statusBg,
                    borderColor: cardTone.statusBorder,
                    borderRadius: 999,
                    borderWidth: 1,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                  }}
                  >
                    <Text style={[Fonts.p3Bold, { color: statusColor }]}>{status.label}</Text>
                  </View>
                </View>

                <Text style={[Fonts.h3, { color: Colors.gold500, marginBottom: 10 }]}>
                  {formatHour(slot?.start_hour)}
                  {' '}
                  -
                  {formatHour(slot?.end_hour)}
                </Text>

                <View style={{ marginBottom: 10 }}>
                  <Text style={[Fonts.p3, { color: Colors.neutral300, marginBottom: 6 }]}>
                    {t('teamSlotList.confirmedPlayers', 'Joueurs confirmés')}
                    :
                    {' '}
                    {participantsCount}
                    /
                    {REQUIRED_PLAYERS}
                  </Text>
                  <View style={{
                    backgroundColor: cardTone.trackBg,
                    borderRadius: 999,
                    height: 6,
                    overflow: 'hidden',
                    width: '100%',
                  }}
                  >
                    <View style={{
                      backgroundColor: progressRatio >= 1 ? Colors.gold500 : Colors.primary500,
                      borderRadius: 999,
                      height: 6,
                      width: `${progressRatio * 100}%`,
                    }}
                    />
                  </View>
                </View>

                {isMember && actionsEnabled ? (
                  <TouchableOpacity
                    onPress={() => onCheckIn?.(slot)}
                    style={{
                      alignItems: 'center',
                      backgroundColor: checkedIn ? Colors.primary500 : 'transparent',
                      borderColor: Colors.primary500,
                      borderRadius: 999,
                      borderWidth: 1,
                      justifyContent: 'center',
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                    }}
                  >
                    <Text style={[Fonts.p2Bold, { color: checkedIn ? Colors.neutral00 : Colors.primary500 }]}>
                      {checkedIn
                        ? t('teamSlotList.cta.removePresence', 'Retirer ma présence')
                        : t('teamSlotList.cta.confirmPresence', 'Je suis présent')}
                    </Text>
                  </TouchableOpacity>
                ) : null}
                {isMember && actionsEnabled && showMemberHelperText ? (
                  <Text style={[Fonts.p3, { color: Colors.neutral300, paddingTop: 8, textAlign: 'center' }]}>
                    {t('teamSlotList.memberHelp', 'Touchez pour confirmer votre présence.')}
                  </Text>
                ) : null}
                {isMember && !actionsEnabled ? (
                  <Text
                    style={[Fonts.p3, {
                      color: Colors.neutral300,
                      paddingVertical: 8,
                      textAlign: 'center',
                    }]}
                  >
                    {t('teamSlotList.checkInSoon', 'Check-in bientôt disponible.')}
                  </Text>
                ) : null}
                {!isMember ? (
                  <Text style={[Fonts.p3, { color: Colors.neutral300, paddingVertical: 8, textAlign: 'center' }]}>
                    {t('teamSlotList.joinHint', 'Rejoindre la squad pour participer.')}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
