import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  getNotificationById,
  markAsRead,
} from '@/services/notification/notificationService';

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/**
 * @param {unknown} value
 * @returns {string}
 */
const toStringSafe = (value) => (typeof value === 'string' ? value : '');

/**
 * @param {unknown} value
 * @returns {string}
 */
const toEntityId = (value) => {
  if (typeof value === 'string' && value.trim().length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
};

/**
 *
 */
function NotificationDetails() {
  const {
    Alignments,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const routeParams = isObject(route?.params) ? route.params : {};
  const routeNotification = isObject(routeParams.notification) ? routeParams.notification : null;
  const routeNotificationId = toEntityId(
    routeParams.notificationId
    || routeNotification?.documentId
    || routeNotification?.id,
  );
  const shouldFetchNotification = Boolean(routeNotificationId && !routeNotification);
  const {
    data: fetchedNotification,
    isError,
    isLoading,
    refetch,
  } = useQuery({
    enabled: shouldFetchNotification,
    queryFn: () => getNotificationById(routeNotificationId),
    queryKey: ['notification-detail', routeNotificationId],
    retry: 1,
    staleTime: 30000,
  });
  const notificationSource = routeNotification || fetchedNotification || routeParams;
  const canMarkNotificationAsRead = Boolean(routeNotification || fetchedNotification);
  const isMissingNotification = Boolean(
    shouldFetchNotification
    && !isLoading
    && !isError
    && !fetchedNotification,
  );

  const details = useMemo(() => {
    const notification = isObject(notificationSource) ? notificationSource : {};
    const data = isObject(notification.data) ? notification.data : notification;
    const body = toStringSafe(notification.body || data.notificationBody || data.body).trim();
    const status = toStringSafe(data.status || notification.status).toLowerCase();
    const reason = toStringSafe(data.reason || notification.reason).trim();
    const eventDetails = toStringSafe(data.eventDetails || notification.eventDetails).trim();
    const eventId = toEntityId(data.eventId || notification.eventId);
    const createdAt = toStringSafe(notification.createdAt || data.createdAt);
    const notificationId = toEntityId(notification.documentId || notification.id || data.notificationId);
    const title = toStringSafe(notification.title || data.notificationTitle || data.title).trim();
    const type = toStringSafe(notification.type || data.type).trim();

    return {
      body,
      createdAt,
      eventDetails,
      eventId,
      notificationId,
      read: Boolean(notification.read),
      reason,
      status,
      title,
      type,
    };
  }, [notificationSource]);

  useEffect(() => {
    if (!canMarkNotificationAsRead) return;
    if (!details.notificationId || details.read) return;
    markAsRead(details.notificationId).catch(() => undefined);
  }, [canMarkNotificationAsRead, details.notificationId, details.read]);

  const formattedDecisionDate = useMemo(() => {
    if (!details.createdAt) {
      return t('notifications.details.participationDeclined.unknownDate');
    }
    const parsedDate = new Date(details.createdAt);
    if (!isValid(parsedDate)) {
      return t('notifications.details.participationDeclined.unknownDate');
    }
    return format(parsedDate, "dd MMM yyyy 'a' HH:mm", { locale: fr });
  }, [details.createdAt, t]);

  const isParticipationDeclined = details.status === 'declined';
  const reasonText = details.reason || t(
    'notifications.details.participationDeclined.reasonFallback',
    'Aucun motif precise.',
  );
  const eventLabel = details.eventDetails || t(
    'notifications.details.participationDeclined.eventFallback',
    'Evenement non renseigne',
  );
  const statusText = details.status === 'declined'
    ? t('notifications.details.participationDeclined.statusDeclined', 'Refusee')
    : details.status;
  const screenTitle = isParticipationDeclined
    ? t('notifications.details.participationDeclined.screenTitle', 'Notification')
    : details.title || t('notifications.details.screenTitle', 'Notification');
  const cardTitle = isParticipationDeclined
    ? t('notifications.details.participationDeclined.title', 'Demande refusee')
    : details.title || t('notifications.details.title', 'Notification');
  const cardSubtitle = isParticipationDeclined
    ? t(
      'notifications.details.participationDeclined.subtitle',
      'Votre demande de participation a ete refusee.',
    )
    : details.body || t('notifications.details.bodyFallback', 'Aucun detail disponible.');
  let subtitleText = cardSubtitle;
  if (isError) {
    subtitleText = t('notifications.details.loadError', 'Impossible de charger cette notification.');
  } else if (isMissingNotification) {
    subtitleText = t('notifications.details.notFound', 'Notification introuvable.');
  }
  const shouldShowDetails = !isLoading && !isError && !isMissingNotification;

  const handleBackPress = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate(RouteNames.NotificationList);
  };

  const handleOpenEvent = () => {
    if (!details.eventId) return;
    navigation.navigate(RouteNames.EventStack, {
      params: { eventId: details.eventId },
      screen: RouteNames.EventDetails,
    });
  };

  return (
    <ScreenContainer bgImage="bg2" contentContainerStyle={[Spaces.padding[16]]}>
      <View style={[Alignments.row, Alignments.alignCenter, Spaces.marginBottom[24]]}>
        <View style={{ width: 48 }}>
          <HeaderBackButton
            onPress={handleBackPress}
            withDefaultMargin={false}
          />
        </View>
        <View style={[Alignments.alignCenter, { flex: 1 }]}>
          <Text style={[Fonts.h3Bold, { color: Colors.neutral00 }]}>
            {screenTitle}
          </Text>
        </View>
        <View style={{ width: 48 }} />
      </View>

      <View
        style={[
          Spaces.padding[16],
          {
            backgroundColor: 'rgba(1, 179, 244, 0.1)',
            borderColor: Colors.primary500,
            borderRadius: 16,
            borderWidth: 1,
          },
        ]}
      >
        <Text style={[Fonts.h3Bold, { color: Colors.neutral00 }]}>
          {isLoading
            ? t('common.loading', 'Chargement...')
            : cardTitle}
        </Text>
        <Text style={[Fonts.p2, { color: Colors.neutral200, marginTop: 8 }]}>
          {subtitleText}
        </Text>

        {isError || isMissingNotification ? (
          <View style={[Spaces.marginTop[20]]}>
            <Button
              onPress={() => refetch()}
              title={t('common.retry', 'Reessayer')}
              variant="Secondary"
            />
          </View>
        ) : null}

        {shouldShowDetails ? (
          <View style={[Spaces.marginTop[20], Spaces.gap[14]]}>
            <View>
              <Text style={[Fonts.p3Bold, { color: Colors.neutral300 }]}>
                {t('notifications.details.participationDeclined.labels.status', 'Statut')}
              </Text>
              <Text style={[Fonts.p2Bold, { color: Colors.error500, marginTop: 4 }]}>
                {statusText || details.type || t('notifications.details.statusFallback', 'Information')}
              </Text>
            </View>

            <View>
              <Text style={[Fonts.p3Bold, { color: Colors.neutral300 }]}>
                {t('notifications.details.participationDeclined.labels.event', 'Evenement')}
              </Text>
              <Text style={[Fonts.p2, { color: Colors.neutral00, marginTop: 4 }]}>
                {eventLabel}
              </Text>
            </View>

            <View>
              <Text style={[Fonts.p3Bold, { color: Colors.neutral300 }]}>
                {t('notifications.details.participationDeclined.labels.reason', 'Motif')}
              </Text>
              <Text style={[Fonts.p2, { color: Colors.neutral00, marginTop: 4 }]}>
                {reasonText}
              </Text>
            </View>

            <View>
              <Text style={[Fonts.p3Bold, { color: Colors.neutral300 }]}>
                {t('notifications.details.participationDeclined.labels.decisionDate', 'Date')}
              </Text>
              <Text style={[Fonts.p2, { color: Colors.neutral00, marginTop: 4 }]}>
                {formattedDecisionDate}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      {details.eventId ? (
        <View style={[Spaces.marginTop[20]]}>
          <Button
            onPress={handleOpenEvent}
            title={t('notifications.details.participationDeclined.actions.viewEvent', 'Voir evenement')}
            variant="Secondary"
          />
        </View>
      ) : null}
    </ScreenContainer>
  );
}

export default NotificationDetails;
