import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

/**
 * POINTAGE (decisions d Adel du 29/09) — LES DEUX OPTIONS DE PRESENCE D UN
 * EVENEMENT, EN DEUX CASES.
 *
 * « Les participants repondent Present / Absent » et « Suivre les arrivees »,
 * cochees par defaut, decochables. Une seule definition pour les trois ecrans
 * qui les proposent : l etape « Acces » du tunnel, la modification mobile et la
 * modification du site. Decochee, une option retire de la fiche ce qu elle
 * commande (boutons, relances, pointage) ; le serveur refuse le reste.
 *
 * La rangee ENTIERE est la case (motif du Recap, « a la une ») : titre et phrase
 * sont lus par le lecteur d ecran, et la cible fait plus de 44 points.
 * @param {object} props
 * @param {boolean | null | undefined} props.arrivalTrackingEnabled La valeur
 *   en cours ; `null`/absente = cochee (evenement d avant le lot).
 * @param {(changement: { arrivalTrackingEnabled?: boolean, rsvpEnabled?: boolean }) => void} props.onChange
 *   Rend la seule option qui vient de changer.
 * @param {boolean | null | undefined} props.rsvpEnabled La valeur en cours.
 * @returns {import('react').ReactElement}
 */
function PresenceOptionsFields({ arrivalTrackingEnabled, onChange, rsvpEnabled }) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  const options = [
    {
      checked: rsvpEnabled !== false,
      cle: 'rsvpEnabled',
      phrase: t(
        'eventPresenceOptions.rsvpHint',
        'Chacun dit à l’avance s’il vient. Décoché : ni boutons Présent / Absent, ni relances.',
      ),
      titre: t('eventPresenceOptions.rsvp', 'Les participants répondent Présent / Absent'),
    },
    {
      checked: arrivalTrackingEnabled !== false,
      cle: 'arrivalTrackingEnabled',
      phrase: t(
        'eventPresenceOptions.arrivalsHint',
        'Le joueur signale son arrivée ou son retard, l’entraîneur fait l’appel. Décoché : pas de pointage.',
      ),
      titre: t('eventPresenceOptions.arrivals', 'Suivre les arrivées'),
    },
  ];

  return (
    <View style={[Spaces.gap[8]]}>
      {options.map((option) => (
        <TouchableOpacity
          accessibilityHint={option.phrase}
          accessibilityLabel={option.titre}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: option.checked }}
          activeOpacity={0.85}
          key={option.cle}
          onPress={() => onChange({ [option.cle]: !option.checked })}
          style={[
            ApplicationStyle.borderRadius16,
            ApplicationStyle.borderWidth1,
            Spaces.padding[12],
            {
              backgroundColor: withAlpha(Colors.primary500, option.checked ? 0.12 : 0.04),
              borderColor: option.checked ? Colors.primary500 : withAlpha(Colors.primary500, 0.2),
              minHeight: 44,
            },
          ]}
        >
          <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
            <View
              style={[
                Alignments.alignCenter,
                Alignments.justifyCenter,
                {
                  backgroundColor: option.checked ? Colors.primary500 : 'transparent',
                  borderColor: option.checked ? Colors.primary500 : Colors.neutral200,
                  borderRadius: 4,
                  borderWidth: 2,
                  height: 24,
                  width: 24,
                },
              ]}
            >
              {option.checked ? <Text style={[Fonts.p3Bold, Fonts.neutral900]}>✓</Text> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{option.titre}</Text>
              <Text style={[Fonts.p3, Fonts.neutral200, Spaces.marginTop[4]]}>{option.phrase}</Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default PresenceOptionsFields;
