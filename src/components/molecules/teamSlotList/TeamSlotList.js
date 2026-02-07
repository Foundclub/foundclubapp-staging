import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import useTheme from '@/theme/themeContext';

/**
 * Component to display and manage Team Slots (Availability)
 * @param {object} props
 * @param {Array} props.slots - List of slots
 * @param {boolean} props.isCaptain - Is current user a captain?
 * @param {Function} props.onAddSlot - Handler to add a new slot
 * @param {Function} props.onCheckIn - Handler to toggle check-in status
 */
export default function TeamSlotList({ slots = [], isCaptain, onAddSlot, onCheckIn, currentUserId, onSlotPress }) {
  console.log('TeamSlotList render:', { isCaptain, slotsCount: slots.length, hasOnSlotPress: !!onSlotPress });
  const { Colors, Fonts, Spaces } = useTheme();

  const dayMap = {
      monday: 'Lundi',
      tuesday: 'Mardi',
      wednesday: 'Mercredi',
      thursday: 'Jeudi',
      friday: 'Vendredi',
      saturday: 'Samedi',
      sunday: 'Dimanche'
  };

  return (
    <View style={[Spaces.marginTop[20]]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={[Fonts.h3, { color: Colors.gold500 }]}>Disponibilités (Créneaux)</Text>
            {isCaptain && (
                <TouchableOpacity onPress={onAddSlot}>
                    <Text style={[Fonts.p1Bold, { color: Colors.gold500 }]}>+ Ajouter</Text>
                </TouchableOpacity>
            )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {slots.length === 0 ? (
                <View style={{ padding: 15, backgroundColor: Colors.neutral800, borderRadius: 8 }}>
                    <Text style={[Fonts.p2, { color: Colors.neutral200 }]}>Aucun créneau défini.</Text>
                </View>
            ) : (
                slots.map((slot, index) => {
                     const participantsCount = slot.participants?.length || 0;
                     const isReady = participantsCount >= 5;
                     
                     // Check-in logic: User is in participants list
                     // Note: We need currentUser ID here to know if *I* am checked in. 
                     // But this component receives `isCaptain` and `onCheckCheckIn`. 
                     // The logic for "isCheckedIn" was passed as prop or calculated inside? 
                     // In previous SquadDetailsScreen, we calculated `isCheckedIn` inside `handleCheckIn` but not passed to list?
                     // Wait, SquadDetailsScreen passes `slots`. We need to know if current user is in `slot.participants`.
                     // The previous code had `slot.isCheckedIn` (which might have been undefined or calculated elsewhere?).
                     // SquadDetailsScreen needs to pass `currentUser` or map slots to add `isCheckedIn`.
                     // Let's assume we can check `slot.participants` here if we have `currentUser` or if `slot` objects are pre-processed.
                     // Actually, looking at previous code, `slot.isCheckedIn` was accessed but never set in SquadDetailsScreen explicitly map.
                     // LET'S FIX THIS: We need to know if the user is checked in.
                     // I'll add a `currentUserId` prop to TeamSlotList.
                     
                     // For now, let's update the UI structure assuming `isCheckedIn` is available or passed.
                     // IMPORTANT: I will ask the user's ID to be passed to this component in the next tool call or assume it's passed.
                     // Actually, I can construct the render function to expect `currentUserId`.
                     
                     // Time Formatting (new recurring format: start_hour/end_hour are strings like "20:00:00")
                     const formatHour = (timeStr) => {
                         if (!timeStr) return "?";
                         const parts = timeStr.split(':');
                         return `${parseInt(parts[0])}h${parts[1]}`;
                     };
                     const startTimeStr = formatHour(slot.start_hour);
                     const endTimeStr = formatHour(slot.end_hour);

                     // Status Text Logic
                     let statusText = `${participantsCount}/5 Prêts`;
                     let statusColor = Colors.neutral00; // White default
                     if (participantsCount >= 3 && participantsCount < 5) {
                         statusText = `Plus que ${5 - participantsCount} !`;
                         statusColor = Colors.warning500; // Orange/Yellow
                     } else if (participantsCount >= 5) {
                         statusText = "Complet";
                         statusColor = Colors.success500;
                     }

                     // Render Dots Helper
                     const renderDots = () => {
                         const totalSlots = 5;
                         const dots = [];
                         for (let i = 0; i < totalSlots; i++) {
                             const isFilled = i < participantsCount;
                             dots.push(
                                 <View 
                                     key={i}
                                     style={{
                                         width: 8, // Smaller dots to fit text
                                         height: 8,
                                         borderRadius: 4,
                                         backgroundColor: isFilled ? Colors.primary500 : 'transparent',
                                         borderWidth: 1,
                                         borderColor: isFilled ? Colors.primary500 : Colors.neutral500,
                                         marginRight: 4
                                     }}
                                 />
                             );
                         }
                         return (
                             <View>
                                 <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                     {dots}
                                     {participantsCount > 5 && (
                                         <Text style={[Fonts.p3Bold, { color: Colors.primary500, marginLeft: 4 }]}>
                                             +{participantsCount - 5}
                                         </Text>
                                     )}
                                 </View>
                                 <Text style={[Fonts.p3, { color: statusColor, fontSize: 10 }]}>
                                     {statusText}
                                 </Text>
                             </View>
                         );
                     };

                     const isCheckedIn = slot.participants?.some(p => p.documentId === currentUserId);

                     return (
                        <TouchableOpacity 
                            key={index} 
                            onPress={() => {
                                if (isCaptain && onSlotPress) {
                                    onSlotPress(slot);
                                }
                            }}
                            activeOpacity={isCaptain ? 0.7 : 1}
                            style={{ 
                                padding: 12, 
                                backgroundColor: Colors.neutral800, 
                                borderRadius: 12, 
                                borderWidth: 1, 
                                borderColor: isReady ? Colors.primary500 : Colors.neutral700,
                                width: 170
                            }}
                        >
                            <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>
                                {dayMap[slot.recurrence_day] || slot.recurrence_day || 'Jour ?'}
                            </Text>
                            
                            {/* Time Display with End Time */}
                            <Text style={[Fonts.h2, { color: Colors.gold500, marginVertical: 8, fontSize: 18 }]}>
                                {startTimeStr} - {endTimeStr}
                            </Text>
                            
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                                {/* Dots Gauge + Text */}
                                <View style={{ flex: 1, marginRight: 8 }}>
                                     {renderDots()}
                                </View>
                                
                                <TouchableOpacity 
                                    onPress={() => onCheckIn(slot)}
                                    style={{ 
                                        backgroundColor: isCheckedIn ? Colors.primary500 : 'transparent',
                                        borderColor: Colors.primary500,
                                        borderWidth: isCheckedIn ? 0 : 2,
                                        width: 36,
                                        height: 36,
                                        borderRadius: 18,
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    {isCheckedIn ? (
                                         <Text style={{ color: Colors.neutral00, fontSize: 18, fontWeight: 'bold' }}>✕</Text>
                                    ) : (
                                        <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>GO</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </TouchableOpacity>
                    );
                })
            )}
        </ScrollView>
    </View>
  );
}
