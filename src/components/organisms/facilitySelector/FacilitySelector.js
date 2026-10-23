import { useIsFocused } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  clubSlotParts,
  creneauDeLaSeance,
  eventFacilityOptions,
} from '@/domains/seasonSlot/clubInstallations';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import MarqueeText from '@/components/atoms/marqueeText/MarqueeText';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';

import { useGetFacilityOccupancy } from '@/services/facility/facilityQueries';
import {
  getClubVilleFacilitiesWithSlots,
  getCMFacilities,
  getFacilities,
} from '@/services/facility/facilityService';

import { getAddressText, getFacilityAddressLabel } from '@/utils/facilityAddressLabel';
import { resolveFacilityPlanningColor } from '@/utils/facilityPlanningColor';

/**
 * FacilitySelector component
 * @param {object} props
 * @param {string} props.clubId - The club ID to fetch facilities from
 * @param {string} [props.cmId] - Optional CM ID to also fetch CM facilities
 * @param {object} props.location - The current location value
 * @param {string} props.facilityId - The current facility ID
 * @param {Function} props.onChange - Callback({ location, facilityId })
 * @param {string} props.error - Error message
 * @param {Function} [props.onAddFacility] - Optional callback when pressing "add facility"
 * @param {Function} [props.onOccupancyResolved] - Optional callback with occupancy payload
 * @param {{ start?: string | null, end?: string | null, excludeEventId?: string | null }} [props.occupancyWindow]
 * @param {boolean} [props.withVilleSlots] - COLL-C2C : propose aussi les installations de la Ville
 *   ou le club a un creneau (l etape « Lieu » d un evenement ; les autres appelants : rien).
 * @param {string | null} [props.teamId] - COLL-C2C : l equipe de l evenement (son creneau).
 * @param {{ documentId?: string, name?: string } | null} [props.currentFacility] - FIN13-COLL :
 *   l installation ACTUELLE de la seance modifiee, toujours proposee (T12/T13 : « Modifier » ne
 *   listait pas le Gymnase de la Ville ou la seance avait lieu).
 * @param {Record<string, unknown> | null} [props.decisionDeLaVille] - COLL-R-APP-CREATION
 *   (COL-003) : la reponse du serveur pour la seance, `{ mairie, complet, tuAcceptes }` (l etape
 *   « Lieu » de la creation, `useMairieDecideALaCreation`) ; les autres appelants : rien.
 */
