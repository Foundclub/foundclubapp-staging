import { useTranslation } from 'react-i18next';
import {
  Image, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import { feedbackCardStyle } from '@/views/profile/coachFeedback/CoachFeedbackList';
import useMesEnfantsEnBref from '@/views/profile/parent/useMesEnfantsEnBref';

import { RouteNames } from '@/navigation/routeNames';

/**
 * PAR-L7 (13/10, design parent E03, décision D1 A d'Adel du 12/10) — LE BLOC « MES ENFANTS »
 * DE « MON PROFIL ».
 *
 * Les mêmes lignes que la carte de l'accueil (« Anissa · U11 Filles », 3 au plus puis « + 2
 * autres »), « Voir tout » vers « Mes enfants », et le « + » carré cyan à droite du titre (le
 * motif « Joueur·se·s + » de l'app) pour en ajouter un. La carte bleue des écrans parent
 * (`feedbackCardStyle`), jamais la carte grise (retour d'Adel du 12/10 : « évite le gris »).
 *
 * - Le PARENT l'a toujours (`toujours`) : son profil, ce sont ses enfants puis ses infos ; sans
 *   enfant, il lit quoi faire.
 * - Un compte SPORTIF ne l'a que s'il a des enfants : son profil sportif reste intact.
 * @param {object} props - Les propriétés.
 * @param {{ navigate: (route: string) => void }} props.navigation - La navigation de l'écran.
 * @param {boolean} [props.toujours] - Montrer le bloc même sans enfant (le parent).
 * @returns {import('react').ReactElement | null} - Le bloc, ou rien.
 */
function BlocMesEnfants({ navigation, toujours = false }) {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Images,
  } = useTheme();
  // Il n'est monté que sur le profil d'un rôle du club (parent, joueur, entraîneur, dirigeant).
  const bref = useMesEnfantsEnBref({ actif: true });

  if (!toujours && bref.total === 0) return null;

  return (
    <View style={feedbackCardStyle(Colors, false)} testID="bloc-mes-enfants">
      <View style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}>
        <Text
          style={[
            Fonts.p3Bold,
            Fonts.primary200,
            { flex: 1, letterSpacing: 0.4, textTransform: 'uppercase' },
          ]}
        >
          {t('myChildren.screen.title', 'Mes enfants')}
        </Text>
        <TouchableOpacity
          accessibilityLabel={t('myChildren.actions.add', 'Ajouter un enfant')}
          accessibilityRole="button"
          onPress={() => navigation.navigate(RouteNames.ChildEdit)}
          style={{
            alignItems: 'center',
            backgroundColor: Colors.primary500,
            borderRadius: 12,
            height: 44,
            justifyContent: 'center',
            width: 44,
          }}
          testID="bloc-mes-enfants-ajouter"
        >
          <Image
            source={Images.plus}
            style={{ height: 14, tintColor: Colors.primary900, width: 14 }}
          />
        </TouchableOpacity>
      </View>

      {bref.total === 0 ? (
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t('myChildren.screen.empty', 'Tu n’as pas encore déclaré d’enfant.')}
        </Text>
      ) : null}

      {bref.lignes.map((ligne) => (
        <Text key={ligne.cle} style={[Fonts.p2, Fonts.neutral200]}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{ligne.prenom}</Text>
          {` · ${ligne.etat}`}
        </Text>
      ))}

      {bref.reste > 0 ? (
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t('myChildren.summary.more', { count: bref.reste })}
        </Text>
      ) : null}

      {bref.total > 0 ? (
        <TouchableOpacity
          accessibilityRole="link"
          onPress={() => navigation.navigate(RouteNames.MyChildren)}
          style={[
            Alignments.row,
            Alignments.alignCenter,
            Alignments.justifySpaceBetween,
            { minHeight: 44 },
          ]}
          testID="bloc-mes-enfants-voir-tout"
        >
          <Text style={[Fonts.p2Bold, Fonts.primary500]}>{t('myChildren.summary.seeAll')}</Text>
          <Image
            source={Images.arrowRight}
            style={{ height: 12, tintColor: Colors.primary500, width: 12 }}
          />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default BlocMesEnfants;
