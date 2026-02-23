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
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import EmptyState from '@/components/atoms/emptyState/EmptyState';
import Loader from '@/components/atoms/loader/Loader';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { deleteFacility, getCMFacilities, getFacilities } from '@/services/facility/facilityService';

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

const fetchContextFacilities = async (clubId, cmId) => {
  const promises = [];
  if (clubId) promises.push(getFacilities(clubId));
  if (cmId) promises.push(getCMFacilities(cmId));

  const results = await Promise.all(promises);

  if (clubId && cmId) {
    const clubData = results[0]?.data || [];
    const cmData = results[1]?.data || [];
    const taggedCM = cmData.map((facility) => ({
      ...facility,
      isReadOnly: true,
      source: 'Multisport',
    }));
    return [...clubData, ...taggedCM];
  }

  return results[0]?.data || [];
};

const getSections = (facilities, t) => {
  if (!facilities.length) return [];

  const editableFacilities = facilities.filter((facility) => !facility.isReadOnly);
  const sharedFacilities = facilities.filter((facility) => facility.isReadOnly);

  if (editableFacilities.length && sharedFacilities.length) {
    return [
      {
        data: editableFacilities,
        title: t('facilityList.sections.club', 'Installations du club'),
      },
      {
        data: sharedFacilities,
        title: t('facilityList.sections.shared', 'Installations partagées'),
      },
    ];
  }

  if (sharedFacilities.length) {
    return [
      {
        data: sharedFacilities,
        title: t('facilityList.sections.sharedOnly', 'Installations partagées'),
      },
    ];
  }

  return [
    {
      data: editableFacilities,
      title: t('facilityList.sections.clubOnly', 'Installations du club'),
    },
  ];
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
  const contextCmId = route.params?.cmId;

  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFacilities = useCallback(async () => {
    if (!contextClubId && !contextCmId) return;

    setLoading(true);
    try {
      const combinedData = await fetchContextFacilities(contextClubId, contextCmId);
      setFacilities(combinedData);
    } catch (error) {
      // no-op: keep previous list on fetch error
    } finally {
      setLoading(false);
    }
  }, [contextClubId, contextCmId]);

  const onRefresh = useCallback(async () => {
    if (!contextClubId && !contextCmId) return;

    setRefreshing(true);
    try {
      const combinedData = await fetchContextFacilities(contextClubId, contextCmId);
      setFacilities(combinedData);
    } catch (error) {
      // no-op: keep previous list on refresh error
    } finally {
      setRefreshing(false);
    }
  }, [contextClubId, contextCmId]);

  useFocusEffect(
    useCallback(() => {
      fetchFacilities();
    }, [fetchFacilities]),
  );

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
              fetchFacilities();
            } catch (error) {
              // no-op: alert flow already handled
            }
          },
          style: 'destructive',
          text: t('common.delete', 'Supprimer'),
        },
      ],
    );
  }, [fetchFacilities, t]);

  const handleEdit = useCallback((facility) => {
    navigation.navigate(RouteNames.FacilityForm, {
      clubId: contextClubId,
      cmId: contextCmId,
      facility,
    });
  }, [contextClubId, contextCmId, navigation]);

  const handleCreate = useCallback(() => {
    navigation.navigate(RouteNames.FacilityForm, {
      clubId: contextClubId,
      cmId: contextCmId,
    });
  }, [contextClubId, contextCmId, navigation]);

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

  const sections = useMemo(() => getSections(facilities, t), [facilities, t]);
  const hasMultipleSections = sections.length > 1;

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
      ? t('facilityList.capacity.teamPlural', 'equipes simultanees')
      : t('facilityList.capacity.teamSingular', 'equipe simultanee')}`;
    const addressLabel = getAddressLabel(
      item?.address,
      t('facilityList.defaults.addressMissing', 'Adresse non renseignee'),
    );
    const hasAddress = Boolean(getAddressLabel(item?.address, '').trim());

    return (
      <View
        style={[
          ApplicationStyle.backgroundColor.primary700,
          ApplicationStyle.borderRadius24,
          Spaces.padding[16],
          Spaces.gap[12],
          {
            borderColor: `${Colors.primary500}33`,
            borderWidth: 1,
            marginBottom: 12,
          },
        ]}
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
          {item?.isReadOnly ? renderMetaChip('Multisport', 'warning') : null}
        </View>

        <View style={[Alignments.row, Alignments.alignCenter, Alignments.wrap, Spaces.gap[8]]}>
          {renderMetaChip(capacityLabel, 'primary')}
          {renderMetaChip(item?.type || t('facilityList.defaults.unknownType', 'Type inconnu'), 'neutral')}
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

        {item?.isReadOnly ? (
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t('facilityList.readOnlyHint', 'Installation partagée, modification depuis le multisport uniquement.')}
          </Text>
        ) : (
          <View style={[Alignments.row, Alignments.justifyEnd, Alignments.wrap, Spaces.gap[8]]}>
            <Button
              icon="edit"
              onPress={() => handleEdit(item)}
              size="small"
              title={t('common.edit', 'Modifier')}
              variant="Secondary"
            />
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
    ApplicationStyle.backgroundColor.primary700,
    ApplicationStyle.borderRadius24,
    ApplicationStyle.icon16,
    ApplicationStyle.tintColor.primary200,
    Colors.error500,
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
          icon="plus"
          onPress={handleCreate}
          size="small"
          title={t('facilityList.actions.add', 'Ajouter')}
          variant="Primary"
        />
      </View>

      {loading && !refreshing ? (
        <Loader />
      ) : (
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
      )}
    </ScreenContainer>
  );
}

export default FacilityList;
