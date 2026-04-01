import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  AppState,
  Image,
  Linking,
  Platform,
  StyleSheet,
  View,
} from 'react-native';

import { useAppContext } from '@/store/appContext';

import GlobalPromptModal from '@/components/organisms/popup/GlobalPromptModal';

import { getCurrentRouteName, navigate } from '@/navigation/navigationService';
import { RouteNames } from '@/navigation/routeNames';

import {
  getActiveInAppPopupCampaigns,
  recordInAppPopupAction,
  recordInAppPopupDismiss,
  recordInAppPopupImpression,
} from '@/services/inAppPopupCampaign/inAppPopupCampaignService';

import { resolveMediaUrl } from '@/utils/mediaUrl';

import { useAppFeedback } from '@/context/AppFeedbackContext';
import { useBlockingOverlayPrompt } from '@/context/BlockingOverlayContext';
import { usePopupEligibility } from '@/context/PopupManagerContext';

const getPopupId = (campaign) => `remote-campaign:${String(campaign?.documentId || '').trim()}`;

const isRouteEligibleForCampaign = (campaign, routeName) => {
  const normalizedRouteName = typeof routeName === 'string' ? routeName : null;
  const allowedRoutes = Array.isArray(campaign?.allowedRoutes) ? campaign.allowedRoutes : [];
  const blockedRoutes = Array.isArray(campaign?.blockedRoutes) ? campaign.blockedRoutes : [];

  if (normalizedRouteName && blockedRoutes.includes(normalizedRouteName)) {
    return false;
  }

  if (allowedRoutes.length > 0 && normalizedRouteName && !allowedRoutes.includes(normalizedRouteName)) {
    return false;
  }

  return true;
};

const sortActions = (actions = []) => [...actions]
  .filter(Boolean)
  .sort((left, right) => {
    if (left?.slot === right?.slot) return 0;
    if (left?.slot === 'primary') return -1;
    if (right?.slot === 'primary') return 1;
    return 0;
  });

/**
 * @returns {import('react').ReactElement | null}
 */
