import {
  useCallback,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';

import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import EventCardNew from '@/components/molecules/eventCard/EventCardNew';
import Input from '@/components/molecules/input/Input';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetEvents } from '@/services/event/eventQueries';
import { useSearchEvents } from '@/services/search/searchQueries';
import { mapSearchPayload } from '@/services/search/searchService';

/**
 * Public event picker for chat sharing flow.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function ConversationPublicEventPicker({ navigation, route }) {
  const {
    Alignments,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const chatId = String(route?.params?.chatId || '').trim();
  const [query, setQuery] = useState('');
  const normalizedQuery = useMemo(() => String(query || '').trim(), [query]);
  const isSmartSearchEnabled = normalizedQuery.length >= 2;

  const {
    data: publicEventsPages,
    isLoading: isLoadingPublicEvents,
  } = useGetEvents({
    compact: true,
    excludeType: 'R\u00E9servation',
    pageSize: 20,
    sessionStatus: 'open',
    sort: 'date:asc',
  }, {
    enabled: !isSmartSearchEnabled,
  });

  const {
    data: searchEventsPages,
    isLoading: isLoadingSearchEvents,
  } = useSearchEvents({
    excludeType: 'R\u00E9servation',
    pageSize: 20,
    q: normalizedQuery,
    sessionStatus: 'open',
    sort: 'relevance',
  }, {
    enabled: isSmartSearchEnabled,
  });

  const publicEvents = useMemo(
    () => publicEventsPages?.pages?.flatMap((page) => page?.data || []) || [],
    [publicEventsPages?.pages],
  );

  const smartEvents = useMemo(
    () => searchEventsPages?.pages?.flatMap((page) => mapSearchPayload(page)) || [],
    [searchEventsPages?.pages],
  );

  const rawEvents = isSmartSearchEnabled ? smartEvents : publicEvents;
  const events = useMemo(() => {
    const seen = new Set();
    return rawEvents
      .filter((event) => {
        const documentId = String(event?.documentId || event?.id || '').trim();
        if (!documentId || seen.has(documentId)) return false;
        seen.add(documentId);
        return true;
      })
      .slice(0, 40);
  }, [rawEvents]);

  const isLoading = isSmartSearchEnabled ? isLoadingSearchEvents : isLoadingPublicEvents;

  const handleSelectEvent = useCallback((event) => {
    const eventDocumentId = String(event?.documentId || '').trim();
    if (!eventDocumentId || !chatId) return;

    navigation.navigate(RouteNames.Conversation, {
      chatId,
      sharedEventFromPicker: {
        date: event?.date || null,
        documentId: eventDocumentId,
        facility: event?.facility
          ? {
            address: event?.facility?.address || null,
            name: event?.facility?.name || '',
          }
          : null,
        location: event?.location || null,
        locationDetails: event?.locationDetails || '',
        name: event?.name || 'Événement',
        team: event?.team
          ? {
            name: event?.team?.name || '',
          }
          : null,
      },
    });
  }, [chatId, navigation]);

  return (
    <ScreenContainer
      bgImage="bg2"
      style={[{ paddingHorizontal: 16 }]}
      withHeaderPadding={false}
    >
      <View style={[Alignments.fill, { paddingTop: insets.top + 8 }]}>
        <View style={[Alignments.row, Alignments.alignCenter, Spaces.marginBottom[16]]}>
          <HeaderBackButton
            onPress={() => navigation.goBack()}
            style={{ marginLeft: 0 }}
            withDefaultMargin={false}
          />
          <View style={[Alignments.fill, Alignments.alignCenter]}>
            <Text style={[Fonts.h3, { color: Colors.neutral00, textAlign: 'center' }]}>
              {t('conversation.shareEvent.publicPickerTitle', 'Partager un événement public')}
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <Input
          icon="search"
          onChangeText={setQuery}
          placeholder={t('conversation.shareEvent.searchPlaceholder', 'Rechercher un événement')}
          value={query}
          wrapperStyle={Spaces.marginBottom[16]}
        />

        <View style={Alignments.fill}>
          {isLoading ? (
            <View style={{ alignItems: 'center', paddingTop: 20 }}>
              <ActivityIndicator color={Colors.primary500} />
            </View>
          ) : null}

          {!isLoading && events.length === 0 ? (
            <Text style={[Fonts.p2, { color: Colors.neutral300, textAlign: 'center' }]}>
              {t('conversation.shareEvent.publicEmpty', 'Aucun événement public disponible.')}
            </Text>
          ) : null}

          {!isLoading && events.length > 0 ? (
            <ScrollView
              contentContainerStyle={{ paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
            >
              {events.map((event, index) => (
                <View
                  key={`public-event-share-${event.documentId || event.id || index}`}
                  style={index < events.length - 1 ? Spaces.marginBottom[12] : null}
                >
                  <EventCardNew
                    item={event}
                    mode="share"
                    onPress={handleSelectEvent}
                  />
                </View>
              ))}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </ScreenContainer>
  );
}

export default ConversationPublicEventPicker;
