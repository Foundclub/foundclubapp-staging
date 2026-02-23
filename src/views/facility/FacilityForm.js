import { joiResolver } from '@hookform/resolvers/joi';
import { useNavigation, useRoute } from '@react-navigation/native';
import Joi from 'joi';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { createFacility, updateFacility } from '@/services/facility/facilityService';

const schema = Joi.object({
  address: Joi.alternatives().try(
    Joi.string().allow('').optional(),
    Joi.object().optional(),
  ),
  maxSlots: Joi.number().min(1).required().messages({
    'any.required': 'La capacite est requise',
    'number.min': 'La capacite doit etre d\'au moins 1',
  }),
  name: Joi.string().required().messages({
    'string.empty': 'Le nom est requis',
  }),
  type: Joi.string().required().messages({
    'string.empty': 'Le type est requis',
  }),
});

const FACILITY_TYPES = [
  { label: 'Terrain', value: 'Terrain' },
  { label: 'Gymnase', value: 'Gymnase' },
  { label: 'Salle video', value: 'Salle video' },
  { label: 'Vestiaire', value: 'Vestiaire' },
  { label: 'Club House', value: 'Club House' },
];

const getAddressLabel = (address) => {
  if (!address) return 'Adresse non renseignee';
  if (typeof address === 'string') return address;
  if (typeof address === 'object') {
    return address?.label || address?.description || 'Adresse non renseignee';
  }
  return 'Adresse non renseignee';
};

const getAddressCoordinates = (address) => {
  if (!address || typeof address !== 'object') return null;

  if (typeof address.value === 'string' && address.value.includes('|')) {
    const [lngValue, latValue] = address.value.split('|');
    const lng = Number(lngValue);
    const lat = Number(latValue);
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      return { lat, lng };
    }
  }

  const coordinates = address?.geometry?.coordinates;
  if (Array.isArray(coordinates) && coordinates.length >= 2) {
    const lng = Number(coordinates[0]);
    const lat = Number(coordinates[1]);
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      return { lat, lng };
    }
  }

  return null;
};

const normalizeAddressPayload = (address) => {
  const coordinates = getAddressCoordinates(address);
  if (!coordinates) return null;

  const description = typeof address === 'object'
    ? String(address?.label || address?.description || '').trim()
    : '';

  return {
    description: description || 'Adresse',
    geometry: {
      coordinates: [coordinates.lng, coordinates.lat],
      type: 'Point',
    },
  };
};

const getCapacityLabel = (value, t) => {
  const teams = Number(value || 1);
  const unit = teams > 1
    ? t('facilityForm.capacity.teamPlural', 'equipes simultanees')
    : t('facilityForm.capacity.teamSingular', 'equipe simultanee');
  return `${teams} ${unit}`;
};

/**
 * Facility create/update screen.
 * @returns {import('react').ReactElement}
 */
