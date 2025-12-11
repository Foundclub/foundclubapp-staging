import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import useTheme from '@/theme/themeContext';
import ScreenContainer from '@/components/templates/ScreenContainer';
import Button from '@/components/atoms/button/Button';
import { getEvents, updateEvent, cancelEvent } from '@/services/event/eventService';
import { useGetMe } from '@/services/auth/authQueries';

/**
 * RequestsDashboard component
 * @param {object} props
 * @returns {JSX.Element}
 */
const RequestsDashboard = ({ navigation, route }) => {
    const { t } = useTranslation();
    const { Colors, Fonts, Spaces, Alignments, ApplicationStyle } = useTheme();
    const queryClient = useQueryClient();
    const { data: userData } = useGetMe();

    // Get clubId from params or user data (assuming admin of first club)
    const clubId = route?.params?.clubId || userData?.trainedTeams?.[0]?.club?.documentId;

    const { data: pendingEvents, isLoading } = useQuery({
        queryKey: ['pendingEvents', clubId],
        queryFn: async () => {
            if (!clubId) return [];
            const res = await getEvents({
                club: { value: clubId },
                validationMode: 'manual',
                sessionStatus: 'open', // Assuming we only want open requests
                startDateAfter: new Date(), // Only future events
            });
            return res.data;
        },
        enabled: !!clubId,
    });

    const updateMutation = useMutation({
        mutationFn: updateEvent,
        onSuccess: () => {
            queryClient.invalidateQueries(['pendingEvents']);
            Alert.alert(t('common.success'), t('requests.approvedSuccess'));
        },
    });

    const cancelMutation = useMutation({
        mutationFn: cancelEvent,
        onSuccess: () => {
            queryClient.invalidateQueries(['pendingEvents']);
            Alert.alert(t('common.success'), t('requests.rejectedSuccess'));
        },
    });

    const handleApprove = (event) => {
        updateMutation.mutate({
            documentId: event.documentId,
            eventData: {
                validationMode: 'auto',
            },
        });
    };

    const handleReject = (event) => {
        Alert.alert(
            t('requests.rejectConfirmTitle'),
            t('requests.rejectConfirmMessage'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.confirm'),
                    style: 'destructive',
                    onPress: () => cancelMutation.mutate(event.documentId),
                },
            ]
        );
    };

    const renderItem = ({ item }) => {
        const date = new Date(item.date);
        const dateStr = format(date, 'EEEE d MMMM yyyy', { locale: fr });

        return (
            <View style={[
                ApplicationStyle.card,
                Spaces.padding[16],
                Spaces.marginBottom[16],
                { borderLeftWidth: 4, borderLeftColor: Colors.warning500 }
            ]}>
                <View style={[Alignments.row, Alignments.spaceBetween, Alignments.alignStart]}>
                    <View style={{ flex: 1 }}>
                        <Text style={[Fonts.h4Black, Fonts.neutral00]}>
                            {item.type?.name || 'Événement'}
                        </Text>
                        <Text style={[Fonts.p2, Fonts.neutral00, Spaces.marginTop[4]]}>
                            {dateStr} • {item.startTime?.substring(0, 5)} - {item.endTime?.substring(0, 5)}
                        </Text>
                        <Text style={[Fonts.p2, Fonts.neutral00, Spaces.marginTop[4]]}>
                            📍 {item.facility?.name || item.locationDetails || 'Lieu non défini'}
                        </Text>
                        <Text style={[Fonts.p2, Fonts.primary500, Spaces.marginTop[4]]}>
                            👤 {item.team?.name || 'Équipe inconnue'}
                        </Text>
                    </View>
                </View>

                <View style={[Alignments.row, Spaces.gap[16], Spaces.marginTop[16]]}>
                    <View style={{ flex: 1 }}>
                        <Button
                            title={t('common.reject', 'Refuser')}
                            variant="Secondary"
                            onPress={() => handleReject(item)}
                            isLoading={cancelMutation.isPending}
                            style={{ borderColor: Colors.error500 }}
                            textStyle={{ color: Colors.error500 }}
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Button
                            title={t('common.validate', 'Valider')}
                            variant="Primary"
                            onPress={() => handleApprove(item)}
                            isLoading={updateMutation.isPending}
                        />
                    </View>
                </View>
            </View>
        );
    };

    return (
        <ScreenContainer title={t('requests.title', 'Demandes en attente')}>
            <FlatList
                data={pendingEvents}
                renderItem={renderItem}
                keyExtractor={(item) => item.documentId}
                contentContainerStyle={[Spaces.padding[16]]}
                ListEmptyComponent={
                    !isLoading && (
                        <View style={[Alignments.center, Spaces.marginTop[40]]}>
                            <Text style={[Fonts.p1, Fonts.neutral00]}>
                                {t('requests.empty', 'Aucune demande en attente')}
                            </Text>
                        </View>
                    )
                }
            />
        </ScreenContainer>
    );
};

export default RequestsDashboard;
