import { useTranslation } from 'react-i18next';
import {
  ImageBackground, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import TourTarget from '@/components/molecules/tour/TourTarget';

/**
 * Guide Dirigeant·e, bonus 2 en simulation (GUIDE-D-CORR-3, M1082, décision du chef) : le
 * club n'a pas encore de canal, le guide montre celui-ci, marqué « Exemple ». Il porte les ancres
 * du vrai fil (`ch-info`, `ch-input`) ; aucun service n'est importé, le champ ne s'écrit pas, rien
 * ne part.
 *
 * ponytail: pas le vrai fil (`Conversation`, 8 300 lignes qui lisent et écrivent) ; ce rendu en
 * reprend l'en-tête et la barre. Sortie : ouvrir le vrai fil en lecture seule si la recette le
 * demande.
 * @param {{ clubName?: string, navigation: any }} props - Nom du club, navigation.
 * @returns {import('react').ReactElement} Écran.
 */
function TourCanalExemple({ clubName = '', navigation }) {
  const { t } = useTranslation();
  const { Colors, Fonts, Images } = useTheme();
  const { bottom, top } = useSafeAreaInsets();
  const messages = [
    t('tourExamples.canal.message1', 'Entraînement décalé à 19 h ce mercredi.'),
    t('tourExamples.canal.message2', 'Pensez à régler la cotisation avant la fin du mois.'),
  ];

  return (
    // Le fond du vrai fil (`Conversation`) ; pas de ScreenContainer, que le fil n'a pas non plus.
    <ImageBackground
      resizeMode="cover"
      source={Images.bg2}
      style={[styles.fill, { backgroundColor: Colors.chatBackground }]}
    >
      <View
        style={[styles.header, {
          backgroundColor: Colors.chatBar,
          borderBottomColor: withAlpha(Colors.neutral00, 0.06),
          paddingTop: top,
        }]}
      >
        <HeaderBackButton onPress={() => navigation.goBack()} withDefaultMargin={false} />
        <TourTarget id="ch-info" style={styles.fill}>
          <View style={styles.identity}>
            <ClubLogoMark club={null} name={clubName} size={40} />
            <View style={styles.fill}>
              <Text numberOfLines={1} style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>
                {clubName || t('tourExamples.canal.title', 'Canal du club')}
              </Text>
              <Text numberOfLines={1} style={[Fonts.caption, { color: Colors.primary500 }]}>
                {t('tourExamples.canal.subtitle', 'Canal du club · Exemple')}
              </Text>
            </View>
          </View>
        </TourTarget>
      </View>
      <ScrollView contentContainerStyle={styles.messages} style={styles.fill}>
        {messages.map((message) => (
          <View
            key={message}
            style={[styles.bubble, { backgroundColor: withAlpha(Colors.primary500, 0.18) }]}
          >
            <Text style={[Fonts.captionBold, { color: Colors.primary500 }]}>
              {t('tourExamples.ad.example', 'Exemple')}
            </Text>
            <Text style={[Fonts.p2, { color: Colors.neutral00 }]}>{message}</Text>
          </View>
        ))}
      </ScrollView>
      <TourTarget id="ch-input">
        <View
          style={[styles.bar, {
            backgroundColor: Colors.chatBar,
            borderTopColor: withAlpha(Colors.neutral00, 0.06),
            paddingBottom: bottom + 12,
          }]}
        >
          <View style={[styles.field, { borderColor: withAlpha(Colors.neutral00, 0.12) }]}>
            <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
              {t('tourExamples.canal.input', 'Écris une annonce… (exemple : rien n’est envoyé)')}
            </Text>
          </View>
        </View>
      </TourTarget>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: 1, paddingHorizontal: 12, paddingTop: 12 },
  bubble: {
    alignSelf: 'flex-end', borderRadius: 16, gap: 4, maxWidth: '85%', padding: 12,
  },
  field: {
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  fill: { flex: 1 },
  header: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  identity: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  messages: { gap: 12, padding: 16 },
});

export default TourCanalExemple;
