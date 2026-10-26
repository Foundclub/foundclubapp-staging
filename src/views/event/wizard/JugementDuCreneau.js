import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import useJugementDuCreneau from './useJugementDuCreneau';

/**
 * 🗓️ DATESDABORD (25/10/2026, « 6- B ») — SOUS « DATE & HORAIRE », CE QUE DIT L'INSTALLATION
 * CHOISIE À L'ÉTAPE « LIEU », pour le jour et les heures en cours : « Ce créneau est libre »
 * (vert), « Attention, ce créneau est déjà pris : … » (orange), la fermeture de la Ville (orange,
 * bloque),
 * la mairie qui décidera (orange), ou la lecture en cours / en panne. Monté seulement quand une
 * installation est choisie (une adresse extérieure ne se juge pas). Il dit à l'étape ce qui bloque
 * « Suivant » (`onEtat`).
 * @param {{
 *   actif?: boolean, date: any, debut: any, etat: any, fin: any,
 *   onEtat: (jugement: { attente: boolean, bloque: boolean }) => void,
 * }} props - Le tunnel, la séance en cours de saisie, le rappel vers l'étape.
 * @returns {import('react').ReactElement} Les lignes.
 */
function JugementDuCreneau({
  actif = true, date, debut, etat, fin, onEtat,
}) {
  const { t } = useTranslation();
  const { Fonts, Spaces } = useTheme();
  const jugement = useJugementDuCreneau(etat, {
    actif, date, debut, fin,
  });
  const attente = jugement.enLecture || jugement.enPanne;

  useEffect(() => {
    onEtat({ attente, bloque: jugement.bloque });
  }, [attente, jugement.bloque, onEtat]);

  return (
    <View style={[Spaces.gap[8]]} testID="date-jugement-du-creneau">
      {jugement.fermeture ? (
        <Text style={[Fonts.p3, Fonts.warning500]} testID="date-fermeture">
          {jugement.fermeture}
        </Text>
      ) : null}
      {jugement.mairie ? (
        <View style={[Spaces.gap[4]]} testID="date-mairie-decide">
          <Text style={[Fonts.p3, Fonts.warning500]}>{jugement.mairie}</Text>
          <Text style={[Fonts.p3Bold, Fonts.warning500]}>
            {t(
              'collectiviteDemandes.decision.siRefusAnnulee',
              'Si la mairie refuse, la séance sera annulée.',
            )}
          </Text>
        </View>
      ) : null}
      {jugement.creneau ? (
        <Text
          style={[Fonts.p3, jugement.creneau.dedans ? Fonts.primary200 : Fonts.warning500]}
          testID={jugement.creneau.dedans ? 'date-dans-le-creneau' : 'date-hors-creneau'}
        >
          {jugement.creneau.texte}
        </Text>
      ) : null}
      {jugement.prevention ? (
        <Text
          style={[Fonts.p3, jugement.prevention.pris ? Fonts.warning500 : Fonts.success500]}
          testID={jugement.prevention.pris ? 'date-creneau-pris' : 'date-creneau-libre'}
        >
          {jugement.prevention.texte}
        </Text>
      ) : null}
      {jugement.enLecture && !jugement.enPanne ? (
        <Text style={[Fonts.p3, Fonts.warning500]}>
          {t(
            'eventWizard.steps.location.checkingAvailability',
            'Vérification de la disponibilité…',
          )}
        </Text>
      ) : null}
      {jugement.enPanne ? (
        <View>
          <Text style={[Fonts.p3, Fonts.warning500]}>
            {t(
              'eventWizard.steps.location.availabilityFailed',
              'Impossible de vérifier la disponibilité. Réessayez avant de continuer.',
            )}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={jugement.relire}
            style={{ alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44 }}
          >
            <Text style={[Fonts.p3Bold, Fonts.primary500]}>
              {t('common.actions.retry', 'Réessayer')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

export default JugementDuCreneau;
