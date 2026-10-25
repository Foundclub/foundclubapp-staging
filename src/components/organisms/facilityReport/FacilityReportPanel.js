import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import {
  closureParamsFromReport,
  reportAuthorLabel,
  reportDayLabel,
  reportMomentLabel,
  reportStatusTone,
  reportStepCount,
  shouldProposeResolved,
} from '@/domains/facilityReport/facilityReportDisplay';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import SkeletonLoader from '@/components/atoms/skeletonLoader/SkeletonLoader';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Input from '@/components/molecules/input/Input';

import { RouteNames } from '@/navigation/routeNames';

import {
  useFacilityReport,
  useSetFacilityReportStatus,
} from '@/services/facilityReport/facilityReportQueries';

import { getErrorMessage } from '@/utils/errors/displayError';
import { getImageUrl } from '@/utils/imageUrl';

import { useIsDesktop } from '@/responsive';

/**
 * R17-SIGNALER-1 (19/10, REC17-011) — UN SIGNALEMENT : son contenu et ses gestes, en PAGE (le
 * telephone, l adresse /signalements/:id) ou en PANNEAU a droite de l onglet « Sécurité et suivi »
 * sur ordinateur (planche P10-securite-ordi B, validee par Adel le 19/10 ; meme colonne de 420 que
 * le panneau valide « Attribuer un créneau »).
 * - La VILLE (le serveur dit `meta.canManage`) : la photo, le texte, qui l a envoye (role et club ;
 *   le nom d un encadrant seulement, Q2 A), ou il en est, et ses gestes : Prendre en charge, Fermer
 *   l installation… (le formulaire COL-008 pre-rempli, Q4 A), Résolu… (un mot possible), Sans
 *   suite… (un mot exige). La fermeture liee finie, il propose « Résolu ».
 * - L AUTEUR : le sien, ou il en est, et le mot de la Ville.
 * Ou vont les gestes : sur ordinateur (panneau ou page), EN LIGNE sous le signalement (planche B) ;
 * au TELEPHONE, dans un PIED FIXE (planche tel 2) : « Prendre en charge », puis « Fermer
 * l installation… » et « + », qui deplie « Résolu… » et « Sans suite… ».
 * Le serveur est le seul juge : tout autre compte recoit « introuvable ».
 * @param {{ enPanneau?: boolean, onClose?: () => void, reportId: string | null }} props
 * @returns {import('react').ReactElement} Le signalement.
 */
