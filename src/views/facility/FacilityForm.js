import { joiResolver } from '@hookform/resolvers/joi';
import { useNavigation, useRoute } from '@react-navigation/native';
import Joi from 'joi';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { extractSubscriptionDecisionFromError } from '@/domains/subscription/subscriptionDecision';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import Loader from '@/components/atoms/loader/Loader';
import Input from '@/components/molecules/input/Input';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import SubscriptionPaywallSheet
  from '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetFacility } from '@/services/facility/facilityQueries';
import { createFacility, updateFacility } from '@/services/facility/facilityService';

import {
  FACILITY_CONFLICT_MODES,
  getFacilityConflictMode,
} from '@/utils/facilityConflictMode';
import {
  FACILITY_PLANNING_PALETTE,
  isValidFacilityPlanningColor,
  resolveFacilityPlanningColor,
} from '@/utils/facilityPlanningColor';

const schema = Joi.object({
  address: Joi.alternatives().try(
    Joi.string().allow('').optional(),
    Joi.object().optional(),
  ),
  capacityConflictMode: Joi.string().valid(
    FACILITY_CONFLICT_MODES.PENDING_VALIDATION,
    FACILITY_CONFLICT_MODES.ALLOW_AND_NOTIFY,
  ).required(),
  maxSlots: Joi.number().min(1).required().messages({
    'any.required': 'La capacité est requise',
    'number.min': 'La capacité doit être d\'au moins 1',
  }),
  name: Joi.string().required().messages({
    'string.empty': 'Le nom est requis',
  }),
  planningColor: Joi.string().valid(...FACILITY_PLANNING_PALETTE).required().messages({
    'any.only': 'Sélectionne une couleur validé',
    'string.empty': 'Sélectionne une couleur',
  }),
  type: Joi.string().required().messages({
    'string.empty': 'Le type est requis',
  }),
});

const FACILITY_TYPES = [
  { label: 'Terrain', value: 'Terrain' },
  { label: 'Gymnase', value: 'Gymnase' },
  { label: 'Salle vidéo', value: 'Salle vidéo' },
  { label: 'Vestiaire', value: 'Vestiaire' },
  { label: 'Club House', value: 'Club House' },
];

const getAddressLabel = (address) => {
  if (!address) return 'Adresse non renseignée';
  if (typeof address === 'string') return address;
  if (typeof address === 'object') {
    return address?.label || address?.description || 'Adresse non renseignée';
  }
  return 'Adresse non renseignée';
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
    ? t('facilityForm.capacity.teamPlural', 'équipes simultanées')
    : t('facilityForm.capacity.teamSingular', 'équipe simultanée');
  return `${teams} ${unit}`;
};

const sanitizeRouteParam = (value) => {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue || normalizedValue.startsWith(':')) {
    return null;
  }

  return normalizedValue;
};

// L'ordre est celui du controle segmente. Les VALEURS sont le contrat avec le
// serveur (`capacityConflictMode`) : seule leur presentation change ici.
const FACILITY_CONFLICT_MODE_OPTIONS = [
  {
    descriptionFallback: 'Le créneau passe en demande, un dirigeant valide avant confirmation.',
    descriptionKey: 'facilityForm.conflictModes.pending.description',
    labelFallback: 'Demande en attente',
    labelKey: 'facilityForm.conflictModes.pending.label',
    value: FACILITY_CONFLICT_MODES.PENDING_VALIDATION,
  },
  {
    descriptionFallback: 'Le créneau reste confirmé, les dirigeants sont notifiés.',
    descriptionKey: 'facilityForm.conflictModes.allow.description',
    labelFallback: 'Autoriser et notifier',
    labelKey: 'facilityForm.conflictModes.allow.label',
    value: FACILITY_CONFLICT_MODES.ALLOW_AND_NOTIFY,
  },
];

/**
 * Option de conflit correspondant a une valeur, avec repli sur la premiere.
 * Une seule source pour le controle segmente ET la puce de l'apercu.
 * @param {string | undefined | null} value
 * @returns {typeof FACILITY_CONFLICT_MODE_OPTIONS[0]}
 */
const getConflictModeOption = (value) => (
  FACILITY_CONFLICT_MODE_OPTIONS.find((option) => option.value === value)
  || FACILITY_CONFLICT_MODE_OPTIONS[0]
);

// Increment de capacite : carre de 30, assez large pour le pouce grace au
// hitSlop du bouton, assez court pour tenir sur la meme ligne que le libelle.
const STEPPER_BUTTON_STYLE = {
  borderRadius: 10,
  height: 30,
  paddingHorizontal: 0,
  width: 30,
};

