import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Alert, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { joiResolver } from '@hookform/resolvers/joi';
import Joi from 'joi';
import Slider from '@react-native-community/slider';

import useTheme from '@/theme/themeContext';
import ScreenContainer from '@/components/templates/ScreenContainer';
import Input from '@/components/molecules/input/Input';
import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import { useGetLeagueTeam } from '@/services/leagueTeam/leagueTeamQueries';
import { updateLeagueTeam } from '@/services/leagueTeam/leagueTeamService';
import { useGetActivities } from '@/services/activity/activityQueries';
import { useGetCategories } from '@/services/category/categoryQueries';
import { buildHomeBasePayload, normalizeLocationInput } from '@/utils/location';

const schema = Joi.object({
  name: Joi.string().required().min(3).label('Nom'),
  address: Joi.object().allow(null).optional().label('Adresse'),
  division: Joi.number().optional().allow(null, '').label('Division'), 
  elo: Joi.number().optional().allow(null, '').label('ELO'),
  sport: Joi.string().required().label('Sport'),
  section: Joi.string().valid('Male', 'Female', 'Mixed').required().label('Section'),
  category: Joi.string().optional().allow('', null).label('Catégorie'),
  radius: Joi.number().min(5).max(100).default(20).label('Rayon'),
});

/**
 * @param {{ navigation: any, route: { params?: { teamId?: string } } }} props
 */
