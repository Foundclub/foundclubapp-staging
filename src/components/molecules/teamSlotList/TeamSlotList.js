import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

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

const getStatus = (count) => {
  if (count >= REQUIRED_PLAYERS) {
    return { label: 'Complet', tone: 'ready' };
  }
  if (count >= REQUIRED_PLAYERS - 2) {
    return { label: `Encore ${REQUIRED_PLAYERS - count}`, tone: 'warning' };
  }
  return { label: `${count}/${REQUIRED_PLAYERS} confirmes`, tone: 'default' };
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
 * @param {string} [props.currentUserId]
 * @returns {import('react').ReactElement}
 */
export default function TeamSlotList({
  currentUserId,
  isCaptain = false,
  isMember = true,
  onAddSlot,
  onCheckIn,
  onSlotPress,
  slots = [],
}) {
  const { Colors, Fonts, Spaces } = useTheme();

  return (
    <View style={{ marginTop: 24 }}>
      <View style={{
        alignItems: 'flex-start',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}
      >
        <Text style={[Fonts.h3, { color: Colors.gold500, flex: 1, flexShrink: 1, paddingRight: 10 }]}>
          Disponibilites (Creneaux)
        </Text>
        {isCaptain ? (
          <TouchableOpacity
            onPress={onAddSlot}
            style={{
              backgroundColor: 'rgba(250, 204, 21, 0.12)',
              borderColor: 'rgba(250, 204, 21, 0.42)',
              borderRadius: 999,
              borderWidth: 1,
              flexShrink: 0,
              marginLeft: 8,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <Text style={[Fonts.p2Bold, { color: Colors.gold500 }]}>+ Ajouter</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {slots.length === 0 ? (
        <View style={{
          backgroundColor: 'rgba(9, 27, 42, 0.78)',
          borderColor: 'rgba(1, 179, 244, 0.20)',
          borderRadius: 12,
          borderWidth: 1,
          padding: 14,
        }}
        >
          <Text style={[Fonts.p2, { color: Colors.neutral200 }]}>Aucun creneau defini.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingRight: 6 }}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {slots.map((slot, index) => {
            const participantsCount = slot?.participants?.length || 0;
            const checkedIn = slot?.participants?.some((p) => p?.documentId === currentUserId);
            const status = getStatus(participantsCount);
            const progressRatio = Math.min(1, participantsCount / REQUIRED_PLAYERS);
            const slotKey = slot?.documentId || `${slot?.recurrence_day || 'slot'}-${index}`;

            const statusColor = status.tone === 'ready'
              ? Colors.success500
              : status.tone === 'warning'
                ? Colors.gold500
                : Colors.neutral300;

            return (
              <TouchableOpacity
                key={slotKey}
                activeOpacity={isCaptain ? 0.85 : 1}
                onPress={() => {
                  if (isCaptain && onSlotPress) {
                    onSlotPress(slot);
                  }
                }}
                style={{
                  backgroundColor: 'rgba(9, 27, 42, 0.88)',
                  borderColor: status.tone === 'ready'
                    ? 'rgba(250, 204, 21, 0.45)'
                    : 'rgba(1, 179, 244, 0.28)',
                  borderRadius: 14,
                  borderWidth: 1,
                  marginRight: 10,
                  padding: 12,
                  width: 198,
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
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    borderColor: 'rgba(255,255,255,0.16)',
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
                  {formatHour(slot?.start_hour)} - {formatHour(slot?.end_hour)}
                </Text>

                <View style={{ marginBottom: 10 }}>
                  <Text style={[Fonts.p3, { color: Colors.neutral300, marginBottom: 6 }]}>
                    Joueurs confirmes: {participantsCount}/{REQUIRED_PLAYERS}
                  </Text>
                  <View style={{
                    backgroundColor: 'rgba(255,255,255,0.12)',
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
                      width: `${Math.max(6, progressRatio * 100)}%`,
                    }}
                    />
                  </View>
                </View>

                {isMember ? (
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
                      {checkedIn ? 'Retirer ma presence' : 'Je suis present'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={[Fonts.p3, { color: Colors.neutral300, textAlign: 'center', paddingVertical: 8 }]}>
                    Rejoindre la squad pour participer.
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
