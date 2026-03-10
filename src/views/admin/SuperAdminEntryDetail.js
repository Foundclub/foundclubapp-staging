import { useMemo, useState } from 'react';
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
      Alert.alert('Raison requise', 'Minimum 3 caractères.');
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
      Alert.alert('Suppression impossible', error?.message || 'Une erreur est survenue.');
    }
  };

  return (
    <ScreenContainer bgImage="bg2">
      <ScrollView contentContainerStyle={[Spaces.paddingHorizontal[16], Spaces.paddingBottom[32]]}>
        <View style={[Spaces.marginTop[16], Spaces.marginBottom[12]]}>
          <Text numberOfLines={1} style={[Fonts.h3, Fonts.neutral00]}>
            {uidDisplayName}
          </Text>
          <Text numberOfLines={1} style={[Fonts.p2, { color: Colors.neutral300 }, Spaces.marginTop[4]]}>
            {viewModel.title}
          </Text>
        </View>

        <View
          style={[
            ApplicationStyle.card,
            Spaces.padding[14],
            Spaces.marginBottom[12],
            {
              backgroundColor: 'rgba(0, 18, 24, 0.58)',
            },
          ]}
        >
          <Text style={[Fonts.h4, { color: Colors.neutral00 }]}>Résumé</Text>
          <View style={[Spaces.marginTop[8], Spaces.gap[6]]}>
            <View style={[Alignments.row, { justifyContent: 'space-between' }]}>
              <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>ID court</Text>
              <Text style={[Fonts.p3, { color: Colors.neutral100 }]}>{viewModel.shortDocumentId || '-'}</Text>
            </View>
            <View style={[Alignments.row, { justifyContent: 'space-between' }]}>
              <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>Document ID</Text>
              <Text
                numberOfLines={1}
                style={[Fonts.p3, { color: Colors.neutral100, maxWidth: '68%', textAlign: 'right' }]}
              >
                {viewModel.documentId || '-'}
              </Text>
            </View>
            <View style={[Alignments.row, { justifyContent: 'space-between' }]}>
              <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>Créé le</Text>
              <Text style={[Fonts.p3, { color: Colors.neutral100 }]}>{viewModel.createdAt || '-'}</Text>
            </View>
            <View style={[Alignments.row, { justifyContent: 'space-between' }]}>
              <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>Modifié le</Text>
              <Text style={[Fonts.p3, { color: Colors.primary200 }]}>{viewModel.updatedAt || '-'}</Text>
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
            <TouchableOpacity
              onPress={() => navigation.navigate(RouteNames.SuperAdminEntryForm, {
                documentId,
                mode: 'edit',
                uid,
                uidDisplayName,
              })}
              style={[
                ApplicationStyle.buttonPrimary,
                ApplicationStyle.borderRadius12,
                Spaces.paddingHorizontal[12],
                Spaces.paddingVertical[10],
                { flex: 1 },
              ]}
            >
              <Text style={[Fonts.p2Bold, { color: Colors.neutral00, textAlign: 'center' }]}>Modifier</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={refetch}
              style={[
                ApplicationStyle.backgroundColor.neutral700,
                ApplicationStyle.borderRadius12,
                Spaces.paddingHorizontal[12],
                Spaces.paddingVertical[10],
                { flex: 1 },
              ]}
            >
              <Text style={[Fonts.p2Bold, { color: Colors.neutral100, textAlign: 'center' }]}>Rafraîchir</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View
          style={[
            ApplicationStyle.card,
            Spaces.padding[14],
            Spaces.marginBottom[12],
            {
              backgroundColor: 'rgba(0, 18, 24, 0.58)',
            },
          ]}
        >
          <Text style={[Fonts.h4, { color: Colors.neutral00 }, Spaces.marginBottom[8]]}>Champs clés</Text>
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
                  <Text
                    numberOfLines={1}
                    style={[Fonts.p3, { color: Colors.neutral100, flex: 1, textAlign: 'right' }]}
                  >
                    {field.value}
                  </Text>
                </View>
              )) : (
                <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>Aucun champ clé détecté.</Text>
              )}
            </View>
          )}
        </View>

        <View
          style={[
            ApplicationStyle.card,
            Spaces.padding[14],
            Spaces.marginBottom[12],
            {
              backgroundColor: 'rgba(0, 18, 24, 0.58)',
            },
          ]}
        >
          <Text style={[Fonts.h4, { color: Colors.neutral00 }, Spaces.marginBottom[8]]}>Relations / Médias</Text>
          {viewModel.complexFields.length > 0 ? (
            <View style={Spaces.gap[8]}>
              {viewModel.complexFields.map((field) => (
                <View
                  key={field.key}
                  style={[
                    ApplicationStyle.backgroundColor.neutral800,
                    ApplicationStyle.borderRadius12,
                    Spaces.paddingHorizontal[10],
                    Spaces.paddingVertical[8],
                  ]}
                >
                  <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>{field.label}</Text>
                  <Text style={[Fonts.p2, { color: Colors.neutral100 }, Spaces.marginTop[4]]}>{field.value}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>Aucune relation ou média exploitable.</Text>
          )}
        </View>

        <View
          style={[
            ApplicationStyle.card,
            Spaces.padding[14],
            Spaces.marginBottom[12],
            {
              backgroundColor: 'rgba(0, 18, 24, 0.58)',
            },
          ]}
        >
          <Text style={[Fonts.h4, { color: Colors.neutral00 }, Spaces.marginBottom[8]]}>Audit récent</Text>
          {auditLogs.length === 0 ? (
            <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>Aucun log disponible.</Text>
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
                      ApplicationStyle.backgroundColor.neutral800,
                      ApplicationStyle.borderRadius12,
                      Spaces.paddingHorizontal[10],
                      Spaces.paddingVertical[8],
                      {
                        borderColor: Colors.neutral700,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <View style={[Alignments.row, { justifyContent: 'space-between' }]}>
                      <Text style={[Fonts.p2Bold, { color: Colors.primary200 }]}>{action}</Text>
                      <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>{when}</Text>
                    </View>
                    <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral100 }, Spaces.marginTop[4]]}>
                      {actor}
                    </Text>
                    {log?.reason ? (
                      <Text style={[Fonts.p3, { color: Colors.neutral300 }, Spaces.marginTop[2]]}>
                        Raison:
                        {' '}
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
            Spaces.padding[14],
            Spaces.marginBottom[12],
            {
              backgroundColor: Colors.neutral900,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => setShowJson((previous) => !previous)}
            style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}
          >
            <Text style={[Fonts.h4, { color: Colors.neutral00 }]}>JSON complet</Text>
            <Text style={[Fonts.p2Bold, { color: Colors.primary200 }]}>
              {showJson ? 'Masquer' : 'Afficher'}
            </Text>
          </TouchableOpacity>

          {showJson ? (
            <Text style={[Fonts.p3, { color: Colors.neutral200, fontFamily: 'monospace' }, Spaces.marginTop[8]]}>
              {jsonPreview}
            </Text>
          ) : (
            <Text style={[Fonts.p2, { color: Colors.neutral300 }, Spaces.marginTop[8]]}>
              Vue avancée repliée pour garder l&apos;écran lisible.
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={() => setIsDeleteModalOpen(true)}
          style={[
            ApplicationStyle.borderRadius12,
            Spaces.paddingVertical[12],
            {
              backgroundColor: 'rgba(255, 40, 79, 0.14)',
              borderColor: Colors.error500,
              borderWidth: 1,
            },
          ]}
        >
          <Text style={[Fonts.p2Bold, { color: Colors.error500, textAlign: 'center' }]}>Supprimer l&apos;entrée</Text>
        </TouchableOpacity>
      </ScrollView>

      <BottomModal
        close={closeDeleteModal}
        isVisible={isDeleteModalOpen}
        scrollable={false}
        snapPoints={['45%']}
      >
        <Text style={[Fonts.h3, { color: Colors.neutral00 }]}>Supprimer l&apos;entrée</Text>
        <Text style={[Fonts.p2, { color: Colors.neutral200 }, Spaces.marginTop[8]]}>
          Action définitive. Une raison d&apos;audit est obligatoire.
        </Text>

        <View style={[ApplicationStyle.card, Spaces.padding[10], Spaces.marginTop[10]]}>
          <Text numberOfLines={1} style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
            {viewModel.title}
          </Text>
          <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral300 }, Spaces.marginTop[4]]}>
            {viewModel.documentId}
          </Text>
        </View>

        <TextInput
          multiline
          onChangeText={setReason}
          placeholder="Raison obligatoire (minimum 3 caractères)"
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
    </ScreenContainer>
  );
}

export default SuperAdminEntryDetail;
