import React, { useEffect, useState, useCallback } from 'react';
import { FlatList, Text, View, RefreshControl, Image, Switch, Alert, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';

import useTheme from '@/theme/themeContext';
import ScreenContainer from '@/components/templates/ScreenContainer';
import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import { getSearchAlerts, deleteSearchAlert, updateSearchAlert } from '@/services/searchAlert/searchAlertService';
import { RouteNames } from '@/navigation/routeNames';
import { useAppContext } from '@/store/appContext';

const SearchAlerts = ({ navigation }) => {
    const { t } = useTranslation();
    const {
        Spaces, Fonts, Alignments, Colors, Images,
    } = useTheme();
    const [, appDispatch] = useAppContext();
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [isTypeModalVisible, setIsTypeModalVisible] = useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [alertToDelete, setAlertToDelete] = useState(null);

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

    const handleDeleteConfirm = async () => {
        if (!alertToDelete) return;
        try {
            await deleteSearchAlert(alertToDelete);
            fetchAlerts();
        } catch (error) {
            console.error(error);
        } finally {
            setDeleteModalVisible(false);
            setAlertToDelete(null);
        }
    };

    const handleDeletePress = (id) => {
        setAlertToDelete(id);
        setDeleteModalVisible(true);
    };

    const handleToggleActive = async (item) => {
        try {
            await updateSearchAlert(item.documentId, { isActive: !item.isActive });
            fetchAlerts();
        } catch (error) {
            console.error(error);
            Alert.alert('Erreur', 'Impossible de modifier l\'alerte');
        }
    };

    // Launch search with filters applied directly to results page
    const handleLaunchSearch = (alert) => {
        if (alert.type === 'event') {
            // Apply filters to app context and navigate to Search (events tab)
            appDispatch({ type: 'SET_EVENT_FILTERS', payload: alert.filters || {} });
            navigation.navigate(RouteNames.HomeTab, {
                screen: RouteNames.Search,
                params: { initialTab: 'events' },
            });
        } else if (alert.type === 'mercato') {
            // Apply mercato filters and navigate to Search (mercato tab)
            appDispatch({ type: 'SET_MERCATO_FILTERS', payload: alert.filters || {} });
            navigation.navigate(RouteNames.HomeTab, {
                screen: RouteNames.Search,
                params: { initialTab: 'mercato' },
            });
        }
    };

    // Edit alert - navigate to filters with pre-filled values
    const handleEditAlert = (alert) => {
        if (alert.type === 'event') {
            navigation.navigate(RouteNames.EventFilters, { 
                editAlertMode: true, 
                alertDocumentId: alert.documentId,
                savedFilters: alert.filters,
                alertLabel: alert.label,
            });
        } else if (alert.type === 'mercato') {
            navigation.navigate(RouteNames.MercatoFilters, { 
                editAlertMode: true, 
                alertDocumentId: alert.documentId,
                savedFilters: alert.filters,
                alertLabel: alert.label,
            });
        }
    };

    const handleCreateAlertPress = () => {
        setIsTypeModalVisible(true);
    };

    const handleNavigateToFilters = (type) => {
        setIsTypeModalVisible(false);
        if (type === 'event') {
            navigation.navigate(RouteNames.EventFilters, { createAlertMode: true });
        } else if (type === 'mercato') {
            navigation.navigate(RouteNames.MercatoFilters, { createAlertMode: true });
        }
    };

    // Format filters into readable string with calendar icon
    const formatFilters = (filters, type) => {
        if (!filters) return null;
        const parts = [];
        
        // City
        if (filters.city?.label) {
            parts.push(filters.city.label);
        }
        // Radius
        if (filters.radius) {
            parts.push(`${filters.radius}km`);
        }
        
        return parts.length > 0 ? parts.join(' • ') : null;
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
                        <TouchableOpacity 
                            onPress={() => handleEditAlert(item)}
                            style={[
                                { backgroundColor: Colors.neutral800, borderRadius: 12, borderWidth: 1, borderColor: Colors.neutral700 },
                                Spaces.padding[16],
                            ]}
                        >
                            <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
                                <View style={{ flex: 1, marginRight: 12 }}>
                                    <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{item.label}</Text>
                                    <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[6], { marginTop: 4 }]}>
                                        <Image 
                                            source={item.type === 'event' ? Images.calendar : Images.users}
                                            style={{ width: 14, height: 14, tintColor: Colors.neutral00 }}
                                        />
                                        <Text numberOfLines={2} style={[Fonts.p3, Fonts.neutral00]}>
                                            {formatFilters(item.filters, item.type)}
                                        </Text>
                                    </View>
                                </View>
                                <Switch
                                    value={item.isActive}
                                    onValueChange={() => handleToggleActive(item)}
                                    trackColor={{ false: Colors.neutral500, true: Colors.primary500 }}
                                    thumbColor={Colors.neutral00}
                                />
                            </View>
                            <View style={[Alignments.row, Spaces.marginTop[12], Spaces.gap[8]]}>
                                <Button
                                    onPress={() => handleLaunchSearch(item)}
                                    title="Rechercher"
                                    variant="Secondary"
                                    style={{ flex: 1 }}
                                />
                                <Button
                                    icon="edit"
                                    onPress={() => handleEditAlert(item)}
                                    variant="Secondary"
                                />
                                <Button
                                    icon="trash"
                                    onPress={() => handleDeletePress(item.documentId)}
                                    variant="Secondary"
                                />
                            </View>
                        </TouchableOpacity>
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

            {/* Type Selection Modal */}
            <BottomModal
                close={() => setIsTypeModalVisible(false)}
                isVisible={isTypeModalVisible}
            >
                <View style={[Spaces.gap[16]]}>
                    <Text style={[Fonts.h3Bold, Fonts.neutral00, Spaces.marginTop[16]]}>
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

            {/* Delete Confirmation Modal */}
            <BottomModal
                close={() => setDeleteModalVisible(false)}
                isVisible={deleteModalVisible}
            >
                <View style={[Spaces.gap[16]]}>
                    <Text style={[Fonts.h3Bold, Fonts.neutral00, Spaces.marginTop[16]]}>
                        Supprimer l'alerte ?
                    </Text>
                    <Text style={[Fonts.p1, Fonts.neutral00]}>
                        Cette action est irréversible. Vous ne recevrez plus de notifications pour cette recherche.
                    </Text>

                    <Button
                        onPress={handleDeleteConfirm}
                        title="Supprimer"
                        variant="Primary"
                    />
                    <Button
                        onPress={() => setDeleteModalVisible(false)}
                        title="Annuler"
                        variant="Secondary"
                    />
                </View>
            </BottomModal>
        </ScreenContainer>
    );
};

export default SearchAlerts;
