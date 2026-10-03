import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import { RouteNames } from '@/navigation/routeNames';

import {
  useCollectiviteRequests,
  useMyCollectivites,
} from '@/services/collectivite/collectiviteQueries';

/**
 * 🏛️ LA RANGÉE-PORTE DU COMPTE MIXTE — COLL-ACCUEIL (01/10/2026), planche `P1-mixte-tel`.
 *
 * Un dirigeant (ou tout compte sportif) qui gère AUSSI une Ville garde son accueil de club
 * (décision d'Adel, 01/10 : « le compte mixte est rare, on ne s'y attarde pas ») : une seule
 * rangée, discrète, en tête, avec le nombre de demandes. Elle ouvre l'espace de la Ville, avec
 * « ‹ son club » en haut pour revenir. Rien pour un compte qui ne gère aucune Ville
 * (`/collectivites/mine` vide : le serveur est le seul juge).
 * @returns {import('react').ReactElement | null} La rangée, ou rien.
 */
function CollectivitePorteRow() {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const { userData } = useAuth();
  const mine = useMyCollectivites();
  const ville = Array.isArray(mine.data) ? mine.data[0] : null;
  const pending = useCollectiviteRequests(ville?.documentId, 'pending');
  if (!ville?.documentId) return null;

  const nombre = Array.isArray(pending.data) ? pending.data.length : 0;
  let sousTitre = t('collectivite.home.kicker', 'Ma collectivité');
  if (nombre === 1) {
    sousTitre = t('collectiviteAccueil.porte.uneDemande', 'Ma collectivité · 1 demande');
  } else if (nombre > 1) {
    sousTitre = t('collectiviteAccueil.porte.demandes', 'Ma collectivité · {{nombre}} demandes', {
      nombre,
    });
  }
  const retour = userData?.club?.name || t('collectiviteAccueil.porte.retourAccueil', 'Accueil');

  const ouvrir = () => {
    // Sur le site, l'espace de la Ville est le menu latéral : on ouvre son accueil.
    if (Platform.OS === 'web') {
      navigation.navigate(RouteNames.CollectiviteHome, { collectiviteId: ville.documentId });
      return;
    }
    navigation.navigate(RouteNames.CollectiviteSpace, {
      collectiviteId: ville.documentId,
      returnLabel: retour,
    });
  };

  return (
    <TouchableOpacity
      // COLL-FIX2 (T10) : « 1 demandes à trancher » — le singulier a sa phrase.
      accessibilityLabel={nombre > 0
        ? t(
          nombre === 1
            ? 'collectiviteAccueil.porte.a11yDemande'
            : 'collectiviteAccueil.porte.a11yDemandes',
          nombre === 1
            ? 'Ma collectivité, {{nom}} : 1 demande à trancher'
            : 'Ma collectivité, {{nom}} : {{nombre}} demandes à trancher',
          { nom: ville.name || '', nombre, ...SANS_ECHAPPEMENT },
        )
        : t('collectiviteAccueil.porte.a11y', 'Ma collectivité, {{nom}}', {
          nom: ville.name || '',
          ...SANS_ECHAPPEMENT,
        })}
      accessibilityRole="button"
      onPress={ouvrir}
      style={[
        ApplicationStyle.borderRadius16,
        Alignments.row,
        Alignments.alignCenter,
        Spaces.padding[12],
        {
          backgroundColor: withAlpha(Colors.primary700, 0.35),
          borderColor: withAlpha(Colors.primary500, 0.28),
          borderWidth: 1,
          gap: 12,
        },
      ]}
      testID="collectivite-porte"
    >
      <View
        style={[
          Alignments.alignCenter,
          Alignments.justifyCenter,
          ApplicationStyle.borderRadius12,
          { backgroundColor: withAlpha(Colors.primary500, 0.18), height: 36, width: 36 },
        ]}
      >
        <Image
          source={Images.flag}
          style={[ApplicationStyle.icon16, ApplicationStyle.tintColor.primary200]}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00]}>{ville.name}</Text>
        <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral300]}>{sousTitre}</Text>
      </View>
      {nombre > 0 ? (
        <View
          style={[
            Alignments.alignCenter,
            Alignments.justifyCenter,
            {
              // Même jeton que la pastille de la cloche (NotificationBadge) : 5,2:1.
              backgroundColor: Colors.error700,
              borderRadius: 999,
              minWidth: 24,
              paddingHorizontal: 6,
            },
          ]}
          testID="collectivite-porte-compteur"
        >
          <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{String(nombre)}</Text>
        </View>
      ) : null}
      <Image
        source={Images.arrowRight}
        style={[ApplicationStyle.icon16, ApplicationStyle.tintColor.neutral400]}
      />
    </TouchableOpacity>
  );
}

export default CollectivitePorteRow;
