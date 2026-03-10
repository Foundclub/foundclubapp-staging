// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  getEntryCardViewModel,
  getListRequestConfig,
  SUPERADMIN_SORT_MODES,
  SUPERADMIN_SORT_OPTIONS,
} from '@/services/admin/superadminDisplaySchema';
import {
  useBulkSuperadminEntries,
  useDeleteSuperadminEntry,
  useGetSuperadminContentMetadata,
  useGetSuperadminEntries,
} from '@/services/admin/superadminQueries';

const rightIcon = require('@/assets/icons/arrowRight.png');
const closeIcon = require('@/assets/icons/close.png');
const plusIcon = require('@/assets/icons/plus.png');
const searchIcon = require('@/assets/icons/search.png');

let clipboardModule;

const getClipboardModule = () => {
  if (clipboardModule !== undefined) return clipboardModule;

  try {
    // eslint-disable-next-line global-require
    const maybeModule = require('@react-native-clipboard/clipboard');
    clipboardModule = maybeModule?.default || maybeModule;
    return clipboardModule;
  } catch (_error) {
    clipboardModule = null;
    return null;
  }
};

const getBadgeColors = (tone, colors) => {
  if (tone === 'success') {
    return { backgroundColor: colors.success100, textColor: colors.success700 };
  }
  if (tone === 'warning') {
    return { backgroundColor: colors.warning100, textColor: colors.warning900 };
  }
  if (tone === 'danger') {
    return { backgroundColor: colors.error100, textColor: colors.error700 };
  }
  return { backgroundColor: colors.neutral700, textColor: colors.neutral100 };
};

const getBulkActionLabel = (action) => {
  if (action === 'delete') return 'Supprimer';
  if (action === 'publish') return 'Publier';
  if (action === 'unpublish') return 'Depublier';
  return 'Appliquer';
};

/**
 * @param {{ navigation: any; route: any }} props
 * @returns {import('react').ReactElement}
 */
