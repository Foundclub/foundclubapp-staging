import { joiResolver } from '@hookform/resolvers/joi';
import Slider from '@react-native-community/slider';
import { useRoute } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  Alert, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import usePlaces from '@/domains/places/usePlaces';
import { useAppContext } from '@/store/appContext';
import { Joi } from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Input from '@/components/molecules/input/Input';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetActivities } from '@/services/activity/activityQueries';
import {
  createSearchAlert, getPreviewCount, getSearchAlerts, updateSearchAlert,
} from '@/services/searchAlert/searchAlertService';
import { useGetSections } from '@/services/section/sectionQueries';

import { getFieldError } from '@/utils/form/formUtils';

import { getPositionValuesForSport } from '@/constants/positions';

const WEB_FILTER_SURFACE_PROPS = {
  contentWidth: 720,
  responsivePadding: true,
  surface: 'card',
};

/** @typedef {import('@/components/molecules/autocompleteSelect/types').Option} Option */
/** @typedef {{ createAlertMode?: boolean; editAlertMode?: boolean; alertLabel?: string; alertDocumentId?: string; savedFilters?: MercatoFiltersFormData }} MercatoRouteParams */
/** @typedef {{ title: string; content: string }} InfoModalContent */
/**
 * @typedef {import('@/store/types').MercatoFilters & {
 *  city?: { label: string; value: string | number | null };
 *  activity?: string | string[];
 *  category?: string | string[];
 *  position?: string | string[];
 *  radius?: number | string;
 * }} MercatoFiltersFormData
 */

const filtersSchema = Joi.object({
  activity: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).allow(''),
  category: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).allow(''),
  city: Joi.object().allow(''),
  position: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).allow(''),
  radius: Joi.number().allow(''),
});

/**
 * @param {{ navigation: import('@react-navigation/native').NavigationProp<any> }} props
 */