function FacilityForm() {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { userData } = useAuth();
  const facility = route.params?.facility;
  const isEdit = !!facility;

  const {
    clearErrors,
    control,
    formState: { errors },
    handleSubmit,
    setError,
    watch,
  } = useForm({
    defaultValues: {
      address: facility?.address || null,
      maxSlots: Number(facility?.maxSlots || 1),
      name: facility?.name || '',
      type: facility?.type || 'Terrain',
    },
    resolver: joiResolver(schema),
  });

  const [loading, setLoading] = useState(false);

  const watchedName = watch('name');
  const watchedType = watch('type');
  const watchedAddress = watch('address');
  const watchedMaxSlots = watch('maxSlots');

  const subtitle = useMemo(() => (
    isEdit
      ? t('facilityForm.subtitle.edit', 'Mettez a jour les informations de cette installation.')
      : t('facilityForm.subtitle.create', 'Configurez une nouvelle installation pour votre club.')
  ), [isEdit, t]);

  const handleSave = async (data) => {
    const clubId = route.params?.clubId || (userData?.club?.documentId || userData?.club?.id);
    const cmId = route.params?.cmId;

    if (!clubId && !cmId) {
      Alert.alert(
        t('common.error', 'Erreur'),
        t('facilityForm.errors.contextMissing', 'Impossible de recuperer les informations du club.'),
      );
      return;
    }

    const normalizedAddress = normalizeAddressPayload(data.address);
    if (!normalizedAddress) {
      setError('address', {
        message: t(
          'facilityForm.errors.addressGeocodeRequired',
          'Selectionnez une adresse geolocalisee dans la liste.',
        ),
        type: 'manual',
      });
      return;
    }
    clearErrors('address');

    const formattedData = {
      ...data,
      address: normalizedAddress,
    };

    setLoading(true);
    try {
      if (isEdit) {
        await updateFacility(facility.documentId, formattedData);
      } else if (clubId) {
        await createFacility({ ...formattedData, club: clubId });
      } else if (cmId) {
        await createFacility({ ...formattedData, multisportClub: cmId });
      } else {
        throw new Error('No clubId or cmId provided');
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        t('common.error', 'Erreur'),
        t('facilityForm.errors.saveFailed', 'Une erreur est survenue lors de l\'enregistrement.'),
      );
    } finally {
      setLoading(false);
    }
  };

  const renderMetaChip = (label, tone = 'primary') => {
    const chipStyleByTone = {
      neutral: {
        backgroundColor: Colors.neutral800,
        borderColor: Colors.neutral500,
        textColor: Colors.neutral200,
      },
      primary: {
        backgroundColor: `${Colors.primary500}1F`,
        borderColor: Colors.primary500,
        textColor: Colors.primary500,
      },
    };
    const chipStyle = chipStyleByTone[tone] || chipStyleByTone.primary;

    return (
      <View
        style={[
          ApplicationStyle.borderRadius12,
          Spaces.paddingHorizontal[8],
          Spaces.paddingVertical[4],
          {
            backgroundColor: chipStyle.backgroundColor,
            borderColor: chipStyle.borderColor,
            borderWidth: 1,
          },
        ]}
      >
        <Text style={[Fonts.p3Bold, { color: chipStyle.textColor }]}>
          {label}
        </Text>
      </View>
    );
  };

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        Alignments.fill,
      ]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        style={[Alignments.fill]}
      >
        <ScrollView
          contentContainerStyle={[Spaces.gap[16], Spaces.paddingBottom[40]]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[Spaces.gap[4], Spaces.marginBottom[8]]}>
            <Text style={[Fonts.h2Black, Fonts.neutral00]}>
              {isEdit
                ? t('facilityForm.title.edit', 'Modifier l\'installation')
                : t('facilityForm.title.create', 'Nouvelle installation')}
            </Text>
            <Text style={[Fonts.p2, Fonts.primary100]}>
              {subtitle}
            </Text>
          </View>

          <View
            style={[
              ApplicationStyle.backgroundColor.primary700,
              ApplicationStyle.borderRadius24,
              Spaces.padding[16],
              Spaces.gap[16],
              { borderColor: `${Colors.primary500}33`, borderWidth: 1 },
            ]}
          >
            <Text style={[Fonts.p2Bold, Fonts.primary200]}>
              {t('facilityForm.sections.identity', 'Identite')}
            </Text>

            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, value } }) => (
                <View style={[Spaces.gap[6]]}>
                  <Input
                    error={errors.name?.message}
                    label={t('facilityForm.fields.name', 'Nom de l\'installation')}
                    onChangeText={onChange}
                    placeholder={t('facilityForm.placeholders.name', 'Ex: Terrain Honneur, Salle A...')}
                    value={value}
                  />
                  {!errors.name?.message ? (
                    <Text style={[Fonts.p3, Fonts.neutral300]}>
                      {t(
                        'facilityForm.hints.name',
                        'Entrez un nom clair pour que les membres reconnaissent facilement cette installation.',
                      )}
                    </Text>
                  ) : null}
                </View>
              )}
            />

            <Controller
              control={control}
              name="type"
              render={({ field: { onChange, value } }) => (
                <View style={[Spaces.gap[8]]}>
                  <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                    {t('facilityForm.fields.type', 'Type')}
                  </Text>
                  <View style={[Alignments.row, Alignments.wrap, Spaces.gap[8]]}>
                    {FACILITY_TYPES.map((typeItem) => {
                      const isActive = value === typeItem.value;
                      return (
                        <Button
                          key={typeItem.value}
                          onPress={() => onChange(typeItem.value)}
                          size="small"
                          style={!isActive ? { borderColor: Colors.primary200 } : undefined}
                          textStyle={!isActive ? { color: Colors.primary200 } : undefined}
                          title={typeItem.label}
                          variant={isActive ? 'Primary' : 'SecondaryLight'}
                        />
                      );
                    })}
                  </View>
                  {errors.type?.message ? (
                    <Text style={[Fonts.p2, Fonts.error700]}>
                      {errors.type.message}
                    </Text>
                  ) : null}
                </View>
              )}
            />
          </View>

          <View
            style={[
              ApplicationStyle.backgroundColor.primary700,
              ApplicationStyle.borderRadius24,
              Spaces.padding[16],
              Spaces.gap[16],
              { borderColor: `${Colors.primary500}33`, borderWidth: 1 },
            ]}
          >
            <Text style={[Fonts.p2Bold, Fonts.primary200]}>
              {t('facilityForm.sections.location', 'Localisation et capacite')}
            </Text>

            <Controller
              control={control}
              name="address"
              render={({ field: { onChange, value } }) => (
                <View style={[Spaces.gap[6]]}>
                  <AutocompleteAddressInput
                    address={value}
                    error={errors.address?.message}
                    label={t('facilityForm.fields.address', 'Adresse (lieu exact)')}
                    placeholder={t('facilityForm.placeholders.address', 'Ex: 12 Rue du Stade...')}
                    setAddress={onChange}
                  />
                  {!errors.address?.message ? (
                    <Text style={[Fonts.p3, Fonts.neutral300]}>
                      {t(
                        'facilityForm.hints.addressSelection',
                        'Selectionnez une adresse dans la liste pour activer le GPS.',
                      )}
                    </Text>
                  ) : null}
                </View>
              )}
            />

            <Controller
              control={control}
              name="maxSlots"
              render={({ field: { onChange, value } }) => {
                const safeValue = Number(value || 1);
                return (
                  <View style={[Spaces.gap[8]]}>
                    <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                      {t('facilityForm.fields.capacity', 'Capacite (equipes simultanees)')}
                    </Text>
                    <View
                      style={[
                        Alignments.row,
                        Alignments.alignCenter,
                        Alignments.justifySpaceBetween,
                        ApplicationStyle.backgroundColor.primary900,
                        ApplicationStyle.borderRadius16,
                        Spaces.padding[12],
                        { borderColor: `${Colors.primary500}55`, borderWidth: 1 },
                      ]}
                    >
                      <Button
                        onPress={() => onChange(Math.max(1, safeValue - 1))}
                        size="small"
                        title="-"
                        variant="Secondary"
                      />
                      <Text style={[Fonts.h3Black, Fonts.neutral00]}>
                        {safeValue}
                      </Text>
                      <Button
                        onPress={() => onChange(Math.min(10, safeValue + 1))}
                        size="small"
                        title="+"
                        variant="Secondary"
                      />
                    </View>
                    {errors.maxSlots?.message ? (
                      <Text style={[Fonts.p2, Fonts.error700]}>
                        {errors.maxSlots.message}
                      </Text>
                    ) : null}
                  </View>
                );
              }}
            />
          </View>

          <View
            style={[
              ApplicationStyle.backgroundColor.primary700,
              ApplicationStyle.borderRadius24,
              Spaces.padding[16],
              Spaces.gap[12],
              { borderColor: `${Colors.primary200}66`, borderWidth: 1 },
            ]}
          >
            <Text style={[Fonts.p2Bold, Fonts.primary200]}>
              {t('facilityForm.sections.preview', 'Apercu')}
            </Text>

            <Text style={[Fonts.h4Black, Fonts.neutral00]}>
              {watchedName?.trim() || t('facilityForm.defaults.name', 'Nom de l\'installation')}
            </Text>

            <View style={[Alignments.row, Alignments.wrap, Spaces.gap[8]]}>
              {renderMetaChip(getCapacityLabel(watchedMaxSlots, t), 'primary')}
              {renderMetaChip(watchedType || t('facilityForm.defaults.type', 'Type inconnu'), 'neutral')}
            </View>

            <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
              <Image
                source={Images.pin}
                style={[
                  ApplicationStyle.icon16,
                  ApplicationStyle.tintColor.primary200,
                  { marginTop: 1 },
                ]}
              />
              <Text numberOfLines={2} style={[Fonts.p2, Fonts.primary100, { flex: 1 }]}>
                {getAddressLabel(watchedAddress)}
              </Text>
            </View>
          </View>

          <View style={[Spaces.gap[8], Spaces.marginTop[8]]}>
            <Button
              isLoading={loading}
              onPress={handleSubmit(handleSave)}
              title={isEdit
                ? t('facilityForm.actions.save', 'Enregistrer')
                : t('facilityForm.actions.create', 'Creer')}
              variant="Primary"
            />
            <Button
              onPress={() => navigation.goBack()}
              title={t('common.cancel', 'Annuler')}
              variant="Secondary"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

export default FacilityForm;
