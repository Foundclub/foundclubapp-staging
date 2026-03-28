import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions } from 'react-native';

import { BREAKPOINTS } from '@/responsive';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { RouteNames } from '@/navigation/routeNames';
import { useGetEvents } from '@/services/event/eventQueries';
import { useSearchEvents } from '@/services/search/searchQueries';
import { mapSearchPayload } from '@/services/search/searchService';
import useTheme from '@/theme/themeContext';
import { getEntityDocumentId } from '@/utils/entityId';

const flattenPages = (pages) => {
  if (!Array.isArray(pages)) return [];
  return pages.flatMap((page) => (Array.isArray(page?.data) ? page.data : []));
};

const dedupeEvents = (events) => {
  const seen = new Set();
  return (Array.isArray(events) ? events : []).filter((event) => {
    const id = String(event?.documentId || event?.id || '').trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

const getLocationLabel = (event) => (
  event?.location?.label
  || event?.facility?.address
  || event?.facility?.name
  || event?.locationDetails
  || ''
);

function ConversationPublicEventPicker({ navigation, route }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= BREAKPOINTS.desktop;
  const isTablet = width >= BREAKPOINTS.tablet;
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const chatId = String(route?.params?.chatId || '').trim();
  const [query, setQuery] = useState('');
  const normalizedQuery = String(query || '').trim();
  const searchEnabled = normalizedQuery.length >= 2;

  const { data: publicEventsPages, isLoading: isPublicLoading } = useGetEvents({
    excludeType: 'Reservation',
    pageSize: 24,
    sessionStatus: 'open',
    sort: 'date:asc',
  }, {
    enabled: !searchEnabled,
  });

  const { data: searchEventsPages, isLoading: isSearchLoading } = useSearchEvents({
    excludeType: 'Reservation',
    pageSize: 24,
    q: normalizedQuery,
    sessionStatus: 'open',
    sort: 'relevance',
  }, {
    enabled: searchEnabled,
  });

  const publicEvents = useMemo(
    () => flattenPages(publicEventsPages?.pages),
    [publicEventsPages?.pages],
  );
  const searchedEvents = useMemo(
    () => (Array.isArray(searchEventsPages?.pages)
      ? searchEventsPages.pages.flatMap((page) => mapSearchPayload(page))
      : []),
    [searchEventsPages?.pages],
  );

  const events = useMemo(
    () => dedupeEvents(searchEnabled ? searchedEvents : publicEvents).slice(0, 40),
    [publicEvents, searchEnabled, searchedEvents],
  );

  const isLoading = searchEnabled ? isSearchLoading : isPublicLoading;
  const textColor = Colors?.neutral00 || '#ffffff';
  const mutedTextColor = Colors?.neutral300 || '#adb1b2';
  const accentColor = Colors?.primary500 || '#01b3f4';
  const borderColor = 'rgba(255,255,255,0.08)';
  const panelBackground = 'rgba(6, 19, 29, 0.78)';
  const cardBackground = 'rgba(8, 26, 39, 0.9)';

  const handleSelectEvent = useCallback((event) => {
    const eventDocumentId = getEntityDocumentId(event);
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
        name: event?.name || 'Evenement',
        team: event?.team ? { name: event?.team?.name || '' } : null,
      },
    });
  }, [chatId, navigation]);

  return (
    <ScreenContainer
      bgImage="bg2"
      contentWidth="wide"
      responsivePadding
      style={{ paddingBottom: 32 }}
    >
      <div style={{ color: textColor, display: 'grid', gap: 24 }}>
        <section style={{ background: panelBackground, border: `1px solid ${borderColor}`, borderRadius: 28, padding: isTablet ? 28 : 20 }}>
          <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <span style={{ color: accentColor, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Messagerie
              </span>
              <h1 style={{ fontFamily: 'Montserrat-Black, sans-serif', fontSize: isTablet ? 34 : 28, margin: 0 }}>
                Partager un evenement public
              </h1>
              <p style={{ color: mutedTextColor, margin: 0, maxWidth: 720 }}>
                Recherche un evenement public et partage-le directement dans cette conversation.
              </p>
            </div>
            <button
              onClick={() => navigation.goBack()}
              style={{ background: 'transparent', border: `1px solid ${borderColor}`, borderRadius: 999, color: textColor, cursor: 'pointer', padding: '10px 14px' }}
              type="button"
            >
              Retour
            </button>
          </div>

          <div style={{ display: 'grid', gap: 14, marginBottom: 20 }}>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('conversation.shareEvent.searchPlaceholder', 'Rechercher un evenement')}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${borderColor}`,
                borderRadius: 18,
                color: textColor,
                fontFamily: 'Montserrat-Regular, sans-serif',
                fontSize: 15,
                outline: 'none',
                padding: '14px 16px',
                width: '100%',
              }}
              type="text"
              value={query}
            />
            <span style={{ color: mutedTextColor, fontSize: 13 }}>
              {searchEnabled
                ? 'Recherche intelligente activee.'
                : 'Saisis au moins 2 caracteres pour lancer une recherche precise.'}
            </span>
          </div>

          {isLoading ? (
            <div style={{ background: cardBackground, border: `1px solid ${borderColor}`, borderRadius: 20, color: mutedTextColor, padding: 20 }}>
              Chargement des evenements…
            </div>
          ) : null}

          {!isLoading && events.length === 0 ? (
            <div style={{ background: cardBackground, border: `1px solid ${borderColor}`, borderRadius: 20, display: 'grid', gap: 8, padding: 20 }}>
              <strong style={{ fontFamily: 'Montserrat-Bold, sans-serif' }}>
                Aucun evenement disponible
              </strong>
              <p style={{ color: mutedTextColor, margin: 0 }}>
                Aucun evenement public ne correspond a cette recherche pour le moment.
              </p>
            </div>
          ) : null}

          {!isLoading && events.length > 0 ? (
            <div style={{ display: 'grid', gap: 14, gridTemplateColumns: isDesktop ? 'repeat(2, minmax(0, 1fr))' : '1fr' }}>
              {events.map((event) => {
                const eventId = getEntityDocumentId(event);
                return (
                  <article key={eventId} style={{ background: cardBackground, border: `1px solid ${borderColor}`, borderRadius: 22, display: 'grid', gap: 12, padding: 18 }}>
                    <div style={{ display: 'grid', gap: 6 }}>
                      <span style={{ color: accentColor, fontSize: 13 }}>
                        {event?.type?.name || 'Evenement'}
                      </span>
                      <h2 style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 22, margin: 0 }}>
                        {event?.name || 'Evenement'}
                      </h2>
                      <span style={{ color: mutedTextColor, fontSize: 14 }}>
                        {event?.team?.name || event?.team?.club?.name || 'Equipe inconnue'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gap: 6 }}>
                      <span style={{ color: mutedTextColor, fontSize: 13 }}>
                        {event?.date
                          ? new Date(event.date).toLocaleString('fr-FR', {
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            month: 'long',
                          })
                          : 'Date à confirmer'}
                      </span>
                      {getLocationLabel(event) ? (
                        <span style={{ color: mutedTextColor, fontSize: 13 }}>
                          {getLocationLabel(event)}
                        </span>
                      ) : null}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      <button
                        onClick={() => navigation.navigate(RouteNames.EventDetails, { eventId })}
                        style={{ background: 'transparent', border: `1px solid ${borderColor}`, borderRadius: 999, color: textColor, cursor: 'pointer', padding: '10px 14px' }}
                        type="button"
                      >
                        Voir le detail
                      </button>
                      <button
                        onClick={() => handleSelectEvent(event)}
                        style={{ background: accentColor, border: 0, borderRadius: 999, color: '#04131d', cursor: 'pointer', fontFamily: 'Montserrat-Bold, sans-serif', padding: '10px 14px' }}
                        type="button"
                      >
                        Partager dans la conversation
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>
      </div>
    </ScreenContainer>
  );
}

export default ConversationPublicEventPicker;
