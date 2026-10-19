import { useNavigation, useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, ScrollView, Text, View,
} from 'react-native';

import {
  closureParamsFromReport,
  reportAuthorLabel,
  reportDayLabel,
  reportStatusTone,
  reportStepCount,
  shouldProposeResolved,
} from '@/domains/facilityReport/facilityReportDisplay';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Input from '@/components/molecules/input/Input';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  useFacilityReport,
  useSetFacilityReportStatus,
} from '@/services/facilityReport/facilityReportQueries';

import { getErrorMessage } from '@/utils/errors/displayError';
import { getImageUrl } from '@/utils/imageUrl';

/**
 * R17-SIGNALER-1 (19/10, REC17-011) — UN SIGNALEMENT, en plein ecran (planches P10-securite-tel 2
 * et 3,
 * P10-securite-ordi B, P11-q4-exemple-tel 2, validees par Adel le 19/10).
 * - La VILLE (le serveur dit `meta.canManage`) : la photo, le texte, qui l a envoye (role et club ;
 * le
 *   nom d un encadrant seulement, Q2 A), ou il en est, et ses gestes : Prendre en charge · Fermer
 * l installation… (le formulaire COL-008 pre-rempli, Q4 A) · Résolu… (un mot possible) · Sans
 * suite…
 *   (un mot exige). La fermeture liee finie, l ecran propose « Résolu ».
 * - L AUTEUR : le sien, ou il en est, et le mot de la Ville.
 * Le serveur est le seul juge : tout autre compte recoit « introuvable ».
 * @returns {import('react').ReactElement} L ecran.
 */