function MercatoFilters({ navigation }) {
  const route = useRoute();
  const routeParams = /** @type {MercatoRouteParams} */ (route?.params || {});
  const createAlertMode = routeParams.createAlertMode || false;
  const editAlertMode = routeParams.editAlertMode || false;
  const initialAlertLabel = routeParams.alertLabel || '';
  const { alertDocumentId } = routeParams;
  const savedFilters = routeParams.savedFilters || null;

  const isAlertMode = createAlertMode || editAlertMode;

  // local states
  const [activitySearchValue, setActivitySearchValue] = useState('');
  const [categorySearchValue, setCategorySearchValue] = useState('');
  const [positionSearchValue, setPositionSearchValue] = useState('');
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [infoModalContent, setInfoModalContent] = useState(
    /** @type {InfoModalContent} */ ({ content: '', title: '' }),
  );

  // Alert State
  const [isSaveModalVisible, setIsSaveModalVisible] = useState(false);
  const [alertLabel, setAlertLabel] = useState(initialAlertLabel || '');
  const [isCreatingAlert, setIsCreatingAlert] = useState(false);
  const [previewCount, setPreviewCount] = useState(/** @type {number | null} */ (null));

  // hooks
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const [{ mercatoFilters }, appDispatch] = useAppContext();
  const { getGeohashForPointAndRadius } = usePlaces();
  const insets = useSafeAreaInsets();

  const defaultValues = useMemo(() => {
    const source = (editAlertMode && savedFilters) ? savedFilters : (mercatoFilters || {});
    return {
      activity: source?.activity || source?.activityIds || [],
      category: source?.category || source?.sectionIds || [],
      city: source?.city || { label: '', value: '' },
      position: source?.position || source?.positions || [],
      radius: source?.radius || 20,
    };
  }, [editAlertMode, savedFilters, mercatoFilters]);

  const {
    control,
    formState: { errors: formErrors },
    getValues,
    handleSubmit,
    setValue,
    watch,
  } = useForm({
    defaultValues,
    mode: 'onBlur',
    resolver: joiResolver(filtersSchema),
  });

  // Header Star Button (only show when NOT in createAlertMode)
  const handleOpenSaveModal = async () => {
    setIsSaveModalVisible(true);
    // Fetch preview count
    try {
      const currentFilters = buildNormalizedFiltersPayload(/** @type {MercatoFiltersFormData} */ (getValues()));
      const result = await getPreviewCount(currentFilters, 'mercato');
      setPreviewCount(result.count);
    } catch (error) {
      console.error('Error fetching preview count:', error);
      setPreviewCount(null);
    }
  };

  // Set header title and optionally hide star button in isAlertMode
  useEffect(() => {
    if (isAlertMode) {
      navigation.setOptions({
        headerRight: () => null,
        headerTitle: editAlertMode ? 'Modifier l\'alerte' : 'Créer une alerte',
      });
    }
  }, [isAlertMode, editAlertMode, navigation]);

  React.useLayoutEffect(() => {
    if (!isAlertMode) {
      navigation.setOptions({
        headerTitle: 'Filtres profils',
        headerRight: () => (
          <View style={{ alignItems: 'center', marginRight: 16 }}>
            <TouchableOpacity
              onPress={handleOpenSaveModal}
              style={{
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: Colors.primary500, fontSize: 24 }}>★</Text>
              <Text style={{ color: Colors.primary500, fontSize: 10, marginTop: 2 }}>Créer alerte</Text>
            </TouchableOpacity>
          </View>
        ),
      });
    }
  }, [navigation, Colors, createAlertMode]);

  const { data: allActivities } = useGetActivities();
  const { data: allSections } = useGetSections();

  const toArray = React.useCallback((/** @type {unknown} */ value) => {
    if (Array.isArray(value)) return value.map((v) => String(v || '')).filter(Boolean);
    if (typeof value === 'string') return value ? [value] : [];
    return [];
  }, []);

  const resolveActivityNames = React.useCallback((/** @type {unknown} */ idsValue) => {
    const ids = toArray(idsValue);
    if (!ids.length) return [];

    const lookup = new Map(
      (allActivities || []).map((activity) => [
        String(activity.documentId || ''),
        String(activity.name || '').trim(),
      ]),
    );

    return ids
      .map((id) => lookup.get(String(id)) || '')
      .filter(Boolean);
  }, [allActivities, toArray]);

  const buildNormalizedFiltersPayload = React.useCallback((/** @type {MercatoFiltersFormData} */ rawData) => {
    const data = rawData || {};
    const cityValue = typeof data.city?.value === 'string' ? data.city.value : '';
    const coordinates = cityValue ? cityValue.split('|') : undefined;
    const geohash = (coordinates && data.city?.value) ? getGeohashForPointAndRadius(
      parseFloat(coordinates[1]),
      parseFloat(coordinates[0]),
      Number(data.radius || 0),
    ) : undefined;

    const activityIds = toArray(data.activity || []);
    const activityNames = resolveActivityNames(activityIds);
    const sectionIds = toArray(data.category || []);
    const positions = toArray(data.position || []);

    return {
      ...data,
      activity: activityIds,
      activityIds,
      activityNames,
      category: sectionIds,
      position: positions,
      positions,
      sectionIds,
      ...(geohash && { geohash }),
    };
  }, [getGeohashForPointAndRadius, resolveActivityNames, toArray]);

  const activities = useMemo(() => {
    const formattedActivities = allActivities?.map(({ documentId, name }) => ({
      label: name,
      value: documentId || '',
    })) || [];

    if (activitySearchValue) {
      return formattedActivities.filter(
        (activity) => activity.label.toLowerCase().includes(
          activitySearchValue.trim().toLowerCase(),
        ),
      );
    }
    return formattedActivities;
  }, [allActivities, activitySearchValue]);

  const categories = useMemo(() => {
    const formattedCategories = allSections?.map(({ documentId, name }) => ({
      label: name,
      value: documentId || '',
    })) || [];

    if (categorySearchValue) {
      return formattedCategories.filter(
        (category) => category.label.toLowerCase().includes(
          categorySearchValue.trim().toLowerCase(),
        ),
      );
    }
    return formattedCategories;
  }, [allSections, categorySearchValue]);

  const selectedActivityIds = watch('activity');

  const availablePositions = useMemo(() => {
    if (!selectedActivityIds || selectedActivityIds.length === 0 || !allActivities) return [];

    const selectedIds = Array.isArray(selectedActivityIds) ? selectedActivityIds : [selectedActivityIds];
    const selectedNames = allActivities
      .filter((a) => selectedIds.includes(a.documentId))
      .map((a) => a.name);

    // Meme source que l'inscription : on filtre sur les valeurs REELLEMENT
    // enregistrees en base, sinon un filtre ne peut rien trouver.
    const positions = new Set();
    selectedNames.forEach((name) => {
      getPositionValuesForSport(name).forEach((/** @type {string} */ p) => positions.add(p));
    });

    return Array.from(positions).map((p) => ({ label: p, value: p }));
  }, [selectedActivityIds, allActivities]);

  /**
   * @param {MercatoFiltersFormData} data
   */
  const handleApplyFilters = (data) => {
    const payload = buildNormalizedFiltersPayload(data);

    appDispatch({
      payload,
      type: 'SET_MERCATO_FILTERS',
    });
    navigation.goBack();
  };

  const handleEmptyFilters = () => {
    appDispatch({ payload: {}, type: 'SET_MERCATO_FILTERS' });
    navigation.goBack();
  };

  // Direct alert creation/update for createAlertMode
  const handleSaveAlert = async () => {
    const currentFilters = buildNormalizedFiltersPayload(/** @type {MercatoFiltersFormData} */ (getValues()));

    // Validate city and radius
    if (!currentFilters.city?.value || !currentFilters.radius) {
      Alert.alert('Erreur', 'La ville et le rayon sont obligatoires pour créer une alerte');
      return;
    }

    if (editAlertMode) {
      // In edit mode, use the existing label initially
      setAlertLabel(initialAlertLabel);
    } else {
      // Auto-generate alert name based on type + city
      const cityName = currentFilters.city?.label || 'Recherche';
      const baseLabel = `Mercato · ${cityName}`;

      // Check for duplicates and add suffix if needed
      try {
        const existingAlerts = await getSearchAlerts();
        const alerts = existingAlerts.data || [];
        let duplicateCount = 0;

        alerts.forEach((/** @type {{ label?: string }} */ alert) => {
          if (alert.label === baseLabel || alert.label.startsWith(`${baseLabel} (`)) {
            duplicateCount++;
          }
        });

        const finalLabel = duplicateCount > 0 ? `${baseLabel} (${duplicateCount + 1})` : baseLabel;
        setAlertLabel(finalLabel);
      } catch (error) {
        console.error('Error checking duplicates:', error);
        setAlertLabel(baseLabel);
      }
    }

    // Show modal to confirm/edit alert name
    setIsSaveModalVisible(true);
    // Fetch preview count
    try {
      const result = await getPreviewCount(currentFilters, 'mercato');
      setPreviewCount(result.count);
    } catch (error) {
      console.error('Error fetching preview count:', error);
      setPreviewCount(null);
    }
  };

  const handleCreateAlert = async () => {
    if (!alertLabel.trim()) {
      Alert.alert('Erreur', 'Merci de saisir un nom pour l\'alerte');
      return;
    }

    setIsCreatingAlert(true);
    try {
      const filtersToSave = buildNormalizedFiltersPayload(/** @type {MercatoFiltersFormData} */ (getValues()));
      if (editAlertMode && alertDocumentId) {
        await updateSearchAlert(alertDocumentId, {
          filters: filtersToSave,
          isActive: true,
          label: alertLabel,
        });
        Alert.alert('Succès', 'Alerte modifiée avec succès');
      } else {
        await createSearchAlert({
          filters: filtersToSave,
          isActive: true,
          label: alertLabel,
          type: 'mercato',
        });
        Alert.alert('Succès', 'Alerte créée avec succès');
      }
      setIsSaveModalVisible(false);
      navigation.goBack();
    } catch (error) {
      console.error('Error saving alert:', error);
      Alert.alert('Erreur', 'Impossible d\'enregistrer l\'alerte');
    } finally {
      setIsCreatingAlert(false);
    }
  };

  /**
   * @param {string} title
   * @param {string} content
   */
  const openInfoModal = (title, content) => {
    setInfoModalContent({ content, title });
    setInfoModalVisible(true);
  };

  /**
   * @param {string} label
   * @param {string} infoKey
   */
  const renderLabel = (label, infoKey) => (
    <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8], Spaces.marginBottom[8]]}>
      <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{label}</Text>
      <Button
        onPress={() => openInfoModal(label, t(`mercatoFilters.infos.${infoKey}`, 'Information'))}
        style={{
          borderRadius: 15, height: 30, padding: 0, width: 30,
        }}
        title="?"
        variant="Secondary"
      />
    </View>
  );

  return (
    <ScreenContainer
      bgImage="bg2"
      // Retrait bas systeme deja applique au contenu ci-dessous : pas de plancher
      // conteneur, sinon insets.bottom serait compte deux fois.
      bottomInsetMode="edge-to-edge"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        Spaces.gap[24],
        Alignments.justifySpaceBetween,
        Alignments.column,
        Alignments.fill,
        { paddingBottom: insets.bottom },
      ]}
      {...WEB_FILTER_SURFACE_PROPS}
    >
      <BottomModal
        close={() => setInfoModalVisible(false)}
        isVisible={infoModalVisible}
      >
        <View style={[Spaces.gap[16], Spaces.paddingTop[16]]}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{infoModalContent.title}</Text>
          <Text style={[Fonts.p1, Fonts.neutral00]}>{infoModalContent.content}</Text>
        </View>
      </BottomModal>

      <BottomModal
        close={() => setIsSaveModalVisible(false)}
        isVisible={isSaveModalVisible}
      >
        <View style={[Spaces.gap[16]]}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
            {editAlertMode ? "Modifier l'alerte" : t('searchAlerts.create.title', 'Créer une alerte')}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            {t('searchAlerts.create.desc', 'Donne un nom à ta recherche pour recevoir des notifications.')}
          </Text>
          <Input
            onChangeText={setAlertLabel}
            placeholder={t('searchAlerts.create.placeholder', 'Ex: Attaquants U13')}
            value={alertLabel}
          />
          {previewCount !== null && (
          <Text style={[Fonts.p2, { color: Colors.primary500 }]}>
            Pour le moment,
            {' '}
            {previewCount}
            {' '}
            profil
            {previewCount > 1 ? 's' : ''}
            {' '}
            correspond
            {previewCount > 1 ? 'ent' : ''}
          </Text>
          )}
          <Button
            isLoading={isCreatingAlert}
            onPress={handleCreateAlert}
            title={t('common.save', 'Sauvegarder')}
            variant="Primary"
          />
        </View>
      </BottomModal>

      <ScrollView
        contentContainerStyle={[Spaces.gap[40]]}
        style={[Spaces.marginVertical[16]]}
      >
        <Controller
          control={control}
          name="city"
          render={({
            field: {
              onChange, value,
            },
          }) => (
            <AutocompleteAddressInput
              address={value && typeof value === 'object' ? value : undefined}
              error={getFieldError({ errors: formErrors, fieldName: 'address' })}
              label={t('clubFilters.fields.city.label')}
              placeholder={t('clubFilters.fields.city.placeholder')}
              setAddress={(nextValue) => onChange(nextValue)}
            />
          )}
        />

        <Controller
          control={control}
          name="radius"
          render={({
            field: { onChange, value },
          }) => (
            <View style={[Spaces.gap[8]]}>
              <Text style={[
                Fonts.p1Bold,
                Fonts.neutral00]}
              >
                {`${t('clubFilters.fields.radius.label')}${value}km`}
              </Text>
              <Slider
                disabled={!watch('city')?.value}
                maximumTrackTintColor={Colors.primary700}
                maximumValue={50}
                minimumTrackTintColor={Colors.primary500}
                minimumValue={20}
                onValueChange={(nextValue) => onChange(nextValue)}
                step={2}
                style={[Alignments.fullWidth, { height: 50 }]}
                thumbTintColor={Colors.primary500}
                value={Number(value || 20)}
              />
            </View>
          )}
        />

        <Controller
          control={control}
          name="activity"
          render={({
            field: { onChange, value },
          }) => (
            <View>
              {renderLabel('Sport', 'activity')}
              <AutocompleteSelect
                error={getFieldError({ errors: formErrors, fieldName: 'activity' })}
                isMulti
                isSearchable
                options={activities}
                placeholder="Ex: Football, Tennis..."
                searchValue={activitySearchValue}
                setSearchValue={setActivitySearchValue}
                setValue={(/** @type {Option | Option[] | undefined} */ option) => {
                  const val = Array.isArray(option)
                    ? option.map((o) => String(o.value))
                    : (option?.value ? [String(option.value)] : []);
                  onChange(val);
                  // Reset position when activity changes
                  setValue('position', []);
                }}
                value={Array.isArray(value) ? value : (value ? [String(value)] : [])}
              />
            </View>
          )}
        />

        <Controller
          control={control}
          name="category"
          render={({
            field: { onChange, value },
          }) => (
            <View>
              {renderLabel(t('eventFilters.fields.category.label', 'Catégorie'), 'category')}
              <AutocompleteSelect
                error={getFieldError({ errors: formErrors, fieldName: 'category' })}
                isMulti
                isSearchable
                options={categories}
                placeholder="Ex: U11, U13..."
                searchValue={categorySearchValue}
                setSearchValue={setCategorySearchValue}
                setValue={(/** @type {Option | Option[] | undefined} */ option) => {
                  const val = Array.isArray(option)
                    ? option.map((o) => String(o.value))
                    : (option?.value ? [String(option.value)] : []);
                  onChange(val);
                }}
                value={Array.isArray(value) ? value : (value ? [String(value)] : [])}
              />
            </View>
          )}
        />

        {/* Position Filter - Conditional */}
        {(selectedActivityIds && selectedActivityIds.length > 0) ? (
          <Controller
            control={control}
            name="position"
            render={({
              field: { onChange, value },
            }) => (
              <View>
                {renderLabel(t('profile.fields.position.label', 'Poste'), 'position')}
                {availablePositions.length > 0 ? (
                  <AutocompleteSelect
                        error={getFieldError({ errors: formErrors, fieldName: 'position' })}
                        isMulti
                        isSearchable
                        options={availablePositions}
                        placeholder="Ex: Attaquant, Gardien..."
                        searchValue={positionSearchValue}
                        setSearchValue={setPositionSearchValue}
                        setValue={(/** @type {Option | Option[] | undefined} */ option) => {
                          const val = Array.isArray(option)
                            ? option.map((o) => String(o.value))
                            : (option?.value ? [String(option.value)] : []);
                          onChange(val);
                        }}
                        value={Array.isArray(value) ? value : (value ? [String(value)] : [])}
                      />
                ) : (
                      <Input
                        onChangeText={(text) => onChange(text ? [text] : [])}
                        placeholder="Ex: Attaquant"
                        value={Array.isArray(value) ? (value[0] || '') : (value || '')}
                      />
                )}
              </View>
            )}
          />
        ) : null}

      </ScrollView>

      <View style={[Spaces.gap[24]]}>
        {isAlertMode ? (
          <>
            <Button
              onPress={() => navigation.goBack()}
              title="Annuler"
              variant="Secondary"
            />
            <Button
              onPress={handleSaveAlert}
              title={editAlertMode ? 'Enregistrer les modifications' : "Créer l'alerte ★"}
              variant="Primary"
            />
          </>
        ) : (
          <>
            <Button
              onPress={handleEmptyFilters}
              title={t('eventFilters.actions.clear')}
              variant="Secondary"
            />
            <Button
              onPress={handleSubmit(handleApplyFilters)}
              title={t('eventFilters.actions.apply')}
              variant="Primary"
            />
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

export default MercatoFilters;
