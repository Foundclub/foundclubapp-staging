import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Text, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

/**
 * R3 — l'invitation « Plus tard » (planche C du pack).
 *
 * 🟠 CE QU'ELLE N'EST PAS : un ecran bloquant. Elle se pose PAR-DESSUS une app
 * qui fonctionne, et le second bouton la referme pour de bon. C'est toute la
 * difference avec `AppUpdateRequiredScreen`, qui remplace l'arbre de navigation.
 *
 * 🚪 ELLE NE FABRIQUE PAS SA PROPRE FEUILLE : elle habille `BottomModal`, deja
 * en service dans une dizaine d'ecrans (glissement vers le bas, fond flouté,
 * marges de securite du telephone). Le composant partage n'est pas touche.
 *
 * ⏱️ « Une seule fois par demarrage a froid » ne se decide PAS ici : c'est
 * `AppUpdateGate` qui retient le refus, parce que c'est lui qui reste monte
 * toute la session (voir son commentaire).
 * @param {{
 *  isVisible?: boolean;
 *  onLater?: () => void;
 *  onOpenUrl?: (url: string) => void | Promise<void>;
 *  recommendedVersion?: string | null;
 *  storeUrl?: string | null;
 * }} props
 * @returns {import('react').ReactElement}
 */
function AppUpdateRecommendedSheet({
  isVisible = false,
  onLater,
  onOpenUrl,
  recommendedVersion = null,
  storeUrl = null,
} = {}) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const [openFailed, setOpenFailed] = useState(false);

  /** @type {import('react-native').ViewStyle} */
  const handleStyle = {
    alignSelf: 'center',
    backgroundColor: withAlpha(Colors.neutral00, 0.18),
    height: 5,
    width: 44,
  };

  /** @type {import('react-native').ViewStyle} */
  const badgeStyle = {
    backgroundColor: withAlpha(Colors.primary500, 0.12),
    borderColor: withAlpha(Colors.primary500, 0.32),
    borderWidth: 1,
    height: 56,
    width: 56,
  };

  /**
   * Ouvre la boutique. 🏪 Un store injoignable ne se raconte pas dans un toast
   * qui s'efface : le pack demande une ligne factuelle qui reste sous le bouton,
   * pendant que le bouton, lui, garde son etat.
   * @param {string | null} url
   * @returns {Promise<void>}
   */
  const openUrl = async (url) => {
    if (!url) return;
    setOpenFailed(false);
    try {
      if (typeof onOpenUrl === 'function') {
        await onOpenUrl(url);
        return;
      }
      await Linking.openURL(url);
    } catch (_error) {
      setOpenFailed(true);
    }
  };

  return (
    <BottomModal
      close={onLater}
      isVisible={isVisible}
      scrollable={false}
    >
      <View style={[Spaces.paddingBottom[16], Spaces.gap[16]]}>
        <View style={[handleStyle, ApplicationStyle.borderRadius100]} />

        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
          <View
            style={[
              badgeStyle,
              ApplicationStyle.borderRadius16,
              Alignments.alignCenter,
              Alignments.justifyCenter,
            ]}
          >
            <GlyphIcon color={Colors.primary500} name="arrowDownToBracket" size={26} />
          </View>
          <View style={[Alignments.grow1, Spaces.gap[4]]}>
            <Text style={[Fonts.h4Black, Fonts.neutral00]}>
              {t('appUpdateGate.recommended.title', 'Une mise à jour est disponible')}
            </Text>
            {recommendedVersion ? (
              <Text style={[Fonts.p3, Fonts.neutral500]}>
                {t('appUpdateGate.recommended.version', {
                  defaultValue: 'Version {{version}}',
                  version: recommendedVersion,
                })}
              </Text>
            ) : null}
          </View>
        </View>

        <Text style={[Fonts.p2, Fonts.neutral300]}>
          {t(
            'appUpdateGate.recommended.description',
            'Mets à jour FoundClub pour profiter des dernières nouveautés et corrections.',
          )}
        </Text>

        <View style={Spaces.gap[8]}>
          <Button
            accessibilityHint={t(
              'appUpdateGate.a11y.updateHint',
              "Ouvre la boutique d'applications de ce téléphone.",
            )}
            accessibilityLabel={t('appUpdateGate.actions.update', 'Mettre à jour')}
            disabled={!storeUrl}
            onPress={() => openUrl(storeUrl)}
            style={Alignments.fullWidth}
            title={t('appUpdateGate.actions.update', 'Mettre à jour')}
            variant="Primary"
          />
          {openFailed ? (
            <Text style={[Fonts.p3, Fonts.error500]}>
              {t(
                'appUpdateGate.storeUnreachable',
                "Impossible d'ouvrir le store. Réessaie.",
              )}
            </Text>
          ) : null}
          <Button
            accessibilityHint={t(
              'appUpdateGate.a11y.laterHint',
              'Ferme ce message et continue dans FoundClub.',
            )}
            accessibilityLabel={t('appUpdateGate.actions.later', 'Plus tard')}
            onPress={onLater}
            style={Alignments.fullWidth}
            title={t('appUpdateGate.actions.later', 'Plus tard')}
            variant="Ghost"
          />
        </View>
      </View>
    </BottomModal>
  );
}

export default AppUpdateRecommendedSheet;
