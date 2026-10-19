import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import {
  reportAuthorLabel,
  reportDayLabel,
  reportStatusTone,
  securityHistory,
  splitReports,
} from '@/domains/facilityReport/facilityReportDisplay';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import EmptyState from '@/components/atoms/emptyState/EmptyState';
import Loader from '@/components/atoms/loader/Loader';

import { RouteNames } from '@/navigation/routeNames';

import { useFacilityReports } from '@/services/facilityReport/facilityReportQueries';

/**
 * R17-SIGNALER-1 (19/10, REC17-011) — le 5ᵉ ONGLET de la fiche d une installation, cote Ville :
 * « Sécurité et suivi » (planches P10-securite-ordi A, D, E, F et P10-securite-tel 1, validees par
 * Adel le 19/10). En tete l ETAT, deduit par le serveur (Q5 A) ; puis les signalements OUVERTS, la
 * securite d abord ; puis l HISTORIQUE (signalements traites, fermetures). Le carnet des controles
 * (Q6 B) est le lot R17-CONTROLES : il n est pas ici.
 * La Ville est vouvoyee. Aucun nom de membre : le serveur ne rend que celui d un encadrant (Q2 A).
 * @param {{ facilityId: string | null, onOpenClosures?: () => void }} props
 * @returns {import('react').ReactElement} L onglet.
 */
