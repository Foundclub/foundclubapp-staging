import { useNavigation } from '@react-navigation/native';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Alert,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';
import closeIcon from '@/assets/icons/close.png';
import rightIcon from '@/assets/icons/arrowRight.png';
import searchIcon from '@/assets/icons/search.png';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import superAdminLayout from '@/components/molecules/superAdmin/superAdminLayout';
import ScreenContainer from '@/components/templates/ScreenContainer';
import AdminStateView from '@/views/admin/components/AdminStateView';

import { RouteNames } from '@/navigation/routeNames';

import {
  getClubActivityLabel,
  getClubCity,
  getClubInitials,
  getDocumentId,
  normalizeText,
} from '@/services/admin/adminClubContentModel';
import {
  useBulkDeleteAdminClubContent,
  useBulkUpdateAdminClubContent,
  useGetAdminClubContentList,
} from '@/services/admin/adminClubContentQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

const SORT_OPTIONS = [
  { key: 'updated', label: 'MAJ' },
  { key: 'alpha', label: 'A-Z' },
  { key: 'created', label: 'Créés' },
  { key: 'customer', label: 'Clients' },
];

const BOOLEAN_FILTERS = [
  { key: 'all', label: 'Tous', value: undefined },
  { key: 'yes', label: 'Oui', value: true },
  { key: 'no', label: 'Non', value: false },
];

const getStatusBadges = (club = {}) => [
  club?.isCustomer ? { label: 'Client', tone: 'success' } : { label: 'Prospect', tone: 'neutral' },
  club?.isReservationProvider ? { label: 'Réservation', tone: 'primary' } : null,
].filter(Boolean);

const getBadgePresentation = (tone, colors) => {
  if (tone === 'success') {
    return {
      backgroundColor: colors.success100,
      borderColor: colors.success500,
      textColor: colors.success700,
    };
  }

  if (tone === 'primary') {
    return {
      backgroundColor: `${colors.primary500}22`,
      borderColor: colors.primary500,
      textColor: colors.primary200,
    };
  }

  return {
    backgroundColor: colors.primary900,
    borderColor: colors.primary700,
    textColor: colors.neutral100,
  };
};

