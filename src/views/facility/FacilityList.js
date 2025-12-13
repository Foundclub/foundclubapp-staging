import React, { useCallback, useState } from 'react';
import { FlatList, Text, View, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import useTheme from '@/theme/themeContext';
import ScreenContainer from '@/components/templates/ScreenContainer';
import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import EmptyState from '@/components/atoms/emptyState/EmptyState';
import { RouteNames } from '@/navigation/routeNames';
import { getFacilities, deleteFacility } from '@/services/facility/facilityService';
import useAuth from '@/domains/auth/useAuth';
import Tag from '@/components/atoms/tag/Tag';

const FacilityList = () => {
    const { t } = useTranslation();
    const {
        Spaces, Fonts, Alignments, Colors,
    } = useTheme();
    const navigation = useNavigation();
    const { userData } = useAuth();
    const club = userData?.club;
    const [facilities, setFacilities] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const fetchFacilities = async () => {
        const clubId = club?.documentId || club?.id;
        if (!clubId) return;
        setLoading(true);
        try {
            const data = await getFacilities(clubId);
            setFacilities(data.data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = useCallback(async () => {
        const clubId = club?.documentId || club?.id;
        if (!clubId) return;
        setRefreshing(true);
        try {
            const data = await getFacilities(clubId);
            setFacilities(data.data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setRefreshing(false);
        }
    }, [club]);

    useFocusEffect(
        useCallback(() => {
            fetchFacilities();
        }, [club])
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
        navigation.navigate(RouteNames.FacilityForm, { facility: item });
    };

    const handleCreate = () => {
        navigation.navigate(RouteNames.FacilityForm);
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
                </View>
                <Text style={[Fonts.p2, Fonts.neutral500]}>
                    {(typeof item.address === 'object' ? item.address?.description : item.address) || 'Adresse non renseignée'}
                </Text>
                <Text style={[Fonts.p3, Fonts.neutral500, Spaces.marginTop[4]]}>{item.type}</Text>
            </View>
            <View style={[Alignments.column, Spaces.gap[8]]}>
                <Button
                    icon="pencil"
                    onPress={() => handleEdit(item)}
                    variant="Secondary"
                    size="small"
                />
                <Button
                    icon="trash"
                    onPress={() => handleDelete(item.documentId)}
                    variant="Secondary"
                    size="small"
                />
            </View>
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
                    size="small"
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
