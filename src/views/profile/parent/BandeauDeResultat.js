import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Icone from '@/components/atoms/SvgIcon/SvgIcon';

/** Un prenom qui commence par une voyelle (ou un h) s elide : « la fiche d'Anissa ». */
const S_ELIDE = /^[aeiouyhàâäéèêëîïôöùûüœæ]/i;

/**
 * PAR-L5L6 (13/10, design parent E05) — LE BANDEAU QUI DIT CE QUI VIENT D ARRIVER, en tete de
 * « Mes enfants » : « La fiche d'Anissa est supprimée. » (aujourd'hui : aucun message).
 * @param {object} props - Les propriétés.
 * @param {import('./annonceDeLaFiche').Annonce | null} props.annonce - Le dernier geste réussi.
 * @returns {import('react').ReactElement | null} - Le bandeau, ou rien.
 */
function BandeauDeResultat({ annonce }) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  if (!annonce) return null;

  const prenom = String(annonce.firstname || '').trim();
  const elide = S_ELIDE.test(prenom) ? 'Elided' : '';
  const message = t(`myChildren.banner.deleted${elide}`, {
    firstname: prenom, ...SANS_ECHAPPEMENT,
  });

  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        alignItems: 'center',
        backgroundColor: withAlpha(Colors.success500, 0.12),
        borderColor: withAlpha(Colors.success500, 0.45),
        borderRadius: 16,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 12,
        padding: 12,
      }}
      testID="my-children-banner"
    >
      <Icone color={Colors.success200} height={20} name="check" width={20} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{message}</Text>
      </View>
    </View>
  );
}

export default BandeauDeResultat;
