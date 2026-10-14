import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { libelleStatut, STATUTS } from '@/domains/complexe/complexeReservation';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';

/**
 * L'allure d'un état (planche P00, « 9 états d'une réservation ») : son jeton, son glyphe, et le
 * pointillé de « Sans réponse » (« moins de gris » : cyan pâle au lieu du gris du plan).
 * @param {string} statut - L'état.
 * @returns {{ cle: 'error500' | 'primary200' | 'success500' | 'warning500', glyphe: string | null,
 *   pointille: boolean }} L'allure.
 */
const allureDe = (statut) => {
  switch (statut) {
    case STATUTS.annulee:
    case STATUTS.refusee:
      return { cle: 'error500', glyphe: 'ban', pointille: false };
    case STATUTS.confirmee:
      return { cle: 'success500', glyphe: 'circleCheck', pointille: false };
    case STATUTS.enAttente:
      return { cle: 'warning500', glyphe: 'hourglass', pointille: false };
    default:
      return { cle: 'primary200', glyphe: 'clock', pointille: true };
  }
};

/**
 * LES PASTILLES D'UNE RÉSERVATION — RESA-L5A2 (14/10/2026), planches E-G04, E-G05, E-G06 : l'état
 * (Confirmée, En attente, Refusée, Sans réponse, Annulée) et la source (A-G18) « App » (cyan) ou
 * « Extérieur » (liseré). `texteEtat` remplace le libellé (« Acceptée », « Refusée : … »).
 * @param {object} props - Les propriétés.
 * @param {boolean} [props.sansEtat] - La source seule (une note « extérieur » confirmée).
 * @param {string | null} [props.source] - `app | exterieur` ; rien sans elle.
 * @param {string} props.statut - L'état du serveur.
 * @param {string} [props.texteEtat] - Le libellé à la place de celui de l'état.
 * @returns {import('react').ReactElement} Les pastilles.
 */
function PastillesReservation({
  sansEtat = false, source = null, statut, texteEtat = '',
}) {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const allure = allureDe(statut);
  const couleur = Colors[allure.cle];
  const libelle = texteEtat || libelleStatut(t, statut);
  const pastille = {
    alignItems: /** @type {'center'} */ ('center'),
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: /** @type {'row'} */ ('row'),
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  };
  return (
    <View style={[Alignments.row, Alignments.wrap, { gap: 4 }]}>
      {source === 'app' ? (
        <View
          style={[pastille, {
            backgroundColor: withAlpha(Colors.primary500, 0.18),
            borderColor: withAlpha(Colors.primary500, 0.6),
          }]}
          testID="pastille-source-app"
        >
          <Text style={[Fonts.p3Bold, Fonts.primary200]}>
            {t('complexeReservations.source.app', 'App')}
          </Text>
        </View>
      ) : null}
      {source === 'exterieur' ? (
        <View
          style={[pastille, { borderColor: Colors.neutral200 }]}
          testID="pastille-source-exterieur"
        >
          <Text style={[Fonts.p3Bold, Fonts.neutral100]}>
            {t('complexeReservations.source.exterieur', 'Extérieur')}
          </Text>
        </View>
      ) : null}
      {!sansEtat && libelle ? (
        <View
          style={[pastille, {
            backgroundColor: withAlpha(couleur, 0.14),
            borderColor: withAlpha(couleur, 0.55),
            borderStyle: allure.pointille ? 'dashed' : 'solid',
          }]}
          testID={`pastille-etat-${statut}`}
        >
          {allure.glyphe ? <GlyphIcon color={couleur} name={allure.glyphe} size={12} /> : null}
          <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{libelle}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default PastillesReservation;