const STEPPER_VALUE_STYLE = {
  minWidth: 24,
  textAlign: /** @type {const} */ ('center'),
};

// 10 pastilles sur UNE ligne : 24 px est le plus grand diametre qui tienne sur
// un ecran de 360 px une fois retires les marges et le liseret de selection.
const PLANNING_SWATCH_STYLE = {
  alignItems: /** @type {const} */ ('center'),
  borderRadius: 999,
  height: 24,
  justifyContent: /** @type {const} */ ('center'),
  width: 24,
};

const PLANNING_SWATCH_DOT_STYLE = {
  borderRadius: 999,
  height: 8,
  width: 8,
};

const TYPE_CHIP_STYLE = {
  height: 32,
  paddingHorizontal: 12,
};

const PREVIEW_DOT_STYLE = {
  borderRadius: 999,
  height: 10,
  width: 10,
};

/** @type {{ address: any, capacityConflictMode: string, maxSlots: number, name: string, planningColor: string, type: string }} */
const DEFAULT_FORM_VALUES = {
  address: null,
  capacityConflictMode: FACILITY_CONFLICT_MODES.PENDING_VALIDATION,
  maxSlots: 1,
  name: '',
  planningColor: FACILITY_PLANNING_PALETTE[0],
  type: 'Terrain',
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
  const routedFacility = route.params?.facility || null;
  const routedFacilityId = sanitizeRouteParam(route.params?.facilityId);
  const {
    data: fetchedFacility,
    error: facilityError,
    isLoading: facilityLoading,
    refetch: refetchFacility,
  } = useGetFacility(routedFacilityId, {
    enabled: Boolean(routedFacilityId && !routedFacility),
  });
  const facility = routedFacility || fetchedFacility || null;
  const isEdit = Boolean(routedFacilityId || facility?.documentId || facility?.id);
  const contextClubId = route.params?.clubId
    || facility?.club?.documentId
    || facility?.club?.id
    || userData?.club?.documentId
    || userData?.club?.id
    || null;
  const contextCmId = route.params?.cmId
    || facility?.multisportClub?.documentId
    || facility?.multisportClub?.id
    || null;

  const {
    clearErrors,
    control,
    formState: { errors },
    handleSubmit,
    reset,
    setError,
    watch,
  } = useForm({
    defaultValues: DEFAULT_FORM_VALUES,
    resolver: joiResolver(schema),
  });

  const [loading, setLoading] = useState(false);
  const [subscriptionPaywallDecision, setSubscriptionPaywallDecision] = useState(null);

  const watchedName = watch('name');
  const watchedType = watch('type');
  const watchedAddress = watch('address');
  const watchedMaxSlots = watch('maxSlots');
  const watchedPlanningColor = watch('planningColor');
  const watchedCapacityConflictMode = watch('capacityConflictMode');
  const isMissingCreateContext = !isEdit && !contextClubId && !contextCmId;
  const isFacilityNotFound = isEdit && !facilityLoading && !facilityError && !facility;

  useEffect(() => {
    if (facility) {
      reset({
        ...DEFAULT_FORM_VALUES,
        address: facility?.address || null,
        capacityConflictMode: String(getFacilityConflictMode(facility) || FACILITY_CONFLICT_MODES.PENDING_VALIDATION),
        maxSlots: Number(facility?.maxSlots || 1),
        name: facility?.name || '',
        planningColor: resolveFacilityPlanningColor(facility) || FACILITY_PLANNING_PALETTE[0],
        type: facility?.type || 'Terrain',
      });
      return;
    }

    if (!isEdit) {
      reset(DEFAULT_FORM_VALUES);
    }
  }, [facility, isEdit, reset]);

  const subtitle = useMemo(() => (
    isEdit
      ? t('facilityForm.subtitle.edit', 'Mets à jour les informations de cette installation.')
      : t('facilityForm.subtitle.create', 'Configure une nouvelle installation pour ton club.')
  ), [isEdit, t]);

  const conflictModeOptions = useMemo(() => FACILITY_CONFLICT_MODE_OPTIONS.map((option) => ({
    label: t(option.labelKey, option.labelFallback),
    value: option.value,
  })), [t]);

  // Libelles sortis du JSX : ils y depassaient la longueur de ligne autorisee.
  const conflictModeFieldLabel = t(
    'facilityForm.fields.capacityConflictMode',
    'Comportement en cas de conflit',
  );
  const planningColorFieldLabel = t(
    'facilityForm.fields.planningColor',
    'Couleur dans le planning',
  );
  const capacityUnitLabel = t('facilityForm.capacity.teamPlural', 'équipes simultanées');
  const previewConflictOption = getConflictModeOption(watchedCapacityConflictMode);
  const previewTypeLabel = watchedType || t('facilityForm.defaults.type', 'Type inconnu');

  const handleSave = async (data) => {
    const facilityDocumentId = facility?.documentId || facility?.id || routedFacilityId;

    if (!isEdit && !contextClubId && !contextCmId) {
      Alert.alert(
        t('common.error', 'Erreur'),
        t('facilityForm.errors.contextMissing', 'Impossible de récupérer les informations du club.'),
      );
      return;
    }

    const normalizedAddress = normalizeAddressPayload(data.address);
    if (!normalizedAddress) {
      setError('address', {
        message: t(
          'facilityForm.errors.addressGeocodeRequired',
          'Sélectionne une adresse géolocalisée dans la liste.',
        ),
        type: 'manual',
      });
      // Le champ adresse peut etre hors ecran au moment du submit : sans alerte,
      // le bouton Creer semble ne rien faire.
      Alert.alert(
        t('common.error', 'Erreur'),
        t(
          'facilityForm.errors.addressGeocodeRequired',
          'Sélectionne une adresse géolocalisée dans la liste.',
        ),
      );
      return;
    }
    clearErrors('address');

    const formattedData = {
      ...data,
      address: normalizedAddress,
      allowOverflowRequests: true,
      capacityConflictMode: data.capacityConflictMode || FACILITY_CONFLICT_MODES.PENDING_VALIDATION,
    };

    setLoading(true);
    try {
      if (isEdit) {
        if (!facilityDocumentId) {
          throw new Error('Missing facility id');
        }
        await updateFacility(facilityDocumentId, formattedData);
      } else if (contextClubId) {
        await createFacility({ ...formattedData, club: contextClubId });
      } else if (contextCmId) {
        await createFacility({ ...formattedData, multisportClub: contextCmId });
      } else {
        throw new Error('No clubId or cmId provided');
      }
      navigation.goBack();
    } catch (error) {
      const subscriptionDecision = extractSubscriptionDecisionFromError(error);
      if (subscriptionDecision) {
        setSubscriptionPaywallDecision(subscriptionDecision);
        return;
      }

      Alert.alert(
        t('common.error', 'Erreur'),
        error?.message || t('facilityForm.errors.saveFailed', 'Une erreur est survenue lors de l\'enregistrement.'),
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
      warning: {
        backgroundColor: `${Colors.warning500}1F`,
        borderColor: Colors.warning500,
        textColor: Colors.warning500,
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

  if (isEdit && facilityLoading && !facility) {
    return (
      <ScreenContainer
        bgImage="bg2"
        contentContainerStyle={[Spaces.paddingVertical[24], Alignments.fill, Alignments.justifyCenter]}
      >
        <View style={[Alignments.alignCenter, Spaces.gap[12]]}>
          <Loader />
          <Text style={[Fonts.p2, Fonts.primary100]}>
            Chargement de l installation...
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  if (isEdit && facilityError && !facility) {
    return (
      <ScreenContainer
        bgImage="bg2"
        contentContainerStyle={[Spaces.paddingVertical[24], Alignments.fill, Alignments.justifyCenter]}
      >
        <View style={[Spaces.gap[12]]}>
          <Text style={[Fonts.h4Black, Fonts.neutral00]}>
            Impossible de charger l installation
          </Text>
          <Text style={[Fonts.p2, Fonts.primary100]}>
            {facilityError?.message || 'Réessaie dans quelques instants.'}
          </Text>
          <Button onPress={() => refetchFacility()} title="Réessayer" variant="Primary" />
          <Button onPress={() => navigation.navigate(RouteNames.FacilityList)} title="Retour aux installations" variant="Secondary" />
        </View>
      </ScreenContainer>
    );
  }

  if (isFacilityNotFound || isMissingCreateContext) {
    return (
      <ScreenContainer
        bgImage="bg2"
        contentContainerStyle={[Spaces.paddingVertical[24], Alignments.fill, Alignments.justifyCenter]}
      >
        <View style={[Spaces.gap[12]]}>
          <Text style={[Fonts.h4Black, Fonts.neutral00]}>
            {isFacilityNotFound ? 'Installation introuvable' : 'Contexte club introuvable'}
          </Text>
          <Text style={[Fonts.p2, Fonts.primary100]}>
            {isFacilityNotFound
              ? 'Le lien est peut-être obsolète ou cette installation a été supprimée.'
              : 'Impossible de determiner pour quel club créer cette installation.'}
          </Text>
          <Button onPress={() => navigation.navigate(RouteNames.FacilityList)} title="Retour aux installations" variant="Secondary" />
          {isFacilityNotFound ? (
            <Button onPress={() => refetchFacility()} title="Réessayer" variant="Primary" />
          ) : null}
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[16],
        Alignments.fill,
      ]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        style={[Alignments.fill]}
      >
        <ScrollView
          contentContainerStyle={[Spaces.gap[12], Spaces.paddingBottom[24]]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
            <HeaderBackButton onPress={() => navigation.goBack()} withDefaultMargin={false} />
            <View style={[Alignments.fill]}>
              <Text numberOfLines={1} style={[Fonts.h4Black, Fonts.neutral00]}>
                {isEdit
                  ? t('facilityForm.title.edit', 'Modifier l\'installation')
                  : t('facilityForm.title.create', 'Nouvelle installation')}
              </Text>
              <Text numberOfLines={1} style={[Fonts.p3, Fonts.primary100]}>
                {subtitle}
              </Text>
            </View>
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
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, value } }) => (
                <Input
                  density="compact"
                  error={errors.name?.message}
                  label={t('facilityForm.fields.name', 'Nom de l\'installation')}
                  onChangeText={onChange}
                  placeholder={t('facilityForm.placeholders.name', 'Ex: Terrain Honneur, Salle A...')}
                  value={value}
                />
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
                          style={[
                            TYPE_CHIP_STYLE,
                            !isActive ? { borderColor: Colors.primary200 } : null,
                          ]}
                          textStyle={!isActive ? { color: Colors.primary200 } : undefined}
                          title={typeItem.label}
                          variant={isActive ? 'Primary' : 'SecondaryLight'}
                        />
                      );
                    })}
                  </View>
                  {errors.type?.message ? (
                    <Text style={[Fonts.p3, Fonts.error700]}>
                      {errors.type.message}
                    </Text>
                  ) : null}
                </View>
              )}
            />

            <Controller
              control={control}
              name="address"
              render={({ field: { onChange, value } }) => (
                <View style={[Spaces.gap[4]]}>
                  <AutocompleteAddressInput
                    address={value}
                    error={errors.address?.message}
                    label={t('facilityForm.fields.address', 'Adresse (lieu exact)')}
                    placeholder={t('facilityForm.placeholders.address', 'Ex: 12 Rue du Stade...')}
                    setAddress={onChange}
                  />
                  {/* L'astuce d'aide a disparu : elle ne servait qu'a annoncer ce
                      que cette ligne CONSTATE. Sans GPS, c'est le message
                      d'erreur existant de l'autocomplete qui parle. */}
                  {getAddressCoordinates(value) ? (
                    <Text style={[Fonts.small, Fonts.success500]}>
                      {t('facilityForm.hints.gpsActive', '✓ GPS activé')}
                    </Text>
                  ) : null}
                </View>
              )}
            />

            <Controller
              control={control}
              name="capacityConflictMode"
              render={({ field: { onChange, value } }) => {
                const activeOption = getConflictModeOption(value);
                return (
                  <View style={[Spaces.gap[8]]}>
                    <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                      {conflictModeFieldLabel}
                    </Text>
                    <SegmentedControl
                      centerContent
                      onChange={onChange}
                      options={conflictModeOptions}
                      value={value}
                    />
                    <Text style={[Fonts.p3, Fonts.neutral300]}>
                      {t(activeOption.descriptionKey, activeOption.descriptionFallback)}
                    </Text>
                  </View>
                );
              }}
            />

            <Controller
              control={control}
              name="maxSlots"
              render={({ field: { onChange, value } }) => {
                const safeValue = Number(value || 1);
                return (
                  <View style={[Spaces.gap[4]]}>
                    <View
                      style={[
                        Alignments.row,
                        Alignments.alignCenter,
                        Alignments.justifySpaceBetween,
                        ApplicationStyle.backgroundColor.primary900,
                        ApplicationStyle.borderRadius16,
                        Spaces.paddingHorizontal[12],
                        Spaces.paddingVertical[8],
                        { borderColor: `${Colors.primary500}55`, borderWidth: 1 },
                      ]}
                    >
                      <View style={[Alignments.fill]}>
                        <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                          {t('facilityForm.fields.capacity', 'Capacité')}
                        </Text>
                        <Text style={[Fonts.small, Fonts.neutral300]}>
                          {capacityUnitLabel}
                        </Text>
                      </View>
                      <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
                        <Button
                          onPress={() => onChange(Math.max(1, safeValue - 1))}
                          size="small"
                          style={STEPPER_BUTTON_STYLE}
                          title="-"
                          variant="Secondary"
                        />
                        <Text style={[Fonts.p1Bold, Fonts.neutral00, STEPPER_VALUE_STYLE]}>
                          {safeValue}
                        </Text>
                        <Button
                          onPress={() => onChange(Math.min(10, safeValue + 1))}
                          size="small"
                          style={STEPPER_BUTTON_STYLE}
                          title="+"
                          variant="Secondary"
                        />
                      </View>
                    </View>
                    {errors.maxSlots?.message ? (
                      <Text style={[Fonts.p3, Fonts.error700]}>
                        {errors.maxSlots.message}
                      </Text>
                    ) : null}
                  </View>
                );
              }}
            />

            <Controller
              control={control}
              name="planningColor"
              render={({ field: { onChange, value } }) => {
                const selectedColor = isValidFacilityPlanningColor(value)
                  ? String(value).toUpperCase()
                  : FACILITY_PLANNING_PALETTE[0];

                return (
                  <View style={[Spaces.gap[8]]}>
                    <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                      {planningColorFieldLabel}
                    </Text>
                    <View
                      style={[
                        Alignments.row,
                        Alignments.alignCenter,
                        Alignments.justifySpaceBetween,
                      ]}
                    >
                      {FACILITY_PLANNING_PALETTE.map((color) => {
                        const isSelected = selectedColor === color;
                        return (
                          <TouchableOpacity
                            activeOpacity={0.85}
                            key={color}
                            onPress={() => onChange(color)}
                            style={[
                              PLANNING_SWATCH_STYLE,
                              {
                                backgroundColor: color,
                                borderColor: isSelected
                                  ? Colors.neutral00
                                  : `${Colors.neutral00}66`,
                                borderWidth: isSelected ? 2 : 1,
                              },
                            ]}
                          >
                            {isSelected ? (
                              <View
                                style={[
                                  PLANNING_SWATCH_DOT_STYLE,
                                  { backgroundColor: Colors.neutral00 },
                                ]}
                              />
                            ) : null}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {errors.planningColor?.message ? (
                      <Text style={[Fonts.p3, Fonts.error700]}>
                        {t('facilityForm.errors.planningColorInvalid', errors.planningColor.message)}
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
              ApplicationStyle.borderRadius16,
              Spaces.padding[12],
              Spaces.gap[8],
              { borderColor: `${Colors.primary200}66`, borderWidth: 1 },
            ]}
          >
            <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
              <View
                style={[
                  PREVIEW_DOT_STYLE,
                  {
                    backgroundColor: isValidFacilityPlanningColor(watchedPlanningColor)
                      ? String(watchedPlanningColor).toUpperCase()
                      : FACILITY_PLANNING_PALETTE[0],
                  },
                ]}
              />
              <Text
                numberOfLines={1}
                style={[Fonts.p2Bold, Fonts.neutral00, Alignments.fill]}
              >
                {watchedName?.trim() || t('facilityForm.defaults.name', 'Nom de l\'installation')}
              </Text>
            </View>

            <View style={[Alignments.row, Alignments.wrap, Spaces.gap[4]]}>
              {renderMetaChip(getCapacityLabel(watchedMaxSlots, t), 'primary')}
              {renderMetaChip(previewTypeLabel, 'neutral')}
              {renderMetaChip(
                t(previewConflictOption.labelKey, previewConflictOption.labelFallback),
                watchedCapacityConflictMode === FACILITY_CONFLICT_MODES.ALLOW_AND_NOTIFY
                  ? 'primary'
                  : 'warning',
              )}
            </View>

            <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[4]]}>
              <Image
                source={Images.pin}
                style={[
                  ApplicationStyle.icon16,
                  ApplicationStyle.tintColor.primary200,
                ]}
              />
              <Text
                numberOfLines={1}
                style={[Fonts.small, Fonts.primary100, Alignments.fill]}
              >
                {getAddressLabel(watchedAddress)}
              </Text>
            </View>
          </View>

          <View style={[Spaces.gap[4]]}>
            <Button
              isLoading={loading}
              onPress={handleSubmit(handleSave)}
              title={isEdit
                ? t('facilityForm.actions.save', 'Enregistrer')
                : t('facilityForm.actions.create', 'Créer')}
              variant="Primary"
            />
            <Button
              onPress={() => navigation.goBack()}
              title={t('common.cancel', 'Annuler')}
              variant="Ghost"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <SubscriptionPaywallSheet
        close={() => setSubscriptionPaywallDecision(null)}
        clubDocumentId={contextClubId || null}
        decision={subscriptionPaywallDecision}
        isVisible={Boolean(subscriptionPaywallDecision)}
        navigation={navigation}
      />
    </ScreenContainer>
  );
}

export default FacilityForm;
