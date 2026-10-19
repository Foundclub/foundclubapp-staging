import { useRoute } from '@react-navigation/native';
import { Platform, View } from 'react-native';

import FacilityReportPanel from '@/components/organisms/facilityReport/FacilityReportPanel';
import ScreenContainer from '@/components/templates/ScreenContainer';

import useBottomDockLayout from '@/navigation/useBottomDockLayout';

import { useIsDesktop } from '@/responsive';

/**
 * R17-SIGNALER-1 (19/10, REC17-011) — UN SIGNALEMENT, en page (planches P10-securite-tel 2 et 3,
 * P11-q4-exemple-tel 2, validees par Adel le 19/10) : au telephone, et a l adresse
 * /signalements/:id. Sur ordinateur, l onglet « Sécurité et suivi » l ouvre en PANNEAU a droite
 * (P10-securite-ordi B) : le contenu et les gestes sont ceux de FacilityReportPanel.
 * Au telephone, les gestes sont dans un PIED FIXE (tel 2) : l ecran prend toute la hauteur
 * (`boundedHeight` sur le site, sans effet sur l iPhone) pour que le pied reste en bas ; sur le
 * SITE mobile, la barre d onglets flotte au-dessus du bas de l ecran : le pied garde sa place
 * au-dessus d elle (`dockClearance`, piege R17INVIT du 19/10, comme CollectiviteInviteClub).
 * @returns {import('react').ReactElement} L ecran.
 */
function FacilityReportDetails() {
  const params = /** @type {any} */ (useRoute().params) || {};
  const isDesktop = useIsDesktop();
  const { dockClearance } = useBottomDockLayout();
  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      boundedHeight
      contentContainerStyle={[{ flex: 1 }]}
      keyboardAvoiding
    >
      <View
        style={{
          flex: 1,
          paddingBottom: Platform.OS === 'web' && !isDesktop ? dockClearance : 0,
        }}
      >
        <FacilityReportPanel reportId={params.reportId || null} />
      </View>
    </ScreenContainer>
  );
}

export default FacilityReportDetails;
