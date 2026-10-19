import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Image, Text, TouchableOpacity } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import { RouteNames } from '@/navigation/routeNames';

/**
 * R17-SIGNALER-1 (19/10, REC17-011) — « Signaler un problème ici », sous le lieu de la fiche d une
 * seance (planche P10-signaler-tel, ecran 1 b ; P11-securite-ou-ca-vit 5). Le SERVEUR dit si la
 * seance s en sert : `event.facilityReportable` n existe que sur une installation de la Ville, pour
 * un compte qui peut la signaler (Q1 A). Sinon, rien ne s affiche.
 * @param {{ event: any }} props
 * @returns {import('react').ReactElement | null} La rangee, ou rien.
 */
function FacilityReportEntry({ event }) {
  const { t } = useTranslation();
  const { Colors, Fonts, Images } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  if (!event?.facilityReportable || !event?.facility?.documentId) return null;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={() => navigation.navigate(RouteNames.FacilityReportNew, {
        eventId: event.documentId,
        facilityId: event.facility.documentId,
        ...(event.facility.name ? { facilityName: event.facility.name } : {}),
      })}
      style={{
        alignItems: 'center',
        backgroundColor: withAlpha(Colors.neutral00, 0.04),
        borderColor: withAlpha(Colors.neutral00, 0.12),
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 10,
        minHeight: 48,
        paddingHorizontal: 12,
      }}
      testID="event-signaler-probleme"
    >
      <Image source={Images.flag} style={{ height: 18, tintColor: Colors.primary500, width: 18 }} />
      <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>
        {t('facilityReports.membre.entreeSeance', 'Signaler un problème ici')}
      </Text>
      <Image
        source={Images.arrowRight}
        style={{ height: 12, tintColor: Colors.neutral200, width: 12 }}
      />
    </TouchableOpacity>
  );
}

export default FacilityReportEntry;
