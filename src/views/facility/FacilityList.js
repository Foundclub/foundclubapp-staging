import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Image,
  Linking,
  Platform,
  RefreshControl,
  SectionList,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { extractSubscriptionDecisionFromError } from '@/domains/subscription/subscriptionDecision';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import EmptyState from '@/components/atoms/emptyState/EmptyState';
import Loader from '@/components/atoms/loader/Loader';
import SubscriptionPaywallSheet
  from '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';
import useBottomDockLayout from '@/navigation/useBottomDockLayout';

import { useClubFacilityContext } from '@/services/facility/facilityQueries';
import { deleteFacility, getFacilitySections } from '@/services/facility/facilityService';

import { getErrorMessage } from '@/utils/errors/displayError';
import { FACILITY_CONFLICT_MODES, getFacilityConflictMode } from '@/utils/facilityConflictMode';
import { resolveFacilityPlanningColor } from '@/utils/facilityPlanningColor';

const getAddressLabel = (address, fallback = 'Adresse non renseignée') => {
  if (!address) return fallback;
  if (typeof address === 'string') return address;
  if (typeof address === 'object') {
    return address?.description || address?.label || fallback;
  }
  return fallback;
};

const getAddressCoordinates = (address) => {
  if (!address || typeof address !== 'object') return null;
  const coordinates = address?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  const lng = Number(coordinates[0]);
  const lat = Number(coordinates[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng };
};

const getListSubtitle = (count) => `${count} ${(count === 0 || count > 1) ? 'installations' : 'installation'}`;

// D34 ecran 03 : la couleur du planning devient un LISERE, plus un habillage.
// 4 pt est la valeur du pack, nommee ici pour qu'on sache pourquoi elle existe.
const FACILITY_ACCENT_WIDTH = 4;

const getFacilityKey = (item, index) => (item.documentId || item.id?.toString() || `${item?.name || 'facility'}-${index}`);

/**
 * Facility list screen.
 * @returns {import('react').ReactElement}
 */
function FacilityList() {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { userData } = useAuth();
  const { sceneBottomInset } = useBottomDockLayout();

  const contextClubId = route.params?.clubId || userData?.club?.documentId || userData?.club?.id;
  const contextCmId = route.params?.cmId
    || (!route.params?.clubId ? userData?.club?.parentMultisport?.documentId || null : null);
  const {
    data: facilityContext,
    error,
    isLoading: loading,
    isRefetching: refreshing,
    refetch: refetchFacilities,
  } = useClubFacilityContext({
    clubId: contextClubId,
    cmId: contextCmId,
  });
  const facilities = useMemo(() => facilityContext?.allFacilities || [], [facilityContext?.allFacilities]);
  const resolvedCmId = facilityContext?.cmId || contextCmId || null;
  const [subscriptionPaywallDecision, setSubscriptionPaywallDecision] = useState(null);

  useFocusEffect(
    useCallback(() => {
      refetchFacilities();
    }, [refetchFacilities]),
  );

  const onRefresh = useCallback(() => {
    refetchFacilities();
  }, [refetchFacilities]);

  const handleDelete = useCallback((id, name) => {
    if (!id) return;

    Alert.alert(
      t('facilityList.alerts.delete.title', 'Supprimer l\'installation'),
      t(
        'facilityList.alerts.delete.description',
        `Veux-tu supprimer "${name || 'cette installation'}" ? Cette action est irréversible.`,
      ),
      [
        {
          style: 'cancel',
          text: t('common.cancel', 'Annuler'),
        },
        {
          onPress: async () => {
            try {
              await deleteFacility(id);
              refetchFacilities();
            } catch (deleteError) {
              const subscriptionDecision = extractSubscriptionDecisionFromError(deleteError);
              if (subscriptionDecision) {
                setSubscriptionPaywallDecision(subscriptionDecision);
                return;
              }

              Alert.alert(
                t('common.error', 'Erreur'),
                deleteError?.message || t(
                  'facilityList.alerts.delete.error',
                  "Impossible de supprimer l'installation pour le moment.",
                ),
              );
            }
          },
          style: 'destructive',
          text: t('common.delete', 'Supprimer'),
        },
      ],
    );
  }, [refetchFacilities, t]);

  const handleEdit = useCallback((facility) => {
    navigation.navigate(RouteNames.FacilityForm, {
      clubId: contextClubId,
      cmId: resolvedCmId,
      facility,
    });
  }, [contextClubId, navigation, resolvedCmId]);

  const handleCreate = useCallback(() => {
    navigation.navigate(RouteNames.FacilityForm, {
      clubId: contextClubId,
      cmId: resolvedCmId,
    });
  }, [contextClubId, navigation, resolvedCmId]);

  // D34 ecran 03 : « Voir le planning » n'ouvre PAS un ecran neuf — le planning
  // du club est un onglet de `ClubDetails` (hors lot). On y revient donc en
  // passant l'installation a selectionner en parametre de route, plutot que
  // d'ajouter une route pour un ecran qui existe deja ailleurs.
  const handleOpenPlanning = useCallback((facility) => {
    const facilityId = facility?.documentId || facility?.id;
    if (!facilityId) return;

    navigation.navigate(RouteNames.Club, {
      clubId: contextClubId,
      planningFacilityId: facilityId,
      planningScope: facility?.isShared ? 'shared' : 'club',
    });
  }, [contextClubId, navigation]);

  const handleOpenFacilityMap = useCallback((facility) => {
    const addressLabel = getAddressLabel(facility?.address, '').trim() || facility?.name || '';
    if (!addressLabel) return;

    const coordinates = getAddressCoordinates(facility?.address);
    const encodedAddress = encodeURIComponent(addressLabel);
    const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;

    const nativeUrl = coordinates
      ? Platform.select({
        android: `geo:${coordinates.lat},${coordinates.lng}?q=${coordinates.lat},${coordinates.lng}(${encodedAddress})`,
        default: fallbackUrl,
        ios: `maps:${coordinates.lat},${coordinates.lng}?q=${encodedAddress}`,
      })
      : Platform.select({
        android: `geo:0,0?q=${encodedAddress}`,
        default: fallbackUrl,
        ios: `maps:0,0?q=${encodedAddress}`,
      });

    if (!nativeUrl) {
      Linking.openURL(fallbackUrl).catch(() => {});
      return;
    }

    Linking.canOpenURL(nativeUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(nativeUrl);
        }
        return Linking.openURL(fallbackUrl);
      })
      .catch(() => {
        Linking.openURL(fallbackUrl).catch(() => {});
      });
  }, []);

  const sections = useMemo(() => getFacilitySections(facilityContext?.allFacilities || [], {
    clubTitle: t('facilityList.sections.club', 'Installations du club'),
    sharedTitle: t('facilityList.sections.shared', 'Installations partagées'),
  }), [facilityContext?.allFacilities, t]);
  const hasMultipleSections = sections.length > 1;
  const isMissingContext = !contextClubId && !contextCmId;

  const renderMetaChip = useCallback((label, tone = 'primary') => {
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
        <Text
          numberOfLines={1}
          style={[
            Fonts.p3Bold,
            { color: chipStyle.textColor },
          ]}
        >
          {label}
        </Text>
      </View>
    );
  }, [
    ApplicationStyle.borderRadius12,
    Colors,
    Fonts.p3Bold,
    Spaces.paddingHorizontal,
    Spaces.paddingVertical,
  ]);

  const renderItem = useCallback(({ item }) => {
    const facilityId = item?.documentId || item?.id;
    const teams = Number(item?.maxSlots || 1);
    const capacityLabel = `${teams} ${teams > 1
      ? t('facilityList.capacity.teamPlural', 'équipes simultanées')
      : t('facilityList.capacity.teamSingular', 'équipe simultanée')}`;
    const addressLabel = getAddressLabel(
      item?.address,
      t('facilityList.defaults.addressMissing', 'Adresse non renseignée'),
    );
    const hasAddress = Boolean(getAddressLabel(item?.address, '').trim());
    const planningColor = resolveFacilityPlanningColor(item);
    const isEditable = !item?.isReadOnly;
    // D34 ecran 03 : le type, la capacite et l'adresse tenaient sur trois
    // lignes (deux chips + une ligne d'adresse). Ils tiennent desormais sur une
    // seule meta, comme « Terrain · 1 equipe simultanee · 21 rue Fortia ».
    // D51 : le type est requis a la creation, mais des installations plus
    // anciennes n'en portent pas. Le segment disparait alors, au lieu
    // d'afficher un repli qui sonne comme une panne pour un simple champ vide.
    const metaLabel = [
      item?.type,
      capacityLabel,
      hasAddress ? addressLabel : null,
    ].filter(Boolean).join(' · ');
    const sharedOwnerLabel = item?.ownerName || t('facilityList.badges.multisport', 'Multisport');
    const conflictMode = getFacilityConflictMode(item);
    const accessibilityEditLabel = t(
      'facilityList.accessibility.editCard',
      `Modifier l'installation ${item?.name || ''}`.trim(),
    );

    return (
      <View
        style={[
          ApplicationStyle.borderRadius24,
          Spaces.padding[16],
          Spaces.gap[12],
          {
            backgroundColor: withAlpha(Colors.primary800, 0.6),
            borderColor: withAlpha(Colors.neutral00, 0.13),
            borderLeftColor: planningColor,
            borderLeftWidth: FACILITY_ACCENT_WIDTH,
            borderWidth: 1,
            marginBottom: 12,
            overflow: 'hidden',
            position: 'relative',
          },
        ]}
      >
        <TouchableOpacity
          accessibilityLabel={isEditable ? accessibilityEditLabel : undefined}
          accessibilityRole={isEditable ? 'button' : undefined}
          activeOpacity={isEditable ? 0.9 : 1}
          disabled={!isEditable}
          onPress={isEditable ? () => handleEdit(item) : undefined}
          style={[Spaces.gap[12]]}
        >
          <View
            style={[
              Alignments.row,
              Alignments.alignCenter,
              Spaces.gap[12],
            ]}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={[Fonts.p1Black, Fonts.neutral00]}
              >
                {item?.name || t('facilityList.defaults.facilityName', 'Installation')}
              </Text>
              <Text
                numberOfLines={2}
                style={[Fonts.p3, Fonts.neutral400, Spaces.marginTop[4]]}
              >
                {metaLabel}
              </Text>
            </View>
            {/* La couleur du planning se lit en pastille ETIQUETEE, pas en */}
            {/* habillage de la carte : rouge = erreur, jamais decoration. */}
            <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
              <View
                style={{
                  backgroundColor: planningColor || Colors.primary500,
                  borderColor: withAlpha(Colors.neutral00, 0.4),
                  borderRadius: 999,
                  borderWidth: 1,
                  height: 12,
                  width: 12,
                }}
              />
              <Text style={[Fonts.p3Bold, Fonts.neutral400]}>
                {t('facilityList.labels.planning', 'Planning')}
              </Text>
            </View>
          </View>

          <View style={[Alignments.row, Alignments.alignCenter, Alignments.wrap, Spaces.gap[8]]}>
            {renderMetaChip(
              conflictMode === FACILITY_CONFLICT_MODES.ALLOW_AND_NOTIFY
                ? t('facilityList.badges.overflowAllowed', 'Conflits : autoriser et notifier')
                : t('facilityList.badges.overflowBlocked', 'Conflits : demande à valider'),
              'neutral',
            )}
            {item?.isReadOnly ? renderMetaChip(t('facilityList.badges.shared', 'Partagée'), 'neutral') : null}
            {item?.isReadOnly ? renderMetaChip(t('facilityList.badges.multisport', 'Multisport'), 'warning') : null}
          </View>
        </TouchableOpacity>

        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
          <View style={{ flex: 1 }}>
            <Button
              onPress={() => handleOpenPlanning(item)}
              title={t('facilityList.actions.openPlanning', 'Voir le planning')}
              variant="Primary"
            />
          </View>
          {isEditable ? (
            <Button
              onPress={() => handleEdit(item)}
              title={t('common.actions.edit', 'Modifier')}
              variant="Secondary"
            />
          ) : null}
        </View>

        {hasAddress ? (
          <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
            <Image
              source={Images.pin}
              style={[
                ApplicationStyle.icon16,
                ApplicationStyle.tintColor.primary200,
              ]}
            />
            <Button
              onPress={() => handleOpenFacilityMap(item)}
              size="small"
              style={{ alignSelf: 'flex-start' }}
              title={t('common.actions.openInGps', 'Ouvrir dans le GPS')}
              variant="Secondary"
            />
          </View>
        ) : null}

        {item?.isReadOnly ? (
          <View style={[Spaces.gap[4]]}>
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {t(
                'facilityList.sharedOwnerHint',
                'Installation partagée du multisport {{ownerName}}. Lecture seule côté club.',
                { ownerName: sharedOwnerLabel },
              )}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {t('facilityList.readOnlyHint', 'Installation partagée, modification depuis le multisport uniquement.')}
            </Text>
          </View>
        ) : (
          <View style={[Alignments.row, Alignments.justifyEnd, Alignments.wrap, Spaces.gap[8]]}>
            <Button
              icon="trash"
              iconColor={Colors.error500}
              onPress={() => handleDelete(facilityId, item?.name)}
              size="small"
              style={{ borderColor: Colors.error500 }}
              textStyle={{ color: Colors.error500 }}
              title={t('common.delete', 'Supprimer')}
              variant="Secondary"
            />
          </View>
        )}
      </View>
    );
  }, [
    Alignments.alignCenter,
    Alignments.justifyEnd,
    Alignments.row,
    Alignments.wrap,
    ApplicationStyle.borderRadius24,
    ApplicationStyle.icon16,
    ApplicationStyle.tintColor.primary200,
    Colors.error500,
    Colors.neutral00,
    Colors.primary500,
    Colors.primary800,
    Fonts.neutral00,
    Fonts.neutral300,
    Fonts.neutral400,
    Fonts.p1Black,
    Fonts.p3,
    Fonts.p3Bold,
    Images.pin,
    Spaces.gap,
    Spaces.marginTop,
    Spaces.padding,
    handleDelete,
    handleEdit,
    handleOpenFacilityMap,
    handleOpenPlanning,
    renderMetaChip,
    t,
  ]);
  const renderSectionHeader = useCallback(({ section }) => (
    hasMultipleSections ? (
      <View style={[Spaces.marginBottom[8], Spaces.marginTop[4]]}>
        <Text style={[Fonts.p2Bold, Fonts.primary200]}>
          {section.title}
        </Text>
      </View>
    ) : null
  ), [Fonts.p2Bold, Fonts.primary200, Spaces.marginBottom, Spaces.marginTop, hasMultipleSections]);

  let content = (
    <SectionList
      contentContainerStyle={[
        { paddingBottom: sceneBottomInset },
        facilities.length === 0 && Alignments.fill,
        facilities.length === 0 && Alignments.mainCenter,
      ]}
      keyExtractor={getFacilityKey}
      ListEmptyComponent={(
        <EmptyState
          actionLabel={t('facilityList.empty.action', 'Ajouter une installation')}
          description={t(
            'facilityList.empty.description',
            'Ajoute les terrains, gymnases ou salles de ton club.',
          )}
          onAction={handleCreate}
          title={t('facilityList.empty.title', 'Aucune installation')}
        />
      )}
      ListFooterComponent={facilities.length > 0 ? (
        <TouchableOpacity
          accessibilityLabel={t('facilityList.empty.action', 'Ajouter une installation')}
          accessibilityRole="button"
          disabled={isMissingContext}
          onPress={handleCreate}
          style={[
            Alignments.alignCenter,
            Alignments.justifyCenter,
            Spaces.marginTop[12],
            {
              backgroundColor: withAlpha(Colors.primary500, 0.06),
              borderColor: withAlpha(Colors.primary500, 0.4),
              borderRadius: 16,
              borderStyle: 'dashed',
              borderWidth: 1.5,
              minHeight: 52,
            },
          ]}
        >
          <Text style={[Fonts.p2Bold, Fonts.primary200]}>
            {`+ ${t('facilityList.empty.action', 'Ajouter une installation')}`}
          </Text>
        </TouchableOpacity>
      ) : null}
      refreshControl={(
        <RefreshControl
          colors={[Colors.primary500]}
          onRefresh={onRefresh}
          refreshing={refreshing}
          tintColor={Colors.primary500}
        />
      )}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      sections={sections}
      showsVerticalScrollIndicator={false}
      stickySectionHeadersEnabled={false}
    />
  );

  if (isMissingContext) {
    content = (
      <View style={[Alignments.fill, Alignments.mainCenter, Spaces.gap[12]]}>
        <Text style={[Fonts.h4Black, Fonts.neutral00]}>
          Club introuvable
        </Text>
        <Text style={[Fonts.p2, Fonts.primary100]}>
          Impossible de determiner pour quel club afficher les installations.
        </Text>
        <Button
          onPress={() => navigation.navigate(RouteNames.TeamList)}
          title="Retour aux équipes"
          variant="Secondary"
        />
      </View>
    );
  } else if (loading && !refreshing) {
    content = <Loader />;
  } else if (error) {
    content = (
      <View style={[Alignments.fill, Alignments.mainCenter, Spaces.gap[12]]}>
        <Text style={[Fonts.h4Black, Fonts.neutral00]}>
          Impossible de charger les installations
        </Text>
        <Text style={[Fonts.p2, Fonts.primary100]}>
          {getErrorMessage(error, 'generic')}
        </Text>
        <Button
          onPress={() => refetchFacilities()}
          title="Réessayer"
          variant="Secondary"
        />
      </View>
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        Spaces.paddingHorizontal[16],
        Alignments.fill,
      ]}
    >
      <View
        style={[
          Spaces.marginBottom[24],
          Alignments.row,
          Alignments.justifySpaceBetween,
          Alignments.alignCenter,
          Spaces.gap[12],
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[Fonts.h2Black, Fonts.neutral00]}>
            {t('facilityList.title', 'Tes installations')}
          </Text>
          <Text style={[Fonts.p2, Fonts.primary100]}>
            {getListSubtitle(facilities.length)}
          </Text>
        </View>
        {/* D34 : une SEULE grammaire d'ajout — le bouton plein de l'en-tete a */}
        {/* laisse la place au pointille en pied de liste (ListFooterComponent). */}
      </View>

      {content}

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

export default FacilityList;
