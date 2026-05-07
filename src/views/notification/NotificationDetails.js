import { useNavigation, useRoute } from '@react-navigation/native';
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

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

  const details = useMemo(() => {
    const routeParams = isObject(route?.params) ? route.params : {};
    const notification = isObject(routeParams.notification) ? routeParams.notification : routeParams;
    const data = isObject(notification.data) ? notification.data : notification;
    const status = toStringSafe(data.status || notification.status).toLowerCase();
    const reason = toStringSafe(data.reason || notification.reason).trim();
    const eventDetails = toStringSafe(data.eventDetails || notification.eventDetails).trim();
    const eventId = toEntityId(data.eventId || notification.eventId);
    const createdAt = toStringSafe(notification.createdAt || data.createdAt);

    return {
      createdAt,
      eventDetails,
      eventId,
      reason,
      status,
    };
  }, [route?.params]);

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

  const reasonText = details.reason || t('notifications.details.participationDeclined.reasonFallback');
  const eventLabel = details.eventDetails || t('notifications.details.participationDeclined.eventFallback');
  const statusText = details.status === 'declined'
    ? t('notifications.details.participationDeclined.statusDeclined')
    : details.status;

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
            {t('notifications.details.participationDeclined.screenTitle')}
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
          {t('notifications.details.participationDeclined.title')}
        </Text>
        <Text style={[Fonts.p2, { color: Colors.neutral200, marginTop: 8 }]}>
          {t('notifications.details.participationDeclined.subtitle')}
        </Text>

        <View style={[Spaces.marginTop[20], Spaces.gap[14]]}>
          <View>
            <Text style={[Fonts.p3Bold, { color: Colors.neutral300 }]}>
              {t('notifications.details.participationDeclined.labels.status')}
            </Text>
            <Text style={[Fonts.p2Bold, { color: Colors.error500, marginTop: 4 }]}>
              {statusText}
            </Text>
          </View>

          <View>
            <Text style={[Fonts.p3Bold, { color: Colors.neutral300 }]}>
              {t('notifications.details.participationDeclined.labels.event')}
            </Text>
            <Text style={[Fonts.p2, { color: Colors.neutral00, marginTop: 4 }]}>
              {eventLabel}
            </Text>
          </View>

          <View>
            <Text style={[Fonts.p3Bold, { color: Colors.neutral300 }]}>
              {t('notifications.details.participationDeclined.labels.reason')}
            </Text>
            <Text style={[Fonts.p2, { color: Colors.neutral00, marginTop: 4 }]}>
              {reasonText}
            </Text>
          </View>

          <View>
            <Text style={[Fonts.p3Bold, { color: Colors.neutral300 }]}>
              {t('notifications.details.participationDeclined.labels.decisionDate')}
            </Text>
            <Text style={[Fonts.p2, { color: Colors.neutral00, marginTop: 4 }]}>
              {formattedDecisionDate}
            </Text>
          </View>
        </View>
      </View>

      {details.eventId ? (
        <View style={[Spaces.marginTop[20]]}>
          <Button
            onPress={handleOpenEvent}
            title={t('notifications.details.participationDeclined.actions.viewEvent')}
            variant="Secondary"
          />
        </View>
      ) : null}
    </ScreenContainer>
  );
}

export default NotificationDetails;
