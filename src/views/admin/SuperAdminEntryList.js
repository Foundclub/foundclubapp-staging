// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import AdminStateView from '@/views/admin/components/AdminStateView';

import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import SuperAdminEmptyState from '@/components/molecules/superAdmin/SuperAdminEmptyState';
import SuperAdminEntryActionsSheet from '@/components/molecules/superAdmin/SuperAdminEntryActionsSheet';
import SuperAdminEntryCard from '@/components/molecules/superAdmin/SuperAdminEntryCard';
import superAdminLayout from '@/components/molecules/superAdmin/superAdminLayout';
import SuperAdminListToolbar from '@/components/molecules/superAdmin/SuperAdminListToolbar';
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

const getBulkActionLabel = (action, t) => {
  if (action === 'delete') return t('superAdminContentManager.actions.delete', 'Supprimer');
  if (action === 'publish') return t('superAdminContentManager.actions.publish', 'Publier');
  if (action === 'unpublish') return t('superAdminContentManager.actions.unpublish', 'Dépublier');
  return t('superAdminContentManager.actions.apply', 'Appliquer');
};

/**
 * @param {{ navigation: any; route: any }} props
 * @returns {import('react').ReactElement}
 */
function SuperAdminEntryList({ navigation, route }) {
  const uid = route?.params?.uid;
  const displayName = route?.params?.displayName || uid;
  const pageHorizontalPadding = superAdminLayout.pageHorizontal;

  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [sortMode, setSortMode] = useState(SUPERADMIN_SORT_MODES.updated);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const [deleteReason, setDeleteReason] = useState('');
  const [targetToDelete, setTargetToDelete] = useState(null);
  const [actionTarget, setActionTarget] = useState(null);

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

  const {
    data,
    error: entriesError,
    isLoading,
    refetch,
  } = useGetSuperadminEntries(uid, params);
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
      Alert.alert(
        t('superAdminContentManager.alerts.emptySelectionTitle', 'Sélection vide'),
        t('superAdminContentManager.alerts.emptySelectionMessage', 'Sélectionnez au moins une entrée.'),
      );
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
        setFeedbackMessage(t('superAdminContentManager.feedback.idCopied', 'ID copié'));
        return;
      }

      Alert.alert(t('superAdminContentManager.common.id', 'ID'), normalized);
      setFeedbackMessage(t('superAdminContentManager.feedback.clipboardUnavailable', 'Copié indisponible sur cette build'));
    } catch (_error) {
      Alert.alert(t('superAdminContentManager.alerts.copyFailedTitle', 'Copié impossible'), normalized);
    }
  };

  const handleDelete = async () => {
    const normalizedReason = deleteReason.trim();
    if (normalizedReason.length < 3) {
      Alert.alert(
        t('superAdminContentManager.alerts.reasonRequiredTitle', 'Raison requise'),
        t('superAdminContentManager.alerts.reasonRequiredMessage', 'Minimum 3 caracteres.'),
      );
      return;
    }

    try {
      await deleteMutation.mutateAsync({
        documentId: targetToDelete?.documentId,
        reason: normalizedReason,
        uid,
      });
      closeDeleteModal();
      setFeedbackMessage(t('superAdminContentManager.feedback.entryDeleted', 'Entrée supprimée'));
    } catch (error) {
      Alert.alert(
        t('superAdminContentManager.alerts.deleteFailedTitle', 'Suppression impossible'),
        error?.message || t('superAdminContentManager.common.genericError', 'Une erreur est survenue.'),
      );
    }
  };

  const handleBulkAction = async () => {
    const normalizedReason = bulkReason.trim();
    if (normalizedReason.length < 3) {
      Alert.alert(
        t('superAdminContentManager.alerts.reasonRequiredTitle', 'Raison requise'),
        t('superAdminContentManager.alerts.reasonRequiredMessage', 'Minimum 3 caracteres.'),
      );
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
        setFeedbackMessage(`${succeededCount}/${selectedBeforeRequest} ${t('superAdminContentManager.feedback.bulkApplied', 'action(s) appliquée(s)')}`);
      } else {
        setFeedbackMessage(`${succeededCount} ${t('superAdminContentManager.feedback.bulkApplied', 'action(s) appliquée(s)')}`);
      }
    } catch (error) {
      Alert.alert(
        t('superAdminContentManager.alerts.bulkFailedTitle', 'Action de masse impossible'),
        error?.message || t('superAdminContentManager.common.genericError', 'Une erreur est survenue.'),
      );
    }
  };

  const actionTargetViewModel = useMemo(
    () => getEntryCardViewModel({ entry: actionTarget || {}, uid }),
    [actionTarget, uid],
  );

  const bulkActionButtonColor = (() => {
    if (bulkMutation.isPending) return Colors.neutral700;
    if (bulkAction === 'delete') return Colors.error500;
    return Colors.primary500;
  })();

  if (!uid) {
    return (
      <AdminStateView
        actionLabel="Retour"
        description="Le content-type superadmin est absent de l'URL."
        onAction={() => navigation.goBack()}
        title="Content-type introuvable"
      />
    );
  }

  if ((metadataQuery.isLoading || isLoading) && !entries.length) {
    return (
      <AdminStateView
        description="Nous chargeons les entrees du content manager."
        isLoading
        title="Chargement du contenu superadmin"
      />
    );
  }

  if ((metadataQuery.error || entriesError) && !entries.length) {
    return (
      <AdminStateView
        actionLabel="Reessayer"
        description={metadataQuery.error?.message || entriesError?.message || 'Impossible de charger cette liste superadmin.'}
        onAction={() => {
          metadataQuery.refetch();
          refetch();
        }}
        title="Chargement impossible"
      />
    );
  }

  return (
    <ScreenContainer bgImage="bg2">
      <View style={[{ paddingHorizontal: pageHorizontalPadding }, Spaces.marginTop[20], Spaces.marginBottom[2]]}>
        <Text numberOfLines={1} style={[Fonts.h2, Fonts.neutral00]}>{displayName}</Text>
        <Text numberOfLines={1} style={[Fonts.p2, Fonts.neutral300, Spaces.marginTop[6]]}>
          {uid}
        </Text>
      </View>

      <SuperAdminListToolbar
        feedbackMessage={feedbackMessage}
        horizontalPadding={pageHorizontalPadding}
        onClearQuery={() => {
          setQuery('');
          setPage(1);
        }}
        onCreateEntry={() => navigation.navigate(RouteNames.SuperAdminEntryForm, {
          documentId: 'new',
          mode: 'create',
          uid,
          uidDisplayName: displayName,
        })}
        onQueryChange={(text) => {
          setQuery(text);
          setPage(1);
        }}
        onSortChange={(nextSortMode) => {
          setSortMode(nextSortMode);
          setPage(1);
        }}
        pagination={pagination}
        query={query}
        selectionState={{
          areAllPageEntriesSelected,
          isSelectionMode,
          onToggleMode: toggleSelectionMode,
          onToggleSelectAll: toggleSelectAllPageEntries,
          selectedCount,
        }}
        sortMode={sortMode}
        sortOptions={SUPERADMIN_SORT_OPTIONS}
        texts={{
          create: t('superAdminContentManager.actions.createEntry', 'Créer une entrée'),
          page: t('superAdminContentManager.list.page', 'Page'),
          searchPlaceholder: t('superAdminContentManager.list.searchPlaceholder', 'Rechercher une entrée'),
          selectAll: t('superAdminContentManager.actions.selectAll', 'Tout sélectionner'),
          selected: t('superAdminContentManager.list.selectedEntries', 'entrée(s) sélectionnée(s)'),
          selectionModeOff: t('superAdminContentManager.actions.multiSelect', 'Selection multiple'),
          selectionModeOn: t('superAdminContentManager.actions.exitSelection', 'Quitter selection'),
          total: t('superAdminContentManager.list.total', 'Total'),
          unselectAll: t('superAdminContentManager.actions.unselectAll', 'Tout desélectionner'),
        }}
      />

      {isSelectionMode && selectedCount > 0 ? (
        <View
          style={[
            ApplicationStyle.card,
            Spaces.padding[12],
            Spaces.gap[10],
            { marginHorizontal: pageHorizontalPadding },
            Spaces.marginBottom[12],
            {
              backgroundColor: Colors.primary700,
              borderColor: Colors.primary700,
              borderWidth: 1,
            },
          ]}
        >
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {selectedCount}
            {' '}
            {t('superAdminContentManager.list.selectedEntries', 'entrée(s) sélectionnée(s)')}
          </Text>
          <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
            <TouchableOpacity
              onPress={() => openBulkActionModal('publish')}
              style={[
                ApplicationStyle.borderRadius12,
                Spaces.paddingHorizontal[12],
                Spaces.paddingVertical[8],
                {
                  backgroundColor: Colors.primary700,
                  borderColor: Colors.primary500,
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[Fonts.p3, { color: Colors.primary200 }]}>
                {t('superAdminContentManager.actions.publish', 'Publier')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => openBulkActionModal('unpublish')}
              style={[
                ApplicationStyle.borderRadius12,
                Spaces.paddingHorizontal[12],
                Spaces.paddingVertical[8],
                {
                  backgroundColor: Colors.primary900,
                  borderColor: Colors.primary700,
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[Fonts.p3, { color: Colors.neutral100 }]}>
                {t('superAdminContentManager.actions.unpublish', 'Dépublier')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => openBulkActionModal('delete')}
              style={[
                ApplicationStyle.borderRadius12,
                Spaces.paddingHorizontal[12],
                Spaces.paddingVertical[8],
                {
                  backgroundColor: Colors.error100,
                  borderColor: Colors.error500,
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[Fonts.p3, { color: Colors.error500 }]}>
                {t('superAdminContentManager.actions.delete', 'Supprimer')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <FlatList
        contentContainerStyle={[{ paddingHorizontal: pageHorizontalPadding }, Spaces.paddingBottom[96]]}
        data={entries}
        keyExtractor={(item) => item?.documentId}
        ListEmptyComponent={
          !isLoading ? (
            <SuperAdminEmptyState
              description={t('superAdminContentManager.empty.listDescription', 'Aucune donnée ne correspond aux filtres actifs.')}
              title={t('superAdminContentManager.empty.listTitle', 'Aucune entrée')}
            />
          ) : null
        }
        onRefresh={refetch}
        refreshing={isLoading}
        renderItem={({ item }) => {
          const viewModel = getEntryCardViewModel({ entry: item, uid });
          const currentDocumentId = item?.documentId;
          const selected = isEntrySelected(currentDocumentId);

          return (
            <SuperAdminEntryCard
              entry={item}
              isSelected={selected}
              isSelectionMode={isSelectionMode}
              labels={{
                openActions: t('superAdminContentManager.actions.more', 'Plus dactions'),
                updatedPrefix: t('superAdminContentManager.list.updatedPrefix', 'Maj:'),
              }}
              onOpenActions={!isSelectionMode
                ? () => setActionTarget(item)
                : undefined}
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
              onToggleSelect={() => toggleEntrySelection(currentDocumentId)}
              viewModel={viewModel}
            />
          );
        }}
      />

      <View
        style={[
          ApplicationStyle.backgroundColor.neutral900,
          { paddingHorizontal: pageHorizontalPadding },
          Spaces.paddingVertical[10],
          Alignments.row,
          Alignments.alignCenter,
          Alignments.justifySpaceBetween,
          { borderColor: Colors.primary700, borderTopWidth: 1 },
        ]}
      >
        <TouchableOpacity
          disabled={pagination.page <= 1}
          onPress={() => setPage((previous) => Math.max(1, previous - 1))}
          style={[
            ApplicationStyle.borderRadius12,
            Spaces.paddingHorizontal[12],
            Spaces.paddingVertical[8],
            {
              backgroundColor: pagination.page <= 1 ? Colors.neutral800 : Colors.primary700,
              borderColor: pagination.page <= 1 ? Colors.neutral600 : Colors.primary500,
              borderWidth: 1,
            },
          ]}
        >
          <Text style={[Fonts.p2, { color: Colors.neutral00 }]}>
            {t('superAdminContentManager.actions.previous', 'Precedent')}
          </Text>
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
                ? Colors.neutral800
                : Colors.primary700,
              borderColor: pagination.page >= (pagination.pageCount || 1)
                ? Colors.neutral600
                : Colors.primary500,
              borderWidth: 1,
            },
          ]}
        >
          <Text style={[Fonts.p2, { color: Colors.neutral00 }]}>
            {t('superAdminContentManager.actions.next', 'Suivant')}
          </Text>
        </TouchableOpacity>
      </View>

      <SuperAdminEntryActionsSheet
        labels={{
          close: t('superAdminContentManager.actions.close', 'Fermer'),
          copyId: t('superAdminContentManager.actions.copyId', 'Copier ID'),
          edit: t('superAdminContentManager.actions.edit', 'Modifier'),
          remove: t('superAdminContentManager.actions.delete', 'Supprimer'),
        }}
        onClose={() => setActionTarget(null)}
        onCopyId={() => {
          handleCopyDocumentId(actionTarget?.documentId);
          setActionTarget(null);
        }}
        onDelete={() => {
          setTargetToDelete(actionTarget);
          setDeleteReason('');
          setActionTarget(null);
        }}
        onEdit={() => {
          navigation.navigate(RouteNames.SuperAdminEntryForm, {
            documentId: actionTarget?.documentId,
            mode: 'edit',
            uid,
            uidDisplayName: displayName,
          });
          setActionTarget(null);
        }}
        subtitle={actionTarget?.documentId}
        title={actionTargetViewModel?.title || ''}
        visible={Boolean(actionTarget)}
      />

      <BottomModal
        close={closeDeleteModal}
        isVisible={Boolean(targetToDelete)}
        scrollable={false}
        snapPoints={['45%']}
      >
        <Text style={[Fonts.h3, Fonts.neutral00]}>
          {t('superAdminContentManager.deleteModal.title', 'Supprimer l\'entrée')}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral200, Spaces.marginTop[8]]}>
          {t('superAdminContentManager.deleteModal.description', 'Cette action est definitive et necessite une raison d\'audit.')}
        </Text>

        <View style={[ApplicationStyle.card, Spaces.padding[10], Spaces.marginTop[10]]}>
          <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00]}>
            {getEntryCardViewModel({ entry: targetToDelete || {}, uid }).title}
          </Text>
          <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral300, Spaces.marginTop[4]]}>
            {targetToDelete?.documentId}
          </Text>
        </View>

        <TextInput
          multiline
          onChangeText={setDeleteReason}
          placeholder={t('superAdminContentManager.deleteModal.reasonPlaceholder', 'Raison obligatoire (minimum 3 caracteres)')}
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
            <Text style={[Fonts.p2Bold, { color: Colors.neutral100, textAlign: 'center' }]}>
              {t('superAdminContentManager.actions.cancel', 'Annuler')}
            </Text>
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
              {deleteMutation.isPending
                ? t('superAdminContentManager.actions.deleting', 'Suppression...')
                : t('superAdminContentManager.actions.delete', 'Supprimer')}
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
          {getBulkActionLabel(bulkAction, t)}
          {' '}
          {t('superAdminContentManager.bulkModal.titleSuffix', 'les entrees')}
        </Text>
        <Text style={[Fonts.p2, { color: Colors.neutral200 }, Spaces.marginTop[8]]}>
          {selectedCount}
          {' '}
          {t('superAdminContentManager.bulkModal.description', 'entrée(s) seront traitées. Une raison d\'audit est obligatoire.')}
        </Text>

        <TextInput
          multiline
          onChangeText={setBulkReason}
          placeholder={t('superAdminContentManager.bulkModal.reasonPlaceholder', 'Raison obligatoire (minimum 3 caracteres)')}
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
            <Text style={[Fonts.p2Bold, { color: Colors.neutral100, textAlign: 'center' }]}>
              {t('superAdminContentManager.actions.cancel', 'Annuler')}
            </Text>
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
              {bulkMutation.isPending
                ? t('superAdminContentManager.actions.processing', 'Traitement...')
                : getBulkActionLabel(bulkAction, t)}
            </Text>
          </TouchableOpacity>
        </View>
      </BottomModal>
    </ScreenContainer>
  );
}

export default SuperAdminEntryList;
