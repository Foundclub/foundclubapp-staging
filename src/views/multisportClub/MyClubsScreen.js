import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import ScreenContainer from '@/components/templates/ScreenContainer';

import { useGetMe } from '@/services/auth/authQueries';

import CMDashboard from './CMDashboard';

/**
 * Deprecated fallback screen.
 * Keeps backward compatibility while reusing the new multisport dashboard UI.
 * @param {{ navigation: any; route: { params?: { cmId?: string } } }} props
 */
function MyClubsScreen({ navigation, route }) {
  const { t } = useTranslation();
  const { data: userData } = useGetMe();
  const { Alignments, Fonts, Spaces } = useTheme();

  const fallbackCmId = route?.params?.cmId || userData?.multisportClubs?.[0]?.documentId;

  if (!fallbackCmId) {
    return (
      <ScreenContainer bgImage="bg2">
        <View style={[Alignments.fill, Alignments.center, Spaces.paddingHorizontal[24]]}>
          <Text style={[Fonts.p1, Fonts.neutral200, Fonts.textCenter]}>
            {t('multisport.fallback.noClub', 'Aucun club multisport associe a ce compte.')}
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <CMDashboard
      navigation={navigation}
      route={{
        ...route,
        params: {
          ...(route?.params || {}),
          cmId: fallbackCmId,
        },
      }}
    />
  );
}

export default MyClubsScreen;
