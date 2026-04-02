import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useMessaging from '@/domains/messaging/useMessaging';
import useTheme from '@/theme/themeContext';

import AdminStateView from '@/views/admin/components/AdminStateView';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  formatJsonPreview,
  getEntryDetailViewModel,
} from '@/services/admin/superadminDisplaySchema';
import {
  useDeleteSuperadminEntry,
  useGetSuperadminContentMetadata,
  useGetSuperadminEntry,
} from '@/services/admin/superadminQueries';

const getBadgeColors = (tone, colors) => {
  if (tone === 'success') {
    return {
      backgroundColor: colors.success100,
      textColor: colors.success700,
    };
  }
  if (tone === 'warning') {
    return {
      backgroundColor: colors.warning100,
      textColor: colors.warning900,
    };
  }
  if (tone === 'danger') {
    return {
      backgroundColor: colors.error100,
      textColor: colors.error700,
    };
  }
  return {
    backgroundColor: colors.neutral700,
    textColor: colors.neutral100,
  };
};

const DETAIL_LAYOUT = Object.freeze({
  cardPadding: 16,
  pageHorizontal: 16,
  pageTop: 20,
  sectionGap: 12,
});

/**
 * @param {{ navigation: any; route: any }} props
 * @returns {import('react').ReactElement}
 */
