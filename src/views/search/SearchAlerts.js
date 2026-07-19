import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, FlatList, Image, RefreshControl, Switch, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { canAccessRecruitmentProfiles } from '@/domains/search/recruitmentFlow';
import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { deleteSearchAlert, getSearchAlerts, updateSearchAlert } from '@/services/searchAlert/searchAlertService';

/**
 * @typedef {object} SearchAlertItem
 * @property {string} [documentId]
 * @property {number | string} [id]
 * @property {string} [label]
 * @property {'event' | 'mercato' | string} [type]
 * @property {Record<string, any>} [filters]
 * @property {boolean} [isActive]
 */

/**
 * @param {{ navigation: import('@react-navigation/native').NavigationProp<any> }} props
 */
function SearchAlerts({ navigation }) {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const { userData } = useAuth();
  const [, appDispatch] = useAppContext();
  const canUseProfileAlerts = canAccessRecruitmentProfiles(userData);
  const [alerts, setAlerts] = useState(/** @type {SearchAlertItem[]} */ ([]));
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isTypeModalVisible, setIsTypeModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [alertToDelete, setAlertToDelete] = useState(/** @type {string | null} */ (null));

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

  const handleDeletePress = (/** @type {string} */ id) => {
    setAlertToDelete(id);
    setDeleteModalVisible(true);
  };

  const handleToggleActive = async (/** @type {SearchAlertItem} */ item) => {
    if (item.type === 'mercato' && !canUseProfileAlerts) return;
    try {
      await updateSearchAlert(item.documentId, { isActive: !item.isActive });
      fetchAlerts();
    } catch (error) {
      console.error(error);
      Alert.alert('Erreur', 'Impossible de modifier l\'alerte');
    }
  };

  // Launch search with filters applied directly to results page
  const handleLaunchSearch = (/** @type {SearchAlertItem} */ alert) => {
    const rawFilters = /** @type {Record<string, any>} */ (alert.filters || {});
    if (alert.type === 'event') {
      const payload = {
        ...rawFilters,
        activity: rawFilters.activity || rawFilters.activityIds || [],
        category: rawFilters.category || rawFilters.categoryIds || [],
        level: rawFilters.level || rawFilters.levelIds || [],
        type: rawFilters.type || rawFilters.typeIds || [],
        ...(rawFilters.clubId && !rawFilters.club ? { club: { label: '', value: rawFilters.clubId } } : {}),
      };
      // Apply filters to app context and navigate to Search (events tab)
      appDispatch({ payload, type: 'SET_EVENT_FILTERS' });
      navigation.navigate(RouteNames.SearchEvents);
    } else if (alert.type === 'mercato') {
      if (!canUseProfileAlerts) {
        Alert.alert(
          'Alerte profils indisponible',
          'Cette alerte profils est visible uniquement sur un compte dirigeant ou entraineur.',
        );
        return;
      }
      const payload = {
        ...rawFilters,
        activity: rawFilters.activity || rawFilters.activityIds || [],
        activityIds: rawFilters.activityIds || rawFilters.activity || [],
        category: rawFilters.category || rawFilters.sectionIds || [],
        position: rawFilters.position || rawFilters.positions || [],
        positions: rawFilters.positions || rawFilters.position || [],
        sectionIds: rawFilters.sectionIds || rawFilters.category || [],
      };
      // Apply mercato filters and navigate to Search (mercato tab)
      appDispatch({ payload, type: 'SET_MERCATO_FILTERS' });
      navigation.navigate(RouteNames.SearchRecruitment, {
        initialRecruitmentTab: 'profils',
      });
    }
  };

  // Edit alert - navigate to filters with pre-filled values
  const handleEditAlert = (/** @type {SearchAlertItem} */ alert) => {
    if (alert.type === 'event') {
      navigation.navigate(RouteNames.EventFilters, {
        alertDocumentId: alert.documentId,
        alertLabel: alert.label,
        editAlertMode: true,
        savedFilters: alert.filters,
      });
    } else if (alert.type === 'mercato') {
      if (!canUseProfileAlerts) {
        Alert.alert(
          'Alerte profils indisponible',
          'Cette alerte profils n est plus modifiable sur un compte joueur.',
        );
        return;
      }
      navigation.navigate(RouteNames.MercatoFilters, {
        alertDocumentId: alert.documentId,
        alertLabel: alert.label,
        editAlertMode: true,
        savedFilters: alert.filters,
      });
    }
  };

  const handleCreateAlertPress = () => {
    if (!canUseProfileAlerts) {
      navigation.navigate(RouteNames.EventFilters, { createAlertMode: true });
      return;
    }
    setIsTypeModalVisible(true);
  };

  const handleNavigateToFilters = (/** @type {'event' | 'mercato'} */ type) => {
    setIsTypeModalVisible(false);
    if (type === 'event') {
      navigation.navigate(RouteNames.EventFilters, { createAlertMode: true });
    } else if (type === 'mercato') {
      if (!canUseProfileAlerts) return;
      navigation.navigate(RouteNames.MercatoFilters, { createAlertMode: true });
    }
  };

  const getAlertTypeLabel = (type) => (type === 'mercato' ? 'Alerte profils' : 'Alerte evenements');

  // Format filters into readable string with calendar icon
  const formatFilters = (/** @type {Record<string, any> | undefined} */ filters, /** @type {string} */ type) => {
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
            Spaces.paddingBottom[80],
            alerts.length === 0 && Alignments.fill,
            alerts.length === 0 && Alignments.mainCenter,
          ]}
          data={alerts}
          keyExtractor={(item) => (item.documentId || item.id?.toString() || Math.random().toString())}
          ListEmptyComponent={(
            <View style={[Alignments.alignCenter, Spaces.gap[16]]}>
              <Image
                source={Images.search}
                style={{
                      height: 60, opacity: 0.5, tintColor: Colors.neutral500, width: 60,
                    }}
              />
              <Text style={[Fonts.p1, Fonts.neutral300, { textAlign: 'center' }]}>
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
          renderItem={({ item }) => {
            const isProfileAlertUnavailable = item.type === 'mercato' && !canUseProfileAlerts;

            return (
            <TouchableOpacity
              disabled={isProfileAlertUnavailable}
              onPress={() => handleEditAlert(item)}
              style={[
                {
                  backgroundColor: Colors.neutral800, borderColor: Colors.neutral700, borderRadius: 12, borderWidth: 1,
                },
                Spaces.padding[16],
              ]}
            >
              <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
                <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={[Fonts.p4Bold, { color: Colors.primary500, marginBottom: 6 }]}>
                        {getAlertTypeLabel(item.type)}
                      </Text>
                      <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{item.label}</Text>
                      <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8], { marginTop: 4 }]}>
                        <Image
                            source={item.type === 'event' ? Images.calendar : Images.users}
                            style={{ height: 14, tintColor: Colors.neutral00, width: 14 }}
                          />
                        <Text numberOfLines={2} style={[Fonts.p3, Fonts.neutral00]}>
                            {formatFilters(item.filters, item.type)}
                          </Text>
                      </View>
                      {isProfileAlertUnavailable ? (
                        <Text style={[Fonts.p3, { color: Colors.neutral300, marginTop: 8 }]}>
                          Disponible uniquement sur un compte dirigeant ou entraineur.
                        </Text>
                      ) : null}
                    </View>
                <Switch
                      disabled={isProfileAlertUnavailable}
                      onValueChange={() => handleToggleActive(item)}
                      thumbColor={Colors.neutral00}
                      trackColor={{ false: Colors.neutral500, true: Colors.primary500 }}
                      value={item.isActive}
                    />
              </View>
              <View style={[Alignments.row, Spaces.marginTop[12], Spaces.gap[8]]}>
                <Button
                      disabled={isProfileAlertUnavailable}
                      onPress={() => handleLaunchSearch(item)}
                      style={{ flex: 1 }}
                      title="Rechercher"
                      variant="Secondary"
                    />
                <Button
                      disabled={isProfileAlertUnavailable}
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
            );
          }}
        />
      )}

      <View style={[
        Spaces.padding[16],
        {
          bottom: 0,
          left: 0,
          position: 'absolute',
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
          {canUseProfileAlerts ? (
            <Button
              onPress={() => handleNavigateToFilters('mercato')}
              title="Un profil ?"
              variant="Secondary"
            />
          ) : null}
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
}

export default SearchAlerts;
