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

import useTheme from '@/theme/themeContext';

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

  const [reason, setReason] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [showJson, setShowJson] = useState(false);

  const {
    data,
    isLoading,
    refetch,
  } = useGetSuperadminEntry(uid, documentId);

  const metadataQuery = useGetSuperadminContentMetadata(uid);
  const attributes = useMemo(
    () => metadataQuery?.data?.data?.attributes || [],
    [metadataQuery?.data?.data?.attributes],
  );

  const deleteMutation = useDeleteSuperadminEntry();

  const entry = data?.data || null;
  const auditLogs = useMemo(() => data?.meta?.audit || [], [data?.meta?.audit]);
  const viewModel = useMemo(() => getEntryDetailViewModel({
    attributes,
    entry: entry || {},
    uid,
  }), [attributes, entry, uid]);
  const jsonPreview = useMemo(() => formatJsonPreview(entry || {}), [entry]);

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

  return (
    <ScreenContainer bgImage="bg2">
      <ScrollView contentContainerStyle={[Spaces.paddingHorizontal[16], Spaces.paddingBottom[32]]}>
        <View style={[Spaces.marginTop[16], Spaces.marginBottom[12]]}>
          <Text numberOfLines={1} style={[Fonts.h3, Fonts.neutral00]}>
            {uidDisplayName}
          </Text>
          <Text numberOfLines={1} style={[Fonts.p2, Fonts.neutral300, Spaces.marginTop[4]]}>
            {viewModel.title}
          </Text>
        </View>

        <View style={[ApplicationStyle.card, Spaces.padding[14], Spaces.marginBottom[12], { backgroundColor: Colors.neutral800 }]}>
          <Text style={[Fonts.h4, Fonts.neutral00]}>{t('superAdminContentManager.detail.sections.summary', 'Resume')}</Text>
          <View style={[Spaces.marginTop[8], Spaces.gap[6]]}>
            <View style={[Alignments.row, { justifyContent: 'space-between' }]}>
              <Text style={[Fonts.p3, Fonts.neutral300]}>{t('superAdminContentManager.detail.shortId', 'ID court')}</Text>
              <Text style={[Fonts.p3, Fonts.neutral100]}>{viewModel.shortDocumentId || '-'}</Text>
            </View>
            <View style={[Alignments.row, { justifyContent: 'space-between' }]}>
              <Text style={[Fonts.p3, Fonts.neutral300]}>{t('superAdminContentManager.common.id', 'Document ID')}</Text>
              <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral100, maxWidth: '68%', textAlign: 'right' }]}>
                {viewModel.documentId || '-'}
              </Text>
            </View>
            <View style={[Alignments.row, { justifyContent: 'space-between' }]}>
              <Text style={[Fonts.p3, Fonts.neutral300]}>{t('superAdminContentManager.detail.createdAt', 'Cree le')}</Text>
              <Text style={[Fonts.p3, Fonts.neutral100]}>{viewModel.createdAt || '-'}</Text>
            </View>
            <View style={[Alignments.row, { justifyContent: 'space-between' }]}>
              <Text style={[Fonts.p3, Fonts.neutral300]}>{t('superAdminContentManager.detail.updatedAt', 'Modifie le')}</Text>
              <Text style={[Fonts.p3, Fonts.primary200]}>{viewModel.updatedAt || '-'}</Text>
            </View>
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
        </View>

        <View style={[ApplicationStyle.card, Spaces.padding[14], Spaces.marginBottom[12], { backgroundColor: Colors.neutral800 }]}>
          <Text style={[Fonts.h4, Fonts.neutral00, Spaces.marginBottom[8]]}>
            {t('superAdminContentManager.detail.sections.keyFields', 'Champs cles')}
          </Text>
          {isLoading ? (
            <ActivityIndicator color={Colors.primary500} />
          ) : (
            <View style={Spaces.gap[6]}>
              {viewModel.keyFields.length > 0 ? viewModel.keyFields.map((field) => (
                <View
                  key={field.key}
                  style={[
                    Alignments.row,
                    Alignments.alignCenter,
                    {
                      borderBottomColor: Colors.neutral700,
                      borderBottomWidth: 1,
                      justifyContent: 'space-between',
                      paddingVertical: 6,
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
                  {t('superAdminContentManager.detail.noKeyFields', 'Aucun champ cle detecte.')}
                </Text>
              )}
            </View>
          )}
        </View>

        <View style={[ApplicationStyle.card, Spaces.padding[14], Spaces.marginBottom[12], { backgroundColor: Colors.neutral800 }]}>
          <Text style={[Fonts.h4, Fonts.neutral00, Spaces.marginBottom[8]]}>
            {t('superAdminContentManager.detail.sections.relationsMedia', 'Relations / Medias')}
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

        <View style={[ApplicationStyle.card, Spaces.padding[14], Spaces.marginBottom[12], { backgroundColor: Colors.neutral800 }]}>
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
                      { borderColor: Colors.neutral600, borderWidth: 1 },
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

        <View style={[ApplicationStyle.card, Spaces.padding[14], Spaces.marginBottom[12], { backgroundColor: Colors.neutral900 }]}>
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
              {t('superAdminContentManager.detail.rawJsonCollapsed', 'Vue avancee repliee pour garder lecran lisible.')}
            </Text>
          )}
        </View>

        <Button
          onPress={() => setIsDeleteModalOpen(true)}
          style={[{ backgroundColor: 'rgba(255, 40, 79, 0.14)', borderColor: Colors.error500, borderWidth: 1 }]}
          textStyle={{ color: Colors.error500 }}
          title={t('superAdminContentManager.actions.deleteEntry', 'Supprimer lentree')}
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
          {t('superAdminContentManager.deleteModal.title', 'Supprimer lentree')}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral200, Spaces.marginTop[8]]}>
          {t('superAdminContentManager.deleteModal.description', 'Action definitive. Une raison daudit est obligatoire.')}
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