function FacilitySelector({
  clubId,
  cmId,
  currentFacility = null,
  decisionDeLaVille = null,
  error,
  facilityId,
  location,
  occupancyWindow,
  onAddFacility,
  onChange,
  onOccupancyResolved,
  teamId = null,
  withVilleSlots = false,
}) {
  const { t } = useTranslation();
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();
  const [mode, setMode] = useState('club');
  const locationModes = useMemo(
    () => [
      {
        description: t('eventEdit.locationMode.clubHint', 'Installation du club'),
        title: t('eventEdit.locationMode.club', 'Club'),
        value: 'club',
      },
      {
        description: t('eventEdit.locationMode.externalHint', 'Adresse extérieure'),
        title: t('eventEdit.locationMode.external', 'Extérieur'),
        value: 'external',
      },
    ],
    [t],
  );
  const selectedLocationMode = useMemo(
    () => locationModes.find((item) => item.value === mode) || locationModes[0],
    [locationModes, mode],
  );
  const cardSurfaceStyle = {
    backgroundColor: 'rgba(4, 31, 44, 0.82)',
    borderColor: 'rgba(1, 179, 244, 0.24)',
    borderWidth: 1,
  };
  const fieldSurfaceStyle = {
    backgroundColor: 'rgba(1, 179, 244, 0.08)',
    borderColor: 'rgba(1, 179, 244, 0.26)',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  };

  const {
    data: clubFacilitiesData,
    isFetching: isFetchingClubFacilities,
    isLoading: isLoadingClubFacilities,
    refetch: refetchClubFacilities,
  } = useQuery({
    enabled: !!clubId,
    queryFn: () => getFacilities(clubId),
    queryKey: ['facilities', clubId],
  });

  const {
    data: cmFacilitiesData,
    isFetching: isFetchingCmFacilities,
    isLoading: isLoadingCmFacilities,
    refetch: refetchCmFacilities,
  } = useQuery({
    enabled: !!cmId,
    queryFn: () => getCMFacilities(cmId),
    queryKey: ['cm-facilities', cmId],
  });

  // COLL-C2C (02/10) — D32 : sur demande seulement. Sans `withVilleSlots`, aucune lecture de plus.
  const { data: villeFacilitiesData } = useQuery({
    enabled: withVilleSlots && Boolean(clubId),
    queryFn: () => getClubVilleFacilitiesWithSlots(clubId),
    queryKey: ['facilities-ville-creneaux', clubId],
  });

  const isLoadingFacilities = (
    (Boolean(clubId) && (isLoadingClubFacilities || isFetchingClubFacilities))
    || (Boolean(cmId) && (isLoadingCmFacilities || isFetchingCmFacilities))
  );

  // COLL-C2C (Ville) et FINITIONS13-COLL (installation actuelle) — FINITIONS16 4 : la regle vit
  // dans `eventFacilityOptions`, que le formulaire du site lit aussi.
  const facilities = useMemo(() => eventFacilityOptions({
    clubFacilities: clubFacilitiesData?.data || [],
    cmFacilities: cmFacilitiesData?.data || [],
    currentFacility,
    villeFacilities: villeFacilitiesData,
  }), [clubFacilitiesData, cmFacilitiesData, currentFacility, villeFacilitiesData]);
  // COLL-C2C — D32 : la seance tombe-t-elle dans un creneau du club ? Alors le creneau porte la
  // place : la carte d occupation de l installation ne s applique pas (le serveur en juge pareil).
  const facilitePourCreneau = facilities.find(
    (facility) => (facility.documentId || facility.id) === facilityId,
  );
  const creneauChoisi = facilitePourCreneau?.isVilleSlot
    ? creneauDeLaSeance(facilitePourCreneau.clubSeasonSlots, {
      start: occupancyWindow?.start || null,
      teamId,
    })
    : null;
  const ligneDeCreneau = (/** @type {any} */ slot) => {
    // R17-QUAND-1 : la forme du créneau (« un mercredi sur deux »), plus « chaque » en dur.
    const morceaux = clubSlotParts(slot, t);
    return t('clubInstallations.creneau.ligne', '{{team}} · {{quand}}', {
      quand: morceaux.quand,
      team: morceaux.team || t('clubInstallations.creneau.toutLeClub', 'Tout le club'),
      ...SANS_ECHAPPEMENT,
    });
  };
  // COLL-R-APP-CREATION (13/10, COL-003, decision d Adel « D2- A ») — le SERVEUR a dit que la
  // mairie decidera (hors des creneaux du club, place libre ou non : SPEC-PLACE) : sa reponse fait
  // foi sur le jugement local du creneau. Sans reponse : la ligne d avant, jamais une promesse.
  const laMairieDecide = Boolean(facilitePourCreneau?.isVilleSlot && decisionDeLaVille?.mairie);
  let phraseDeLaMairie = t(
    'collectiviteDemandes.decision.mairieLibre',
    'Hors des créneaux de ton club : la mairie décidera, même s’il reste de la place.',
  );
  if (decisionDeLaVille?.tuAcceptes) {
    phraseDeLaMairie = t(
      'collectiviteDemandes.decision.tuAcceptes',
      'Ta demande partira à la Ville ; tu pourras l’accepter toi-même dans Demandes.',
    );
  } else if (decisionDeLaVille?.complet) {
    phraseDeLaMairie = t(
      'collectiviteDemandes.club.quandMeme',
      'Tu peux demander quand même : la mairie décidera.',
    );
  }
  const aDesInstallationsDeLaVille = facilities.some((facility) => facility.isVilleSlot);
  const isFocused = useIsFocused();
  const {
    data: occupancyData,
    isFetching: isFetchingOccupancy,
  } = useGetFacilityOccupancy(facilityId, occupancyWindow, {
    enabled: mode === 'club'
      && Boolean(facilityId && occupancyWindow?.start && occupancyWindow?.end)
      && !creneauChoisi,
  });

  const addressMissingLabel = t(
    'eventWizard.steps.location.addressMissing',
    'Adresse non renseignée',
  );

  useEffect(() => {
    if (facilityId) {
      setMode('club');
    }
  }, [facilityId]);

  useEffect(() => {
    if (!isFocused || mode !== 'club') return;
    if (clubId) refetchClubFacilities();
    if (cmId) refetchCmFacilities();
  }, [clubId, cmId, isFocused, mode, refetchClubFacilities, refetchCmFacilities]);

  const handleModeChange = (newMode) => {
    setMode(newMode);
    onChange({ facilityId: null, location: null });
  };

  const handleFacilityChange = (selectedId) => {
    const selectedFacility = facilities.find(
      (facility) => (facility.documentId || facility.id) === selectedId,
    );

    if (!selectedFacility) {
      onChange({ facilityId: null, location: null });
      return;
    }

    onChange({
      facilityId: selectedId,
      location: {
        label: getAddressText(selectedFacility.address),
        value: '',
      },
    });
  };

  const handleAddressChange = (newLocation) => {
    onChange({ facilityId: null, location: newLocation });
  };

  const occupancySummary = occupancyData?.data || occupancyData || null;
  const selectedFacility = facilities.find(
    (facility) => (facility.documentId || facility.id) === facilityId,
  );
  const isSaturated = Boolean(occupancySummary?.saturated);
  const requiresApproval = Boolean(occupancySummary?.requiresApproval);
  const allowsImmediateConfirmation = Boolean(occupancySummary?.allowsImmediateConfirmation);
  let occupancyCardBackground = cardSurfaceStyle.backgroundColor;
  let occupancyCardBorder = cardSurfaceStyle.borderColor;
  let occupancyTone = Fonts.primary200;
  let occupancyMessage = t(
    'eventWizard.steps.location.capacityAvailable',
    'Cette installation a encore de la capacité pour ce créneau.',
  );

  if (isSaturated && requiresApproval) {
    occupancyCardBackground = 'rgba(245, 158, 11, 0.12)';
    occupancyCardBorder = `${Colors.warning500}88`;
    occupancyTone = Fonts.warning500;
    occupancyMessage = t(
      'eventWizard.steps.location.pendingValidationConflict',
      "Ce créneau dépasse la capacité. La création passera en demande en attente jusqu'à validation d'un dirigeant.",
    );
  } else if (isSaturated && allowsImmediateConfirmation) {
    occupancyCardBackground = 'rgba(1, 179, 244, 0.12)';
    occupancyCardBorder = `${Colors.primary500}88`;
    occupancyTone = Fonts.primary500;
    occupancyMessage = t(
      'eventWizard.steps.location.allowAndNotifyConflict',
      'Ce créneau dépasse la capacité, mais il restera autorisé et notifiera les dirigeants.',
    );
  }

  useEffect(() => {
    if (!onOccupancyResolved) return;
    if (mode !== 'club' || !facilityId || !occupancyWindow?.start || !occupancyWindow?.end) {
      onOccupancyResolved(null);
      return;
    }

    // DATESDABORD (23/10) — `isShared` : l installation est celle du club multisport (l etape
    // « Lieu » nomme alors le club multisport dans sa phrase de prevention).
    onOccupancyResolved(occupancySummary
      ? { ...occupancySummary, isShared: Boolean(selectedFacility?.isShared) }
      : null);
  }, [
    facilityId, mode, occupancySummary, occupancyWindow?.end, occupancyWindow?.start,
    onOccupancyResolved, selectedFacility?.isShared,
  ]);

  return (
    <View style={[Spaces.gap[16]]}>
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
        {t('eventEdit.fields.location.label', 'Lieu')}
      </Text>

      <View style={[Spaces.gap[12]]}>
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t('eventWizard.steps.location.modeHint', 'Choisis si le lieu est dans ton club ou en extérieur.')}
        </Text>
        <View style={[Alignments.row, Spaces.gap[12]]}>
          {locationModes.map((modeOption) => {
            const isActive = modeOption.value === mode;
            const cardBg = isActive ? `${Colors.primary500}1A` : 'rgba(255,255,255,0.06)';
            const cardBorder = isActive ? Colors.primary500 : 'rgba(255,255,255,0.34)';
            return (
              <TouchableOpacity
                accessibilityHint={t('eventWizard.steps.location.modeButtonHint', 'Sélectionné ce mode de lieu')}
                accessibilityLabel={`${modeOption.title}. ${modeOption.description}`}
                accessibilityRole="button"
                activeOpacity={0.9}
                key={modeOption.value}
                onPress={() => handleModeChange(modeOption.value)}
                style={[
                  ApplicationStyle.borderRadius100,
                  Spaces.paddingHorizontal[16],
                  Spaces.paddingVertical[12],
                  {
                    backgroundColor: cardBg,
                    borderColor: cardBorder,
                    borderWidth: isActive ? 1.4 : 1,
                    flex: 1,
                    minHeight: 48,
                  },
                ]}
              >
                <View
                  style={[
                    Alignments.row,
                    Alignments.justifySpaceBetween,
                    Alignments.alignCenter,
                    Spaces.gap[8],
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[Fonts.p2Bold, isActive ? Fonts.primary500 : Fonts.neutral100, { flex: 1 }]}
                  >
                    {modeOption.title}
                  </Text>
                  <View
                    style={{
                      alignItems: 'center',
                      backgroundColor: isActive ? Colors.primary500 : 'transparent',
                      borderColor: isActive ? Colors.primary500 : Colors.neutral400,
                      borderRadius: 10,
                      borderWidth: 1.6,
                      height: 20,
                      justifyContent: 'center',
                      width: 20,
                    }}
                  >
                    {isActive ? (
                      <Image
                        source={Images.check}
                        style={{ height: 12, tintColor: Colors.neutral900, width: 12 }}
                      />
                    ) : null}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {selectedLocationMode?.description}
        </Text>
      </View>

      {mode === 'club' ? (
        <View style={[Spaces.gap[16]]}>
          <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[16], cardSurfaceStyle]}>
            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {t('eventEdit.fields.facility.label', 'Installation')}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {aDesInstallationsDeLaVille
                  ? t(
                    'clubInstallations.lieu.aide',
                    'Choisis une installation de ton club, ou de la Ville où ton club a un créneau.',
                  )
                  : t(
                    'eventWizard.steps.location.installationHelper',
                    'Choisis une installation de ton club.',
                  )}
              </Text>
            </View>

            {isLoadingFacilities ? (
              <View style={[Spaces.paddingVertical[12]]}>
                <ActivityIndicator color={Colors.primary500} />
              </View>
            ) : null}

            {!isLoadingFacilities && facilities.length === 0 ? (
              <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[12], fieldSurfaceStyle]}>
                <Text style={[Fonts.p2Bold, Fonts.primary500]}>
                  {t('eventWizard.steps.location.noInstallationsTitle', 'Aucune installation pour le moment')}
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral100]}>
                  {t(
                    'eventWizard.steps.location.noInstallations',
                    'Ajoute une installation ou passe en mode Extérieur pour saisir une adresse.',
                  )}
                </Text>
              </View>
            ) : null}

            {!isLoadingFacilities && facilities.length > 0 ? (
              <ScrollView
                contentContainerStyle={[Spaces.gap[12], { paddingBottom: 2, paddingRight: 2 }]}
                nestedScrollEnabled
                showsVerticalScrollIndicator={facilities.length > 3}
                style={{ maxHeight: 280 }}
              >
                {facilities.map((facility) => {
                  const id = facility.documentId || facility.id;
                  const isSelected = facilityId === id;
                  const planningColor = resolveFacilityPlanningColor(facility) || Colors.primary500;
                  const cardTintColor = `${planningColor}${isSelected ? '36' : '22'}`;
                  const selectedBadgeStyle = {
                    backgroundColor: `${planningColor}24`,
                    borderColor: planningColor,
                    borderRadius: 999,
                    borderWidth: 1,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                  };
                  const selectedCheckStyle = {
                    alignItems: 'center',
                    backgroundColor: planningColor,
                    borderRadius: 10,
                    height: 20,
                    justifyContent: 'center',
                    width: 20,
                  };
                  return (
                    <TouchableOpacity
                      activeOpacity={0.86}
                      key={`wizard-facility-${id}`}
                      onPress={() => handleFacilityChange(id)}
                      style={[
                        ApplicationStyle.card,
                        Spaces.padding[16],
                        Spaces.gap[8],
                        {
                          backgroundColor: cardTintColor,
                          borderColor: planningColor,
                          minHeight: 84,
                          overflow: 'hidden',
                          position: 'relative',
                          shadowColor: isSelected ? planningColor : 'transparent',
                          shadowOpacity: isSelected ? 0.24 : 0,
                          shadowRadius: isSelected ? 8 : 0,
                        },
                      ]}
                    >
                      <View
                        style={{
                          backgroundColor: planningColor,
                          borderBottomRightRadius: 8,
                          borderTopRightRadius: 8,
                          height: '100%',
                          left: 0,
                          position: 'absolute',
                          top: 0,
                          width: 4,
                        }}
                      />
                      <View
                        style={{
                          alignItems: 'center',
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                        }}
                      >
                        {/* MARQUEE — le nom du gymnase se lit en entier */}
                        <MarqueeText
                          containerStyle={{ flex: 1, marginRight: 12 }}
                          style={[Fonts.p2Bold, Fonts.neutral00]}
                          text={facility.isShared && !facility.isVilleSlot
                            ? `${facility.name} (CM)`
                            : facility.name}
                        />
                        {isSelected ? (
                          <View style={{ alignItems: 'center', flexDirection: 'row' }}>
                            <View style={selectedCheckStyle}>
                              <Image
                                source={Images.check}
                                style={{ height: 11, tintColor: Colors.neutral900, width: 11 }}
                              />
                            </View>
                            <View style={[selectedBadgeStyle, { marginLeft: 8 }]}>
                              <Text style={[Fonts.p4Bold, { color: planningColor }]}>
                                {t('common.selected', 'Sélectionnée')}
                              </Text>
                            </View>
                          </View>
                        ) : null}
                      </View>
                      <Text numberOfLines={2} style={[Fonts.p2, Fonts.neutral200]}>
                        {getFacilityAddressLabel(facility.address, addressMissingLabel)}
                      </Text>
                      {facility.isVilleSlot ? (
                        <Text numberOfLines={2} style={[Fonts.p3, Fonts.primary200]}>
                          {t(
                            'clubInstallations.lieu.creneaux',
                            'Tes créneaux de la Ville : {{liste}}',
                            {
                              liste: facility.clubSeasonSlots.map(ligneDeCreneau).join(' · '),
                              ...SANS_ECHAPPEMENT,
                            },
                          )}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : null}
          </View>

          {creneauChoisi && occupancyWindow?.start && !laMairieDecide ? (
            <View
              style={[
                ApplicationStyle.card,
                Spaces.padding[16],
                {
                  backgroundColor: 'rgba(1, 179, 244, 0.12)',
                  borderColor: `${Colors.primary500}88`,
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[Fonts.p2, Fonts.neutral100]}>
                {t(
                  'clubInstallations.lieu.dansLeCreneau',
                  // eslint-disable-next-line max-len
                  'Dans ton créneau {{creneau}} : la séance est validée directement. Si ton club y est déjà au complet à cette heure, ton dirigeant décide.',
                  { creneau: ligneDeCreneau(creneauChoisi), ...SANS_ECHAPPEMENT },
                )}
              </Text>
            </View>
          ) : null}

          {facilitePourCreneau?.isVilleSlot && !creneauChoisi && occupancyWindow?.start
            && !laMairieDecide ? (
              <Text style={[Fonts.p3, Fonts.warning500]}>
                {t(
                  'clubInstallations.lieu.horsCreneau',
                  'Hors de tes créneaux de la Ville à cette heure.',
                )}
              </Text>
            ) : null}

          {/* COLL-R-APP-CREATION — la carte orange de « Modifier » (FINITIONS11-COLL). */}
          {laMairieDecide && occupancyWindow?.start ? (
            <View
              style={[
                Spaces.padding[16],
                Spaces.gap[4],
                ApplicationStyle.backgroundColor.warning100,
                { borderColor: Colors.warning500, borderRadius: 8, borderWidth: 1 },
              ]}
              testID="facility-selector-mairie-decide"
            >
              <Text style={[Fonts.p2, Fonts.warning900]}>{phraseDeLaMairie}</Text>
              <Text style={[Fonts.p2Bold, Fonts.warning900]}>
                {t(
                  'collectiviteDemandes.decision.siRefusAnnulee',
                  'Si la mairie refuse, la séance sera annulée.',
                )}
              </Text>
            </View>
          ) : null}

          {!creneauChoisi && selectedFacility && occupancyWindow?.start && occupancyWindow?.end ? (
            <View
              style={[
                ApplicationStyle.card,
                Spaces.padding[16],
                Spaces.gap[12],
                {
                  backgroundColor: occupancyCardBackground,
                  borderColor: occupancyCardBorder,
                  borderWidth: 1,
                },
              ]}
            >
              <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[8]]}>
                <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>
                  {selectedFacility?.name || t('eventEdit.fields.facility.label', 'Installation')}
                </Text>
                {isFetchingOccupancy ? (
                  <ActivityIndicator color={Colors.primary500} size="small" />
                ) : null}
              </View>

              {!isFetchingOccupancy && occupancySummary ? (
                <>
                  <Text style={[Fonts.p2, Fonts.neutral100]}>
                    {/* FINITIONS4 (recette du 29/09) — la ligne d occupation etait ecrite
                        en dur, en franglais, sans accent ni accord : elle passe par t(). */}
                    {t('eventWizard.steps.location.occupancy', {
                      count: Number(occupancySummary.overlapCount || 0),
                      max: Number(occupancySummary.maxSlots || 1),
                      occupied: Number(occupancySummary.overlapCount || 0),
                    })}
                    {Number.isFinite(occupancySummary.remaining)
                      ? ` • ${t('eventWizard.steps.location.remaining', {
                        count: Math.max(0, Number(occupancySummary.remaining || 0)),
                      })}`
                      : ''}
                  </Text>
                  {/* COLL-R-APP-CREATION — sur un gymnase de la Ville, la place ne decide pas :
                      ni « encore de la capacite », ni « validation d un dirigeant ». */}
                  {facilitePourCreneau?.isVilleSlot ? null : (
                    <Text
                      style={[
                        Fonts.p3,
                        occupancyTone,
                      ]}
                    >
                      {occupancyMessage}
                    </Text>
                  )}
                </>
              ) : null}
            </View>
          ) : null}

          {onAddFacility ? (
            <Button
              onPress={() => onAddFacility()}
              style={{ marginTop: 2 }}
              title={`+ ${t('eventWizard.steps.location.addInstallation', 'Ajouter une installation')}`}
              variant="Secondary"
            />
          ) : null}
        </View>
      ) : (
        <AutocompleteAddressInput
          address={location}
          error={error}
          label={t('eventEdit.fields.address.label', 'Adresse')}
          permettreLieuSurCarte
          placeholder={t('eventEdit.fields.location.placeholder')}
          setAddress={handleAddressChange}
          wrapperStyle={fieldSurfaceStyle}
        />
      )}

      {error ? (
        <Text style={[Fonts.p3, Fonts.error700]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export default FacilitySelector;