const SquadEditScreen = ({ navigation, route }) => {
  const { teamId } = route.params || {};
  const safeTeamId = String(teamId || '');
  const { Colors, Fonts, Spaces, Alignments } = useTheme();
  const { t } = useTranslation();

  const { data: team, isLoading } = useGetLeagueTeam(safeTeamId);
  const { data: allActivities } = useGetActivities();
  const { data: allCategories } = useGetCategories();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sportSearchValue, setSportSearchValue] = useState('');
  const [categorySearchValue, setCategorySearchValue] = useState('');

  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm({
    resolver: joiResolver(schema),
    defaultValues: {
      name: '',
      address: null,
      division: '',
      elo: '',
      sport: 'Football',
      section: 'Male',
      category: 'Senior',
      radius: 20
    }
  });

  const radiusValue = watch('radius');

  // Format Activities for AutocompleteSelect
  const activities = useMemo(() => {
    const formatted = allActivities
      ?.filter((/** @type {any} */ a) => a.isLeague === true)
      ?.map(({ name }) => ({
        label: name,
        value: name,
      })) || [];

    if (sportSearchValue) {
      return formatted.filter(a => a.label.toLowerCase().includes(sportSearchValue.toLowerCase()));
    }
    return formatted;
  }, [allActivities, sportSearchValue]);

  // Format Categories for AutocompleteSelect
  const categories = useMemo(() => {
    const formatted = allCategories?.map(({ name }) => ({
      label: name,
      value: name,
    })) || [];

    if (categorySearchValue) {
      return formatted.filter(c => c.label.toLowerCase().includes(categorySearchValue.toLowerCase()));
    }
    return formatted;
  }, [allCategories, categorySearchValue]);

  const sections = useMemo(() => [
    { label: 'Masculin', value: 'Male' },
    { label: 'Féminin', value: 'Female' },
    { label: 'Mixte', value: 'Mixed' },
  ], []);

  useEffect(() => {
    navigation.setOptions({
        headerTitle: 'Éditer la Squad',
    });
  }, [navigation]);

  useEffect(() => {
    if (team) {
      const normalizedHomeBase = normalizeLocationInput(team.home_base);
      reset({
        name: team.name || '',
        address: /** @type {any} */ (normalizedHomeBase || null),
        division: team.division ? String(team.division) : '',
        elo: team.elo ? String(team.elo) : '',
        sport: team.sport || 'Football',
        section: team.section || 'Male',
        category: team.category || 'Senior',
        radius: normalizedHomeBase?.radius || 20
      });
    }
  }, [team, reset]);

  const onSubmit = async (/** @type {Record<string, any>} */ data) => {
    try {
      setIsSubmitting(true);

      const homeBasePayload = buildHomeBasePayload(data.address, data.radius);
      if (!homeBasePayload) {
        Alert.alert('Adresse invalide', 'Selectionnez une adresse avec des coordonnees valides.');
        return;
      }

      await updateLeagueTeam(/** @type {any} */ ({
        documentId: teamId,
        name: data.name,
        home_base: homeBasePayload,
        sport: data.sport,
        section: data.section,
        category: data.category
      }));
      Alert.alert('Succès', 'Squad mise à jour');
      navigation.goBack();
    } catch (e) {
      console.error(e);
      Alert.alert('Erreur', 'Impossible de mettre à jour la squad');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenContainer bgImage="bg2">
       <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
       >
      <ScrollView contentContainerStyle={[Spaces.paddingVertical[16], Spaces.paddingHorizontal[4], Spaces.gap[24], Spaces.paddingBottom[40]]}>
        
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Nom de la Squad"
              placeholder="Ex: Les Invincibles"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              error={errors.name?.message}
            />
          )}
        />

        <View style={[Alignments.row, Spaces.gap[16]]}>
            <View style={{ flex: 1 }}>
                <Controller
                    control={control}
                    name="sport"
                    render={({ field: { onChange, value } }) => (
                        <AutocompleteSelect
                            label="Sport"
                            placeholder="Sélectionner"
                            options={activities}
                            value={value}
                            setValue={(/** @type {{value?: string} | null} */ option) => onChange(option ? option.value : undefined)}
                            searchValue={sportSearchValue}
                            setSearchValue={setSportSearchValue}
                            error={errors.sport?.message}
                            disabled={true}
                        />
                    )}
                />
            </View>
            <View style={{ flex: 1 }}>
                <Controller
                    control={control}
                    name="section"
                    render={({ field: { onChange, value } }) => (
                        <AutocompleteSelect
                            label="Section"
                            placeholder="Sélectionner"
                            options={sections}
                            value={sections.find(s => s.value === value)?.label || value}
                            setValue={(/** @type {{value?: string} | null} */ option) => onChange(option ? option.value : undefined)}
                            isSearchable={false}
                            error={errors.section?.message}
                        />
                    )}
                />
            </View>
        </View>

        <Controller
          control={control}
          name="category"
          render={({ field: { onChange, value } }) => (
            <AutocompleteSelect
                label="Catégorie"
                placeholder="Ex: Senior"
                options={categories}
                value={value}
                setValue={(/** @type {{value?: string} | null} */ option) => onChange(option ? option.value : undefined)}
                searchValue={categorySearchValue}
                setSearchValue={setCategorySearchValue}
                isSearchable={true}
                error={errors.category?.message}
            />
          )}
        />

        <Controller
            control={control}
            name="address"
            render={({ field: { onChange, value } }) => (
                <AutocompleteAddressInput
                    label="QG (Adresse principale)"
                    placeholder="Rechercher une adresse"
                    address={/** @type {any} */ (value || undefined)}
                    setAddress={onChange}
                />
            )}
        />

        <View>
            <View style={[Alignments.row, Alignments.justifySpaceBetween, Spaces.marginBottom[8]]}>
                <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>Rayon de déplacement</Text>
                <Text style={[Fonts.p1Bold, { color: Colors.primary500 }]}>{radiusValue} km</Text>
            </View>
            <Controller
                control={control}
                name="radius"
                render={({ field: { onChange, value } }) => (
                    <Slider
                        style={{ width: '100%', height: 40 }}
                        minimumValue={5}
                        maximumValue={100}
                        step={5}
                        value={value}
                        onValueChange={onChange}
                        minimumTrackTintColor={Colors.primary500}
                        maximumTrackTintColor={Colors.neutral500}
                        thumbTintColor={Colors.primary500}
                    />
                )}
            />
            <Text style={[Fonts.p3, { color: Colors.neutral500 }]}>Distance max pour vos matchs a l'extérieur</Text>
        </View>
        
        <View style={{ marginTop: 24 }}>
            <Button
                title="Enregistrer"
                onPress={handleSubmit(onSubmit)}
                isLoading={isSubmitting || isLoading}
                disabled={isSubmitting}
                variant="Primary"
            />
        </View>

        <View style={{ marginTop: 12 }}>
             <Button
                title="Annuler"
                variant="Secondary"
                onPress={() => navigation.goBack()}
            />
        </View>

      </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
};

export default SquadEditScreen;
