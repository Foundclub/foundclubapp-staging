import { joiResolver } from '@hookform/resolvers/joi';
import Slider from '@react-native-community/slider';
import Joi from 'joi';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import Input from '@/components/molecules/input/Input';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import ScreenContainer from '@/components/templates/ScreenContainer';
import LeagueStateView from '@/views/league/components/LeagueStateView';

import { RouteNames } from '@/navigation/routeNames';

import { useGetActivities } from '@/services/activity/activityQueries';
import { useGetLeagueTeam } from '@/services/leagueTeam/leagueTeamQueries';
import { updateLeagueTeam } from '@/services/leagueTeam/leagueTeamService';

import { buildHomeBasePayload, normalizeLocationInput } from '@/utils/location';

const schema = Joi.object({
  address: Joi.object().allow(null).optional().label('Adresse'),
  category: Joi.string().optional().allow('', null).label('Catégorie'),
  division: Joi.number().optional().allow(null, '').label('Division'),
  elo: Joi.number().optional().allow(null, '').label('ELO matchmaking'),
  name: Joi.string().required().min(3).label('Nom'),
  radius: Joi.number().min(5).max(100).default(20)
    .label('Rayon'),
  section: Joi.string().valid('Male', 'Female', 'Mixed').required().label('Section'),
  sport: Joi.string().required().label('Sport'),
});

/**
 * @param {{ navigation: any, route: { params?: { teamId?: string } } }} props
 */
