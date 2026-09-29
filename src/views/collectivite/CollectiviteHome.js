import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { countLabel, findManagedCollectivite } from '@/domains/collectivite/collectiviteDisplay';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Loader from '@/components/atoms/loader/Loader';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  useCollectiviteClubs,
  useCollectiviteInstallations,
  useCollectiviteRequests,
  useMyCollectivites,
} from '@/services/collectivite/collectiviteQueries';

/**
 * 🏛️ « MA COLLECTIVITE » — l accueil du gestionnaire de mairie (COLLECTIVITES 1c, SPEC §2 A).
 *
 * En tete, les demandes EN ATTENTE (pastille), puis ses installations et ses clubs
 * rattaches, chacun avec son nombre. Chaque carte ouvre son ecran. Les nombres viennent
 * des memes lectures que ces ecrans (memes clefs react-query) : l accueil et l ecran
 * disent toujours la meme chose.
 *
 * Le serveur est le seul juge : un compte qui n est pas gestionnaire de CETTE collectivite
 * recoit 403 sur chaque lecture, et l ecran le dit au lieu d afficher des zeros.
 * @returns {import('react').ReactElement} L ecran.
 */
function CollectiviteHome() {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  const routeParams = /** @type {{ collectiviteId?: string } | undefined} */ (route?.params);
  const collectiviteId = routeParams?.collectiviteId || null;

  const mine = useMyCollectivites();
  const pending = useCollectiviteRequests(collectiviteId, 'pending');
  const installations = useCollectiviteInstallations(collectiviteId);
  const clubs = useCollectiviteClubs(collectiviteId);
  const collectivite = findManagedCollectivite(mine.data, collectiviteId);

  const refetchPending = pending.refetch;
  // Au retour d une demande tranchee, la pastille doit deja etre juste.
  useFocusEffect(useCallback(() => {
    refetchPending?.();
  }, [refetchPending]));

  const refreshing = Boolean(
    pending.isRefetching || installations.isRefetching || clubs.isRefetching,
  );
  const onRefresh = () => {
    pending.refetch?.();
    installations.refetch?.();
    clubs.refetch?.();
  };

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

  const pendingCount = Array.isArray(pending.data) ? pending.data.length : 0;
  const cards = [
    {
      badge: pendingCount > 0 ? String(pendingCount) : null,
      count: countLabel(pending),
      hint: t(
        'collectivite.home.cards.requests.hint',
        'À trancher : accepter ou refuser, avec un message.',
      ),
      icon: Images.envelope,
      key: 'requests',
      route: RouteNames.CollectiviteRequests,
      title: t('collectivite.home.cards.requests.title', 'Demandes en attente'),
    },
    {
      count: countLabel(installations),
      hint: t(
        'collectivite.home.cards.installations.hint',
        'Horaires, capacité, planning de chaque installation.',
      ),
      icon: Images.stadium,
      key: 'installations',
      route: RouteNames.CollectiviteInstallations,
      title: t('collectivite.home.cards.installations.title', 'Installations'),
    },
    {
      count: countLabel(clubs),
      hint: t(
        'collectivite.home.cards.clubs.hint',
        'Leur contact, leurs équipes et leurs membres (des nombres).',
      ),
      icon: Images.users,
      key: 'clubs',
      route: RouteNames.CollectiviteClubs,
      title: t('collectivite.home.cards.clubs.title', 'Clubs rattachés'),
    },
  ];

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Spaces.paddingBottom[24], Alignments.fill]}
    >
      <ScrollView
        contentContainerStyle={{ gap: 16, paddingBottom: 24, paddingTop: 12 }}
        refreshControl={(
          <RefreshControl
            colors={[Colors.primary500]}
            onRefresh={onRefresh}
            refreshing={refreshing}
            tintColor={Colors.primary500}
          />
        )}
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

        {/* Trois cartes : une colonne sur un telephone, une rangee sur un ordinateur. */}
        <View style={[Alignments.row, Alignments.wrap, { gap: 12 }]}>
          {cards.map((card) => (
            <TouchableOpacity
              accessibilityLabel={`${card.title} : ${card.count}`}
              accessibilityRole="button"
              disabled={!card.route}
              key={card.key}
              onPress={() => navigation.navigate(card.route, { collectiviteId })}
              style={[
                ApplicationStyle.card,
                Spaces.padding[16],
                {
                  backgroundColor: `${Colors.primary700}73`,
                  borderColor: `${Colors.primary500}80`,
                  flexBasis: 260,
                  flexGrow: 1,
                  gap: 8,
                },
              ]}
              testID={`collectivite-home-${card.key}`}
            >
              <View style={[Alignments.row, Alignments.alignCenter, { gap: 10 }]}>
                <Image
                  source={card.icon}
                  style={[ApplicationStyle.icon16, ApplicationStyle.tintColor.primary200]}
                />
                <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>{card.title}</Text>
                {card.badge ? (
                  <View
                    style={[
                      Alignments.alignCenter,
                      Alignments.justifyCenter,
                      {
                        backgroundColor: Colors.error500,
                        borderRadius: 999,
                        minWidth: 24,
                        paddingHorizontal: 6,
                      },
                    ]}
                    testID={`collectivite-home-${card.key}-badge`}
                  >
                    <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{card.badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[Fonts.h1Black, Fonts.neutral00]}>{card.count}</Text>
              <Text style={[Fonts.p3, Fonts.neutral300]}>{card.hint}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

export default CollectiviteHome;