function FacilitySecurityTab({ facilityId, onOpenClosures }) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const suivi = useFacilityReports(facilityId);

  if (suivi.isLoading) return <Loader />;
  if (suivi.isError || !suivi.data) {
    return (
      <View style={{ gap: 12, padding: 16 }} testID="securite-erreur">
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
          {t('facilityReports.ville.erreur', 'Le suivi n’a pas pu être chargé.')}
        </Text>
        <Button
          onPress={() => suivi.refetch?.()}
          size="sm"
          title={t('facilityReports.ville.reessayer', 'Réessayer')}
          variant="Secondary"
        />
      </View>
    );
  }

  const reports = Array.isArray(suivi.data?.data) ? suivi.data.data : [];
  const meta = suivi.data?.meta || {};
  const state = meta.state || { code: 'en_service' };
  const { ouverts, traites } = splitReports(reports);
  const jalons = securityHistory(traites, meta.closures);

  const tons = {
    a_surveiller: Colors.warning500,
    en_service: Colors.success500,
    fermee: Colors.error500,
  };
  const { code } = /** @type {{ code: 'a_surveiller' | 'en_service' | 'fermee' }} */ (state);
  const couleurEtat = tons[code] || Colors.success500;
  const motif = state.closure?.reason
    ? t(`collectiviteFermetures.motifs.${state.closure.reason}`, state.closure.reason)
    : null;
  let phraseEtat = t(
    'facilityReports.ville.etatEnService',
    'Aucun signalement ouvert, aucune fermeture en cours.',
  );
  if (state.code === 'a_surveiller') {
    phraseEtat = t('facilityReports.ville.etatASurveiller', {
      ...SANS_ECHAPPEMENT,
      count: state.securityOpenCount || 1,
      date: reportDayLabel(state.securitySince),
    });
  }
  if (state.code === 'fermee' && state.closure) {
    const jours = {
      debut: reportDayLabel(state.closure.startDate),
      fin: reportDayLabel(state.closure.endDate),
    };
    phraseEtat = motif
      ? t('facilityReports.ville.etatFermeeMotif', { ...SANS_ECHAPPEMENT, ...jours, motif })
      : t('facilityReports.ville.etatFermee', jours);
  }

  const pastille = (/** @type {string} */ status) => {
    const ton = reportStatusTone(status);
    const couleur = {
      neutral: Colors.neutral300,
      primary: Colors.primary500,
      success: Colors.success500,
      warning: Colors.warning500,
    }[ton];
    return (
      <View
        style={{
          alignSelf: 'flex-start',
          backgroundColor: withAlpha(couleur, 0.16),
          borderRadius: 999,
          paddingHorizontal: 10,
          paddingVertical: 2,
        }}
      >
        <Text style={[Fonts.p3Bold, { color: couleur }]}>
          {t(`facilityReports.statuts.${status}`, status)}
        </Text>
      </View>
    );
  };

  return (
    <View style={{ gap: 16 }} testID="onglet-securite">
      <View
        accessibilityRole="summary"
        style={{
          backgroundColor: withAlpha(couleurEtat, 0.1),
          borderColor: withAlpha(couleurEtat, 0.45),
          borderRadius: 16,
          borderWidth: 1,
          gap: 4,
          padding: 14,
        }}
        testID={`securite-etat-${state.code}`}
      >
        <Text style={[Fonts.h5Bold, { color: couleurEtat }]}>
          {t(/** @type {string} */ (`facilityReports.ville.etat.${state.code}`), state.code)}
        </Text>
        <Text style={[Fonts.p3, Fonts.neutral100]}>{phraseEtat}</Text>
        {state.code === 'fermee' && onOpenClosures ? (
          <Button
            onPress={onOpenClosures}
            size="sm"
            title={t('facilityReports.ville.voirFermetures', 'Fermetures')}
            variant="Secondary"
          />
        ) : null}
      </View>

      {reports.length === 0 ? (
        <EmptyState
          description={t(
            'facilityReports.ville.videTexte',
            'Les membres des clubs qui utilisent l’installation peuvent signaler un problème '
              + 'depuis son planning ou depuis une séance. '
              + 'Vous êtes prévenus à chaque signalement.',
          )}
          title={t('facilityReports.ville.videTitre', 'Aucun signalement')}
        />
      ) : null}

      {ouverts.length ? (
        <View style={{ gap: 10 }}>
          <View style={{ gap: 2 }}>
            <Text accessibilityRole="header" style={[Fonts.h5Bold, Fonts.neutral00]}>
              {t('facilityReports.ville.ouverts', { ...SANS_ECHAPPEMENT, count: ouverts.length })}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t(
                'facilityReports.ville.ouvertsSous',
                'Reçus des membres des clubs qui utilisent l’installation',
              )}
            </Text>
          </View>
          {ouverts.map((report) => (
            <TouchableOpacity
              accessibilityLabel={t('facilityReports.ville.ouvrirFiche', {
                ...SANS_ECHAPPEMENT,
                title: report.title,
              })}
              accessibilityRole="button"
              key={report.documentId}
              onPress={() => navigation.navigate(RouteNames.FacilityReportDetails, {
                espace: 'ville',
                reportId: report.documentId,
              })}
              style={{
                backgroundColor: withAlpha(Colors.neutral00, 0.04),
                borderColor:
                  report.status === 'envoye'
                    ? withAlpha(Colors.warning500, 0.5)
                    : withAlpha(Colors.neutral00, 0.1),
                borderRadius: 14,
                borderWidth: 1,
                gap: 4,
                minHeight: 44,
                padding: 12,
              }}
              testID={`securite-signalement-${report.documentId}`}
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
                {pastille(report.status)}
              </View>
              <Text numberOfLines={2} style={[Fonts.p3, Fonts.neutral100]}>
                {`${t(
                  `facilityReports.categoriesCourtes.${report.category}`,
                  report.category,
                )} · « ${report.description} »`}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {`${reportDayLabel(report.createdAt)} · ${reportAuthorLabel(t, report)}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {jalons.length ? (
        <View style={{ gap: 10 }} testID="securite-historique">
          <Text accessibilityRole="header" style={[Fonts.h5Bold, Fonts.neutral00]}>
            {t('facilityReports.ville.historique', 'Historique')}
          </Text>
          {jalons.map(({ item, kind }) => {
            const signalement = kind === 'report';
            let couleur = Colors.warning500;
            if (signalement) {
              couleur = item.status === 'resolu' ? Colors.success500 : Colors.neutral300;
            }
            let titre = t('facilityReports.ville.histoFermeture', {
              ...SANS_ECHAPPEMENT,
              debut: reportDayLabel(item.startDate),
              fin: reportDayLabel(item.endDate),
            });
            let detail = item.status === 'reopened'
              ? t('facilityReports.ville.histoRouverte', 'Fermeture · rouverte')
              : t('facilityReports.ville.histoFermetureMotif', {
                ...SANS_ECHAPPEMENT,
                motif: item.reason
                  ? t(`collectiviteFermetures.motifs.${item.reason}`, item.reason)
                  : item.label || '',
              });
            if (signalement) {
              titre = item.status === 'resolu'
                ? t('facilityReports.ville.histoResolu', { ...SANS_ECHAPPEMENT, title: item.title })
                : t('facilityReports.ville.histoSansSuite', {
                  ...SANS_ECHAPPEMENT,
                  title: item.title,
                });
              const dates = {
                debut: reportDayLabel(item.createdAt),
                fin: reportDayLabel(item.closedAt),
              };
              detail = item.cityNote
                ? t('facilityReports.ville.histoDatesMot', {
                  ...SANS_ECHAPPEMENT,
                  ...dates,
                  note: item.cityNote,
                })
                : t('facilityReports.ville.histoDates', dates);
            }
            return (
              <TouchableOpacity
                accessibilityRole={signalement ? 'button' : 'text'}
                disabled={!signalement}
                key={`${kind}-${item.documentId}`}
                onPress={() => navigation.navigate(RouteNames.FacilityReportDetails, {
                  espace: 'ville',
                  reportId: item.documentId,
                })}
                style={{ flexDirection: 'row', gap: 10, minHeight: 44 }}
                testID={`securite-jalon-${kind}-${item.documentId}`}
              >
                <View
                  style={{
                    backgroundColor: couleur,
                    borderRadius: 5,
                    height: 10,
                    marginTop: 6,
                    width: 10,
                  }}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{titre}</Text>
                  <Text style={[Fonts.p3, Fonts.neutral200]}>{detail}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export default FacilitySecurityTab;
