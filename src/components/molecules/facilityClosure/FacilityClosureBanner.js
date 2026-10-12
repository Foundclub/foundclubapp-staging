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
 * FINITIONS11-COLL (03/10, planche 25) : `facilityType` (la valeur du serveur, `facility.type`)
 * nomme le lieu, « Le gymnase est fermé ce jour-là » ; sans lui, « L'installation ».
 * 🎨 FINITIONS13-COLL (04/10) : `closures` (une liste) pose un bandeau par fermeture, la plus
 * proche d'abord (tournée T13 : la fermeture du 15 restait invisible tant qu'une autre existait
 * le 10).
 * @param {{
 *   closure?: any,
 *   closures?: any[],
 *   facilityType?: string | null,
 *   onMove?: () => void,
 *   onCancel?: () => void,
 *   testID?: string,
 *   withDays?: boolean,
 * }} props
 * @returns {import('react').ReactElement | null} Le bandeau.
 */
function FacilityClosureBanner({
  closure = null,
  closures,
  facilityType = null,
  onCancel,
  onMove,
  testID = 'bandeau-fermeture',
  withDays = false,
}) {
  const { t } = useTranslation();
  const { Colors, Fonts, Spaces } = useTheme();
  if (Array.isArray(closures)) {
    const liste = closures.filter(Boolean);
    if (liste.length < 2) {
      return liste.length ? (
        <FacilityClosureBanner
          closure={liste[0]}
          facilityType={facilityType}
          testID={testID}
          withDays={withDays}
        />
      ) : null;
    }
    return (
      <View style={{ gap: 8 }}>
        {liste.map((une, rang) => (
          <FacilityClosureBanner
            closure={une}
            facilityType={facilityType}
            key={une?.documentId || `${une?.startDate}-${rang}`}
            testID={rang ? `${testID}-${rang + 1}` : testID}
            withDays={withDays}
          />
        ))}
      </View>
    );
  }
  if (!closure) return null;
  const { texte, titre } = closureBannerText(t, closure, { facilityType, withDays });
  const gestes = Boolean(onMove || onCancel);
  // FINITIONS-VILLE (T20) : lu d'une traite, le titre (sans point) se collait au nom de la
  // fermeture (« … 4 novembre T20 essai. ») : la région se lit « titre. nom. ».
  const lecture = [titre ? `${titre}.` : '', texte].filter(Boolean).join(' ');
  return (
    <View style={{ gap: 8 }} testID={testID}>
      <View
        accessibilityLabel={lecture}
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
