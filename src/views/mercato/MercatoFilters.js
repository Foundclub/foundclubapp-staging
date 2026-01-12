import { joiResolver } from '@hookform/resolvers/joi';
import Slider from '@react-native-community/slider';
import React, { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
    ScrollView, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import usePlaces from '@/domains/places/usePlaces';
import { useAppContext } from '@/store/appContext';
import { Joi } from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ScreenContainer from '@/components/templates/ScreenContainer';
import Input from '@/components/molecules/input/Input';

import { useGetActivities } from '@/services/activity/activityQueries';
import { useGetSections } from '@/services/section/sectionQueries';
import { getFieldError } from '@/utils/form/formUtils';
import { SPORTS_POSITIONS } from '@/constants/sportsPositions';

import { createSearchAlert } from '@/services/searchAlert/searchAlertService';
import { RouteNames } from '@/navigation/routeNames';

const filtersSchema = Joi.object({
    activity: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).allow(''),
    category: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).allow(''),
    city: Joi.object().allow(''),
    radius: Joi.number().allow(''),
    position: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).allow(''),
});

function MercatoFilters({ navigation }) {
    // local states
    const [activitySearchValue, setActivitySearchValue] = useState('');
    const [categorySearchValue, setCategorySearchValue] = useState('');
    const [positionSearchValue, setPositionSearchValue] = useState('');
    const [infoModalVisible, setInfoModalVisible] = useState(false);
    const [infoModalContent, setInfoModalContent] = useState({ title: '', content: '' });

    // Alert State
    const [isSaveModalVisible, setIsSaveModalVisible] = useState(false);
    const [alertLabel, setAlertLabel] = useState('');
    const [isCreatingAlert, setIsCreatingAlert] = useState(false);

    // hooks
    const { t } = useTranslation();
    const {
        Alignments, Colors, Fonts, Spaces,
    } = useTheme();
    const [{ mercatoFilters }, appDispatch] = useAppContext();
    const { getGeohashForPointAndRadius } = usePlaces();
    const insets = useSafeAreaInsets();

    const {
        control,
        formState: { errors: formErrors },
        handleSubmit,
        watch,
        setValue,
        getValues,
    } = useForm({
        defaultValues: {
            activity: mercatoFilters?.activity || [],
            category: mercatoFilters?.category || [],
            city: mercatoFilters?.city || { label: '', value: '' },
            radius: mercatoFilters?.radius || 20,
            position: mercatoFilters?.position || [],
        },
        mode: 'onBlur',
        resolver: joiResolver(filtersSchema),
    });

    // Header Star Button
    React.useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <View style={{ marginRight: 16 }}>
                    <TouchableOpacity
                        onPress={() => setIsSaveModalVisible(true)}
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Text style={{ color: Colors.primary500, fontSize: 24 }}>★</Text>
                    </TouchableOpacity>
                </View>
            ),
        });
    }, [navigation, Colors]);

    const handleCreateAlert = async () => {
        if (!alertLabel.trim()) return;
        setIsCreatingAlert(true);
        try {
            // Get current form values to save as filters
            const currentFilters = getValues();
            await createSearchAlert({
                label: alertLabel,
                filters: currentFilters,
            });
            setIsSaveModalVisible(false);
            setAlertLabel('');
            // Show success feedback (Toast or Alert)
            // For now, navigate to Alerts list as feedback
            navigation.navigate(RouteNames.SearchAlerts);
        } catch (err) {
            console.error(err);
        } finally {
            setIsCreatingAlert(false);
        }
    };

    const { data: allActivities } = useGetActivities();
    const { data: allSections } = useGetSections();

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

        const positions = new Set();
        selectedNames.forEach((name) => {
            // Find key case-insensitive
            const key = Object.keys(SPORTS_POSITIONS).find((k) => k.toLowerCase() === name.toLowerCase());
            if (key) {
                SPORTS_POSITIONS[key].forEach((p) => positions.add(p));
            }
        });

        return Array.from(positions).map((p) => ({ label: p, value: p }));
    }, [selectedActivityIds, allActivities]);



    const handleApplyFilters = (data) => {
        // format place params
        const coordinates = data.city?.value?.split('|');
        const geohash = (coordinates && data.city?.value) ? getGeohashForPointAndRadius(
            parseFloat(coordinates[1]),
            parseFloat(coordinates[0]),
            data.radius,
        ) : undefined;

        const payload = {
            ...data,
            ...(geohash && { geohash }),
        };

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

    const openInfoModal = (title, content) => {
        setInfoModalContent({ title, content });
        setInfoModalVisible(true);
    };

    const renderLabel = (label, infoKey) => (
        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8], Spaces.marginBottom[8]]}>
            <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{label}</Text>
            <Button
                onPress={() => openInfoModal(label, t(`mercatoFilters.infos.${infoKey}`, 'Information'))}
                style={{ width: 30, height: 30, padding: 0, borderRadius: 15 }}
                title="?"
                variant="Secondary"
            />
        </View>
    );

    return (
        <ScreenContainer
            bgImage="bg2"
            contentContainerStyle={[
                Spaces.paddingVertical[24],
                Spaces.gap[24],
                Alignments.justifySpaceBetween,
                Alignments.column,
                Alignments.fill,
                { paddingBottom: insets.bottom },
            ]}
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
                    <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{t('searchAlerts.create.title', 'Créer une alerte')}</Text>
                    <Text style={[Fonts.p1, Fonts.neutral00]}>
                        {t('searchAlerts.create.desc', 'Donnez un nom à votre recherche pour recevoir des notifications.')}
                    </Text>
                    <Input
                        onChangeText={setAlertLabel}
                        placeholder={t('searchAlerts.create.placeholder', 'Ex: Attaquants U13')}
                        value={alertLabel}
                    />
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
                            address={value}
                            error={getFieldError({ errors: formErrors, fieldName: 'address' })}
                            label={t('clubFilters.fields.city.label')}
                            placeholder={t('clubFilters.fields.city.placeholder')}
                            setAddress={onChange}
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
                                onValueChange={onChange}
                                step={2}
                                style={[Alignments.fullWidth, { height: 50 }]}
                                tapToSeek
                                thumbTintColor={Colors.primary500}
                                value={value}
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
                                setValue={(/** @type {Option | undefined} */option) => {
                                    const val = Array.isArray(option) ? option.map((o) => o.value) : option?.value || '';
                                    onChange(val);
                                    // Reset position when activity changes
                                    setValue('position', []);
                                }}
                                value={value}
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
                                setValue={(/** @type {Option | undefined} */option) => {
                                    const val = Array.isArray(option) ? option.map((o) => o.value) : option?.value || '';
                                    onChange(val);
                                }}
                                value={value}
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
                                        setValue={(/** @type {Option | undefined} */option) => {
                                            const val = Array.isArray(option) ? option.map((o) => o.value) : option?.value || '';
                                            onChange(val);
                                        }}
                                        value={value}
                                    />
                                ) : (
                                    <Input
                                        onChangeText={onChange}
                                        placeholder="Ex: Attaquant"
                                        value={value}
                                    />
                                )}
                            </View>
                        )}
                    />
                ) : null}



            </ScrollView>

            <View style={[Spaces.gap[24]]}>
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
            </View>
        </ScreenContainer>
    );
}

export default MercatoFilters;
