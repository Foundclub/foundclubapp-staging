import React, { useEffect, useState, useCallback } from 'react';
import { FlatList, Text, View, RefreshControl, Image } from 'react-native';
import { useTranslation } from 'react-i18next';

import useTheme from '@/theme/themeContext';
import ScreenContainer from '@/components/templates/ScreenContainer';
import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import { getSearchAlerts, deleteSearchAlert } from '@/services/searchAlert/searchAlertService';
import { RouteNames } from '@/navigation/routeNames';

const SearchAlerts = ({ navigation }) => {
    const { t } = useTranslation();
    const {
        Spaces, Fonts, Alignments, Colors, Images,
    } = useTheme();
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [isTypeModalVisible, setIsTypeModalVisible] = useState(false);

    const fetchAlerts = async () => {
        setLoading(true);
        try {
            const data = await getSearchAlerts();
            setAlerts(data.data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            const data = await getSearchAlerts();
            setAlerts(data.data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setRefreshing(false);
        }
    }, []);

    const handleDelete = async (id) => {
        try {
            await deleteSearchAlert(id);
            fetchAlerts();
        } catch (error) {
            console.error(error);
        }
    };

    const handleCreateAlertPress = () => {
        setIsTypeModalVisible(true);
    };

    const handleNavigateToFilters = (type) => {
        setIsTypeModalVisible(false);
        if (type === 'event') {
            navigation.navigate(RouteNames.EventFilters);
        } else if (type === 'mercato') {
            navigation.navigate(RouteNames.MercatoFilters);
        }
    };

    useEffect(() => {
        fetchAlerts();
    }, []);

    return (
        <ScreenContainer
            bgImage="bg2"
            contentContainerStyle={[Alignments.fill]}
        >
            <View style={[Spaces.paddingHorizontal[16], Spaces.paddingTop[24], Spaces.marginBottom[24]]}>
                <Text style={[Fonts.h1, Fonts.neutral00]}>Mes Alertes</Text>
            </View>

            {loading && !refreshing ? (
                <Loader />
            ) : (
                <FlatList
                    contentContainerStyle={[
                        Spaces.gap[16],
                        Spaces.paddingHorizontal[16],
                        Spaces.paddingBottom[100],
                        alerts.length === 0 && Alignments.fill,
                        alerts.length === 0 && Alignments.mainCenter,
                    ]}
                    data={alerts}
                    keyExtractor={(item) => item.documentId || item.id?.toString()}
                    ListEmptyComponent={(
                        <View style={[Alignments.alignCenter, Spaces.gap[16]]}>
                            <Image
                                source={Images.search}
                                style={{
                                    width: 60, height: 60, tintColor: Colors.neutral500, opacity: 0.5,
                                }}
                            />
                            <Text style={[Fonts.p1, Fonts.neutral500, { textAlign: 'center' }]}>
                                {t('searchAlerts.empty', 'Aucune alerte enregistrée.\nCréez une alerte depuis les filtres de recherche.')}
                            </Text>
                        </View>
                    )}
                    refreshControl={(
                        <RefreshControl
                            colors={[Colors.primary500]}
                            onRefresh={onRefresh}
                            refreshing={refreshing}
                            tintColor={Colors.primary500}
                        />
                    )}
                    renderItem={({ item }) => (
                        <View style={[
                            { backgroundColor: Colors.neutral00, borderRadius: 8 },
                            Spaces.padding[16],
                            Alignments.row,
                            Alignments.alignCenter,
                            Alignments.justifySpaceBetween,
                        ]}
                        >
                            <View style={{ flex: 1, marginRight: 16 }}>
                                <Text style={[Fonts.p1Bold, Fonts.neutral900]}>{item.label}</Text>
                                <Text numberOfLines={2} style={[Fonts.p3, Fonts.neutral500]}>
                                    {item.filters ? `${Object.keys(item.filters).length} critères` : ''}
                                </Text>
                            </View>
                            <Button
                                icon="trash"
                                onPress={() => handleDelete(item.documentId)}
                                variant="Secondary"
                            />
                        </View>
                    )}
                />
            )}

            <View style={[
                Spaces.padding[16],
                {
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                },
            ]}
            >
                <Button
                    onPress={handleCreateAlertPress}
                    title={t('searchAlerts.actions.create', 'Créer une alerte')}
                    variant="Primary"
                />
            </View>

            <BottomModal
                close={() => setIsTypeModalVisible(false)}
                isVisible={isTypeModalVisible}
            >
                <View style={[Spaces.gap[16]]}>
                    <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
                        {t('searchAlerts.typeSelection.title', 'Que recherchez-vous ?')}
                    </Text>
                    <Text style={[Fonts.p1, Fonts.neutral00]}>
                        {t('searchAlerts.typeSelection.desc', 'Choisissez le type d\'alerte que vous souhaitez créer.')}
                    </Text>

                    <Button
                        onPress={() => handleNavigateToFilters('event')}
                        title="Un événement / Une réservation ?"
                        variant="Secondary"
                    />
                    <Button
                        onPress={() => handleNavigateToFilters('mercato')}
                        title="Un profil (Joueur, Entraîneur) ?"
                        variant="Secondary"
                    />
                </View>
            </BottomModal>
        </ScreenContainer>
    );
};

export default SearchAlerts;