function FacilityReportDetails() {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const params = /** @type {any} */ (useRoute().params) || {};
  const reportId = params.reportId || null;
  const fiche = useFacilityReport(reportId);
  const statut = useSetFacilityReportStatus();
  const [feuille, setFeuille] = useState(/** @type {null | 'resolu' | 'sans_suite'} */ (null));
  const [mot, setMot] = useState('');
  const [erreur, setErreur] = useState(/** @type {string | null} */ (null));

  if (fiche.isLoading) {
    return (
      <ScreenContainer bgImage="bg2" bottomInsetMode="screen">
        <Loader />
      </ScreenContainer>
    );
  }
  const report = fiche.data?.data || null;
  if (fiche.isError || !report) {
    const introuvable = Number(/** @type {any} */ (fiche.error)?.response?.status) === 404;
    return (
      <ScreenContainer bgImage="bg2" bottomInsetMode="screen">
        <View style={{ gap: 12, paddingTop: 24 }} testID="signalement-erreur">
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {introuvable
              ? t('APIerrors.FACILITY_REPORT_NOT_FOUND', 'Ce signalement est introuvable.')
              : t('facilityReports.ville.erreur', 'Le suivi n’a pas pu être chargé.')}
          </Text>
          {introuvable ? null : (
            <Button
              onPress={() => fiche.refetch?.()}
              size="sm"
              title={t('facilityReports.ville.reessayer', 'Réessayer')}
              variant="Secondary"
            />
          )}
        </View>
      </ScreenContainer>
    );
  }

  const meta = fiche.data?.meta || {};
  const ville = meta.canManage === true;
  const ouvert = report.status === 'envoye' || report.status === 'pris_en_charge';
  const today = meta.closurePrefill?.startDate || '';
  const ton = reportStatusTone(report.status);
  const couleur = {
    neutral: Colors.neutral300,
    primary: Colors.primary500,
    success: Colors.success500,
    warning: Colors.warning500,
  }[ton];
  const etapes = reportStepCount(report.status);
  const statuts = ville ? 'statuts' : 'statutsAuteur';
  const nomDeLaVille = report.collectivite?.name || t('facilityReports.membre.laVille', 'La Ville');

  const changer = async (
    /** @type {string} */ status,
    /** @type {string | null} */ note = null,
  ) => {
    setErreur(null);
    try {
      await statut.mutateAsync({ reportId: report.documentId, status, ...(note ? { note } : {}) });
      setFeuille(null);
      setMot('');
    } catch (refus) {
      setErreur(getErrorMessage(/** @type {any} */ (refus)));
    }
  };
  const fermerLInstallation = () => {
    navigation.navigate(
      RouteNames.CollectiviteFermeture,
      closureParamsFromReport(report, meta.closurePrefill, report.collectivite?.documentId || null),
    );
  };

  const motRequis = feuille === 'sans_suite';
  const feuilleOuverte = feuille !== null;

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="screen" keyboardAvoiding>
      <ScrollView
        contentContainerStyle={{ gap: 12, paddingBottom: 24, paddingTop: 16 }}
        testID="signalement-fiche"
      >
        {report.photo?.url ? (
          <View style={{ gap: 4 }}>
            <Image
              accessibilityLabel={t('facilityReports.ville.photoAlt', 'Photo jointe par l’auteur')}
              resizeMode="cover"
              source={{ uri: getImageUrl(report.photo.url) }}
              style={{ borderRadius: 16, height: 220, width: '100%' }}
              testID="signalement-photo"
            />
            {ville ? (
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {t(
                  'facilityReports.ville.photoVue',
                  'Photo vue par la Ville et l’auteur seulement.',
                )}
              </Text>
            ) : null}
          </View>
        ) : null}
        <View
          style={{
            alignItems: 'center',
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'space-between',
          }}
        >
          <View
            style={{
              backgroundColor: withAlpha(couleur, 0.16),
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 2,
            }}
          >
            <Text style={[Fonts.p3Bold, { color: couleur }]} testID="signalement-statut">
              {t(
                /** @type {string} */ (`facilityReports.${statuts}.${report.status}`),
                report.status,
              )}
            </Text>
          </View>
          <Text style={[Fonts.p3, Fonts.neutral200]}>{reportDayLabel(report.createdAt)}</Text>
        </View>
        <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
          {report.title}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral100]}>{`« ${report.description} »`}</Text>
        <Text style={[Fonts.p3, Fonts.neutral200]} testID="signalement-qui">
          {ville
            ? `${t(
              `facilityReports.categories.${report.category}`,
              report.category,
            )} · ${reportAuthorLabel(t, report)}`
            : `${t(`facilityReports.categories.${report.category}`, report.category)} · ${
              report.facility?.name || ''
            }`}
        </Text>
        <View style={{ gap: 6 }}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ flexDirection: 'row', gap: 6 }}
          >
            {[1, 2, 3].map((rang) => (
              <View
                key={rang}
                style={{
                  backgroundColor: rang <= etapes ? couleur : withAlpha(Colors.neutral00, 0.14),
                  borderRadius: 3,
                  flex: 1,
                  height: 6,
                }}
              />
            ))}
          </View>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t('facilityReports.etapes', 'Envoyé · Pris en charge · Résolu')}
          </Text>
        </View>
        {report.closure?.startDate ? (
          <Text style={[Fonts.p3Bold, Fonts.neutral100]} testID="signalement-fermeture-liee">
            {t('facilityReports.ville.liee', {
              ...SANS_ECHAPPEMENT,
              debut: reportDayLabel(report.closure.startDate),
              fin: reportDayLabel(report.closure.endDate),
            })}
          </Text>
        ) : null}
        {report.cityNote ? (
          <Text style={[Fonts.p2, Fonts.neutral00]} testID="signalement-mot">
            {t('facilityReports.membre.motDeLaVille', {
              ...SANS_ECHAPPEMENT,
              note: report.cityNote,
              ville: nomDeLaVille,
            })}
          </Text>
        ) : null}
        {erreur ? (
          <Text style={[Fonts.p3Bold, Fonts.error500]} testID="signalement-refus">
            {erreur}
          </Text>
        ) : null}

        {ville && ouvert && shouldProposeResolved(report, today) ? (
          <View
            style={{
              backgroundColor: withAlpha(Colors.success500, 0.1),
              borderRadius: 14,
              gap: 8,
              padding: 12,
            }}
            testID="signalement-proposer-resolu"
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {t(
                'facilityReports.ville.proposerResolu',
                'La fermeture liée est finie : ce signalement est-il résolu ?',
              )}
            </Text>
            <Button
              onPress={() => setFeuille('resolu')}
              size="sm"
              title={t('facilityReports.ville.feuilleResolu', 'Marquer résolu')}
              variant="Secondary"
            />
          </View>
        ) : null}

        {ville && ouvert ? (
          <View style={{ gap: 8, marginTop: 8 }}>
            {report.status === 'envoye' ? (
              <Button
                isLoading={statut.isPending && !feuilleOuverte}
                onPress={() => changer('pris_en_charge')}
                title={t('facilityReports.ville.prendre', 'Prendre en charge')}
                variant="Primary"
              />
            ) : null}
            <Button
              onPress={fermerLInstallation}
              title={t('facilityReports.ville.fermer', 'Fermer l’installation…')}
              variant="Secondary"
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                onPress={() => setFeuille('resolu')}
                style={{ flex: 1 }}
                title={t('facilityReports.ville.resoudre', 'Résolu…')}
                variant="Ghost"
              />
              <Button
                onPress={() => setFeuille('sans_suite')}
                style={{ flex: 1 }}
                title={t('facilityReports.ville.sansSuite', 'Sans suite…')}
                variant="Ghost"
              />
            </View>
          </View>
        ) : null}
        {ville && !ouvert ? (
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t('facilityReports.ville.clos', 'Ce signalement est clos.')}
          </Text>
        ) : null}
      </ScrollView>

      <BottomModal
        close={() => setFeuille(null)}
        footerComponent={(
          <View style={{
            flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12,
          }}
          >
            <Button
              onPress={() => setFeuille(null)}
              style={{ flex: 1 }}
              title={t('facilityReports.ville.annuler', 'Annuler')}
              variant="Ghost"
            />
            <Button
              disabled={motRequis && !mot.trim()}
              isLoading={statut.isPending}
              onPress={() => changer(feuille || 'resolu', mot.trim() || null)}
              style={{ flex: 1 }}
              title={
                motRequis
                  ? t('facilityReports.ville.feuilleSansSuite', 'Classer sans suite')
                  : t('facilityReports.ville.feuilleResolu', 'Marquer résolu')
              }
              variant="Primary"
            />
          </View>
        )}
        isVisible={feuilleOuverte}
      >
        <View style={{ gap: 10, padding: 16 }} testID="signalement-feuille">
          <Text accessibilityRole="header" style={[Fonts.h5Bold, Fonts.neutral00]}>
            {motRequis
              ? t('facilityReports.ville.feuilleSansSuite', 'Classer sans suite')
              : t('facilityReports.ville.feuilleResolu', 'Marquer résolu')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral100]}>{report.title}</Text>
          <Input
            label={
              motRequis
                ? t('facilityReports.ville.motObligatoire', 'Un mot pour l’auteur (obligatoire)')
                : t('facilityReports.ville.motPourAuteur', 'Un mot pour l’auteur')
            }
            maxLength={500}
            multiline
            onChangeText={setMot}
            placeholder={t(
              'facilityReports.ville.motPlaceholder',
              'Ce qui a été fait, ou pourquoi rien ne sera fait.',
            )}
            testID="signalement-feuille-mot"
            value={mot}
          />
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t(
              'facilityReports.ville.previentAuteur',
              'L’auteur est prévenu. Le signalement passe dans l’historique.',
            )}
          </Text>
        </View>
      </BottomModal>
    </ScreenContainer>
  );
}

export default FacilityReportDetails;