function SuperAdminEntryList({ navigation, route }) {
  const uid = route?.params?.uid;
  const displayName = route?.params?.displayName || uid;

  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [sortMode, setSortMode] = useState(SUPERADMIN_SORT_MODES.updated);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const [deleteReason, setDeleteReason] = useState('');
  const [targetToDelete, setTargetToDelete] = useState(null);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState([]);
  const [bulkAction, setBulkAction] = useState(null);
  const [bulkReason, setBulkReason] = useState('');

  const pageSize = 20;

  const metadataQuery = useGetSuperadminContentMetadata(uid);
  const attributes = useMemo(
    () => metadataQuery?.data?.data?.attributes || [],
    [metadataQuery?.data?.data?.attributes],
  );

  const listRequestConfig = useMemo(() => getListRequestConfig({
    attributes,
    sortMode,
    uid,
  }), [attributes, sortMode, uid]);

  const params = useMemo(() => ({
    fields: listRequestConfig.fields,
    pagination: {
      page,
      pageSize,
    },
    q: query.trim() || undefined,
    sort: listRequestConfig.sort,
  }), [listRequestConfig.fields, listRequestConfig.sort, page, pageSize, query]);

  const { data, isLoading, refetch } = useGetSuperadminEntries(uid, params);
  const deleteMutation = useDeleteSuperadminEntry();
  const bulkMutation = useBulkSuperadminEntries();

  useEffect(() => {
    if (!feedbackMessage) return undefined;
    const timer = setTimeout(() => setFeedbackMessage(''), 1800);
    return () => clearTimeout(timer);
  }, [feedbackMessage]);

  const entries = useMemo(
    () => (Array.isArray(data?.data) ? data.data : []),
    [data?.data],
  );
  const pagination = data?.meta?.pagination || {
    page: 1,
    pageCount: 0,
    pageSize,
    total: 0,
  };

  const pageEntryIds = useMemo(
    () => entries.map((entry) => String(entry?.documentId || '').trim()).filter(Boolean),
    [entries],
  );

  const selectedCount = selectedDocumentIds.length;

  const areAllPageEntriesSelected = useMemo(() => (
    pageEntryIds.length > 0
    && pageEntryIds.every((documentId) => selectedDocumentIds.includes(documentId))
  ), [pageEntryIds, selectedDocumentIds]);

  const clearSelection = () => setSelectedDocumentIds([]);

  const leaveSelectionMode = () => {
    setIsSelectionMode(false);
    clearSelection();
  };

  const toggleSelectionMode = () => {
    if (isSelectionMode) {
      leaveSelectionMode();
      return;
    }
    setIsSelectionMode(true);
  };

  const toggleEntrySelection = (documentId) => {
    if (!documentId) return;
    setSelectedDocumentIds((previous) => {
      if (previous.includes(documentId)) {
        return previous.filter((currentId) => currentId !== documentId);
      }
      return [...previous, documentId];
    });
  };

  const toggleSelectAllPageEntries = () => {
    if (pageEntryIds.length === 0) return;
    setSelectedDocumentIds((previous) => {
      if (areAllPageEntriesSelected) {
        return previous.filter((id) => !pageEntryIds.includes(id));
      }
      const merged = new Set([...pageEntryIds, ...previous]);
      return Array.from(merged);
    });
  };

  const isEntrySelected = (documentId) => selectedDocumentIds.includes(documentId);

  const closeDeleteModal = () => {
    if (deleteMutation.isPending) return;
    setTargetToDelete(null);
    setDeleteReason('');
  };

  const closeBulkModal = () => {
    if (bulkMutation.isPending) return;
    setBulkAction(null);
    setBulkReason('');
  };

  const openBulkActionModal = (action) => {
    if (selectedCount === 0) {
      Alert.alert('Selection vide', 'Selectionnez au moins une entree.');
      return;
    }
    setBulkAction(action);
    setBulkReason('');
  };

  const handleCopyDocumentId = (documentId) => {
    const normalized = String(documentId || '').trim();
    if (!normalized) return;

    const clipboard = getClipboardModule();
    try {
      if (typeof clipboard?.setString === 'function') {
        clipboard.setString(normalized);
        setFeedbackMessage('ID copie');
        return;
      }

      Alert.alert('ID', normalized);
      setFeedbackMessage('Copie indisponible sur cette build');
    } catch (_error) {
      Alert.alert('Copie impossible', normalized);
    }
  };

  const handleDelete = async () => {
    const normalizedReason = deleteReason.trim();
    if (normalizedReason.length < 3) {
      Alert.alert('Raison requise', 'Minimum 3 caracteres.');
      return;
    }

    try {
      await deleteMutation.mutateAsync({
        documentId: targetToDelete?.documentId,
        reason: normalizedReason,
        uid,
      });
      closeDeleteModal();
      setFeedbackMessage('Entree supprimee');
    } catch (error) {
      Alert.alert('Suppression impossible', error?.message || 'Une erreur est survenue.');
    }
  };

  const handleBulkAction = async () => {
    const normalizedReason = bulkReason.trim();
    if (normalizedReason.length < 3) {
      Alert.alert('Raison requise', 'Minimum 3 caracteres.');
      return;
    }

    if (!bulkAction || selectedCount === 0) return;

    try {
      const selectedBeforeRequest = selectedCount;
      const result = await bulkMutation.mutateAsync({
        action: bulkAction,
        documentIds: selectedDocumentIds,
        reason: normalizedReason,
        uid,
      });

      const succeededCount = Number(result?.data?.succeededCount ?? result?.data?.deletedCount ?? 0);
      const failedCount = Number(result?.data?.failedCount ?? 0);

      closeBulkModal();
      clearSelection();

      if (failedCount > 0) {
        setFeedbackMessage(`${succeededCount}/${selectedBeforeRequest} action(s) appliquee(s)`);
      } else {
        setFeedbackMessage(`${succeededCount} action(s) appliquee(s)`);
      }
    } catch (error) {
      Alert.alert('Action de masse impossible', error?.message || 'Une erreur est survenue.');
    }
  };

  const bulkActionButtonColor = (() => {
    if (bulkMutation.isPending) return Colors.neutral700;
    if (bulkAction === 'delete') return Colors.error500;
    return Colors.primary500;
  })();

  return (
    <ScreenContainer bgImage="bg2">
      <View style={[Spaces.paddingHorizontal[24], Spaces.marginTop[16]]}>
        <Text numberOfLines={1} style={[Fonts.h2, Fonts.neutral00]}>{displayName}</Text>
        <Text numberOfLines={1} style={[Fonts.p2, { color: Colors.neutral300 }, Spaces.marginTop[4]]}>
          {uid}
        </Text>
      </View>

      <View style={[Spaces.paddingHorizontal[16], Spaces.marginTop[12], Spaces.marginBottom[12], Spaces.gap[8]]}>
        <View
          style={[
            ApplicationStyle.card,
            Alignments.row,
            Alignments.alignCenter,
            Spaces.paddingHorizontal[12],
            Spaces.paddingVertical[8],
            { backgroundColor: 'rgba(12, 12, 13, 0.6)' },
          ]}
        >
          <Image
            source={searchIcon}
            style={{
              height: 18,
              marginRight: 8,
              tintColor: Colors.neutral300,
              width: 18,
            }}
          />
          <TextInput
            onChangeText={(text) => {
              setQuery(text);
              setPage(1);
            }}
            placeholder="Rechercher une entree"
            placeholderTextColor={Colors.neutral300}
            style={[Fonts.p1, { color: Colors.neutral00, flex: 1 }]}
            value={query}
          />
          {query.length > 0 ? (
            <TouchableOpacity
              hitSlop={{
                bottom: 8, left: 8, right: 8, top: 8,
              }}
              onPress={() => {
                setQuery('');
                setPage(1);
              }}
            >
              <Image
                source={closeIcon}
                style={{ height: 14, tintColor: Colors.neutral300, width: 14 }}
              />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={[Alignments.row, Spaces.gap[8]]}>
          {SUPERADMIN_SORT_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.key}
              onPress={() => {
                setSortMode(option.key);
                setPage(1);
              }}
              style={[
                ApplicationStyle.borderRadius12,
                Spaces.paddingHorizontal[10],
                Spaces.paddingVertical[8],
                {
                  backgroundColor: sortMode === option.key ? Colors.primary700 : Colors.neutral700,
                  borderColor: sortMode === option.key ? Colors.primary500 : Colors.neutral600,
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[Fonts.p3, { color: sortMode === option.key ? Colors.primary200 : Colors.neutral100 }]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate(RouteNames.SuperAdminEntryForm, {
            mode: 'create',
            uid,
            uidDisplayName: displayName,
          })}
          style={[
            ApplicationStyle.buttonPrimary,
            Alignments.row,
            Alignments.alignCenter,
            Alignments.justifyCenter,
            Spaces.gap[8],
            { minHeight: 44 },
          ]}
        >
          <Image
            source={plusIcon}
            style={{ height: 16, tintColor: Colors.neutral00, width: 16 }}
          />
          <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>Creer une entree</Text>
        </TouchableOpacity>

        <View style={[Alignments.row, Spaces.gap[8]]}>
          <TouchableOpacity
            onPress={toggleSelectionMode}
            style={[
              ApplicationStyle.borderRadius12,
              Spaces.paddingHorizontal[10],
              Spaces.paddingVertical[8],
              {
                backgroundColor: isSelectionMode ? Colors.primary700 : Colors.neutral700,
                borderColor: isSelectionMode ? Colors.primary500 : Colors.neutral600,
                borderWidth: 1,
              },
            ]}
          >
            <Text style={[Fonts.p3, { color: Colors.neutral00 }]}>
              {isSelectionMode ? 'Quitter selection' : 'Selection multiple'}
            </Text>
          </TouchableOpacity>

          {isSelectionMode ? (
            <TouchableOpacity
              onPress={toggleSelectAllPageEntries}
              style={[
                ApplicationStyle.borderRadius12,
                Spaces.paddingHorizontal[10],
                Spaces.paddingVertical[8],
                {
                  backgroundColor: Colors.neutral700,
                  borderColor: Colors.neutral600,
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[Fonts.p3, { color: Colors.neutral100 }]}>
                {areAllPageEntriesSelected ? 'Tout deselectionner' : 'Tout selectionner'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
          <Text style={[Fonts.p2, { color: Colors.neutral200 }]}>
            Total:
            {' '}
            {pagination.total || 0}
          </Text>
          <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
            Page
            {' '}
            {pagination.page || 1}
            {' / '}
            {pagination.pageCount || 1}
          </Text>
        </View>

        {feedbackMessage ? (
          <View
            style={[
              ApplicationStyle.borderRadius12,
              Spaces.paddingHorizontal[10],
              Spaces.paddingVertical[8],
              {
                alignSelf: 'flex-start',
                backgroundColor: 'rgba(39, 214, 163, 0.18)',
                borderColor: Colors.success500,
                borderWidth: 1,
              },
            ]}
          >
            <Text style={[Fonts.p3, { color: Colors.success500 }]}>{feedbackMessage}</Text>
          </View>
        ) : null}

        {isSelectionMode && selectedCount > 0 ? (
          <View
            style={[
              ApplicationStyle.card,
              Spaces.padding[10],
              Spaces.gap[8],
              { backgroundColor: 'rgba(0, 26, 34, 0.65)' },
            ]}
          >
            <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
              {selectedCount}
              {' '}
              entree(s) selectionnee(s)
            </Text>
            <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
              <TouchableOpacity
                onPress={() => openBulkActionModal('publish')}
                style={[
                  ApplicationStyle.borderRadius12,
                  Spaces.paddingHorizontal[10],
                  Spaces.paddingVertical[6],
                  {
                    backgroundColor: Colors.primary700,
                    borderColor: Colors.primary500,
                    borderWidth: 1,
                  },
                ]}
              >
                <Text style={[Fonts.p3, { color: Colors.primary200 }]}>Publier</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => openBulkActionModal('unpublish')}
                style={[
                  ApplicationStyle.borderRadius12,
                  Spaces.paddingHorizontal[10],
                  Spaces.paddingVertical[6],
                  {
                    backgroundColor: Colors.neutral700,
                    borderColor: Colors.neutral600,
                    borderWidth: 1,
                  },
                ]}
              >
                <Text style={[Fonts.p3, { color: Colors.neutral100 }]}>Depublier</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => openBulkActionModal('delete')}
                style={[
                  ApplicationStyle.borderRadius12,
                  Spaces.paddingHorizontal[10],
                  Spaces.paddingVertical[6],
                  {
                    backgroundColor: 'rgba(255, 40, 79, 0.14)',
                    borderColor: Colors.error500,
                    borderWidth: 1,
                  },
                ]}
              >
                <Text style={[Fonts.p3, { color: Colors.error500 }]}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </View>

      <FlatList
        contentContainerStyle={[Spaces.paddingHorizontal[16], Spaces.paddingBottom[24]]}
        data={entries}
        keyExtractor={(item) => item?.documentId}
        ListEmptyComponent={
          !isLoading ? (
            <View
              style={[
                ApplicationStyle.card,
                Spaces.padding[16],
                Alignments.alignCenter,
                Spaces.marginTop[24],
              ]}
            >
              <Text style={[Fonts.h4, { color: Colors.neutral100 }]}>Aucune entree</Text>
              <Text
                style={[
                  Fonts.p2,
                  { color: Colors.neutral300 },
                  Spaces.marginTop[8],
                  { textAlign: 'center' },
                ]}
              >
                Aucune donnee ne correspond aux filtres actifs.
              </Text>
            </View>
          ) : null
        }
        refreshControl={(
          <RefreshControl
            onRefresh={refetch}
            refreshing={isLoading}
            tintColor={Colors.primary500}
          />
        )}
        renderItem={({ item }) => {
          const viewModel = getEntryCardViewModel({ entry: item, uid });
          const currentDocumentId = item?.documentId;
          const selected = isEntrySelected(currentDocumentId);

          return (
            <View
              style={[
                ApplicationStyle.card,
                Spaces.padding[14],
                Spaces.marginBottom[10],
                {
                  backgroundColor: 'rgba(0, 18, 24, 0.55)',
                  borderColor: selected ? Colors.primary500 : undefined,
                  borderWidth: selected ? 1 : 0,
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => {
                  if (isSelectionMode) {
                    toggleEntrySelection(currentDocumentId);
                    return;
                  }

                  navigation.navigate(RouteNames.SuperAdminEntryDetail, {
                    documentId: currentDocumentId,
                    uid,
                    uidDisplayName: displayName,
                  });
                }}
                style={[Alignments.row, Alignments.alignCenter]}
              >
                {isSelectionMode ? (
                  <TouchableOpacity
                    onPress={() => toggleEntrySelection(currentDocumentId)}
                    style={[
                      ApplicationStyle.borderRadius12,
                      Spaces.marginRight[8],
                      {
                        alignItems: 'center',
                        backgroundColor: selected ? Colors.primary500 : 'transparent',
                        borderColor: selected ? Colors.primary500 : Colors.neutral500,
                        borderWidth: 1,
                        height: 22,
                        justifyContent: 'center',
                        width: 22,
                      },
                    ]}
                  >
                    <Text style={[Fonts.p3, { color: Colors.neutral00 }]}>{selected ? 'X' : ''}</Text>
                  </TouchableOpacity>
                ) : null}

                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[Fonts.h4, { color: Colors.neutral00 }]}>{viewModel.title}</Text>
                  <Text
                    numberOfLines={1}
                    style={[Fonts.p3, { color: Colors.neutral300 }, Spaces.marginTop[2]]}
                  >
                    {viewModel.shortDocumentId || viewModel.documentId}
                  </Text>
                </View>

                <Image
                  source={rightIcon}
                  style={{
                    height: 14,
                    tintColor: isSelectionMode ? Colors.neutral600 : Colors.neutral300,
                    width: 14,
                  }}
                />
              </TouchableOpacity>

              {viewModel.badges.length > 0 ? (
                <View style={[Alignments.row, Spaces.gap[8], Spaces.marginTop[8], { flexWrap: 'wrap' }]}>
                  {viewModel.badges.map((badge) => {
                    const colors = getBadgeColors(badge.tone, Colors);
                    return (
                      <View
                        key={badge.key}
                        style={[
                          ApplicationStyle.borderRadius12,
                          Spaces.paddingHorizontal[8],
                          Spaces.paddingVertical[4],
                          { backgroundColor: colors.backgroundColor },
                        ]}
                      >
                        <Text style={[Fonts.p3, { color: colors.textColor }]}>{badge.label}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}

              <View style={[Spaces.marginTop[8], Spaces.gap[4]]}>
                {viewModel.fields.map((field) => (
                  <View key={field.key} style={[Alignments.row, { justifyContent: 'space-between' }]}>
                    <Text style={[Fonts.p3, { color: Colors.neutral300, flex: 1 }]}>{field.label}</Text>
                    <Text
                      numberOfLines={1}
                      style={[Fonts.p3, { color: Colors.neutral100, flex: 1, textAlign: 'right' }]}
                    >
                      {field.value}
                    </Text>
                  </View>
                ))}
              </View>

              <View
                style={[
                  Alignments.row,
                  Alignments.justifySpaceBetween,
                  Alignments.alignCenter,
                  Spaces.marginTop[10],
                ]}
              >
                <Text style={[Fonts.p3, { color: Colors.primary200 }]}>
                  Maj:
                  {viewModel.updatedAt || '-'}
                </Text>

                {!isSelectionMode ? (
                  <View style={[Alignments.row, Spaces.gap[8]]}>
                    <TouchableOpacity
                      onPress={() => navigation.navigate(RouteNames.SuperAdminEntryForm, {
                        documentId: currentDocumentId,
                        mode: 'edit',
                        uid,
                        uidDisplayName: displayName,
                      })}
                      style={[
                        ApplicationStyle.borderRadius12,
                        Spaces.paddingHorizontal[10],
                        Spaces.paddingVertical[6],
                        {
                          backgroundColor: Colors.primary700,
                          borderColor: Colors.primary500,
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <Text style={[Fonts.p3, { color: Colors.primary200 }]}>Modifier</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleCopyDocumentId(currentDocumentId)}
                      style={[
                        ApplicationStyle.borderRadius12,
                        Spaces.paddingHorizontal[10],
                        Spaces.paddingVertical[6],
                        {
                          backgroundColor: Colors.neutral700,
                          borderColor: Colors.neutral600,
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <Text style={[Fonts.p3, { color: Colors.neutral100 }]}>Copier ID</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        setTargetToDelete(item);
                        setDeleteReason('');
                      }}
                      style={[
                        ApplicationStyle.borderRadius12,
                        Spaces.paddingHorizontal[10],
                        Spaces.paddingVertical[6],
                        {
                          backgroundColor: 'rgba(255, 40, 79, 0.14)',
                          borderColor: Colors.error500,
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <Text style={[Fonts.p3, { color: Colors.error500 }]}>Supprimer</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            </View>
          );
        }}
      />

      <View
        style={[
          ApplicationStyle.backgroundColor.neutral900,
          Spaces.paddingHorizontal[16],
          Spaces.paddingVertical[10],
          Alignments.row,
          Alignments.alignCenter,
          Alignments.justifySpaceBetween,
          { borderColor: Colors.neutral700, borderTopWidth: 1 },
        ]}
      >
        <TouchableOpacity
          disabled={pagination.page <= 1}
          onPress={() => setPage((previous) => Math.max(1, previous - 1))}
          style={[
            ApplicationStyle.borderRadius12,
            Spaces.paddingHorizontal[12],
            Spaces.paddingVertical[8],
            { backgroundColor: pagination.page <= 1 ? Colors.neutral700 : Colors.primary700 },
          ]}
        >
          <Text style={[Fonts.p2, { color: Colors.neutral00 }]}>Precedent</Text>
        </TouchableOpacity>

        <Text style={[Fonts.p2, { color: Colors.neutral100 }]}>
          {pagination.page || 1}
          {' / '}
          {pagination.pageCount || 1}
        </Text>

        <TouchableOpacity
          disabled={pagination.page >= (pagination.pageCount || 1)}
          onPress={() => setPage((previous) => previous + 1)}
          style={[
            ApplicationStyle.borderRadius12,
            Spaces.paddingHorizontal[12],
            Spaces.paddingVertical[8],
            {
              backgroundColor: pagination.page >= (pagination.pageCount || 1)
                ? Colors.neutral700
                : Colors.primary700,
            },
          ]}
        >
          <Text style={[Fonts.p2, { color: Colors.neutral00 }]}>Suivant</Text>
        </TouchableOpacity>
      </View>

      <BottomModal
        close={closeDeleteModal}
        isVisible={Boolean(targetToDelete)}
        scrollable={false}
        snapPoints={['45%']}
      >
        <Text style={[Fonts.h3, { color: Colors.neutral00 }]}>Supprimer l&apos;entree</Text>
        <Text style={[Fonts.p2, { color: Colors.neutral200 }, Spaces.marginTop[8]]}>
          Cette action est definitive et necessite une raison d&apos;audit.
        </Text>

        <View style={[ApplicationStyle.card, Spaces.padding[10], Spaces.marginTop[10]]}>
          <Text numberOfLines={1} style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
            {getEntryCardViewModel({ entry: targetToDelete || {}, uid }).title}
          </Text>
          <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral300 }, Spaces.marginTop[4]]}>
            {targetToDelete?.documentId}
          </Text>
        </View>

        <TextInput
          multiline
          onChangeText={setDeleteReason}
          placeholder="Raison obligatoire (minimum 3 caracteres)"
          placeholderTextColor={Colors.neutral400}
          style={[
            ApplicationStyle.borderRadius12,
            Fonts.p2,
            Spaces.marginTop[10],
            {
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderColor: Colors.neutral600,
              borderWidth: 1,
              color: Colors.neutral00,
              minHeight: 84,
              paddingHorizontal: 12,
              paddingVertical: 10,
              textAlignVertical: 'top',
            },
          ]}
          value={deleteReason}
        />

        <View style={[Alignments.row, Spaces.gap[8], Spaces.marginTop[12]]}>
          <TouchableOpacity
            onPress={closeDeleteModal}
            style={[
              ApplicationStyle.borderRadius12,
              Spaces.paddingVertical[12],
              { backgroundColor: Colors.neutral700, flex: 1 },
            ]}
          >
            <Text style={[Fonts.p2Bold, { color: Colors.neutral100, textAlign: 'center' }]}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={deleteMutation.isPending}
            onPress={handleDelete}
            style={[
              ApplicationStyle.borderRadius12,
              Spaces.paddingVertical[12],
              {
                backgroundColor: deleteMutation.isPending ? Colors.neutral700 : Colors.error500,
                flex: 1,
              },
            ]}
          >
            <Text style={[Fonts.p2Bold, { color: Colors.neutral00, textAlign: 'center' }]}>
              {deleteMutation.isPending ? 'Suppression...' : 'Supprimer'}
            </Text>
          </TouchableOpacity>
        </View>
      </BottomModal>
      <BottomModal
        close={closeBulkModal}
        isVisible={Boolean(bulkAction)}
        scrollable={false}
        snapPoints={['50%']}
      >
        <Text style={[Fonts.h3, { color: Colors.neutral00 }]}>
          {getBulkActionLabel(bulkAction)}
          {' '}
          les entrees
        </Text>
        <Text style={[Fonts.p2, { color: Colors.neutral200 }, Spaces.marginTop[8]]}>
          {selectedCount}
          {' '}
          entree(s) seront traitees. Une raison d&apos;audit est obligatoire.
        </Text>

        <TextInput
          multiline
          onChangeText={setBulkReason}
          placeholder="Raison obligatoire (minimum 3 caracteres)"
          placeholderTextColor={Colors.neutral400}
          style={[
            ApplicationStyle.borderRadius12,
            Fonts.p2,
            Spaces.marginTop[10],
            {
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderColor: Colors.neutral600,
              borderWidth: 1,
              color: Colors.neutral00,
              minHeight: 84,
              paddingHorizontal: 12,
              paddingVertical: 10,
              textAlignVertical: 'top',
            },
          ]}
          value={bulkReason}
        />

        <View style={[Alignments.row, Spaces.gap[8], Spaces.marginTop[12]]}>
          <TouchableOpacity
            onPress={closeBulkModal}
            style={[
              ApplicationStyle.borderRadius12,
              Spaces.paddingVertical[12],
              { backgroundColor: Colors.neutral700, flex: 1 },
            ]}
          >
            <Text style={[Fonts.p2Bold, { color: Colors.neutral100, textAlign: 'center' }]}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={bulkMutation.isPending}
            onPress={handleBulkAction}
            style={[
              ApplicationStyle.borderRadius12,
              Spaces.paddingVertical[12],
              {
                backgroundColor: bulkActionButtonColor,
                flex: 1,
              },
            ]}
          >
            <Text style={[Fonts.p2Bold, { color: Colors.neutral00, textAlign: 'center' }]}>
              {bulkMutation.isPending ? 'Traitement...' : getBulkActionLabel(bulkAction)}
            </Text>
          </TouchableOpacity>
        </View>
      </BottomModal>
    </ScreenContainer>
  );
}

export default SuperAdminEntryList;
