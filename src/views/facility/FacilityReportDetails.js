import { useRoute } from '@react-navigation/native';

import FacilityReportPanel from '@/components/organisms/facilityReport/FacilityReportPanel';
import ScreenContainer from '@/components/templates/ScreenContainer';

/**
 * R17-SIGNALER-1 (19/10, REC17-011) — UN SIGNALEMENT, en page (planches P10-securite-tel 2 et 3,
 * P11-q4-exemple-tel 2, validees par Adel le 19/10) : au telephone, et a l adresse
 * /signalements/:id. Sur ordinateur, l onglet « Sécurité et suivi » l ouvre en PANNEAU a droite
 * (P10-securite-ordi B) : le contenu et les gestes sont ceux de FacilityReportPanel.
 * @returns {import('react').ReactElement} L ecran.
 */
function FacilityReportDetails() {
  const params = /** @type {any} */ (useRoute().params) || {};
  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="screen" keyboardAvoiding>
      <FacilityReportPanel reportId={params.reportId || null} />
    </ScreenContainer>
  );
}

export default FacilityReportDetails;