function AdminClubList() {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();
  const navigation = useNavigation();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [city, setCity] = useState('');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [reservationFilter, setReservationFilter] = useState('all');
  const [sortMode, setSortMode] = useState('updated');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [dangerAction, setDangerAction] = useState(null);
  const [dangerReason, setDangerReason] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const params = useMemo(() => ({
    city,
    isCustomer: BOOLEAN_FILTERS.find((filter) => filter.key === customerFilter)?.value,
    isReservationProvider: BOOLEAN_FILTERS.find((filter) => filter.key === reservationFilter)?.value,
    page: 1,
    pageSize: 40,
    q: debouncedQuery,
    sortMode,
  }), [city, customerFilter, debouncedQuery, reservationFilter, sortMode]);

  const {
    data,
    error,
    isFetching,
    isLoading,
    refetch,
  } = useGetAdminClubContentList(params);
  const bulkDeleteMutation = useBulkDeleteAdminClubContent();
  const bulkUpdateMutation = useBulkUpdateAdminClubContent();

  const clubs = useMemo(() => (Array.isArray(data?.data) ? data.data : []), [data?.data]);
  const total = data?.meta?.pagination?.total || clubs.length;
  const hasLocalCityFilter = Boolean(normalizeText(city));
  const totalLabel = hasLocalCityFilter ? clubs.length : total;
  const totalSuffix = hasLocalCityFilter ? 'clubs affichés' : 'clubs dans le Content Manager';
  const selectedCount = selectedIds.length;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const leaveSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds([]);
  }, []);

  const toggleSelection = useCallback((documentId) => {
    if (!documentId) return;
    setSelectedIds((previous) => (
      previous.includes(documentId)
        ? previous.filter((id) => id !== documentId)
        : [...previous, documentId]
    ));
  }, []);

  const selectAllVisible = useCallback(() => {
    const visibleIds = clubs.map(getDocumentId).filter(Boolean);
    setSelectedIds((previous) => {
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => previous.includes(id));
      if (allSelected) return previous.filter((id) => !visibleIds.includes(id));
      return Array.from(new Set([...previous, ...visibleIds]));
    });
  }, [clubs]);

  const openDangerAction = useCallback((action) => {
    if (selectedCount === 0) {
      Alert.alert('Sélection vide', 'Sélectionnez au moins un club.');
      return;
    }
    setDangerAction(action);
    setDangerReason('');
  }, [selectedCount]);

  const closeDangerAction = useCallback(() => {
    if (bulkDeleteMutation.isPending || bulkUpdateMutation.isPending) return;
    setDangerAction(null);
    setDangerReason('');
  }, [bulkDeleteMutation.isPending, bulkUpdateMutation.isPending]);

  const executeDangerAction = useCallback(async () => {
    const reason = normalizeText(dangerReason);
    if (reason.length < 3) {
      Alert.alert('Raison requise', 'Ajoutez une raison d’au moins 3 caractères.');
      return;
    }

    try {
      if (dangerAction === 'delete') {
        await bulkDeleteMutation.mutateAsync({ documentIds: selectedIds, reason });
      } else if (dangerAction === 'customer-on') {
        await bulkUpdateMutation.mutateAsync({ data: { isCustomer: true }, documentIds: selectedIds, reason });
      } else if (dangerAction === 'customer-off') {
        await bulkUpdateMutation.mutateAsync({ data: { isCustomer: false }, documentIds: selectedIds, reason });
      } else if (dangerAction === 'reservation-on') {
        await bulkUpdateMutation.mutateAsync({ data: { isReservationProvider: true }, documentIds: selectedIds, reason });
      } else if (dangerAction === 'reservation-off') {
        await bulkUpdateMutation.mutateAsync({ data: { isReservationProvider: false }, documentIds: selectedIds, reason });
      }
      closeDangerAction();
      leaveSelectionMode();
    } catch (mutationError) {
      Alert.alert('Action impossible', getErrorMessage(mutationError, 'generic'));
    }
  }, [
    bulkDeleteMutation,
    bulkUpdateMutation,
    closeDangerAction,
    dangerAction,
    dangerReason,
    leaveSelectionMode,
    selectedIds,
  ]);

  const renderChip = useCallback((label, active, onPress) => (
    <TouchableOpacity
      onPress={onPress}
      style={[
        ApplicationStyle.borderRadius12,
        Spaces.paddingHorizontal[12],
        Spaces.paddingVertical[8],
        styles.chip,
        {
          backgroundColor: active ? Colors.primary500 : Colors.primary900,
          borderColor: active ? Colors.primary500 : Colors.primary700,
        },
      ]}
    >
      <Text style={[Fonts.p3Bold, { color: active ? Colors.neutral00 : Colors.primary200 }]}>
        {label}
      </Text>
    </TouchableOpacity>
  ), [ApplicationStyle.borderRadius12, Colors, Fonts.p3Bold, Spaces.paddingHorizontal, Spaces.paddingVertical]);

  const renderFilterGroup = useCallback((label, children) => (
    <View style={Spaces.gap[8]}>
      <Text style={[Fonts.label, Fonts.uppercase, { color: Colors.primary200 }]}>
        {label}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <View style={[Alignments.row, styles.horizontalChips]}>
          {children}
        </View>
      </ScrollView>
    </View>
  ), [Alignments.row, Colors.primary200, Fonts.label, Fonts.uppercase, Spaces.gap]);

  const renderClub = useCallback(({ item }) => {
    const documentId = getDocumentId(item);
    const isSelected = selectedSet.has(documentId);
    const cityLabel = getClubCity(item);
    const activityLabel = getClubActivityLabel(item);
    const badges = getStatusBadges(item);

    return (
      <TouchableOpacity
        activeOpacity={0.84}
        onLongPress={() => {
          setSelectionMode(true);
          toggleSelection(documentId);
        }}
        onPress={() => {
          if (selectionMode) {
            toggleSelection(documentId);
            return;
          }
          navigation.navigate(RouteNames.AdminClubDetail, { clubId: documentId });
        }}
        style={[
          ApplicationStyle.card,
          ApplicationStyle.borderRadius16,
          Spaces.padding[16],
          Spaces.marginBottom[12],
          {
            backgroundColor: Colors.primary700,
            borderColor: isSelected ? Colors.primary500 : Colors.primary700,
            shadowColor: Colors.primary500,
          },
          styles.clubCard,
        ]}
      >
        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
          {selectionMode ? (
            <View
              style={[
                Alignments.center,
                styles.selectionDot,
                {
                  backgroundColor: isSelected ? Colors.primary500 : 'transparent',
                  borderColor: isSelected ? Colors.primary500 : Colors.primary200,
                },
              ]}
            >
              {isSelected ? (
                <Image
                  source={Images.check}
                  style={styles.checkIcon}
                />
              ) : null}
            </View>
          ) : null}

          <View
            style={[
              Alignments.center,
              styles.logoFrame,
              {
                backgroundColor: Colors.primary900,
                borderColor: `${Colors.primary500}55`,
              },
            ]}
          >
            {item.logo?.url ? (
              <Image
                resizeMode="cover"
                source={{ uri: item.logo.url }}
                style={styles.logoImage}
              />
            ) : (
              <Text style={[Fonts.p2Bold, { color: Colors.primary200 }]}>
                {getClubInitials(item)}
              </Text>
            )}
          </View>

          <View style={styles.clubContent}>
            <Text numberOfLines={1} style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
              {item.name || 'Club sans nom'}
            </Text>
            <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral200 }, Spaces.marginTop[4]]}>
              {[cityLabel, activityLabel].filter(Boolean).join(' • ') || documentId}
            </Text>
            <View style={[Alignments.row, styles.badgeRow, Spaces.marginTop[8]]}>
              {badges.map((badge) => {
                const badgeColors = getBadgePresentation(badge.tone, Colors);
                return (
                  <View
                    key={badge.label}
                    style={[
                      ApplicationStyle.borderRadius12,
                      Spaces.paddingHorizontal[8],
                      Spaces.paddingVertical[4],
                      styles.badge,
                      {
                        backgroundColor: badgeColors.backgroundColor,
                        borderColor: badgeColors.borderColor,
                      },
                    ]}
                  >
                    <Text style={[Fonts.p3Bold, { color: badgeColors.textColor }]}>
                      {badge.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {!selectionMode ? (
            <Image
              source={rightIcon}
              style={[styles.rightIcon, { tintColor: Colors.neutral200 }]}
            />
          ) : null}
        </View>
      </TouchableOpacity>
    );
  }, [
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Images.check,
    Spaces,
    navigation,
    selectedSet,
    selectionMode,
    toggleSelection,
  ]);

  if (isLoading && !clubs.length) {
    return (
      <AdminStateView
        description="Nous chargeons la console Club depuis le moteur SuperAdmin."
        isLoading
        title="Chargement des clubs"
      />
    );
  }

  if (error && !clubs.length) {
    return (
      <AdminStateView
        actionLabel="Réessayer"
        description={getErrorMessage(error, 'generic') || 'Impossible de charger les clubs.'}
        onAction={refetch}
        title="Chargement impossible"
      />
    );
  }

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="tab-scene">
      <View style={[Spaces.paddingHorizontal[24], Spaces.marginTop[18], Spaces.marginBottom[16]]}>
        <Text style={[Fonts.label, Fonts.uppercase, { color: Colors.primary500 }]}>
          Superadmin
        </Text>
        <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12], Spaces.marginTop[6]]}>
          <View style={styles.headerText}>
            <Text style={[Fonts.h1Bold, Fonts.neutral00]}>Gestion Clubs</Text>
            <Text style={[Fonts.p2, Fonts.neutral200, Spaces.marginTop[4]]}>
              {totalLabel}
              {' '}
              {totalSuffix}
              {isFetching ? ' • synchronisation...' : ''}
            </Text>
          </View>
          <Button
            icon="plus"
            iconPosition="after"
            onPress={() => navigation.navigate(RouteNames.AdminClubForm)}
            size="sm"
            title="Créer"
          />
        </View>
      </View>

      <View style={[Spaces.paddingHorizontal[superAdminLayout.pageHorizontal], Spaces.gap[12], Spaces.marginBottom[12]]}>
        <View
          style={[
            ApplicationStyle.card,
            Alignments.row,
            Alignments.alignCenter,
            Spaces.paddingHorizontal[12],
            Spaces.paddingVertical[10],
            {
              backgroundColor: Colors.primary700,
              borderColor: Colors.primary500,
            },
          ]}
        >
          <Image
            source={searchIcon}
            style={[styles.searchIcon, { tintColor: Colors.neutral300 }]}
          />
          <TextInput
            onChangeText={setQuery}
            placeholder="Rechercher un club..."
            placeholderTextColor={Colors.neutral300}
            style={[Fonts.p1, styles.inputText, { color: Colors.neutral00 }]}
            value={query}
          />
          {query.length > 0 ? (
            <TouchableOpacity
              hitSlop={{
                bottom: 8,
                left: 8,
                right: 8,
                top: 8,
              }}
              onPress={() => setQuery('')}
            >
              <Image
                source={closeIcon}
                style={[styles.closeIcon, { tintColor: Colors.neutral300 }]}
              />
            </TouchableOpacity>
          ) : null}
        </View>

        <TextInput
          onChangeText={setCity}
          placeholder="Filtrer la page par ville ou code postal"
          placeholderTextColor={Colors.neutral300}
          style={[
            ApplicationStyle.card,
            Fonts.p1,
            Spaces.paddingHorizontal[12],
            Spaces.paddingVertical[10],
            {
              backgroundColor: Colors.primary700,
              borderColor: Colors.primary500,
              color: Colors.neutral00,
            },
          ]}
          value={city}
        />

        {renderFilterGroup(
          'Tri',
          SORT_OPTIONS.map((option) => renderChip(
            option.label,
            sortMode === option.key,
            () => setSortMode(option.key),
          )),
        )}
        {renderFilterGroup(
          'Client',
          BOOLEAN_FILTERS.map((option) => renderChip(
            option.label,
            customerFilter === option.key,
            () => setCustomerFilter(option.key),
          )),
        )}
        {renderFilterGroup(
          'Réservation',
          BOOLEAN_FILTERS.map((option) => renderChip(
            option.label,
            reservationFilter === option.key,
            () => setReservationFilter(option.key),
          )),
        )}

        <View style={[Alignments.row, Spaces.gap[8]]}>
          <Button
            onPress={() => (selectionMode ? leaveSelectionMode() : setSelectionMode(true))}
            size="sm"
            title={selectionMode ? 'Annuler sélection' : 'Sélection'}
            variant="Secondary"
          />
          {selectionMode ? (
            <Button
              onPress={selectAllVisible}
              size="sm"
              title="Tout"
              variant="SecondaryLight"
            />
          ) : null}
        </View>

        {selectionMode ? (
          <View
            style={[
              ApplicationStyle.card,
              ApplicationStyle.borderRadius16,
              Spaces.padding[12],
              Spaces.gap[8],
              {
                backgroundColor: Colors.primary700,
                borderColor: Colors.primary500,
              },
            ]}
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {selectedCount}
              {' '}
              clubs sélectionnés
            </Text>
            <View style={[Alignments.row, styles.bulkActions]}>
              <Button onPress={() => openDangerAction('customer-on')} size="sm" title="Client oui" variant="Secondary" />
              <Button onPress={() => openDangerAction('customer-off')} size="sm" title="Client non" variant="Secondary" />
              <Button onPress={() => openDangerAction('reservation-on')} size="sm" title="Résa oui" variant="Secondary" />
              <Button onPress={() => openDangerAction('reservation-off')} size="sm" title="Résa non" variant="Secondary" />
              <Button onPress={() => openDangerAction('delete')} size="sm" title="Supprimer" variant="SecondaryLight" />
            </View>
          </View>
        ) : null}
      </View>

      <FlatList
        contentContainerStyle={[
          Spaces.paddingHorizontal[superAdminLayout.pageHorizontal],
          Spaces.paddingBottom[superAdminLayout.pageBottom],
        ]}
        data={clubs}
        keyExtractor={(item) => getDocumentId(item)}
        ListEmptyComponent={
          !isLoading ? (
            <View style={[Alignments.alignCenter, Spaces.marginTop[40], Spaces.paddingHorizontal[24]]}>
              <Text style={[Fonts.h4Bold, { color: Colors.neutral100 }]}>Aucun club trouvé</Text>
              <Text style={[Fonts.p2, { color: Colors.neutral300 }, Spaces.marginTop[8], styles.emptyText]}>
                Ajustez la recherche ou les filtres.
              </Text>
            </View>
          ) : null
        }
        onRefresh={refetch}
        refreshing={isFetching}
        renderItem={renderClub}
      />

      <BottomModal
        close={closeDangerAction}
        isVisible={Boolean(dangerAction)}
        snapPoints={['46%']}
      >
        <Text style={[Fonts.h3, Fonts.neutral00]}>Action SuperAdmin</Text>
        <Text style={[Fonts.p2, Fonts.neutral300, Spaces.marginTop[8]]}>
          Cette action sera appliquée aux clubs sélectionnés et auditée.
        </Text>
        <TextInput
          multiline
          onChangeText={setDangerReason}
          placeholder="Raison obligatoire"
          placeholderTextColor={Colors.neutral300}
          style={[
            ApplicationStyle.card,
            Fonts.p1,
            Spaces.marginTop[14],
            Spaces.padding[12],
            styles.reasonInput,
            {
              backgroundColor: Colors.primary700,
              borderColor: Colors.primary500,
              color: Colors.neutral00,
            },
          ]}
          value={dangerReason}
        />
        <View style={[Spaces.gap[10], Spaces.marginTop[14]]}>
          <Button
            isLoading={bulkDeleteMutation.isPending || bulkUpdateMutation.isPending}
            onPress={executeDangerAction}
            title="Confirmer"
          />
          <Button onPress={closeDangerAction} title="Annuler" variant="Secondary" />
        </View>
      </BottomModal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
  },
  badgeRow: {
    flexWrap: 'wrap',
    gap: 6,
  },
  bulkActions: {
    flexWrap: 'wrap',
    gap: 8,
  },
  checkIcon: {
    height: 13,
    tintColor: '#ffffff',
    width: 13,
  },
  chip: {
    borderWidth: 1,
    marginRight: 8,
    minHeight: 38,
  },
  closeIcon: {
    height: 14,
    width: 14,
  },
  clubCard: {
    elevation: 7,
    shadowOpacity: 0.14,
    shadowRadius: 12,
  },
  clubContent: {
    flex: 1,
    minWidth: 0,
  },
  emptyText: {
    textAlign: 'center',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  horizontalChips: {
    paddingRight: 12,
  },
  inputText: {
    flex: 1,
  },
  logoFrame: {
    borderRadius: 14,
    borderWidth: 1,
    height: 56,
    overflow: 'hidden',
    width: 56,
  },
  logoImage: {
    height: 56,
    width: 56,
  },
  reasonInput: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  rightIcon: {
    height: 14,
    width: 14,
  },
  searchIcon: {
    height: 18,
    marginRight: 8,
    width: 18,
  },
  selectionDot: {
    borderRadius: 13,
    borderWidth: 1,
    height: 26,
    width: 26,
  },
});

export default AdminClubList;
