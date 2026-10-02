import { useNavigation, useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import ScreenContainer from '@/components/templates/ScreenContainer';
import ActualiteCarte from '@/views/collectivite/components/ActualiteCarte';

import { RouteNames } from '@/navigation/routeNames';

import {
  useActualiteMutations,
  useCollectiviteActualites,
} from '@/services/collectivite/collectiviteActualiteQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

/**
 * 📰 « ACTUALITÉS DE LA VILLE », CÔTÉ MAIRIE — COLL-C4A (02/10/2026), planche P3b-actu-tel
 * (écran 3) du design validé HY521H1 page 3.
 *
 * « Publier une actualité » en tête, puis chaque actualité EN LIGNE telle que les clubs la
 * voient, à qui elle est partie (en NOMBRES : « Envoyée aux membres des 3 clubs ») et deux
 * gestes, Modifier et Retirer. Pas de compteur de lecture : il n'existe pas.
 *
 * Paramètre de route : `collectiviteId`. Le serveur est le seul juge (policy
 * is-gestionnaire-collectivite) : un compte qui n'est plus gestionnaire lit son refus.
 * @returns {import('react').ReactElement} L'écran.
 */
function CollectiviteActualites() {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  const collectiviteId = /** @type {{ collectiviteId?: string } | undefined} */ (route?.params)
    ?.collectiviteId || null;
  const actualites = useCollectiviteActualites(collectiviteId);
  const { retirer } = useActualiteMutations(collectiviteId);
  const [enRetrait, setEnRetrait] = useState(/** @type {string | null} */ (null));

  // `retour` : après la publication, le formulaire revient ici au lieu d'empiler une 2e liste.
  const publier = () => navigation.navigate(RouteNames.CollectiviteActualiteForm, {
    collectiviteId,
    retour: 'liste',
  });
  const modifier = (/** @type {any} */ actualite) => navigation.navigate(
    RouteNames.CollectiviteActualiteForm,
    { actualiteId: actualite?.documentId, collectiviteId },
  );
  const retirerApresConfirmation = (/** @type {any} */ actualite) => {
    const geste = async () => {
      setEnRetrait(actualite?.documentId || null);
      try {
        await retirer.mutateAsync(String(actualite?.documentId));
      } catch (error) {
        Alert.alert(
          t('collectiviteActualites.retrait.echec', 'Le retrait n’a pas abouti'),
          getErrorMessage(/** @type {any} */ (error)),
        );
      } finally {
        setEnRetrait(null);
      }
    };
    Alert.alert(
      t('collectiviteActualites.retrait.titre', 'Retirer cette actualité ?'),
      t(
        'collectiviteActualites.retrait.texte',
        'Elle disparaîtra pour tous les membres des clubs. Les notifications déjà parties restent.',
      ),
      [
        { style: 'cancel', text: t('common.actions.cancel', 'Annuler') },
        {
          onPress: geste,
          style: 'destructive',
          text: t('collectiviteActualites.retirer', 'Retirer'),
        },
      ],
    );
  };

  const liste = Array.isArray(actualites.data) ? actualites.data : [];
  let contenu;
  if (actualites.isLoading) {
    contenu = <Loader />;
  } else if (actualites.error) {
    contenu = (
      <View
        accessibilityRole="alert"
        style={[
          Spaces.padding[16],
          {
            backgroundColor: withAlpha(Colors.error500, 0.12),
            borderColor: withAlpha(Colors.error500, 0.4),
            borderRadius: 16,
            borderWidth: 1,
            gap: 8,
          },
        ]}
        testID="collectivite-actualites-erreur"
      >
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {t('collectiviteActualites.erreur', 'Les actualités n’ont pas pu être lues.')}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {getErrorMessage(/** @type {any} */ (actualites.error))}
        </Text>
        <Button
          isOption
          onPress={() => actualites.refetch?.()}
          size="sm"
          style={{ alignSelf: 'flex-start' }}
          title={t('collectiviteActualites.reessayer', 'Réessayer')}
          variant="SecondaryLight"
        />
      </View>
    );
  } else if (liste.length === 0) {
    contenu = (
      <View
        style={[
          Spaces.padding[16],
          {
            backgroundColor: withAlpha(Colors.neutral00, 0.04),
            borderRadius: 16,
            gap: 8,
          },
        ]}
        testID="collectivite-actualites-vide"
      >
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t(
            'collectiviteActualites.vide',
            'Aucune actualité publiée. Les membres de vos clubs la liront dans leurs messages.',
          )}
        </Text>
      </View>
    );
  } else {
    contenu = liste.map((actualite) => (
      <ActualiteCarte
        actualite={actualite}
        key={actualite?.documentId}
        onModifier={() => modifier(actualite)}
        onRetirer={() => retirerApresConfirmation(actualite)}
        retraitEnCours={enRetrait === actualite?.documentId}
        testID={`collectivite-actualite-${actualite?.documentId}`}
        voirDestinataires
      />
    ));
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Spaces.paddingBottom[24], Alignments.fill]}
    >
      <ScrollView
        contentContainerStyle={{ gap: 12, paddingBottom: 24, paddingTop: 12 }}
        refreshControl={(
          <RefreshControl
            colors={[Colors.primary500]}
            onRefresh={() => actualites.refetch?.()}
            refreshing={Boolean(actualites.isRefetching)}
            tintColor={Colors.primary500}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        <Button
          icon="send"
          onPress={publier}
          testID="collectivite-actualites-publier"
          title={t('collectiviteActualites.publier', 'Publier une actualité')}
          variant="Primary"
        />
        {contenu}
      </ScrollView>
    </ScreenContainer>
  );
}

export default CollectiviteActualites;
