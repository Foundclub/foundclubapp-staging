import React, { useCallback, useState } from 'react';
import { FlatList, Text, View, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import useTheme from '@/theme/themeContext';
import ScreenContainer from '@/components/templates/ScreenContainer';
import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import EmptyState from '@/components/atoms/emptyState/EmptyState';
import { RouteNames } from '@/navigation/routeNames';
import { getFacilities, getCMFacilities, deleteFacility } from '@/services/facility/facilityService';
import useAuth from '@/domains/auth/useAuth';
import Tag from '@/components/atoms/tag/Tag';

const FacilityList = () => {
    const { t } = useTranslation();
    const {
        Spaces, Fonts, Alignments, Colors,
    } = useTheme();
    const navigation = useNavigation();
    const { userData } = useAuth();
    // Support passing clubId or cmId via params
    const route = useRoute();
    const contextClubId = route.params?.clubId || userData?.club?.documentId || userData?.club?.id;
    const contextCmId = route.params?.cmId;

    const [facilities, setFacilities] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const fetchFacilities = async () => {
        if (!contextClubId && !contextCmId) return;
        setLoading(true);
        try {
            const promises = [];
            if (contextClubId) promises.push(getFacilities(contextClubId));
            if (contextCmId) promises.push(getCMFacilities(contextCmId));

            const results = await Promise.all(promises);
            
            let combinedData = [];
            
            // If both fetched, result[0] is Club, result[1] is CM (based on push order)
            // But let's handle carefully
            if (contextClubId && contextCmId) {
                const clubData = results[0]?.data || [];
                const cmData = results[1]?.data || [];
                // Mark CM facilities as read-only if we are in a club context
                const taggedCM = cmData.map(f => ({ ...f, isReadOnly: true, source: 'Multisport' }));
                combinedData = [...clubData, ...taggedCM];
            } else if (contextClubId) {
                combinedData = results[0]?.data || [];
            } else if (contextCmId) {
                combinedData = results[0]?.data || [];
            }

            setFacilities(combinedData);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = useCallback(async () => {
        if (!contextClubId && !contextCmId) return;
        setRefreshing(true);
        try {
            const promises = [];
            if (contextClubId) promises.push(getFacilities(contextClubId));
            if (contextCmId) promises.push(getCMFacilities(contextCmId));

            const results = await Promise.all(promises);
            
             let combinedData = [];
            
            if (contextClubId && contextCmId) {
                const clubData = results[0]?.data || [];
                const cmData = results[1]?.data || [];
                const taggedCM = cmData.map(f => ({ ...f, isReadOnly: true, source: 'Multisport' }));
                combinedData = [...clubData, ...taggedCM];
            } else if (contextClubId) {
                combinedData = results[0]?.data || [];
            } else if (contextCmId) {
                combinedData = results[0]?.data || [];
            }
            
            setFacilities(combinedData);
        } catch (error) {
            console.error(error);
        } finally {
            setRefreshing(false);
        }
    }, [contextClubId, contextCmId]);

    useFocusEffect(
        useCallback(() => {
            fetchFacilities();
        }, [contextClubId, contextCmId])
    );

    const handleDelete = async (id) => {
        try {
            await deleteFacility(id);
            fetchFacilities();
        } catch (error) {
            console.error(error);
        }
    };

    const handleEdit = (item) => {
        navigation.navigate(RouteNames.FacilityForm, { 
            facility: item,
            clubId: contextClubId,
            cmId: contextCmId
        });
    };

    const handleCreate = () => {
        navigation.navigate(RouteNames.FacilityForm, {
            clubId: contextClubId,
            cmId: contextCmId
        });
    };

    const renderItem = ({ item }) => (
        <View style={[
            { backgroundColor: Colors.neutral00, borderRadius: 12, elevation: 2 },
            Spaces.padding[16],
            Alignments.row,
            Alignments.alignCenter,
            Alignments.justifySpaceBetween,
        ]}
        >
            <View style={{ flex: 1, marginRight: 16 }}>
                <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8], Spaces.marginBottom[4]]}>
                    <Text style={[Fonts.h3, Fonts.neutral900]}>{item.name}</Text>
                    <Tag text={`${item.maxSlots} slots`} textColor="primary500" />
                    {item.isReadOnly && <Tag text="Multisport" textColor="secondary500" />}
                </View>
                <Text style={[Fonts.p2, Fonts.neutral500]}>
                    {(typeof item.address === 'object' ? item.address?.description : item.address) || 'Adresse non renseignée'}
                </Text>
                <Text style={[Fonts.p3, Fonts.neutral500, Spaces.marginTop[4]]}>{item.type}</Text>
            </View>
            {!item.isReadOnly && (
                <View style={[Alignments.column, Spaces.gap[8]]}>
                    <Button
                        icon="edit"
                        onPress={() => handleEdit(item)}
                        variant="Secondary"
                    />
                    <Button
                        icon="trash"
                        onPress={() => handleDelete(item.documentId)}
                        variant="Secondary"
                    />
                </View>
            )}
        </View>
    );

    return (
        <ScreenContainer
            bgImage="bg2"
            contentContainerStyle={[Spaces.paddingVertical[24], Spaces.paddingHorizontal[16], Alignments.fill]}
        >
            <View style={[Spaces.marginBottom[24], Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
                <Text style={[Fonts.h1, Fonts.neutral00]}>Installations</Text>
                <Button
                    onPress={handleCreate}
                    title="Ajouter"
                    variant="Primary"
                />
            </View>

            {loading && !refreshing ? (
                <Loader />
            ) : (
                <FlatList
                    contentContainerStyle={[
                        Spaces.gap[16],
                        facilities.length === 0 && Alignments.fill,
                        facilities.length === 0 && Alignments.mainCenter,
                    ]}
                    data={facilities}
                    keyExtractor={(item) => item.documentId || item.id?.toString()}
                    ListEmptyComponent={(
                        <EmptyState
                            title="Aucune installation"
                            description="Ajoutez les terrains, gymnases ou salles de votre club."
                            actionLabel="Ajouter une installation"
                            onAction={handleCreate}
                        />
                    )}
                    refreshControl={(
                        <RefreshControl
                            colors={[Colors.primary500]}
                            onRefresh={onRefresh}
                            refreshing={refreshing}
                            tintColor={Colors.primary500}
                        />
                    )}
                    renderItem={renderItem}
                />
            )}
        </ScreenContainer>
    );
};

export default FacilityList;
