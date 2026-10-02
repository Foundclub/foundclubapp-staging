import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { formatCollectiviteOfferedBy } from '@/domains/subscription/subscriptionDecision';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import ScreenContainer from '@/components/templates/ScreenContainer';
import ActualiteCarte from '@/views/collectivite/components/ActualiteCarte';

import { useMesActualitesDeLaVille } from '@/services/collectivite/collectiviteActualiteQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

/**
 * 📰 LE CANAL DE LA VILLE, CÔTÉ MEMBRE — COLL-C4A (02/10/2026), planche P3v2-messages-tel
 * (écran 3, « Ce que lit un membre d'un club ») du design validé HY521H1 page 3.
 *
 * Les actualités de la Ville pour les clubs rattachés, de la plus ancienne à la plus récente
 * (comme une conversation). Il LIT, il ne répond pas : aucune zone de saisie, aucune réaction —
 * « Lecture seule ». La Ville parle en son nom ; le membre est tutoyé.
 *
 * Y mènent : la notification d'une actualité (ctaRoute du serveur), le bloc « De la Ville » de
 * la fiche du club, le bandeau de l'accueil (planche 3), la messagerie (planche 4).
 * Paramètre de route : `collectiviteId` (facultatif) — une seule Ville ; sans lui, toutes celles
 * des clubs du membre. Le serveur ne rend que ce que SES clubs peuvent lire.
 * @returns {import('react').ReactElement} L'écran.
 */
function CollectiviteActualitesCanal() {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  const collectiviteId = /** @type {{ collectiviteId?: string } | undefined} */ (route?.params)
    ?.collectiviteId || null;
  const lecture = useMesActualitesDeLaVille();
  const defilement = useRef(/** @type {any} */ (null));

  const collectivites = Array.isArray(lecture.data?.collectivites)
    ? lecture.data.collectivites
    : [];
  const ville = collectiviteId
    ? collectivites.find((c) => c?.documentId === collectiviteId) || null
    : (collectivites.length === 1 && collectivites[0]) || null;
  const actualites = (Array.isArray(lecture.data?.actualites) ? lecture.data.actualites : [])
    .filter((actualite) => (
      !collectiviteId || actualite?.collectivite?.documentId === collectiviteId
    ))
    .slice()
    .reverse();

  // Le titre de l'écran : le nom de LA Ville quand il n'y en a qu'une (planche : « Ville de
  // Montrivage »).
  useEffect(() => {
    if (ville?.name) navigation.setOptions?.({ headerTitle: ville.name });
  }, [navigation, ville?.name]);

  let contenu;
  if (lecture.isLoading) {
    contenu = <Loader />;
  } else if (lecture.error) {
    contenu = (
      <View
        accessibilityRole="alert"
        style={[
          Spaces.padding[16],
          { backgroundColor: withAlpha(Colors.error500, 0.12), borderRadius: 16, gap: 8 },
        ]}
        testID="canal-ville-erreur"
      >
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
          {t('collectiviteActualites.canal.erreur', 'Les actualités n’ont pas pu être lues.')}
        </Text>
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {getErrorMessage(/** @type {any} */ (lecture.error))}
        </Text>
        <Button
          isOption
          onPress={() => lecture.refetch?.()}
          size="sm"
          style={{ alignSelf: 'flex-start' }}
          title={t('collectiviteActualites.reessayer', 'Réessayer')}
          variant="SecondaryLight"
        />
      </View>
    );
  } else if (actualites.length === 0) {
    contenu = (
      <Text style={[Fonts.p2, Fonts.neutral200]} testID="canal-ville-vide">
        {t('collectiviteActualites.canal.vide', 'Aucune actualité de la Ville pour l’instant.')}
      </Text>
    );
  } else {
    contenu = actualites.map((actualite) => (
      <View
        key={actualite?.documentId}
        style={{ alignSelf: 'flex-start', maxWidth: 560, width: '92%' }}
      >
        <ActualiteCarte actualite={actualite} testID="canal-ville-actualite" />
      </View>
    ));
  }

  const presentation = ville?.name
    ? t(
      'collectiviteActualites.canal.presentation',
      'Les actualités de {{ville}}, pour les clubs rattachés. Seule la Ville y écrit.',
      { ville: formatCollectiviteOfferedBy(ville.name) },
    )
    : t(
      'collectiviteActualites.canal.presentationToutes',
      'Les actualités des Villes de tes clubs. Seules les Villes y écrivent.',
    );

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Spaces.paddingBottom[24], Alignments.fill]}
    >
      <ScrollView
        contentContainerStyle={{ gap: 12, paddingBottom: 24, paddingTop: 12 }}
        onContentSizeChange={() => defilement.current?.scrollToEnd?.({ animated: false })}
        ref={defilement}
        refreshControl={(
          <RefreshControl
            colors={[Colors.primary500]}
            onRefresh={() => lecture.refetch?.()}
            refreshing={Boolean(lecture.isRefetching)}
            tintColor={Colors.primary500}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        <View
          style={[
            Spaces.paddingHorizontal[12],
            Spaces.paddingVertical[8],
            { backgroundColor: withAlpha(Colors.primary500, 0.1), borderRadius: 12 },
          ]}
        >
          <Text style={[Fonts.p3, Fonts.neutral200]} testID="canal-ville-presentation">
            {presentation}
          </Text>
        </View>
        {contenu}
        <Text
          style={[Fonts.p3, Fonts.neutral300, Fonts.textCenter]}
          testID="canal-ville-lecture-seule"
        >
          {t('collectiviteActualites.canal.lectureSeule', 'Lecture seule')}
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}

export default CollectiviteActualitesCanal;
