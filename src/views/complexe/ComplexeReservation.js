import { useNavigation, useRoute } from '@react-navigation/native';

import useTheme from '@/theme/themeContext';

import ScreenContainer from '@/components/templates/ScreenContainer';
import FicheReservation from '@/views/complexe/components/FicheReservation';

import { RouteNames } from '@/navigation/routeNames';

/**
 * E-G05 — LA FICHE D'UNE RÉSERVATION, sur téléphone — RESA-L5A2 (14/10/2026), planche EG05 : la
 * fiche (`FicheReservation`) en écran entier. Entrées : une carte de E-G04, de E-G06, la frise et
 * « Prochaines réservations » de E-G02, le planning (E-G03), une notification
 * `complexeReservationGerant` (« nouvelle », « annulée »). « Voir dans le planning » ouvre l'onglet
 * Planning (E-G03) de l'espace, au jour et au terrain de la réservation. RESA-L5B-1 : le nom du
 * réserveur ouvre sa fiche client (E-G15).
 * Paramètres de route : `complexeId`, `reservationId`. Caché par `COMPLEXES_GERANT`.
 * @returns {import('react').ReactElement} L'écran.
 */
function ComplexeReservation() {
  const { Alignments, Spaces } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
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
        onVoirClient={(joueurId) => navigation.navigate(RouteNames.ComplexeClient, {
          complexeId: params?.complexeId, joueurId,
        })}
        onVoirPlanning={(fiche) => navigation.navigate(RouteNames.ComplexeEspace, {
          params: {
            complexeId: params?.complexeId, date: fiche.date, terrainId: fiche.terrain?.documentId,
          },
          screen: RouteNames.ComplexePlanning,
        })}
        reservationId={String(params?.reservationId || '')}
      />
    </ScreenContainer>
  );
}

export default ComplexeReservation;
