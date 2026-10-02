import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ActualiteCarte from '@/views/collectivite/components/ActualiteCarte';

import { RouteNames } from '@/navigation/routeNames';

import { useCollectiviteActualites } from '@/services/collectivite/collectiviteActualiteQueries';
import { useCollectiviteClubs } from '@/services/collectivite/collectiviteQueries';

// Sur l'accueil, les deux dernières : le reste est dans « Actualités de la Ville ».
const NOMBRE_SUR_L_ACCUEIL = 2;

/**
 * 📰 LE BLOC « ACTUALITÉS DE LA VILLE » DE L'ACCUEIL DE LA MAIRIE — COLL-C4A (02/10/2026), à la
 * place laissée par COLL-ACCUEIL (planches P3v2-accueil-tel : dernier bloc ; -ordi : 3e colonne).
 *
 * « Publier une actualité », les deux dernières actualités envoyées aux clubs (à qui, en
 * NOMBRES), « Toutes les actualités ». Aucune : une phrase, et « Publier la première ».
 * Le bloc se dit seul en panne : l'accueil reste utilisable.
 * @param {{ collectiviteId: string }} props
 * @returns {import('react').ReactElement} Le bloc.
 */
function ActualitesDeLaVille({ collectiviteId }) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const actualites = useCollectiviteActualites(collectiviteId);
  const clubs = useCollectiviteClubs(collectiviteId);
  const liste = Array.isArray(actualites.data) ? actualites.data : [];
  const nombreDeClubs = Array.isArray(clubs.data) ? clubs.data.length : null;

  const publier = () => navigation.navigate(
    RouteNames.CollectiviteActualiteForm,
    { collectiviteId },
  );
  const toutes = () => navigation.navigate(RouteNames.CollectiviteActualites, { collectiviteId });

  let contenu;
  if (actualites.isLoading) {
    contenu = (
      <View
        style={[
          ApplicationStyle.borderRadius16,
          { backgroundColor: withAlpha(Colors.neutral00, 0.06), height: 120 },
        ]}
      />
    );
  } else if (actualites.error) {
    contenu = (
      <View
        accessibilityRole="alert"
        style={[
          Spaces.padding[16],
          ApplicationStyle.borderRadius16,
          { backgroundColor: withAlpha(Colors.error500, 0.12), gap: 8 },
        ]}
        testID="collectivite-home-actualites-erreur"
      >
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
          {t('collectiviteActualites.accueil.erreur', 'Les actualités n’ont pas pu être lues.')}
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
          ApplicationStyle.borderRadius16,
          { backgroundColor: withAlpha(Colors.neutral00, 0.04), gap: 12 },
        ]}
        testID="collectivite-home-actualites-vide"
      >
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {nombreDeClubs === null
            ? t(
              'collectiviteActualites.accueil.videSansNombre',
              'Aucune actualité publiée. Les membres de vos clubs la liront dans leurs messages.',
            )
            : t(
              'collectiviteActualites.accueil.vide',
              // eslint-disable-next-line max-len
              'Aucune actualité publiée. Les membres de vos {{nombre}} clubs la liront dans leurs messages.',
              { nombre: nombreDeClubs },
            )}
        </Text>
        <Button
          isOption
          onPress={publier}
          size="sm"
          style={{ alignSelf: 'flex-start' }}
          testID="collectivite-home-actualites-premiere"
          title={t('collectiviteActualites.accueil.premiere', 'Publier la première')}
          variant="SecondaryLight"
        />
      </View>
    );
  } else {
    contenu = (
      <>
        {liste.slice(0, NOMBRE_SUR_L_ACCUEIL).map((actualite) => (
          <ActualiteCarte
            actualite={actualite}
            compact
            key={actualite?.documentId}
            testID="collectivite-home-actualite"
            voirDestinataires
          />
        ))}
        <TouchableOpacity
          accessibilityRole="link"
          onPress={toutes}
          style={[
            Alignments.row,
            Alignments.alignCenter,
            { alignSelf: 'flex-start', gap: 4, minHeight: 44 },
          ]}
          testID="collectivite-home-actualites-toutes"
        >
          <Text style={[Fonts.p2Bold, Fonts.primary500]}>
            {t('collectiviteActualites.accueil.toutes', 'Toutes les actualités')}
          </Text>
          <Image
            source={Images.arrowRight}
            style={[ApplicationStyle.icon16, ApplicationStyle.tintColor.primary500]}
          />
        </TouchableOpacity>
      </>
    );
  }

  return (
    <View style={{ gap: 12 }} testID="collectivite-home-actualites">
      <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
        {t('collectiviteActualites.accueil.titre', 'Actualités de la Ville')}
      </Text>
      {liste.length > 0 ? (
        <Button
          icon="send"
          onPress={publier}
          testID="collectivite-home-actualites-publier"
          title={t('collectiviteActualites.publier', 'Publier une actualité')}
          variant="Primary"
        />
      ) : null}
      {contenu}
    </View>
  );
}

export default ActualitesDeLaVille;
