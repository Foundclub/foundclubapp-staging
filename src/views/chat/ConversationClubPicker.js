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

import { clubsAProposer } from '@/domains/messaging/clubPartage';
import useTheme from '@/theme/themeContext';

import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import ClubSearchResultCard from '@/components/molecules/clubSearchResultCard/ClubSearchResultCard';
import Input from '@/components/molecules/input/Input';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useSearchClubs } from '@/services/search/searchQueries';
import { mapSearchPayload } from '@/services/search/searchService';

// ASSISTANCE-MINEURS-CLUB (19/11/2026, D271) — le choix d'un club à envoyer dans une
// conversation, copié sur `ConversationPublicEventPicker` : la recherche de l'onglet Rechercher
// (`/search/clubs`, dès 2 lettres) et ses cartes ; toucher un club revient à la conversation,
// qui l'envoie.

/**
 * L'écran « Envoyer un club ».
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - L'écran.
 * @returns {import('react').ReactElement} L'écran.
 */
function ConversationClubPicker({ navigation, route }) {
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
  const texte = String(query || '').trim();
  const rechercheActive = texte.length >= 2;

  const { data, isLoading } = useSearchClubs(
    { pageSize: 30, q: texte },
    { enabled: rechercheActive },
  );
  const clubs = useMemo(
    () => clubsAProposer(texte, data?.pages, mapSearchPayload),
    [data?.pages, texte],
  );

  const choisir = useCallback((club) => {
    const documentId = String(club?.documentId || '').trim();
    if (!documentId || !chatId) return;
    navigation.navigate(RouteNames.Conversation, {
      chatId,
      sharedClubFromPicker: { documentId, name: String(club?.name || '').trim() },
    });
  }, [chatId, navigation]);

  const message = (libelle) => (
    <Text style={[Fonts.p2, { color: Colors.neutral300, textAlign: 'center' }]}>
      {libelle}
    </Text>
  );

  let contenu = null;
  if (!rechercheActive) {
    contenu = message(t(
      'conversation.shareClub.hint',
      'Tape le nom ou la ville du club (2 lettres au moins).',
    ));
  } else if (isLoading) {
    contenu = (
      <View style={{ alignItems: 'center', paddingTop: 20 }}>
        <ActivityIndicator color={Colors.primary500} />
      </View>
    );
  } else if (clubs.length === 0) {
    contenu = message(t('conversation.shareClub.empty', 'Aucun club trouvé.'));
  } else {
    contenu = (
      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {clubs.map((club, index) => (
          <View
            key={`club-a-partager-${club.documentId}`}
            style={index < clubs.length - 1 ? Spaces.marginBottom[12] : null}
          >
            <ClubSearchResultCard item={club} onPress={() => choisir(club)} />
          </View>
        ))}
      </ScrollView>
    );
  }

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
              {t('conversation.shareClub.title', 'Envoyer un club')}
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
        <Input
          icon="search"
          onChangeText={setQuery}
          placeholder={t('conversation.shareClub.searchPlaceholder', 'Nom du club ou ville')}
          value={query}
          wrapperStyle={Spaces.marginBottom[16]}
        />
        <View style={Alignments.fill}>{contenu}</View>
      </View>
    </ScreenContainer>
  );
}

export default ConversationClubPicker;
