import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useMemo } from 'react';
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
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import EmptyState from '@/components/atoms/emptyState/EmptyState';
import Loader from '@/components/atoms/loader/Loader';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useClubFacilityContext } from '@/services/facility/facilityQueries';
import { deleteFacility, getFacilitySections } from '@/services/facility/facilityService';

import { resolveFacilityPlanningColor } from '@/utils/facilityPlanningColor';

const getAddressLabel = (address, fallback = 'Adresse non renseignee') => {
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
        `Voulez-vous supprimer "${name || 'cette installation'}" ? Cette action est irréversible.`,
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
      t('facilityList.defaults.addressMissing', 'Adresse non renseignee'),
    );
    const hasAddress = Boolean(getAddressLabel(item?.address, '').trim());
    const planningColor = resolveFacilityPlanningColor(item);
    const cardTintColor = `${planningColor}22`;
    const isEditable = !item?.isReadOnly;
    const sharedOwnerLabel = item?.ownerName || t('facilityList.badges.multisport', 'Multisport');
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
            backgroundColor: cardTintColor,
            borderColor: planningColor,
            borderWidth: 1,
            marginBottom: 12,
            overflow: 'hidden',
            position: 'relative',
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
              Alignments.justifySpaceBetween,
              Spaces.gap[8],
            ]}
          >
            <Text
              numberOfLines={2}
              style={[
                Fonts.h4Black,
                Fonts.neutral00,
                { flex: 1 },
              ]}
            >
              {item?.name || t('facilityList.defaults.facilityName', 'Installation')}
            </Text>
            {item?.isReadOnly ? renderMetaChip(t('facilityList.badges.multisport', 'Multisport'), 'warning') : null}
          </View>

          <View style={[Alignments.row, Alignments.alignCenter, Alignments.wrap, Spaces.gap[8]]}>
            {renderMetaChip(capacityLabel, 'primary')}
            {renderMetaChip(item?.type || t('facilityList.defaults.unknownType', 'Type inconnu'), 'neutral')}
            {renderMetaChip(
              item?.allowOverflowRequests !== false
                ? t('facilityList.badges.overflowAllowed', 'Exceptions autorisees')
                : t('facilityList.badges.overflowBlocked', 'Capacite stricte'),
              item?.allowOverflowRequests !== false ? 'warning' : 'neutral',
            )}
            {item?.isReadOnly ? renderMetaChip(t('facilityList.badges.shared', 'Partagee'), 'primary') : null}
          </View>

          <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
            <View
              style={{
                backgroundColor: planningColor || Colors.primary500,
                borderColor: `${Colors.neutral00}66`,
                borderRadius: 999,
                borderWidth: 1,
                height: 12,
                width: 12,
              }}
            />
            <Text style={[Fonts.p3, Fonts.primary100]}>
              {t('facilityList.labels.planningColor', 'Couleur planning')}
            </Text>
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
            <Text
              numberOfLines={2}
              style={[
                Fonts.p2,
                Fonts.primary100,
                { flex: 1 },
              ]}
            >
              {addressLabel}
            </Text>
          </View>
          {hasAddress ? (
            <Button
              onPress={() => handleOpenFacilityMap(item)}
              size="small"
              style={{ alignSelf: 'flex-start' }}
              title={t('common.actions.openInGps', 'Ouvrir dans le GPS')}
              variant="Secondary"
            />
          ) : null}
        </TouchableOpacity>

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
    Alignments.justifySpaceBetween,
    Alignments.row,
    Alignments.wrap,
    ApplicationStyle.borderRadius24,
    ApplicationStyle.icon16,
    ApplicationStyle.tintColor.primary200,
    Colors.error500,
    Colors.neutral00,
    Colors.primary500,
    Fonts.h4Black,
    Fonts.neutral00,
    Fonts.neutral300,
    Fonts.p2,
    Fonts.primary100,
    Fonts.p3,
    Images.pin,
    Spaces.gap,
    Spaces.padding,
    handleDelete,
    handleEdit,
    handleOpenFacilityMap,
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
        Spaces.paddingBottom[120],
        facilities.length === 0 && Alignments.fill,
        facilities.length === 0 && Alignments.mainCenter,
      ]}
      keyExtractor={getFacilityKey}
      ListEmptyComponent={(
        <EmptyState
          actionLabel={t('facilityList.empty.action', 'Ajouter une installation')}
          description={t(
            'facilityList.empty.description',
            'Ajoutez les terrains, gymnases ou salles de votre club.',
          )}
          onAction={handleCreate}
          title={t('facilityList.empty.title', 'Aucune installation')}
        />
      )}
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
          title="Retour aux equipes"
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
          {error?.message || 'Reessayez dans quelques instants.'}
        </Text>
        <Button
          onPress={() => refetchFacilities()}
          title="R\u00E9essayer"
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
            {t('facilityList.title', 'Vos installations')}
          </Text>
          <Text style={[Fonts.p2, Fonts.primary100]}>
            {getListSubtitle(facilities.length)}
          </Text>
        </View>
        <Button
          disabled={isMissingContext}
          icon="plus"
          onPress={handleCreate}
          size="small"
          title={t('facilityList.actions.add', 'Ajouter')}
          variant="Primary"
        />
      </View>

      {content}
    </ScreenContainer>
  );
}

export default FacilityList;
