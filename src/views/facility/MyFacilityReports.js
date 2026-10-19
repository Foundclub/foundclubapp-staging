import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import {
  reportDayLabel,
  reportStatusTone,
  reportStepCount,
} from '@/domains/facilityReport/facilityReportDisplay';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import EmptyState from '@/components/atoms/emptyState/EmptyState';
import Loader from '@/components/atoms/loader/Loader';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useMyFacilityReports } from '@/services/facilityReport/facilityReportQueries';

/**
 * R17-SIGNALER-1 (19/10, REC17-011) — « MES SIGNALEMENTS », depuis « Mon compte » et la
 * notification « La Ville a pris en charge ton signalement » (planche P10-signaler-tel, ecran 5) :
 * chaque signalement, ses trois etapes, et le mot de la Ville quand elle a repondu (Q3 A).
 * Le membre est tutoye.
 * @returns {import('react').ReactElement} L ecran.
 */
function MyFacilityReports() {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const mes = useMyFacilityReports();

  let corps;
  if (mes.isLoading) corps = <Loader testID="mes-signalements-chargement" />;
  else if (mes.isError) {
    corps = (
      <View style={{ gap: 12 }} testID="mes-signalements-erreur">
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
          {t(
            'facilityReports.membre.erreurChargement',
            'Tes signalements n’ont pas pu être chargés.',
          )}
        </Text>
        <Button
          onPress={() => mes.refetch?.()}
          size="sm"
          title={t('facilityReports.ville.reessayer', 'Réessayer')}
          variant="Secondary"
        />
      </View>
    );
  } else {
    const liste = Array.isArray(mes.data?.data) ? mes.data.data : [];
    corps = liste.length === 0 ? (
      <EmptyState title={t('facilityReports.membre.mesVide', 'Tu n’as encore rien signalé.')} />
    ) : (
      liste.map((report) => {
        const ton = reportStatusTone(report.status);
        const couleur = {
          neutral: Colors.neutral300,
          primary: Colors.primary500,
          success: Colors.success500,
          warning: Colors.warning500,
        }[ton];
        const etapes = reportStepCount(report.status);
        return (
          <TouchableOpacity
            accessibilityRole="button"
            key={report.documentId}
            onPress={() => navigation.navigate(RouteNames.FacilityReportDetails, {
              reportId: report.documentId,
            })}
            style={{
              backgroundColor: withAlpha(Colors.neutral00, 0.04),
              borderColor: withAlpha(Colors.neutral00, 0.1),
              borderRadius: 16,
              borderWidth: 1,
              gap: 6,
              minHeight: 44,
              padding: 14,
            }}
            testID={`mes-signalements-${report.documentId}`}
          >
            <View
              style={{
                alignItems: 'center',
                flexDirection: 'row',
                gap: 8,
                justifyContent: 'space-between',
              }}
            >
              <Text numberOfLines={2} style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>
                {report.title}
              </Text>
              <View
                style={{
                  backgroundColor: withAlpha(couleur, 0.16),
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 2,
                }}
              >
                <Text style={[Fonts.p3Bold, { color: couleur }]}>
                  {t(`facilityReports.statutsAuteur.${report.status}`, report.status)}
                </Text>
              </View>
            </View>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t('facilityReports.membre.mesLigne', {
                date: reportDayLabel(report.createdAt),
                facility: report.facility?.name || '',
              })}
            </Text>
            {report.status === 'sans_suite' ? null : (
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{ flexDirection: 'row', gap: 6 }}
              >
                {[1, 2, 3].map((rang) => (
                  <View
                    key={rang}
                    style={{
                      backgroundColor:
                          rang <= etapes ? couleur : withAlpha(Colors.neutral00, 0.14),
                      borderRadius: 3,
                      flex: 1,
                      height: 6,
                    }}
                  />
                ))}
              </View>
            )}
            {report.cityNote ? (
              <Text style={[Fonts.p3, Fonts.neutral100]}>
                {t('facilityReports.membre.motDeLaVille', {
                  note: report.cityNote,
                  ville:
                      report.collectivite?.name || t('facilityReports.membre.laVille', 'La Ville'),
                })}
              </Text>
            ) : null}
          </TouchableOpacity>
        );
      })
    );
  }

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="screen">
      <ScrollView
        contentContainerStyle={{ gap: 12, paddingBottom: 24, paddingTop: 16 }}
        testID="mes-signalements"
      >
        <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00]}>
          {t('facilityReports.membre.mesTitre', 'Mes signalements')}
        </Text>
        {corps}
      </ScrollView>
    </ScreenContainer>
  );
}

export default MyFacilityReports;
