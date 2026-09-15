import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 *
 */
export default function LeagueStandings() {
  const { Colors, Fonts } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={{
      alignItems: 'center', backgroundColor: Colors.neutral900, flex: 1, justifyContent: 'center',
    }}
    >
      <Text style={[Fonts.h1, { color: Colors.gold500 }]}>
        {t('leagueStandings.title', 'CLASSEMENT')}
      </Text>
      <Text style={[Fonts.p1, { color: Colors.neutral00, marginTop: 10 }]}>
        {t('leagueStandings.season', 'Saison')}
        {' '}
        <Text style={{ color: Colors.gold500 }}>1</Text>
        {' '}
        {t('leagueStandings.inProgress', '- En cours')}
      </Text>
      <Text style={[Fonts.p2, { color: Colors.neutral500, marginTop: 20 }]}>
        {t('leagueStandings.comingSoon', 'Bientôt disponible')}
      </Text>
    </View>
  );
}
