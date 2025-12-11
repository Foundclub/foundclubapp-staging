import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import PlanningWeekTimelineView from '../planningWeekTimelineView/PlanningWeekTimelineViewV2';
import PlanningCalendarView from '../planningCalendarView/PlanningCalendarView';
import BottomModal from '../../molecules/bottomModal/BottomModal';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { getEvents } from '@/services/event/eventService';
import { RouteNames } from '@/navigation/routeNames';
import Loader from '@/components/atoms/loader/Loader';
import useTheme from '@/theme/themeContext';

const PersonalPlanningContainer = ({ onSummaryPress }) => {
    const navigation = useNavigation();
    const { Colors, Fonts, Spaces, Alignments } = useTheme();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState('3days'); // '3days' | 'week' | 'month'
    const [isViewModalVisible, setIsViewModalVisible] = useState(false);

    // Calculate date range based on view mode
    const { startDate, endDate } = React.useMemo(() => {
        const now = currentDate;
        if (viewMode === 'month') {
            return {
                startDate: startOfMonth(now),
                endDate: endOfMonth(now)
            };
        }
        // Default to week view (covers 3days as well)
        return {
            startDate: startOfWeek(now, { weekStartsOn: 1 }), // Monday start
            endDate: endOfWeek(now, { weekStartsOn: 1 })
        };
    }, [currentDate, viewMode]);

    const { data: eventsData, isLoading } = useQuery({
        queryKey: ['myEvents', startDate.toISOString(), endDate.toISOString()],
        queryFn: () => getEvents({
            myTeams: true,
            pageSize: 100,
            sort: 'date:asc',
            startDateAfter: startDate,
            startDateBefore: endDate
        }),
    });

    const events = eventsData?.data || [];

    const handleEventPress = (event) => {
        if (event.type?.name === 'Match') {
            navigation.navigate(RouteNames.MatchDetails, { matchId: event.documentId });
        } else if (event.type?.name === 'Entraînement') {
            navigation.navigate(RouteNames.TrainingDetails, { trainingId: event.documentId });
        } else {
            navigation.navigate(RouteNames.EventDetails, { eventId: event.documentId });
        }
    };

    const getViewLabel = (mode) => {
        switch (mode) {
            case 'month': return 'Vue : Mois';
            case 'week': return 'Vue : Semaine';
            case '3days': return 'Vue : 3 Jours';
            default: return 'Vue : Semaine';
        }
    };

    const handleViewSelect = (mode) => {
        setViewMode(mode);
        setIsViewModalVisible(false);
    };

    if (isLoading) {
        return <Loader />;
    }

    return (
        <View>
            {/* Header with View Selector - Centered and No Title */}
            <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifyCenter, Spaces.marginBottom[16]]}>
                {/* View Selector Buttons */}
                <View style={[Alignments.row, { backgroundColor: Colors.neutral800, borderRadius: 8, padding: 2 }]}>
                    <TouchableOpacity
                        onPress={() => setViewMode('week')}
                        style={[
                            Spaces.paddingHorizontal[12],
                            Spaces.paddingVertical[6],
                            { borderRadius: 6, backgroundColor: viewMode === 'week' ? Colors.primary500 : 'transparent' }
                        ]}
                    >
                        <Text style={[Fonts.p4Bold, { color: Colors.neutral00, fontWeight: 'bold', opacity: viewMode === 'week' ? 1 : 0.5 }]}>
                            Semaine
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setViewMode('3days')}
                        style={[
                            Spaces.paddingHorizontal[12],
                            Spaces.paddingVertical[6],
                            { borderRadius: 6, backgroundColor: viewMode === '3days' ? Colors.primary500 : 'transparent' }
                        ]}
                    >
                        <Text style={[Fonts.p4Bold, { color: Colors.neutral00, fontWeight: 'bold', opacity: viewMode === '3days' ? 1 : 0.5 }]}>
                            3 Jours
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setViewMode('month')}
                        style={[
                            Spaces.paddingHorizontal[12],
                            Spaces.paddingVertical[6],
                            { borderRadius: 6, backgroundColor: viewMode === 'month' ? Colors.primary500 : 'transparent' }
                        ]}
                    >
                        <Text style={[Fonts.p4Bold, { color: Colors.neutral00, fontWeight: 'bold', opacity: viewMode === 'month' ? 1 : 0.5 }]}>
                            Mois
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Planning Views */}
            {viewMode === 'month' ? (
                <PlanningCalendarView
                    events={events}
                    onEventPress={handleEventPress}
                    compact={true}
                    currentDate={currentDate}
                    onDateSelect={setCurrentDate}
                />
            ) : (
                <PlanningWeekTimelineView
                    events={events}
                    onEventPress={handleEventPress}
                    currentDate={currentDate}
                    onDateChange={setCurrentDate}
                    mode={viewMode}
                    scrollEnabled={false}
                    maxSlots={1}
                    onSummaryPress={onSummaryPress}
                />
            )}
        </View>
    );
};

export default PersonalPlanningContainer;
