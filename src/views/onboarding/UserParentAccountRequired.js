import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import FormScreenContainer from '@/components/templates/FormScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

const FALLBACKS = {
  body: 'Tu as moins de 13 ans. Sur FoundClub, tu n’as pas besoin de compte : '
    + 'c’est ton parent qui te déclare depuis le sien.',
  steps: 'Il installe l’app, choisit « Parent » à l’inscription, puis te déclare '
    + 'comme joueur. Tu apparaîtras sous ton prénom dans ton équipe.',
  title: 'Un compte parent est nécessaire',
};

/**
 * PARENT (2026-09-02, palier 13) — L ECRAN OU ATTERRIT UN MOINS DE 13 ANS.
 *
 * « Inscris un compte de 10 ans : il doit demander un compte parent, et
 * refuser de continuer sans » (Adel). Le serveur a refuse l identite avec la
 * portee `minor_parent_account_required` ; `UserName` nous amene ici.
 *
 * Il n y a PAS de compte sous 13 ans (version A d Adel) : le parent declare
 * son enfant depuis SON compte, l enfant est une fiche joueur sans
 * identifiants. Cet ecran l explique, et n offre que deux sorties :
 *   · « Corriger ma date de naissance » — une faute de frappe est la seule
 *     raison legitime de revenir (le serveur re-verifie de toute facon) ;
 *   · « Se deconnecter ».
 * ⛔ Aucun « passer », aucune etape suivante : c est tout le sens du palier.
 * @param {{ navigation: any, route?: any }} props - Les props de l ecran.
 * @returns {import('react').ReactElement} L ecran.
 */
function UserParentAccountRequired({ navigation }) {
  const { Alignments, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { logoutMutation } = useAuth();

  const handleFixBirthdate = () => {
    navigation.navigate(RouteNames.UserName);
  };

  const handleLogout = () => {
    logoutMutation?.mutate?.();
  };

  return (
    <FormScreenContainer
      bgImage="bg2"
      bottomInsetMode="edge-to-edge"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        { marginBottom: insets.bottom },
        Alignments.justifySpaceBetween,
        Alignments.column,
        Alignments.fill,
      ]}
    >
      <View style={[Spaces.gap[16]]}>
        <Text style={[Fonts.h2Black, Fonts.neutral00]}>
          {t('parentAccountRequired.title', FALLBACKS.title)}
        </Text>
        <Text style={[Fonts.p1, Fonts.neutral00]}>
          {t('parentAccountRequired.body', FALLBACKS.body)}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral00]}>
          {t('parentAccountRequired.steps', FALLBACKS.steps)}
        </Text>
      </View>

      <View style={[Spaces.gap[16]]}>
        <Button
          onPress={handleFixBirthdate}
          title={t('parentAccountRequired.fixBirthdate', 'Corriger ma date de naissance')}
          variant="SecondaryLight"
        />
        <Button
          onPress={handleLogout}
          title={t('parentAccountRequired.logout', 'Se déconnecter')}
          variant="Primary"
        />
      </View>
    </FormScreenContainer>
  );
}

export default UserParentAccountRequired;
