import { useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import { findManagedCollectivite } from '@/domains/collectivite/collectiviteDisplay';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Loader from '@/components/atoms/loader/Loader';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { useMyCollectivites } from '@/services/collectivite/collectiviteQueries';

/**
 * 🏛️ « MA COLLECTIVITE » — l accueil du gestionnaire de mairie (COLLECTIVITES 1c, SPEC §2 A).
 * Ecran 1 du lot : la PORTE D ENTREE y mene ; ses cartes arrivent avec l ecran 2.
 *
 * Le serveur est le seul juge : un compte qui n est pas gestionnaire de CETTE collectivite
 * ne la trouve pas dans `/collectivites/mine`, et l ecran le dit.
 * @returns {import('react').ReactElement} L ecran.
 */
function CollectiviteHome() {
  const { t } = useTranslation();
  const { Alignments, Fonts, Spaces } = useTheme();
  const route = useRoute();
  const routeParams = /** @type {{ collectiviteId?: string } | undefined} */ (route?.params);
  const collectiviteId = routeParams?.collectiviteId || null;

  const mine = useMyCollectivites();
  const collectivite = findManagedCollectivite(mine.data, collectiviteId);

  if (mine.isLoading) {
    return (
      <ScreenContainer
        bgImage="bg2"
        contentContainerStyle={[Alignments.fill, Alignments.justifyCenter]}
      >
        <Loader />
      </ScreenContainer>
    );
  }

  if (!collectivite) {
    return (
      <ScreenContainer
        bgImage="bg2"
        contentContainerStyle={[Alignments.fill, Alignments.justifyCenter, Spaces.padding[24]]}
      >
        <Text style={[Fonts.h4Bold, Fonts.neutral00, Fonts.textCenter]}>
          {t('collectivite.home.notManaged', 'Tu ne gères pas cette collectivité.')}
        </Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Spaces.paddingBottom[24], Alignments.fill]}
    >
      <ScrollView
        contentContainerStyle={{ gap: 16, paddingBottom: 24, paddingTop: 12 }}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        <View style={{ gap: 4 }}>
          <Text style={[Fonts.p3Bold, Fonts.primary200]}>
            {t('collectivite.home.kicker', 'Ma collectivité').toUpperCase()}
          </Text>
          <Text style={[Fonts.h2Black, Fonts.neutral00]}>{collectivite?.name}</Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t(
              'collectivite.home.subtitle',
              // eslint-disable-next-line max-len
              'Ton espace de gestionnaire : les installations de {{name}}, les demandes des clubs et les clubs rattachés.',
              { name: collectivite?.name || '', ...SANS_ECHAPPEMENT },
            )}
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

export default CollectiviteHome;