function RemotePopupCampaignHost() {
  const [{ auth }] = useAppContext();
  const { showBanner } = useAppFeedback();
  const appStateRef = useRef(AppState.currentState);
  const fetchInFlightRef = useRef(false);
  const sessionSeenCampaignIdsRef = useRef(new Set());
  const trackedImpressionIdsRef = useRef(new Set());
  const [activeCampaign, setActiveCampaign] = useState(null);

  const routeName = getCurrentRouteName();
  const popupDescriptor = useMemo(() => {
    if (!activeCampaign) return null;

    return {
      allowedRoutes: activeCampaign.allowedRoutes,
      blockedRoutes: activeCampaign.blockedRoutes,
      blocking: true,
      id: getPopupId(activeCampaign),
      kind: 'startup_blocking',
      priority: Number(activeCampaign.priority || 30),
      surface: 'modal',
    };
  }, [activeCampaign]);

  const popup = usePopupEligibility(
    popupDescriptor,
    Boolean(activeCampaign),
    {
      cooldownKey: activeCampaign?.documentId || 'remote-popup',
      routeName,
    },
  );
  const canShowCampaign = useBlockingOverlayPrompt(
    popup.descriptor.id,
    popup.canShow,
    popup.descriptor.priority,
  );
  const isVisible = Boolean(activeCampaign && popup.canShow && canShowCampaign);

  const fetchCampaigns = useCallback(async (trigger) => {
    if (!auth?.token || !auth?.user?.documentId || fetchInFlightRef.current) return;

    fetchInFlightRef.current = true;
    try {
      const response = await getActiveInAppPopupCampaigns({
        platform: Platform.OS,
        trigger,
      });
      const campaigns = Array.isArray(response?.data) ? response.data : [];
      const currentRouteName = getCurrentRouteName();
      const nextCampaign = campaigns.find((campaign) => {
        const documentId = String(campaign?.documentId || '').trim();
        if (!documentId) return false;
        if (campaign?.cadence === 'once_per_session' && sessionSeenCampaignIdsRef.current.has(documentId)) {
          return false;
        }
        return isRouteEligibleForCampaign(campaign, currentRouteName);
      }) || null;

      setActiveCampaign(nextCampaign);
    } catch (_error) {
      setActiveCampaign(null);
    } finally {
      fetchInFlightRef.current = false;
    }
  }, [auth?.token, auth?.user?.documentId]);

  useEffect(() => {
    if (!auth?.token || !auth?.user?.documentId) {
      setActiveCampaign(null);
      return undefined;
    }

    fetchCampaigns('app_open');
    return undefined;
  }, [auth?.token, auth?.user?.documentId, fetchCampaigns]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (previousState.match(/inactive|background/) && nextState === 'active') {
        fetchCampaigns('app_foreground');
      }
    });

    return () => subscription.remove();
  }, [auth?.token, auth?.user?.documentId, fetchCampaigns]);

  useEffect(() => {
    if (!isVisible || !activeCampaign?.documentId) return;
    const trackingKey = String(activeCampaign.documentId).trim();
    if (!trackingKey || trackedImpressionIdsRef.current.has(trackingKey)) return;

    trackedImpressionIdsRef.current.add(trackingKey);
    popup.markShown({ campaignId: trackingKey });
    if (activeCampaign?.cadence === 'once_per_session') {
      sessionSeenCampaignIdsRef.current.add(trackingKey);
    }

    recordInAppPopupImpression(trackingKey).catch(() => {});
  }, [activeCampaign?.cadence, activeCampaign?.documentId, isVisible, popup]);

  const clearActiveCampaign = () => {
    if (!activeCampaign?.documentId) {
      setActiveCampaign(null);
      return;
    }

    popup.dismiss();
    trackedImpressionIdsRef.current.delete(String(activeCampaign.documentId).trim());
    setActiveCampaign(null);
  };

  const handleDismiss = () => {
    const documentId = String(activeCampaign?.documentId || '').trim();
    if (documentId) {
      recordInAppPopupDismiss(documentId).catch(() => {});
    }
    clearActiveCampaign();
  };

  const openCampaignDestination = async (action) => {
    switch (action?.actionType) {
      case 'open_club':
        return navigate(RouteNames.ClubStack, {
          params: { clubId: action?.clubId },
          screen: RouteNames.Club,
        });
      case 'open_event':
        return navigate(RouteNames.EventStack, {
          params: { eventId: action?.eventId },
          screen: RouteNames.EventDetails,
        });
      case 'open_notification_list':
        return navigate(RouteNames.NotificationList);
      case 'open_recruitment_ad':
        return navigate(RouteNames.RecruitmentAdDetails, {
          adId: action?.adId,
        });
      case 'open_requests_hub':
        return navigate(RouteNames.RequestsHub);
      case 'open_team':
        return navigate(RouteNames.TeamStack, {
          params: { teamId: action?.teamId },
          screen: RouteNames.TeamDetails,
        });
      case 'open_url':
        if (!action?.url) return false;
        await Linking.openURL(action.url);
        return true;
      default:
        return false;
    }
  };

  const handleActionPress = async (action) => {
    const documentId = String(activeCampaign?.documentId || '').trim();

    if (!documentId) {
      clearActiveCampaign();
      return;
    }

    if (action?.actionType === 'dismiss') {
      recordInAppPopupDismiss(documentId).catch(() => {});
      clearActiveCampaign();
      return;
    }

    recordInAppPopupAction(documentId, {
      actionType: action?.actionType,
      slot: action?.slot,
    }).catch(() => {});

    try {
      const didOpen = await openCampaignDestination(action);
      if (!didOpen) {
        showBanner({
          title: 'Contenu indisponible',
          tone: 'info',
        });
      }
    } catch (_error) {
      showBanner({
        title: 'Contenu indisponible',
        tone: 'info',
      });
    } finally {
      clearActiveCampaign();
    }
  };

  const actions = sortActions(activeCampaign?.actions || []);
  const primaryAction = actions.find((action) => action?.slot === 'primary') || null;
  const secondaryAction = actions.find((action) => action?.slot === 'secondary') || null;
  const imageUrl = resolveMediaUrl(activeCampaign?.image?.url || null);
  const headerContent = imageUrl ? (
    <View style={styles.headerWrap}>
      <Image source={{ uri: imageUrl }} style={styles.headerImage} />
    </View>
  ) : null;

  if (!activeCampaign) return null;

  return (
    <GlobalPromptModal
      body={activeCampaign?.body || ''}
      eyebrow={activeCampaign?.eyebrow || undefined}
      headerContent={headerContent}
      onRequestClose={handleDismiss}
      primaryAction={primaryAction ? {
        label: primaryAction.label,
        onPress: () => handleActionPress(primaryAction),
        variant: primaryAction.variant || 'Primary',
      } : {
        label: 'Fermer',
        onPress: handleDismiss,
        variant: 'Primary',
      }}
      secondaryAction={secondaryAction ? {
        label: secondaryAction.label,
        onPress: () => handleActionPress(secondaryAction),
        variant: secondaryAction.variant || 'Secondary',
      } : null}
      supportingText={activeCampaign?.subtitle || undefined}
      title={activeCampaign?.title || activeCampaign?.internalName || 'Information'}
      tone={activeCampaign?.tone || 'primary'}
      visible={isVisible}
    />
  );
}

const styles = StyleSheet.create({
  headerImage: {
    borderRadius: 18,
    height: 180,
    width: '100%',
  },
  headerWrap: {
    overflow: 'hidden',
  },
});

export default RemotePopupCampaignHost;
