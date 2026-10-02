import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { closureBannerText } from '@/domains/facilityClosure/facilityClosureDisplay';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';

/**
 * 🚧 COLL-C4B (02/10) — LE BANDEAU D UNE FERMETURE (design HY521H1, « P4v3-fermer-tel » ecran 5 ;
 * « P3b-actu-tel » ecran 6). Orange : attention, jamais erreur. Composant PUR : il ne lit rien, il
 * dit la fermeture qu on lui donne — importable par n importe quel ecran sans doublure de plus.
 *
 * Sur un entrainement touche (D16), il porte les deux gestes du club : « Changer l heure ou le
 * lieu », « Annuler l entrainement ». Rien n est annule a la place du club ; ses joueurs ne sont
 * prevenus que s il deplace ou annule (le geste de la fiche, comme aujourd hui).
 * @param {{
 *   closure: any,
 *   onMove?: () => void,
 *   onCancel?: () => void,
 *   testID?: string,
 *   withDays?: boolean,
 * }} props
 * @returns {import('react').ReactElement | null} Le bandeau.
 */
function FacilityClosureBanner({
  closure, onCancel, onMove, testID = 'bandeau-fermeture', withDays = false,
}) {
  const { t } = useTranslation();
  const { Colors, Fonts, Spaces } = useTheme();
  if (!closure) return null;
  const { texte, titre } = closureBannerText(t, closure, { withDays });
  const gestes = Boolean(onMove || onCancel);
  return (
    <View style={{ gap: 8 }} testID={testID}>
      <View
        accessibilityRole="summary"
        style={[
          Spaces.padding[12],
          {
            backgroundColor: withAlpha(Colors.warning500, 0.12),
            borderColor: withAlpha(Colors.warning500, 0.45),
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 10,
          },
        ]}
      >
        <SvgIcon color={Colors.warning500} height={18} name="clock-two-thirty" width={18} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{titre}</Text>
          {texte ? <Text style={[Fonts.p3, Fonts.neutral200]}>{texte}</Text> : null}
        </View>
      </View>
      {onMove ? (
        <Button
          onPress={onMove}
          title={t('collectiviteFermetures.seance.deplacer', 'Changer l’heure ou le lieu')}
          variant="Primary"
        />
      ) : null}
      {onCancel ? (
        <Button
          onPress={onCancel}
          title={t('collectiviteFermetures.seance.annuler', 'Annuler l’entraînement')}
          variant="Danger"
        />
      ) : null}
      {gestes ? (
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {t(
            'collectiviteFermetures.seance.joueurs',
            'Les joueurs ne sont prévenus que si le club déplace ou annule.',
          )}
        </Text>
      ) : null}
    </View>
  );
}

export default FacilityClosureBanner;