function SuperAdminEntryDetail({ navigation, route }) {
  const uid = route?.params?.uid;
  const uidDisplayName = route?.params?.uidDisplayName || uid;
  const documentId = route?.params?.documentId;

  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { startWhisperChat } = useMessaging();

  const [reason, setReason] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [isContacting, setIsContacting] = useState(false);

  const {
    data,
    error,
    isLoading,
    refetch,
  } = useGetSuperadminEntry(uid, documentId);

  const metadataQuery = useGetSuperadminContentMetadata(uid);
  const attributes = useMemo(
    () => metadataQuery?.data?.data?.attributes || [],
    [metadataQuery?.data?.data?.attributes],
  );

  const deleteMutation = useDeleteSuperadminEntry();
  const pageHorizontalPadding = DETAIL_LAYOUT.pageHorizontal;

  const entry = data?.data || null;
  const entryDocumentId = String(entry?.documentId || '').trim();
  const currentUserDocumentId = String(userData?.documentId || '').trim();
  const isUsersPermissionsEntry = uid === 'plugin::users-permissions.user';
  const canContactEntryUser = Boolean(isUsersPermissionsEntry && entryDocumentId);
  const auditLogs = useMemo(() => data?.meta?.audit || [], [data?.meta?.audit]);
  const viewModel = useMemo(() => getEntryDetailViewModel({
    attributes,
    entry: entry || {},
    uid,
  }), [attributes, entry, uid]);
  const jsonPreview = useMemo(() => formatJsonPreview(entry || {}), [entry]);
  const summaryRows = useMemo(() => ([
    {
      key: 'shortId',
      label: t('superAdminContentManager.detail.shortId', 'ID court'),
      value: viewModel.shortDocumentId || '-',
    },
    {
      key: 'id',
      label: t('superAdminContentManager.common.id', 'Document ID'),
      value: viewModel.documentId || '-',
    },
    {
      key: 'createdAt',
      label: t('superAdminContentManager.detail.createdAt', 'Cree le'),
      value: viewModel.createdAt || '-',
    },
    {
      key: 'updatedAt',
      label: t('superAdminContentManager.detail.updatedAt', 'Modifie le'),
      value: viewModel.updatedAt || '-',
    },
  ]), [t, viewModel.createdAt, viewModel.documentId, viewModel.shortDocumentId, viewModel.updatedAt]);
  const sectionCardStyle = [
    ApplicationStyle.card,
    Spaces.padding[DETAIL_LAYOUT.cardPadding],
    { marginBottom: DETAIL_LAYOUT.sectionGap },
    {
      backgroundColor: Colors.primary700,
      borderColor: Colors.primary700,
      borderWidth: 1,
    },
  ];

  if (!uid || !documentId) {
    return (
      <AdminStateView
        actionLabel="Retour"
        description="Les informations de l'entree superadmin sont incompletes dans l'URL."
        onAction={() => navigation.goBack()}
        title="Entree introuvable"
      />
    );
  }

  if ((isLoading || metadataQuery.isLoading) && !entry) {
    return (
      <AdminStateView
        description="Nous chargeons le detail de l'entree."
        isLoading
        title="Chargement du detail"
      />
    );
  }

  if ((error || metadataQuery.error) && !entry) {
    return (
      <AdminStateView
        actionLabel="R\u00E9essayer"
        description={error?.message || metadataQuery.error?.message || 'Impossible de charger cette entree.'}
        onAction={() => {
          metadataQuery.refetch();
          refetch();
        }}
        title="Chargement impossible"
      />
    );
  }

  if (!entry) {
    return (
      <AdminStateView
        actionLabel="Retour"
        description="Cette entree superadmin n'existe pas ou n'est plus accessible."
        onAction={() => navigation.goBack()}
        title="Entree introuvable"
      />
    );
  }

  const closeDeleteModal = () => {
    if (deleteMutation.isPending) return;
    setIsDeleteModalOpen(false);
    setReason('');
  };

  const handleDelete = async () => {
    const normalizedReason = reason.trim();
    if (normalizedReason.length < 3) {
      Alert.alert(
        t('superAdminContentManager.alerts.reasonRequiredTitle', 'Raison requise'),
        t('superAdminContentManager.alerts.reasonRequiredMessage', 'Minimum 3 caracteres.'),
      );
      return;
    }

    try {
      await deleteMutation.mutateAsync({
        documentId,
        reason: normalizedReason,
        uid,
      });
      closeDeleteModal();
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        t('superAdminContentManager.alerts.deleteFailedTitle', 'Suppression impossible'),
        error?.message || t('superAdminContentManager.common.genericError', 'Une erreur est survenue.'),
      );
    }
  };

  const handleContactEntryUser = async () => {
    if (!canContactEntryUser) return;

    if (entryDocumentId === currentUserDocumentId) {
      Alert.alert(
        t('common.info', 'Info'),
        t('messaging.errors.cannotMessageSelf', 'Impossible de lancer une conversation avec ton propre compte.'),
      );
      return;
    }

    setIsContacting(true);
    try {
      const chat = await startWhisperChat([entryDocumentId]);
      if (!chat?.documentId) {
        Alert.alert(
          t('common.errors.error', 'Erreur'),
          t('messaging.errors.failedToCreateConversation', 'Impossible de créer la conversation.'),
        );
        return;
      }
      navigation.navigate(RouteNames.Conversation, { chatId: chat.documentId });
    } catch (error) {
      Alert.alert(
        t('common.errors.error', 'Erreur'),
        error?.message || t('messaging.errors.failedToCreateConversation', 'Impossible de créer la conversation.'),
      );
    } finally {
      setIsContacting(false);
    }
  };

  return (
    <ScreenContainer bgImage="bg2">
      <ScrollView contentContainerStyle={[{ paddingHorizontal: pageHorizontalPadding }, Spaces.paddingBottom[48]]}>
        <View style={[Spaces.marginTop[DETAIL_LAYOUT.pageTop], { marginBottom: DETAIL_LAYOUT.sectionGap }]}>
          <Text numberOfLines={1} style={[Fonts.h2, Fonts.neutral00]}>
            {uidDisplayName}
          </Text>
          <Text numberOfLines={1} style={[Fonts.p1, Fonts.neutral200, Spaces.marginTop[6]]}>
            {viewModel.title}
          </Text>
        </View>

        <View style={sectionCardStyle}>
          <Text style={[Fonts.h4, Fonts.neutral00]}>
            {t('superAdminContentManager.detail.sections.summary', 'Resume')}
          </Text>
          <View style={Spaces.marginTop[10]}>
            {summaryRows.map((row, index) => (
              <View
                key={row.key}
                style={[
                  Alignments.row,
                  Alignments.alignCenter,
                  {
                    borderBottomColor: Colors.neutral700,
                    borderBottomWidth: index < summaryRows.length - 1 ? 1 : 0,
                    justifyContent: 'space-between',
                    paddingVertical: 8,
                  },
                ]}
              >
                <Text style={[Fonts.p3, { color: Colors.neutral300, flex: 1 }]}>{row.label}</Text>
                <Text
                  numberOfLines={row.key === 'id' ? 2 : 1}
                  style={[
                    Fonts.p3,
                    {
                      color: row.key === 'updatedAt' ? Colors.primary200 : Colors.neutral100,
                      flex: 1.2,
                      textAlign: 'right',
                    },
                  ]}
                >
                  {row.value}
                </Text>
              </View>
            ))}
          </View>

          {viewModel.badges.length > 0 ? (
            <View style={[Alignments.row, Spaces.gap[8], Spaces.marginTop[10], { flexWrap: 'wrap' }]}>
              {viewModel.badges.map((badge) => {
                const colors = getBadgeColors(badge.tone, Colors);
                return (
                  <View
                    key={badge.key}
                    style={[
                      ApplicationStyle.borderRadius12,
                      Spaces.paddingHorizontal[8],
                      Spaces.paddingVertical[4],
                      { borderColor: Colors.primary700, borderWidth: 1 },
                      { backgroundColor: colors.backgroundColor },
                    ]}
                  >
                    <Text style={[Fonts.p3, { color: colors.textColor }]}>{badge.label}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          <View style={[Alignments.row, Spaces.gap[8], Spaces.marginTop[12]]}>
            <Button
              onPress={() => navigation.navigate(RouteNames.SuperAdminEntryForm, {
                documentId,
                mode: 'edit',
                uid,
                uidDisplayName,
              })}
              style={{ flex: 1 }}
              title={t('superAdminContentManager.actions.edit', 'Modifier')}
              variant="Primary"
            />
            <Button
              onPress={refetch}
              style={{ flex: 1 }}
              title={t('superAdminContentManager.actions.refresh', 'Rafraichir')}
              variant="Secondary"
            />
          </View>
          {canContactEntryUser ? (
            <Button
              isLoading={isContacting}
              onPress={handleContactEntryUser}
              style={[Spaces.marginTop[8]]}
              title={t('userDetails.actions.contact', 'Contacter')}
              variant="Secondary"
            />
          ) : null}
        </View>

        <View
          style={sectionCardStyle}
        >
          <Text style={[Fonts.h4, Fonts.neutral00, Spaces.marginBottom[8]]}>
            {t('superAdminContentManager.detail.sections.keyFields', 'Champs clés')}
          </Text>
          {isLoading ? (
            <ActivityIndicator color={Colors.primary500} />
          ) : (
            <View style={Spaces.gap[6]}>
              {viewModel.keyFields.length > 0 ? viewModel.keyFields.map((field) => (
                <View
                  key={field.key}
                  style={[
                    ApplicationStyle.borderRadius12,
                    Spaces.paddingHorizontal[10],
                    Spaces.paddingVertical[8],
                    Spaces.marginBottom[8],
                    {
                      backgroundColor: Colors.primary900,
                      borderColor: Colors.primary700,
                      borderWidth: 1,
                      justifyContent: 'space-between',
                    },
                  ]}
                >
                  <Text style={[Fonts.p3, { color: Colors.neutral300, flex: 1 }]}>{field.label}</Text>
                  <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral100, flex: 1, textAlign: 'right' }]}>
                    {field.value}
                  </Text>
                </View>
              )) : (
                <Text style={[Fonts.p2, Fonts.neutral300]}>
                  {t('superAdminContentManager.detail.noKeyFields', 'Aucun champ cle détecté.')}
                </Text>
              )}
            </View>
          )}
        </View>

        <View
          style={sectionCardStyle}
        >
          <Text style={[Fonts.h4, Fonts.neutral00, Spaces.marginBottom[8]]}>
            {t('superAdminContentManager.detail.sections.relationsMedia', 'Relations / Médias')}
          </Text>
          {viewModel.complexFields.length > 0 ? (
            <View style={Spaces.gap[8]}>
              {viewModel.complexFields.map((field) => (
                <View
                  key={field.key}
                  style={[
                    ApplicationStyle.backgroundColor.neutral700,
                    ApplicationStyle.borderRadius12,
                    Spaces.paddingHorizontal[10],
                    Spaces.paddingVertical[8],
                    {
                      backgroundColor: Colors.primary900,
                      borderColor: Colors.primary700,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Text style={[Fonts.p3, Fonts.neutral300]}>{field.label}</Text>
                  <Text style={[Fonts.p2, Fonts.neutral100, Spaces.marginTop[4]]}>{field.value}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[Fonts.p2, Fonts.neutral300]}>
              {t('superAdminContentManager.detail.noRelations', 'Aucune relation ou media exploitable.')}
            </Text>
          )}
        </View>

        <View
          style={sectionCardStyle}
        >
          <Text style={[Fonts.h4, Fonts.neutral00, Spaces.marginBottom[8]]}>
            {t('superAdminContentManager.detail.sections.audit', 'Audit recent')}
          </Text>
          {auditLogs.length === 0 ? (
            <Text style={[Fonts.p2, Fonts.neutral300]}>
              {t('superAdminContentManager.detail.noAudit', 'Aucun log disponible.')}
            </Text>
          ) : (
            <View style={Spaces.gap[8]}>
              {auditLogs.slice(0, 20).map((log, index) => {
                const logKey = String(log?.documentId || log?.id || index);
                const action = String(log?.action || 'update').toUpperCase();
                const actor = String(log?.actorIdentifier || log?.actor || 'superadmin');
                const when = String(log?.timestamp || log?.createdAt || '');

                return (
                  <View
                    key={logKey}
                    style={[
                      ApplicationStyle.backgroundColor.neutral700,
                      ApplicationStyle.borderRadius12,
                      Spaces.paddingHorizontal[10],
                      Spaces.paddingVertical[8],
                      {
                        backgroundColor: Colors.primary900,
                        borderColor: Colors.primary700,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <View style={[Alignments.row, { justifyContent: 'space-between' }]}>
                      <Text style={[Fonts.p2Bold, Fonts.primary200]}>{action}</Text>
                      <Text style={[Fonts.p3, Fonts.neutral300]}>{when}</Text>
                    </View>
                    <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral100, Spaces.marginTop[4]]}>
                      {actor}
                    </Text>
                    {log?.reason ? (
                      <Text style={[Fonts.p3, Fonts.neutral300, Spaces.marginTop[2]]}>
                        {t('superAdminContentManager.common.reason', 'Raison')}
                        {': '}
                        {String(log.reason)}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View
          style={[
            ApplicationStyle.card,
            Spaces.padding[DETAIL_LAYOUT.cardPadding],
            { marginBottom: DETAIL_LAYOUT.sectionGap },
            {
              backgroundColor: Colors.primary900,
              borderColor: Colors.primary700,
              borderWidth: 1,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => setShowJson((previous) => !previous)}
            style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}
          >
            <Text style={[Fonts.h4, Fonts.neutral00]}>
              {t('superAdminContentManager.detail.sections.rawJson', 'JSON complet')}
            </Text>
            <Text style={[Fonts.p2Bold, Fonts.primary200]}>
              {showJson
                ? t('superAdminContentManager.actions.hide', 'Masquer')
                : t('superAdminContentManager.actions.show', 'Afficher')}
            </Text>
          </TouchableOpacity>

          {showJson ? (
            <Text style={[Fonts.p3, { color: Colors.neutral200, fontFamily: 'monospace' }, Spaces.marginTop[8]]}>
              {jsonPreview}
            </Text>
          ) : (
            <Text style={[Fonts.p2, Fonts.neutral300, Spaces.marginTop[8]]}>
              {t('superAdminContentManager.detail.rawJsonCollapsed', 'Vue avancée repliée pour garder l\'écran lisible.')}
            </Text>
          )}
        </View>

        <Button
          onPress={() => setIsDeleteModalOpen(true)}
          style={[{ backgroundColor: 'rgba(255, 40, 79, 0.14)', borderColor: Colors.error500, borderWidth: 1 }]}
          textStyle={{ color: Colors.error500 }}
          title={t('superAdminContentManager.actions.deleteEntry', 'Supprimer l\'entrée')}
          variant="Secondary"
        />
      </ScrollView>

      <BottomModal
        close={closeDeleteModal}
        isVisible={isDeleteModalOpen}
        scrollable={false}
        snapPoints={['45%']}
      >
        <Text style={[Fonts.h3, Fonts.neutral00]}>
          {t('superAdminContentManager.deleteModal.title', 'Supprimer l\'entrée')}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral200, Spaces.marginTop[8]]}>
          {t('superAdminContentManager.deleteModal.description', 'Action definitive. Une raison d\'audit est obligatoire.')}
        </Text>

        <View style={[ApplicationStyle.card, Spaces.padding[10], Spaces.marginTop[10]]}>
          <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00]}>
            {viewModel.title}
          </Text>
          <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral300, Spaces.marginTop[4]]}>
            {viewModel.documentId}
          </Text>
        </View>

        <TextInput
          multiline
          onChangeText={setReason}
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
          value={reason}
        />

        <View style={[Alignments.row, Spaces.gap[8], Spaces.marginTop[12]]}>
          <Button
            onPress={closeDeleteModal}
            style={{ flex: 1 }}
            title={t('superAdminContentManager.actions.cancel', 'Annuler')}
            variant="Secondary"
          />
          <TouchableOpacity
            disabled={deleteMutation.isPending}
            onPress={handleDelete}
            style={[
              ApplicationStyle.borderRadius12,
              Spaces.paddingVertical[12],
              {
                alignItems: 'center',
                backgroundColor: deleteMutation.isPending ? Colors.neutral700 : Colors.error500,
                flex: 1,
                justifyContent: 'center',
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
    </ScreenContainer>
  );
}

export default SuperAdminEntryDetail;
