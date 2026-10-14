import { useRoute } from '@react-navigation/native';

import useTheme from '@/theme/themeContext';

import ScreenContainer from '@/components/templates/ScreenContainer';
import FicheReservation from '@/views/complexe/components/FicheReservation';

/**
 * E-G05 — LA FICHE D'UNE RÉSERVATION, sur téléphone — RESA-L5A2 (14/10/2026), planche EG05 : la
 * fiche (`FicheReservation`) en écran entier. Entrées : une carte de E-G04, de E-G06, la frise et
 * « Prochaines réservations » de E-G02, le planning (E-G03), une notification
 * `complexeReservationGerant` (« nouvelle », « annulée »).
 * Paramètres de route : `complexeId`, `reservationId`. Caché par `COMPLEXES_GERANT`.
 * @returns {import('react').ReactElement} L'écran.
 */
function ComplexeReservation() {
  const { Alignments, Spaces } = useTheme();
  const route = useRoute();
  const params = /** @type {{ complexeId?: string, reservationId?: string } | undefined} */ (
    route?.params
  );
  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[12], Spaces.paddingBottom[16], Alignments.fill]}
    >
      <FicheReservation
        complexeId={params?.complexeId || null}
        reservationId={String(params?.reservationId || '')}
      />
    </ScreenContainer>
  );
}

export default ComplexeReservation;
