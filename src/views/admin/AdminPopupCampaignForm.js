import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import GlobalPromptModal from '@/components/organisms/popup/GlobalPromptModal';
import ScreenContainer from '@/components/templates/ScreenContainer';
import AdminStateView from '@/views/admin/components/AdminStateView';

import { RouteNames } from '@/navigation/routeNames';

import client from '@/services/client';
import {
  useCreateInAppPopupCampaign,
  useGetInAppPopupCampaign,
  useUpdateInAppPopupCampaign,
} from '@/services/inAppPopupCampaign/inAppPopupCampaignQueries';

import { getErrorMessage } from '@/utils/errors/displayError';
import { resolveMediaUrl } from '@/utils/mediaUrl';

const TEMPLATE_OPTIONS = ['standard_modal', 'hero_image_modal', 'critical_modal'];
const TONE_OPTIONS = ['primary', 'league', 'critical'];
const TRIGGER_OPTIONS = ['app_open', 'app_foreground', 'both'];
const CADENCE_OPTIONS = ['once_per_session', 'once_per_24h', 'until_dismissed', 'once_ever'];
const ACTION_TYPE_OPTIONS = ['dismiss', 'open_url', 'open_notification_list', 'open_requests_hub', 'open_event', 'open_team', 'open_club', 'open_recruitment_ad'];

