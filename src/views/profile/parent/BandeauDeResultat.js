import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Icone from '@/components/atoms/SvgIcon/SvgIcon';

/**
 * Un prenom qui commence par une voyelle (ou un h) s elide : « la fiche d'Anissa ».
 * PAR-L13 — partage avec la carte de l enfant (« La carte d'Anissa »).
 */
export const S_ELIDE = /^[aeiouyhàâäéèêëîïôöùûüœæ]/i;

/**
 * PAR-L5L6 (13/10, design parent E05 et E08) — LE BANDEAU QUI DIT CE QUI VIENT D ARRIVER, en
 * tete de « Mes enfants » : « La fiche d'Anissa est supprimée. », « La fiche d'Anissa est
 * créée. » + « Chercher un club pour Anissa » (aujourd'hui : aucun message).
 *
 * « La fiche de… est créée » plutot que le « Anissa est ajoutée. » de la maquette : l'app ne
 * connait pas le genre d'un enfant, la fiche, si.
 * @param {object} props - Les propriétés.
 * @param {import('./annonceDeLaFiche').Annonce | null} props.annonce - Le dernier geste réussi.
 * @param {(enfant: { documentId?: string, firstname: string }) => void} [props.onSearchClub]
 *   - « Chercher un club pour Anissa », apres une creation.
 * @returns {import('react').ReactElement | null} - Le bandeau, ou rien.
 */
function BandeauDeResultat({ annonce, onSearchClub = undefined }) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  if (!annonce) return null;

  const prenom = String(annonce.firstname || '').trim();
  const elide = S_ELIDE.test(prenom) ? 'Elided' : '';
  const creee = annonce.type === 'creee';
  const avecPrenom = { firstname: prenom, ...SANS_ECHAPPEMENT };
  const message = t(`myChildren.banner.${creee ? 'created' : 'deleted'}${elide}`, avecPrenom);

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
        {creee && annonce.documentId && onSearchClub ? (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => onSearchClub({ documentId: annonce.documentId, firstname: prenom })}
            style={{ alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44 }}
            testID="my-children-banner-search"
          >
            <Text style={[Fonts.p2Bold, { color: Colors.primary300 }]}>
              {t('myChildren.actions.searchClub', avecPrenom)}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export default BandeauDeResultat;
