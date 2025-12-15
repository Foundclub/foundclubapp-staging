import { useNavigation } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useMemo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View, TouchableOpacity, Alert } from 'react-native';

import useTheme from '@/theme/themeContext';

import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';
import EventCardNew from '@/components/molecules/eventCard/EventCardNew';

import { useGetEvents } from '@/services/event/eventQueries';
import { updateEvent } from '@/services/event/eventService';
import { useMutation } from '@tanstack/react-query';
import { RouteNames } from '@/navigation/routeNames';

function FeaturedRequestsList() {
    // hooks
    const {
        Alignments,
        ApplicationStyle,
        Fonts,
        Spaces,
        Colors,
    } = useTheme();
    const { t } = useTranslation();
    const navigation = useNavigation();

    const [filterStatus, setFilterStatus] = useState('pending');

    const {
        data: requestPages,
        error,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        refetch,
    } = useGetEvents({
        featuredRequestStatus: filterStatus === 'pending' ? 'pending' : ['approved', 'rejected'],
        pageSize: 10,
        sort: 'updatedAt:desc', // Newest first
    });

    const updateEventMutation = useMutation({
        mutationFn: updateEvent,
        onSuccess: (data, variables) => {
            const isApproved = variables.eventData.featuredRequestStatus === 'approved';
            Alert.alert(
                isApproved ? 'Demande validée' : 'Demande refusée',
                isApproved ? 'L\'événement est maintenant mis en avant.' : 'La demande a été rejetée.',
                [{ text: 'OK', onPress: () => refetch() }]
            );
        },
    });

    // handlers
    const handleEndReached = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    const handleAcceptRequest = (event) => {
        console.log('handleAcceptRequest called for:', event?.documentId);
        if (event?.documentId) {
            updateEventMutation.mutate({
                documentId: event.documentId,
                eventData: {
                    isFeatured: true,
                    featuredRequestStatus: 'approved',
                },
            });
        } else {
            console.warn('No documentId for event in handleAcceptRequest');
        }
    };

    const handleRejectRequest = (event) => {
        console.log('handleRejectRequest called for:', event?.documentId);
        if (event?.documentId) {
            updateEventMutation.mutate({
                documentId: event.documentId,
                eventData: {
                    featuredRequestStatus: 'rejected',
                },
            });
        } else {
            console.warn('No documentId for event in handleRejectRequest');
        }
    };

    const handleEventPress = (event) => {
        navigation.navigate(RouteNames.EventStack, { screen: RouteNames.EventDetails, params: { eventId: event.documentId } });
    };

    /**
     * @type {FCEvent[]}
     */
    const requests = useMemo(() => requestPages?.pages
        ?.reduce((/** @type {FCEvent[]} */ acc, page) => {
            const items = page?.data || [];
            return acc.concat(items);
        }, [])
        || [], [requestPages]);

    /**
     * Render the request item
     * @param {object} param
     * @param {FCEvent} param.item
     * @returns {import('react').ReactElement}
     */
    const renderItem = ({ item }) => (
        <EventCardNew
            item={item}
            onPress={handleEventPress}
            showClubHeader
            onValidate={filterStatus === 'pending' ? handleAcceptRequest : undefined}
            onRefuse={filterStatus === 'pending' ? handleRejectRequest : undefined}
        />
    );

    const renderEmptyList = () => (
        <View style={[
            ApplicationStyle.backgroundColor.primary900,
            ApplicationStyle.borderRadius32,
            Alignments.alignCenter,
            Spaces.gap[32],
            Spaces.paddingHorizontal[12],
            Spaces.paddingVertical[24],
            Spaces.marginVertical[24]]}
        >
            <Text style={[Fonts.p1Bold, Fonts.neutral00, Fonts.textCenter]}>
                {filterStatus === 'pending' ? 'Aucune demande en attente' : 'Aucun historique'}
            </Text>
        </View>
    );

    return (
        <ScreenContainer
            bgImage="bg2"
            contentContainerStyle={[
                Spaces.paddingVertical[24],
                Alignments.fill,
            ]}
        >
            <WithDataWrapper
                error={error?.message}
                isLoading={isLoading && !isFetchingNextPage}
                wrapperStyle={[Alignments.fill]}
            >
                <View style={[
                    Alignments.fill,
                    Spaces.paddingHorizontal[16],
                    ApplicationStyle.borderRadius2]}
                >
                    {/* Toggle Filter */}
                    <View style={[Alignments.row, Spaces.marginBottom[16], { backgroundColor: '#173844', borderRadius: 12, padding: 4 }]}>
                        <TouchableOpacity
                            onPress={() => setFilterStatus('pending')}
                            style={[
                                Alignments.fill,
                                Alignments.alignCenter,
                                Spaces.paddingVertical[8],
                                { borderRadius: 8, backgroundColor: filterStatus === 'pending' ? '#01B3F4' : 'transparent' }
                            ]}
                        >
                            <Text style={[Fonts.p2Bold, { color: filterStatus === 'pending' ? '#001218' : '#FFFFFF' }]}>
                                En attente
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setFilterStatus('history')}
                            style={[
                                Alignments.fill,
                                Alignments.alignCenter,
                                Spaces.paddingVertical[8],
                                { borderRadius: 8, backgroundColor: filterStatus === 'history' ? '#01B3F4' : 'transparent' }
                            ]}
                        >
                            <Text style={[Fonts.p2Bold, { color: filterStatus === 'history' ? '#001218' : '#FFFFFF' }]}>
                                Historique
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <FlashList
                        data={requests}
                        estimatedItemSize={200}
                        keyExtractor={(item) => item?.documentId || 'unknown'}
                        ListEmptyComponent={renderEmptyList}
                        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
                        onEndReached={handleEndReached}
                        onEndReachedThreshold={0.5}
                        onRefresh={refetch}
                        refreshing={isLoading && !isFetchingNextPage}
                        renderItem={renderItem}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 24 }}
                    />
                </View>
            </WithDataWrapper>
        </ScreenContainer>
    );
}

export default FeaturedRequestsList;