const parseCsv = (value) => String(value || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const buildEmptyAction = (slot) => ({
  actionType: 'dismiss',
  enabled: false,
  label: '',
  slot,
  targetValue: '',
  variant: slot === 'secondary' ? 'Secondary' : 'Primary',
});

const actionToForm = (action, slot) => {
  if (!action) return buildEmptyAction(slot);
  return {
    actionType: action.actionType || 'dismiss',
    enabled: true,
    label: action.label || '',
    slot,
    targetValue: action.url || action.eventId || action.teamId || action.clubId || action.adId || '',
    variant: action.variant || (slot === 'secondary' ? 'Secondary' : 'Primary'),
  };
};

const campaignToForm = (campaign) => {
  const actions = Array.isArray(campaign?.actions) ? campaign.actions : [];
  const primaryAction = actions.find((action) => action?.slot === 'primary');
  const secondaryAction = actions.find((action) => action?.slot === 'secondary');

  return {
    actions: {
      primary: actionToForm(primaryAction, 'primary'),
      secondary: actionToForm(secondaryAction, 'secondary'),
    },
    allowedRoutesText: Array.isArray(campaign?.allowedRoutes) ? campaign.allowedRoutes.join(', ') : '',
    blockedRoutesText: Array.isArray(campaign?.blockedRoutes) ? campaign.blockedRoutes.join(', ') : '',
    body: campaign?.body || '',
    cadence: campaign?.cadence || 'once_per_session',
    endAt: campaign?.endAt || '',
    eyebrow: campaign?.eyebrow || '',
    image: campaign?.image || null,
    internalName: campaign?.internalName || '',
    priority: String(campaign?.priority || 30),
    startAt: campaign?.startAt || '',
    status: campaign?.status || 'draft',
    subtitle: campaign?.subtitle || '',
    targetClubsText: Array.isArray(campaign?.audience?.targetClubIds) ? campaign.audience.targetClubIds.join(', ') : '',
    targetMultisportClubsText: Array.isArray(campaign?.audience?.targetMultisportClubIds) ? campaign.audience.targetMultisportClubIds.join(', ') : '',
    targetPlatformsText: Array.isArray(campaign?.audience?.targetPlatforms) ? campaign.audience.targetPlatforms.join(', ') : '',
    targetRolesText: Array.isArray(campaign?.audience?.targetRoles) ? campaign.audience.targetRoles.join(', ') : '',
    targetUsersText: Array.isArray(campaign?.audience?.targetUserIds) ? campaign.audience.targetUserIds.join(', ') : '',
    templateKey: campaign?.templateKey || 'standard_modal',
    title: campaign?.title || '',
    tone: campaign?.tone || 'primary',
    trigger: campaign?.trigger || 'both',
  };
};

const buildPayloadFromForm = (formState) => {
  const actions = [formState.actions.primary, formState.actions.secondary]
    .filter((action) => action?.enabled)
    .map((action) => {
      const payload = {
        actionType: action.actionType,
        label: String(action.label || '').trim(),
        slot: action.slot,
        variant: action.variant,
      };

      switch (action.actionType) {
        case 'open_club':
          return { ...payload, clubId: String(action.targetValue || '').trim() };
        case 'open_event':
          return { ...payload, eventId: String(action.targetValue || '').trim() };
        case 'open_recruitment_ad':
          return { ...payload, adId: String(action.targetValue || '').trim() };
        case 'open_team':
          return { ...payload, teamId: String(action.targetValue || '').trim() };
        case 'open_url':
          return { ...payload, url: String(action.targetValue || '').trim() };
        default:
          return payload;
      }
    });

  return {
    actions,
    allowedRoutes: parseCsv(formState.allowedRoutesText),
    blockedRoutes: parseCsv(formState.blockedRoutesText),
    body: formState.body.trim(),
    cadence: formState.cadence,
    endAt: formState.endAt.trim() || null,
    eyebrow: formState.eyebrow.trim(),
    image: formState.image?.id || null,
    internalName: formState.internalName.trim(),
    priority: Number(formState.priority || 30),
    startAt: formState.startAt.trim() || null,
    subtitle: formState.subtitle.trim(),
    targetClubs: parseCsv(formState.targetClubsText),
    targetMultisportClubs: parseCsv(formState.targetMultisportClubsText),
    targetPlatforms: parseCsv(formState.targetPlatformsText),
    targetRoles: parseCsv(formState.targetRolesText),
    targetUsers: parseCsv(formState.targetUsersText),
    templateKey: formState.templateKey,
    title: formState.title.trim(),
    tone: formState.tone,
    trigger: formState.trigger,
  };
};

const getActionTargetLabel = (actionType) => {
  switch (actionType) {
    case 'open_club':
      return 'Club documentId';
    case 'open_event':
      return 'Event documentId';
    case 'open_recruitment_ad':
      return 'Annonce documentId';
    case 'open_team':
      return 'Team documentId';
    case 'open_url':
      return 'URL cible';
    default:
      return 'Cible';
  }
};

/**
 *
 */
function AdminPopupCampaignForm() {
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
  const [formState, setFormState] = useState(() => campaignToForm(null));
  const campaignQuery = useGetInAppPopupCampaign(campaignId);
  const createMutation = useCreateInAppPopupCampaign();
  const updateMutation = useUpdateInAppPopupCampaign();

  useEffect(() => {
    if (campaignQuery.data?.data) {
      setFormState(campaignToForm(campaignQuery.data.data));
    }
  }, [campaignQuery.data]);

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const currentCampaign = campaignQuery.data?.data || null;
  const imageUrl = resolveMediaUrl(formState.image?.url || null);
  const previewPayload = useMemo(() => buildPayloadFromForm(formState), [formState]);
  const previewActions = Array.isArray(previewPayload.actions) ? previewPayload.actions : [];
  const previewPrimaryAction = previewActions.find((action) => action.slot === 'primary') || null;
  const previewSecondaryAction = previewActions.find((action) => action.slot === 'secondary') || null;

  if (campaignId && campaignQuery.isLoading) {
    return (
      <AdminStateView
        description="Nous chargeons le brouillon de campagne."
        isLoading
        title="Chargement du brouillon"
      />
    );
  }

  if (campaignId && campaignQuery.error) {
    return (
      <AdminStateView
        actionLabel="Réessayer"
        description={getErrorMessage(campaignQuery.error, 'generic') || 'Impossible de charger ce brouillon.'}
        onAction={() => campaignQuery.refetch()}
        title="Chargement impossible"
      />
    );
  }

  if (campaignId && currentCampaign && currentCampaign.status !== 'draft') {
    return (
      <AdminStateView
        actionLabel="Ouvrir le détail"
        description="Cette campagne a déjà été publiée. Dupliquez-la depuis le détail pour la modifier."
        onAction={() => navigation.replace(RouteNames.AdminPopupCampaignDetail, { campaignId })}
        title="Brouillon non éditable"
      />
    );
  }

  const setField = (field, value) => {
    setFormState((previous) => ({ ...previous, [field]: value }));
  };

  const setActionField = (slot, field, value) => {
    setFormState((previous) => ({
      ...previous,
      actions: {
        ...previous.actions,
        [slot]: {
          ...previous.actions[slot],
          [field]: value,
        },
      },
    }));
  };

  const handleUploadImage = async () => {
    try {
      const response = await launchImageLibrary({
        includeBase64: false,
        mediaType: 'photo',
        quality: 0.8,
        selectionLimit: 1,
      });

      if (response?.didCancel) return;
      if (response?.errorCode) {
        Alert.alert('Galerie', response?.errorMessage || 'Impossible d’ouvrir la galerie.');
        return;
      }

      const asset = response?.assets?.[0];
      if (!asset?.uri) return;

      const mime = String(asset.type || 'image/jpeg').trim() || 'image/jpeg';
      const extension = mime.includes('/') ? (mime.split('/')[1] || 'jpg') : 'jpg';
      const fallbackName = `popup_${Date.now()}.${extension}`;
      const fileName = String(asset.fileName || asset.name || fallbackName).trim() || fallbackName;
      const formData = new FormData();

      formData.append('files', /** @type {any} */ ({
        name: fileName,
        type: mime,
        uri: asset.uri,
      }));

      const uploadResponse = await client.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      const uploadedFile = Array.isArray(uploadResponse?.data) ? uploadResponse.data[0] : null;
      if (!uploadedFile) {
        Alert.alert('Upload impossible', 'Le serveur n’a renvoyé aucun fichier.');
        return;
      }

      setField('image', uploadedFile);
    } catch (error) {
      Alert.alert('Upload impossible', getErrorMessage(error, 'generic'));
    }
  };

  const handleSubmit = async () => {
    const payload = buildPayloadFromForm(formState);

    try {
      let response;
      if (campaignId) {
        response = await updateMutation.mutateAsync({
          data: payload,
          documentId: campaignId,
        });
      } else {
        response = await createMutation.mutateAsync({
          data: payload,
        });
      }

      const nextDocumentId = response?.data?.documentId || campaignId;
      if (nextDocumentId) {
        navigation.replace(RouteNames.AdminPopupCampaignDetail, { campaignId: nextDocumentId });
      }
    } catch (error) {
      Alert.alert('Enregistrement impossible', getErrorMessage(error, 'generic'));
    }
  };

  const renderChoiceRow = (label, field, options) => (
    <View style={[Spaces.gap[8]]}>
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={[Spaces.gap[8], { flexDirection: 'row' }]}>
          {options.map((option) => {
            const isActive = formState[field] === option;
            return (
              <TouchableOpacity
                key={option}
                onPress={() => setField(field, option)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isActive ? `${Colors.primary500}22` : Colors.neutral800,
                    borderColor: isActive ? Colors.primary500 : `${Colors.neutral300}33`,
                  },
                ]}
              >
                <Text style={[Fonts.p3Bold, { color: isActive ? Colors.primary500 : Colors.neutral100 }]}>{option}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );

  const renderInput = (label, field, options = {}) => (
    <View style={[Spaces.gap[8]]}>
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{label}</Text>
      <TextInput
        multiline={Boolean(options.multiline)}
        numberOfLines={options.multiline ? 5 : 1}
        onChangeText={(value) => setField(field, value)}
        placeholder={options.placeholder}
        placeholderTextColor={Colors.neutral300}
        style={[
          styles.input,
          ApplicationStyle.backgroundColor.neutral800,
          {
            borderColor: `${Colors.primary500}24`,
            color: Colors.neutral00,
            minHeight: options.multiline ? 120 : 52,
            textAlignVertical: options.multiline ? 'top' : 'center',
          },
        ]}
        value={formState[field]}
      />
    </View>
  );

  const renderActionEditor = (slotLabel, slot) => {
    const action = formState.actions[slot];
    const needsTarget = ['open_club', 'open_event', 'open_recruitment_ad', 'open_team', 'open_url'].includes(action.actionType);

    return (
      <View
        style={[
          styles.section,
          ApplicationStyle.backgroundColor.neutral800,
          { borderColor: `${Colors.primary500}24` },
        ]}
      >
        <View style={styles.inlineRow}>
          <Text style={[Fonts.h4, Fonts.neutral00]}>{slotLabel}</Text>
          <TouchableOpacity
            onPress={() => setActionField(slot, 'enabled', !action.enabled)}
            style={[
              styles.toggle,
              {
                backgroundColor: action.enabled ? `${Colors.primary500}22` : Colors.neutral700,
                borderColor: action.enabled ? Colors.primary500 : `${Colors.neutral300}33`,
              },
            ]}
          >
            <Text style={[Fonts.p3Bold, { color: action.enabled ? Colors.primary500 : Colors.neutral100 }]}>
              {action.enabled ? 'Actif' : 'Inactif'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Label bouton</Text>
          <TextInput
            onChangeText={(value) => setActionField(slot, 'label', value)}
            placeholder="Ex: Ouvrir"
            placeholderTextColor={Colors.neutral300}
            style={[
              styles.input,
              ApplicationStyle.backgroundColor.neutral800,
              { borderColor: `${Colors.primary500}24`, color: Colors.neutral00 },
            ]}
            value={action.label}
          />
        </View>

        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Type d’action</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={[Spaces.gap[8], { flexDirection: 'row' }]}>
              {ACTION_TYPE_OPTIONS.map((option) => {
                const isActive = action.actionType === option;
                return (
                  <TouchableOpacity
                    key={option}
                    onPress={() => setActionField(slot, 'actionType', option)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isActive ? `${Colors.primary500}22` : Colors.neutral800,
                        borderColor: isActive ? Colors.primary500 : `${Colors.neutral300}33`,
                      },
                    ]}
                  >
                    <Text style={[Fonts.p3Bold, { color: isActive ? Colors.primary500 : Colors.neutral100 }]}>{option}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {needsTarget ? (
          <View style={[Spaces.gap[8]]}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{getActionTargetLabel(action.actionType)}</Text>
            <TextInput
              onChangeText={(value) => setActionField(slot, 'targetValue', value)}
              placeholder="documentId ou URL"
              placeholderTextColor={Colors.neutral300}
              style={[
                styles.input,
                ApplicationStyle.backgroundColor.neutral800,
                { borderColor: `${Colors.primary500}24`, color: Colors.neutral00 },
              ]}
              value={action.targetValue}
            />
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <ScreenContainer bgImage="bg2" contentContainerStyle={[Spaces.paddingVertical[24]]}>
      <ScrollView contentContainerStyle={[Spaces.paddingHorizontal[24], Spaces.paddingBottom[32], Spaces.gap[16]]}>
        <Text style={[Fonts.h1, Fonts.neutral00]}>
          {campaignId ? 'Éditer la campagne' : 'Nouvelle campagne'}
        </Text>

        {renderInput('Nom interne', 'internalName', { placeholder: 'Ex: push-renouvellement-avril' })}
        {renderChoiceRow('Modèle', 'templateKey', TEMPLATE_OPTIONS)}
        {renderChoiceRow('Ton', 'tone', TONE_OPTIONS)}
        {renderChoiceRow('Trigger', 'trigger', TRIGGER_OPTIONS)}
        {renderChoiceRow('Cadence', 'cadence', CADENCE_OPTIONS)}

        {renderInput('Eyebrow', 'eyebrow', { placeholder: 'Ex: Nouvelle fonctionnalité' })}
        {renderInput('Titre', 'title', { placeholder: 'Titre visible du popup' })}
        {renderInput('Sous-titre', 'subtitle', { placeholder: 'Texte secondaire optionnel' })}
        {renderInput('Corps', 'body', { multiline: true, placeholder: 'Message principal affiché dans le popup' })}
        {renderInput('Priorité (10-59)', 'priority', { placeholder: '30' })}
        {renderInput('Début (ISO, optionnel)', 'startAt', { placeholder: '2026-04-01T09:00:00.000Z' })}
        {renderInput('Fin (ISO, optionnel)', 'endAt', { placeholder: '2026-04-03T18:00:00.000Z' })}

        <View
          style={[
            styles.section,
            ApplicationStyle.backgroundColor.neutral800,
            { borderColor: `${Colors.primary500}24` },
          ]}
        >
          <Text style={[Fonts.h4, Fonts.neutral00]}>Image</Text>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} />
          ) : (
            <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>Aucune image liée.</Text>
          )}
          <Button
            onPress={handleUploadImage}
            title={imageUrl ? 'Remplacer l’image' : 'Ajouter une image'}
            variant="Secondary"
          />
        </View>

        {renderActionEditor('Action principale', 'primary')}
        {renderActionEditor('Action secondaire', 'secondary')}

        {renderInput('Allowed routes (csv)', 'allowedRoutesText', { placeholder: 'Ex: HomeTab, NotificationList' })}
        {renderInput('Blocked routes (csv)', 'blockedRoutesText', { placeholder: 'Ex: Conversation, EventEdit' })}
        {renderInput('Rôles ciblés (csv)', 'targetRolesText', { placeholder: 'new, player, coach, president, superadmin' })}
        {renderInput('Plateformes ciblées (csv)', 'targetPlatformsText', { placeholder: 'ios, android, web' })}
        {renderInput('Clubs ciblés (documentIds csv)', 'targetClubsText', { placeholder: 'club-doc-id-1, club-doc-id-2' })}
        {renderInput('Multisports ciblés (documentIds csv)', 'targetMultisportClubsText', { placeholder: 'cm-doc-id-1, cm-doc-id-2' })}
        {renderInput('Utilisateurs ciblés (documentIds csv)', 'targetUsersText', { placeholder: 'user-doc-id-1, user-doc-id-2' })}

        <View style={[Spaces.gap[12], Spaces.marginTop[8]]}>
          <Button
            onPress={() => setIsPreviewVisible(true)}
            title="Prévisualiser"
            variant="Secondary"
          />
          <Button
            disabled={isSaving}
            isLoading={isSaving}
            onPress={handleSubmit}
            title={campaignId ? 'Enregistrer le brouillon' : 'Créer le brouillon'}
          />
        </View>
      </ScrollView>

      <GlobalPromptModal
        body={previewPayload.body || ''}
        eyebrow={previewPayload.eyebrow || undefined}
        headerContent={imageUrl ? <Image source={{ uri: imageUrl }} style={styles.previewImage} /> : null}
        onRequestClose={() => setIsPreviewVisible(false)}
        primaryAction={previewPrimaryAction ? {
          label: previewPrimaryAction.label || 'Action',
          onPress: () => setIsPreviewVisible(false),
          variant: previewPrimaryAction.variant || 'Primary',
        } : {
          label: 'Fermer',
          onPress: () => setIsPreviewVisible(false),
        }}
        secondaryAction={previewSecondaryAction ? {
          label: previewSecondaryAction.label || 'Action secondaire',
          onPress: () => setIsPreviewVisible(false),
          variant: previewSecondaryAction.variant || 'Secondary',
        } : null}
        supportingText={previewPayload.subtitle || undefined}
        title={previewPayload.title || previewPayload.internalName || 'Prévisualisation'}
        tone={previewPayload.tone || 'primary'}
        visible={isPreviewVisible}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  image: {
    borderRadius: 18,
    height: 180,
    width: '100%',
  },
  inlineRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  previewImage: {
    borderRadius: 18,
    height: 180,
    width: '100%',
  },
  section: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 18,
  },
  toggle: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});

export default AdminPopupCampaignForm;