function FacilityReportPanel({ enPanneau = false, onClose, reportId }) {
  const { t } = useTranslation();
  const { Colors, Fonts, Images } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const isDesktop = useIsDesktop();
  const fiche = useFacilityReport(reportId);
  const statut = useSetFacilityReportStatus();
  const [feuille, setFeuille] = useState(/** @type {null | 'resolu' | 'sans_suite'} */ (null));
  const [plus, setPlus] = useState(false);
  const [mot, setMot] = useState('');
  const [erreur, setErreur] = useState(/** @type {string | null} */ (null));
  // Planche B : sur ordinateur, « Catégorie » et « Envoyé par » en rangees ; au telephone, une
  // ligne (tel 2).
  const enRangees = enPanneau || isDesktop;
  // Planche tel 2 : au telephone, les gestes sont dans un pied FIXE, sous le defilement.
  const auPied = !enPanneau && !isDesktop;

  const entete = enPanneau ? (
    <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
      <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00, { flex: 1 }]}>
        {t('facilityReports.ville.titreFiche', 'Signalement')}
      </Text>
      {onClose ? (
        <TouchableOpacity
          accessibilityLabel={t('facilityReports.ville.fermerPanneau', 'Fermer le signalement')}
          accessibilityRole="button"
          onPress={onClose}
          style={{
            alignItems: 'center', height: 44, justifyContent: 'center', width: 44,
          }}
          testID="signalement-panneau-fermer"
        >
          <Image
            source={Images.close}
            style={{ height: 14, tintColor: Colors.neutral00, width: 14 }}
          />
        </TouchableOpacity>
      ) : null}
    </View>
  ) : null;

  if (fiche.isLoading) {
    return (
      <View
        accessibilityState={{ busy: true }}
        style={{ gap: 12, paddingTop: enPanneau ? 0 : 16 }}
        testID="signalement-chargement"
      >
        {entete}
        {/* Un bloc du squelette a un FOND : c est lui que le masque du chatoiement dessine. */}
        <SkeletonLoader isActive wrapperStyle={[{ gap: 12 }]}>
          <View style={{ backgroundColor: Colors.primary700, borderRadius: 16, height: 180 }} />
          <View
            style={{
              backgroundColor: Colors.primary700, borderRadius: 8, height: 22, width: '70%',
            }}
          />
          <View style={{ backgroundColor: Colors.primary700, borderRadius: 8, height: 64 }} />
        </SkeletonLoader>
      </View>
    );
  }
  const report = fiche.data?.data || null;
  if (fiche.isError || !report) {
    const introuvable = Number(/** @type {any} */ (fiche.error)?.response?.status) === 404;
    return (
      <View style={{ gap: 12, paddingTop: enPanneau ? 0 : 24 }} testID="signalement-erreur">
        {entete}
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
  const categorie = String(t(
    /** @type {string} */ (`facilityReports.categories.${report.category}`),
    report.category,
  ));
  const envoyePar = ville ? reportAuthorLabel(t, report) : report.facility?.name || '';

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

  const ouvrirLaFeuille = (/** @type {'resolu' | 'sans_suite'} */ sorte) => {
    setPlus(false);
    setFeuille(sorte);
  };

  const motRequis = feuille === 'sans_suite';
  const feuilleOuverte = feuille !== null;

  const rangee = (/** @type {string} */ libelle, /** @type {string} */ valeurDeLaRangee) => (
    <View
      style={{
        alignItems: 'center',
        flexDirection: 'row',
        gap: 12,
        minHeight: 44,
        paddingVertical: 8,
      }}
    >
      <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>{libelle}</Text>
      <Text style={[Fonts.p3, Fonts.neutral200, { flexShrink: 1, textAlign: 'right' }]}>
        {valeurDeLaRangee}
      </Text>
    </View>
  );

  const corps = (
    <>
      {report.photo?.url ? (
        <View style={{ gap: 4 }}>
          <Image
            accessibilityLabel={t('facilityReports.ville.photoAlt', 'Photo jointe par l’auteur')}
            resizeMode="cover"
            source={{ uri: getImageUrl(report.photo.url) }}
            style={{ borderRadius: 16, height: enPanneau ? 200 : 220, width: '100%' }}
            testID="signalement-photo"
          />
          {ville ? (
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t('facilityReports.ville.photoVue', 'Photo vue par la Ville et l’auteur seulement.')}
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
            {String(t(
              /** @type {string} */ (`facilityReports.${statuts}.${report.status}`),
              report.status,
            ))}
          </Text>
        </View>
        <Text style={[Fonts.p3, Fonts.neutral200]} testID="signalement-quand">
          {reportMomentLabel(report.createdAt)}
        </Text>
      </View>
      <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
        {report.title}
      </Text>
      <Text style={[Fonts.p2, Fonts.neutral100]}>{`« ${report.description} »`}</Text>
      {enRangees ? (
        <View
          style={{
            backgroundColor: withAlpha(Colors.primary500, 0.06),
            borderColor: withAlpha(Colors.primary500, 0.22),
            borderRadius: 16,
            borderWidth: 1,
            paddingHorizontal: 12,
          }}
          testID="signalement-rangees"
        >
          {rangee(t('facilityReports.ville.categorie', 'Catégorie'), categorie)}
          <View style={{ backgroundColor: withAlpha(Colors.neutral00, 0.08), height: 1 }} />
          {rangee(
            ville
              ? t('facilityReports.ville.envoyePar', 'Envoyé par')
              : t('facilityReports.membre.installation', 'Installation'),
            envoyePar,
          )}
        </View>
      ) : (
        <Text style={[Fonts.p3, Fonts.neutral200]} testID="signalement-qui">
          {`${categorie} · ${envoyePar}`}
        </Text>
      )}
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
            onPress={() => ouvrirLaFeuille('resolu')}
            size="sm"
            title={t('facilityReports.ville.feuilleResolu', 'Marquer résolu')}
            variant="Secondary"
          />
        </View>
      ) : null}
      {ville && !ouvert ? (
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t('facilityReports.ville.clos', 'Ce signalement est clos.')}
        </Text>
      ) : null}
    </>
  );

  // Planche B : les quatre gestes, en ligne, sous le signalement.
  const gestesEnLigne = ville && ouvert ? (
    <View style={{ gap: 8, marginTop: 8 }} testID="signalement-gestes">
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
          onPress={() => ouvrirLaFeuille('resolu')}
          style={{ flex: 1 }}
          title={t('facilityReports.ville.resoudre', 'Résolu…')}
          variant="Ghost"
        />
        <Button
          onPress={() => ouvrirLaFeuille('sans_suite')}
          style={{ flex: 1 }}
          title={t('facilityReports.ville.sansSuite', 'Sans suite…')}
          variant="Ghost"
        />
      </View>
    </View>
  ) : null;

  // Planche tel 2 : le pied FIXE. « + » deplie « Résolu… » et « Sans suite… » au-dessus du pied.
  const pied = auPied && ville && ouvert ? (
    <View
      style={{
        borderTopColor: withAlpha(Colors.neutral00, 0.08),
        borderTopWidth: 1,
        gap: 8,
        paddingBottom: 16,
        paddingTop: 16,
      }}
      testID="signalement-pied"
    >
      {plus ? (
        <View style={{ flexDirection: 'row', gap: 8 }} testID="signalement-plus-menu">
          <Button
            onPress={() => ouvrirLaFeuille('resolu')}
            style={{ flex: 1 }}
            title={t('facilityReports.ville.resoudre', 'Résolu…')}
            variant="Ghost"
          />
          <Button
            onPress={() => ouvrirLaFeuille('sans_suite')}
            style={{ flex: 1 }}
            title={t('facilityReports.ville.sansSuite', 'Sans suite…')}
            variant="Ghost"
          />
        </View>
      ) : null}
      {report.status === 'envoye' ? (
        <Button
          isLoading={statut.isPending && !feuilleOuverte}
          onPress={() => changer('pris_en_charge')}
          title={t('facilityReports.ville.prendre', 'Prendre en charge')}
          variant="Primary"
        />
      ) : null}
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
        <Button
          onPress={fermerLInstallation}
          size="sm"
          style={{ flex: 1 }}
          title={t('facilityReports.ville.fermer', 'Fermer l’installation…')}
          variant="Secondary"
        />
        <TouchableOpacity
          accessibilityLabel={t(
            'facilityReports.ville.plusDActions',
            'Plus d’actions : résolu, sans suite',
          )}
          accessibilityRole="button"
          accessibilityState={{ expanded: plus }}
          onPress={() => setPlus((avant) => !avant)}
          style={{
            alignItems: 'center',
            borderColor: withAlpha(Colors.neutral00, 0.16),
            borderRadius: 12,
            borderWidth: 1,
            height: 44,
            justifyContent: 'center',
            width: 44,
          }}
          testID="signalement-plus"
        >
          <Image
            source={Images.plus}
            style={{ height: 16, tintColor: Colors.neutral200, width: 16 }}
          />
        </TouchableOpacity>
      </View>
    </View>
  ) : null;

  const feuilleDuMot = (
    <BottomModal
      close={() => setFeuille(null)}
      footerComponent={(
        <View
          style={{
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
        {/* C05 (Q2-20) : l alerte globale est coupee ; le refus se lit dans la feuille ouverte. */}
        {erreur ? (
          <Text style={[Fonts.p3Bold, Fonts.error500]} testID="signalement-feuille-refus">
            {erreur}
          </Text>
        ) : null}
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t(
            'facilityReports.ville.previentAuteur',
            'L’auteur est prévenu. Le signalement passe dans l’historique.',
          )}
        </Text>
      </View>
    </BottomModal>
  );

  if (enPanneau) {
    return (
      <View style={{ gap: 12 }} testID="signalement-panneau">
        {entete}
        {corps}
        {gestesEnLigne}
        {feuilleDuMot}
      </View>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ gap: 12, paddingBottom: 24, paddingTop: 16 }}
        style={{ flex: 1 }}
        testID="signalement-fiche"
      >
        {corps}
        {auPied ? null : gestesEnLigne}
      </ScrollView>
      {pied}
      {feuilleDuMot}
    </View>
  );
}

export default FacilityReportPanel;
