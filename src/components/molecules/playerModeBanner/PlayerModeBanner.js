import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

/**
 * @typedef {object} PlayerModeBannerProps
 * @property {string} accountRoleKey - Le rôle du COMPTE (president / coach…).
 * @property {boolean} canUsePlayerMode - Le mode a un sens pour ce compte.
 * @property {boolean} isPlayerMode - Le mode est actif.
 * @property {(enabled: boolean) => void} onChange - Entrer (vrai) ou revenir (faux).
 */

/**
 * LOT RÔLES (demande d'Adel du 2026-09-28) — le bandeau du MODE JOUEUR, en
 * tête de l'accueil. Deux états, et jamais les deux à la fois :
 *   · l'OFFRE, pour un dirigeant ou un entraîneur qui joue dans une équipe ;
 *   · le RETOUR, quand le mode est actif — « l'option de revenir en arrière »,
 *     visible et en un seul geste.
 * Le mode est un affichage : ce bandeau ne touche aucun droit.
 * @param {PlayerModeBannerProps} props - Les propriétés.
 * @returns {import('react').ReactElement | null} Le bandeau, ou rien.
 */
function PlayerModeBanner(props) {
  const {
    accountRoleKey, canUsePlayerMode, isPlayerMode, onChange,
  } = props;
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();

  if (!isPlayerMode && !canUsePlayerMode) return null;

  const staffLabel = accountRoleKey === 'coach'
    ? t('playerMode.staff.coach', 'entraîneur')
    : t('playerMode.staff.president', 'dirigeant');
  const actionLabel = isPlayerMode
    ? t('playerMode.active.exit', 'Revenir en mode {{staff}}', {
      staff: staffLabel,
      ...SANS_ECHAPPEMENT,
    })
    : t('playerMode.offer.enter', 'Voir l\'app en joueur');

  return (
    <View
      style={[
        ApplicationStyle.borderRadius24,
        ApplicationStyle.borderWidth1,
        Spaces.gap[12],
        Spaces.padding[16],
        {
          backgroundColor: isPlayerMode ? `${Colors.primary500}26` : 'transparent',
          borderColor: isPlayerMode ? Colors.primary500 : `${Colors.primary500}55`,
        },
      ]}
      testID={isPlayerMode ? 'player-mode-active' : 'player-mode-offer'}
    >
      {isPlayerMode ? (
        <View style={[Spaces.gap[4]]}>
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
            {t('playerMode.active.title', 'Mode joueur')}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t(
              'playerMode.active.description',
              'Tu vois l\'app comme un joueur de ton équipe. Tes droits de {{staff}} sont intacts.',
              { staff: staffLabel, ...SANS_ECHAPPEMENT },
            )}
          </Text>
        </View>
      ) : (
        <Text style={[Fonts.p2, Fonts.neutral00]}>
          {t('playerMode.offer.description', 'Tu joues aussi dans une équipe.')}
        </Text>
      )}
      <TouchableOpacity
        accessibilityLabel={actionLabel}
        accessibilityRole="button"
        onPress={() => onChange(!isPlayerMode)}
        style={[
          Alignments.alignCenter,
          ApplicationStyle.borderRadius12,
          Spaces.paddingVertical[12],
          isPlayerMode
            ? ApplicationStyle.backgroundColor.primary500
            : ApplicationStyle.backgroundColor.primary700,
        ]}
        testID={isPlayerMode ? 'player-mode-exit' : 'player-mode-enter'}
      >
        {/* FINITIONS3 (29/09) : « Voir l'app en » — sous Android 16, un texte gras de
            plusieurs mots dans une boite a sa largeur MESUREE perd son dernier mot. La
            boite s etire sur tout le bouton, le texte y est centre (parade du bouton
            partage, FINITIONS du 28/09). */}
        <Text
          style={[
            Alignments.selfStretch,
            Fonts.p2Bold,
            Fonts.textCenter,
            isPlayerMode ? Fonts.primary900 : Fonts.neutral00,
          ]}
        >
          {actionLabel}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default PlayerModeBanner;
