import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import {
  lienDeLaVilleRetenu,
  retourAuLienEnAttente,
} from '@/domains/collectivite/lienDeLaVille';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import { RouteNames } from '@/navigation/routeNames';

/**
 * 🏛️ L'INVITATION DE LA VILLE, SUR L'ACCUEIL — CORR-INVITATION-VILLE (31/10/2026), fin du point 10
 * de la recette du site (décision A, plus l'ajout d'Adel « le B doit etre possible aussi »).
 *
 * B : un compte qui a touché « Inscrire mon club » sur l'invitation de la Ville (lien retenu 48 h,
 * lienDeLaVille.js) et qui n'a pas encore de club trouve, sur son accueil, une carte qui rouvre
 * l'invitation. Elle disparaît avec la création du club, qui envoie puis oublie le lien
 * (ClubWizardRecap). Même rangée que la porte de la Ville (CollectivitePorteRow).
 *
 * Sur le SITE, l'accueil fait aussi le retour au lien après la connexion : au téléphone c'est
 * useLiensEnAttente (PrivateNavigator), que le site n'a pas. L'accueil du site n'est monté qu'une
 * fois l'étape d'âge et le choix du statut faits (SharedHomeRoute) : le compte est prêt. La page
 * du lien, ouverte avec un compte, efface le repère : on n'y revient qu'une fois.
 * @param {object} props - Les propriétés.
 * @param {any} props.navigation - La navigation de l'accueil (HomeHub).
 * @returns {import('react').ReactElement | null} La carte, ou rien.
 */
function CollectiviteInvitationRow({ navigation }) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const { userData } = useAuth();

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const retour = retourAuLienEnAttente();
    if (retour) navigation.navigate(RouteNames.CollectiviteJoin, { token: retour });
  }, [navigation]);

  const token = lienDeLaVilleRetenu();
  if (!token || userData?.club) return null;

  const titre = t('collectiviteAccueil.invitationVille.titre', 'La Ville t’a invité : inscris ton club');

  return (
    <TouchableOpacity
      accessibilityLabel={titre}
      accessibilityRole="button"
      onPress={() => navigation.navigate(RouteNames.CollectiviteJoin, { token })}
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
      testID="collectivite-invitation"
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
      <Text numberOfLines={2} style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>{titre}</Text>
      <Image
        source={Images.arrowRight}
        style={[ApplicationStyle.icon16, ApplicationStyle.tintColor.neutral400]}
      />
    </TouchableOpacity>
  );
}

export default CollectiviteInvitationRow;
