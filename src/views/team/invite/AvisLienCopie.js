import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * GUIDES-SITE-CORR-2 (M1096) — sur un ordinateur, « Copier le lien d'invitation » copie le lien
 * (teamInviteShare) : rien ne s'ouvre, donc l'écran DIT que c'est copié, ou que la copie a échoué.
 * Posé en surimpression en haut de la fiche de l'équipe ; la feuille des actions est déjà fermée.
 * @param {object} props - Les props.
 * @param {'' | 'copie' | 'echec'} props.etat - Ce que la copie a donné ; '' : rien à dire.
 * @returns {import('react').ReactElement | null} L'avis, ou rien.
 */
function AvisLienCopie({ etat }) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  if (!etat) return null;
  const texte = etat === 'copie'
    ? t('teamDetails.invite.linkCopied', 'Lien copié : colle-le dans le groupe de ton équipe.')
    : t(
      'smsRepliCopie.echec',
      'La copie n’a pas marché sur ce navigateur : envoie l’invitation depuis ton téléphone.',
    );
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      pointerEvents="none"
      style={{
        alignItems: 'center', left: 0, position: 'absolute', right: 0, top: 52, zIndex: 20,
      }}
      testID="team.lienCopie"
    >
      <View style={{
        backgroundColor: etat === 'copie' ? Colors.success500 : Colors.error500,
        borderRadius: 12,
        maxWidth: 420,
        paddingHorizontal: 16,
        paddingVertical: 10,
      }}
      >
        <Text style={[Fonts.p2Bold, {
          // Texte foncé sur le vert (le blanc s'y lit mal) ; blanc sur le rouge de l'échec.
          color: etat === 'copie' ? Colors.primary900 : Colors.neutral00,
          textAlign: 'center',
        }]}
        >
          {texte}
        </Text>
      </View>
    </View>
  );
}

export default AvisLienCopie;
