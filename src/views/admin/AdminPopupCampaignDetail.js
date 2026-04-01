import { useNavigation, useRoute } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import GlobalPromptModal from '@/components/organisms/popup/GlobalPromptModal';
import ScreenContainer from '@/components/templates/ScreenContainer';
import AdminStateView from '@/views/admin/components/AdminStateView';

import { RouteNames } from '@/navigation/routeNames';

import {
  useArchiveInAppPopupCampaign,
  useDuplicateInAppPopupCampaign,
  useGetInAppPopupCampaign,
  useGetInAppPopupCampaignStats,
  usePauseInAppPopupCampaign,
  usePublishInAppPopupCampaign,
} from '@/services/inAppPopupCampaign/inAppPopupCampaignQueries';

import { resolveMediaUrl } from '@/utils/mediaUrl';

const sortActions = (actions = []) => [...actions].sort((left, right) => {
  if (left?.slot === right?.slot) return 0;
  if (left?.slot === 'primary') return -1;
  if (right?.slot === 'primary') return 1;
  return 0;
});

/**
 *
 */
function AdminPopupCampaignDetail() {
  const navigation = useNavigation();
  const route = useRoute();
  const campaignId = route?.params?.campaignId;
  const {
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);

  const campaignQuery = useGetInAppPopupCampaign(campaignId);
  const statsQuery = useGetInAppPopupCampaignStats(campaignId);
  const publishMutation = usePublishInAppPopupCampaign();
  const pauseMutation = usePauseInAppPopupCampaign();
  const archiveMutation = useArchiveInAppPopupCampaign();
  const duplicateMutation = useDuplicateInAppPopupCampaign();

  const campaign = campaignQuery?.data?.data || statsQuery?.data?.data?.campaign || null;
  const stats = statsQuery?.data?.data?.stats || campaign?.stats || {};
  const isBusy = publishMutation.isPending
    || pauseMutation.isPending
    || archiveMutation.isPending
    || duplicateMutation.isPending;

  const imageUrl = resolveMediaUrl(campaign?.image?.url || null);
  const actions = useMemo(() => sortActions(campaign?.actions || []), [campaign?.actions]);
  const primaryAction = actions.find((action) => action?.slot === 'primary') || null;
  const secondaryAction = actions.find((action) => action?.slot === 'secondary') || null;

  if (campaignQuery.isLoading || statsQuery.isLoading) {
    return (
      <AdminStateView
        description="Nous préparons le détail de la campagne pop-up."
        isLoading
        title="Chargement de la campagne"
      />
    );
  }

  if (campaignQuery.error || statsQuery.error || !campaign) {
    return (
      <AdminStateView
        actionLabel="Réessayer"
        description={campaignQuery.error?.message || statsQuery.error?.message || 'Impossible de charger cette campagne.'}
        onAction={() => {
          campaignQuery.refetch();
          statsQuery.refetch();
        }}
        title="Chargement impossible"
      />
    );
  }

  const handlePublish = async () => {
    try {
      await publishMutation.mutateAsync({ documentId: campaign.documentId });
      campaignQuery.refetch();
      statsQuery.refetch();
    } catch (error) {
      Alert.alert('Publication impossible', error?.message || 'Une erreur est survenue.');
    }
  };

  const handlePause = async () => {
    try {
      await pauseMutation.mutateAsync({ documentId: campaign.documentId });
      campaignQuery.refetch();
      statsQuery.refetch();
    } catch (error) {
      Alert.alert('Pause impossible', error?.message || 'Une erreur est survenue.');
    }
  };

  const handleArchive = async () => {
    try {
      await archiveMutation.mutateAsync({ documentId: campaign.documentId });
      campaignQuery.refetch();
      statsQuery.refetch();
    } catch (error) {
      Alert.alert('Archivage impossible', error?.message || 'Une erreur est survenue.');
    }
  };

  const handleDuplicate = async () => {
    try {
      const response = await duplicateMutation.mutateAsync({ documentId: campaign.documentId });
      const nextDocumentId = response?.data?.documentId;
      if (nextDocumentId) {
        navigation.navigate(RouteNames.AdminPopupCampaignForm, { campaignId: nextDocumentId });
      }
    } catch (error) {
      Alert.alert('Duplication impossible', error?.message || 'Une erreur est survenue.');
    }
  };

  const isDraft = campaign.status === 'draft';
  const canPause = campaign.status === 'live' || campaign.status === 'scheduled';
  const canArchive = campaign.status !== 'archived';
  const previewHeader = imageUrl ? (
    <Image source={{ uri: imageUrl }} style={styles.previewImage} />
  ) : null;

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[Spaces.paddingVertical[24]]}
    >
      <ScrollView contentContainerStyle={[Spaces.paddingHorizontal[24], Spaces.paddingBottom[32], Spaces.gap[16]]}>
        <Text style={[Fonts.h1, Fonts.neutral00]}>{campaign.title || campaign.internalName}</Text>
        <Text style={[Fonts.p2, { color: Colors.neutral200 }]}>
          {campaign.internalName}
        </Text>

        <View
          style={[
            styles.section,
            ApplicationStyle.backgroundColor.neutral800,
            { borderColor: `${Colors.primary500}24` },
          ]}
        >
          <Text style={[Fonts.h4, Fonts.neutral00]}>Résumé</Text>
          <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
            Statut
            {campaign.status}
          </Text>
          <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
            Modèle
            {campaign.templateKey}
          </Text>
          <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
            Trigger
            {campaign.trigger}
          </Text>
          <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
            Priorité
            {campaign.priority}
          </Text>
          <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
            Audience
            {' '}
            {campaign.summary?.audienceSummary || 'Tous les utilisateurs authentifiés'}
          </Text>
          <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
            Fenêtre
            {' '}
            {campaign.startAt || 'immédiat'}
            {' '}
            a
            {' '}
            {campaign.endAt || 'sans fin'}
          </Text>
        </View>

        <View
          style={[
            styles.section,
            ApplicationStyle.backgroundColor.neutral800,
            { borderColor: `${Colors.primary500}24` },
          ]}
        >
          <Text style={[Fonts.h4, Fonts.neutral00]}>Statistiques</Text>
          <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
            Utilisateurs vus
            {stats.uniqueSeenUsers || 0}
          </Text>
          <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
            Impressions
            {stats.totalImpressions || 0}
          </Text>
          <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
            Dismiss
            {stats.dismissCount || 0}
          </Text>
          <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
            Clic primaire
            {stats.primaryClickCount || 0}
          </Text>
          <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
            Clic secondaire
            {stats.secondaryClickCount || 0}
          </Text>
        </View>

        <View
          style={[
            styles.section,
            ApplicationStyle.backgroundColor.neutral800,
            { borderColor: `${Colors.primary500}24` },
          ]}
        >
          <Text style={[Fonts.h4, Fonts.neutral00]}>Contenu</Text>
          <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>
            {campaign.eyebrow || 'Sans eyebrow'}
          </Text>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{campaign.title}</Text>
          {campaign.subtitle ? (
            <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>{campaign.subtitle}</Text>
          ) : null}
          <Text style={[Fonts.p2, { color: Colors.neutral100 }]}>{campaign.body}</Text>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} />
          ) : null}
          <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
            CTA
            {' '}
            {actions.map((action) => `${action.slot}:${action.actionType}`).join(' | ') || 'aucun'}
          </Text>
        </View>

        <View style={[Spaces.gap[12]]}>
          <Button
            onPress={() => setIsPreviewVisible(true)}
            title="Prévisualiser"
            variant="Secondary"
          />
          {isDraft ? (
            <Button
              disabled={isBusy}
              onPress={() => navigation.navigate(RouteNames.AdminPopupCampaignForm, { campaignId: campaign.documentId })}
              title="Modifier le brouillon"
              variant="Secondary"
            />
          ) : null}
          {isDraft ? (
            <Button
              disabled={isBusy}
              isLoading={publishMutation.isPending}
              onPress={handlePublish}
              title="Publier"
            />
          ) : null}
          {canPause ? (
            <Button
              disabled={isBusy}
              isLoading={pauseMutation.isPending}
              onPress={handlePause}
              title="Mettre en pause"
              variant="Secondary"
            />
          ) : null}
          <Button
            disabled={isBusy}
            isLoading={duplicateMutation.isPending}
            onPress={handleDuplicate}
            title="Dupliquer"
            variant="Secondary"
          />
          {canArchive ? (
            <Button
              disabled={isBusy}
              isLoading={archiveMutation.isPending}
              onPress={handleArchive}
              title="Archiver"
              variant="Secondary"
            />
          ) : null}
        </View>
      </ScrollView>

      <GlobalPromptModal
        body={campaign.body || ''}
        eyebrow={campaign.eyebrow || undefined}
        headerContent={previewHeader}
        onRequestClose={() => setIsPreviewVisible(false)}
        primaryAction={primaryAction ? {
          label: primaryAction.label,
          onPress: () => setIsPreviewVisible(false),
          variant: primaryAction.variant || 'Primary',
        } : {
          label: 'Fermer',
          onPress: () => setIsPreviewVisible(false),
          variant: 'Primary',
        }}
        secondaryAction={secondaryAction ? {
          label: secondaryAction.label,
          onPress: () => setIsPreviewVisible(false),
          variant: secondaryAction.variant || 'Secondary',
        } : null}
        supportingText={campaign.subtitle || undefined}
        title={campaign.title || campaign.internalName}
        tone={campaign.tone || 'primary'}
        visible={isPreviewVisible}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  image: {
    borderRadius: 18,
    height: 180,
    marginTop: 8,
    width: '100%',
  },
  previewImage: {
    borderRadius: 18,
    height: 180,
    width: '100%',
  },
  section: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    padding: 18,
  },
});

export default AdminPopupCampaignDetail;