function SquadEditScreen({ navigation, route }) {
  const { teamId } = route.params || {};
  const safeTeamId = String(teamId || '');
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();

  const {
    data: team,
    error: teamError,
    isLoading: isTeamLoading,
    refetch: refetchTeam,
  } = useGetLeagueTeam(safeTeamId);
  const {
    data: allActivities,
    error: activitiesError,
    isLoading: activitiesLoading,
    refetch: refetchActivities,
  } = useGetActivities();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sportSearchValue, setSportSearchValue] = useState('');

  const {
    control, formState: { errors }, handleSubmit, reset, watch,
  } = useForm({
    defaultValues: {
      address: null,
      category: 'Senior',
      division: '',
      elo: '',
      name: '',
      radius: 20,
      section: 'Male',
      sport: 'Football',
    },
    resolver: joiResolver(schema),
  });

  const radiusValue = watch('radius');
  const setupError = teamError || activitiesError;
  const isBootstrapping = isTeamLoading || activitiesLoading;
  const missingTeam = Boolean(safeTeamId) && !isTeamLoading && !teamError && !team;

  // Format Activities for AutocompleteSelect
  const activities = useMemo(() => {
    const formatted = allActivities
      ?.filter((/** @type {any} */ a) => a.isLeague === true)
      ?.map(({ name }) => ({
        label: name,
        value: name,
      })) || [];

    if (sportSearchValue) {
      return formatted.filter((a) => a.label.toLowerCase().includes(sportSearchValue.toLowerCase()));
    }
    return formatted;
  }, [allActivities, sportSearchValue]);

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
        address: /** @type {any} */ (normalizedHomeBase || null),
        category: 'Senior',
        division: team.division ? String(team.division) : '',
        elo: team.elo ? String(team.elo) : '',
        name: team.name || '',
        radius: normalizedHomeBase?.radius || 20,
        section: team.section || 'Male',
        sport: team.sport || 'Football',
      });
    }
  }, [team, reset]);

  const onSubmit = async (/** @type {Record<string, any>} */ data) => {
    try {
      setIsSubmitting(true);

      const homeBasePayload = buildHomeBasePayload(data.address, data.radius);
      if (!homeBasePayload) {
        Alert.alert('Adresse invalide', 'Sélectionnez une adresse avec des coordonnées valides.');
        return;
      }

      await updateLeagueTeam(/** @type {any} */ ({
        category: 'Senior',
        documentId: teamId,
        home_base: homeBasePayload,
        name: data.name,
        section: data.section,
        sport: data.sport,
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

  if (!safeTeamId) {
    return (
      <LeagueStateView
        actionLabel="Retour aux squads"
        description="Aucune squad n'est associee a ce lien d'edition."
        onAction={() => navigation.navigate(RouteNames.LeagueSquadTab)}
        title="Squad introuvable"
      />
    );
  }

  if (isBootstrapping) {
    return (
      <LeagueStateView
        description="Preparation du formulaire d'edition de la squad."
        isLoading
        title="Chargement de la squad"
      />
    );
  }

  if (setupError) {
    return (
      <LeagueStateView
        actionLabel="Recharger"
        description={setupError?.message || 'Impossible de charger cette squad pour le moment.'}
        onAction={() => {
          refetchTeam();
          refetchActivities();
        }}
        title="Chargement impossible"
      />
    );
  }

  if (missingTeam) {
    return (
      <LeagueStateView
        actionLabel="Retour aux squads"
        description="Cette squad n'existe plus ou n'est pas accessible depuis ce lien."
        onAction={() => navigation.navigate(RouteNames.LeagueSquadTab)}
        title="Squad introuvable"
      />
    );
  }

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
            render={({ field: { onBlur, onChange, value } }) => (
              <Input
                error={errors.name?.message}
                label="Nom de la Squad"
                onBlur={onBlur}
                onChangeText={onChange}
                placeholder="Ex: Les Invincibles"
                value={value}
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
                    disabled
                    error={errors.sport?.message}
                    label="Sport"
                    options={activities}
                    placeholder="Sélectionner"
                    searchValue={sportSearchValue}
                    setSearchValue={setSportSearchValue}
                    setValue={(/** @type {{value?: string} | null} */ option) => onChange(option ? option.value : undefined)}
                    value={value}
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
                    error={errors.section?.message}
                    isSearchable={false}
                    label="Section"
                    options={sections}
                    placeholder="Sélectionner"
                    setValue={(/** @type {{value?: string} | null} */ option) => onChange(option ? option.value : undefined)}
                    value={sections.find((s) => s.value === value)?.label || value}
                  />
                )}
              />
            </View>
          </View>

          <View
            style={{
              backgroundColor: 'rgba(250, 204, 21, 0.10)',
              borderColor: 'rgba(250, 204, 21, 0.38)',
              borderRadius: 16,
              borderWidth: 1,
              padding: 14,
            }}
          >
            <Text style={[Fonts.p3Bold, { color: Colors.gold500, marginBottom: 4 }]}>Catégorie</Text>
            <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>Senior</Text>
            <Text style={[Fonts.p3, { color: Colors.neutral300, marginTop: 6 }]}>
              FoundClub League est réservé aux squads Senior.
            </Text>
          </View>

          <Controller
            control={control}
            name="address"
            render={({ field: { onChange, value } }) => (
              <AutocompleteAddressInput
                address={/** @type {any} */ (value || undefined)}
                label="QG (Adresse principale)"
                placeholder="Rechercher une adresse"
                setAddress={onChange}
              />
            )}
          />

          <View>
            <View style={[Alignments.row, Alignments.justifySpaceBetween, Spaces.marginBottom[8]]}>
              <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>Rayon de déplacement</Text>
              <Text style={[Fonts.p1Bold, { color: Colors.gold500 }]}>
                {radiusValue}
                {' '}
                km
              </Text>
            </View>
            <Controller
              control={control}
              name="radius"
              render={({ field: { onChange, value } }) => (
                <Slider
                  maximumTrackTintColor={Colors.neutral500}
                  maximumValue={100}
                  minimumTrackTintColor={Colors.primary500}
                  minimumValue={5}
                  onValueChange={onChange}
                  step={5}
                  style={{ height: 40, width: '100%' }}
                  thumbTintColor={Colors.primary500}
                  value={value}
                />
              )}
            />
            <Text style={[Fonts.p3, { color: Colors.neutral500 }]}>
              {'Distance max pour vos matchs à l\'extérieur'}
            </Text>
          </View>

          <View style={{ marginTop: 24 }}>
            <Button
              disabled={isSubmitting}
              isLoading={isSubmitting || isBootstrapping}
              onPress={handleSubmit(onSubmit)}
              title="Enregistrer"
              variant="Primary"
            />
          </View>

          <View style={{ marginTop: 12 }}>
            <Button
              onPress={() => navigation.goBack()}
              title="Annuler"
              variant="Secondary"
            />
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

export default SquadEditScreen;
