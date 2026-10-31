import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, Linking, Text, TouchableOpacity, View,
} from 'react-native';

import {
  checkLongDate,
  pickerFromIso,
  seriesRows,
} from '@/domains/facilityCheck/facilityCheckDisplay';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import SkeletonLoader from '@/components/atoms/skeletonLoader/SkeletonLoader';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { FenetrePleinEcran } from '@/components/organisms/seasonSlot/SeasonSlotForm';

import { useFacilityChecks, useRemoveFacilityCheck } from '@/services/facilityCheck/facilityCheckQueries';

import { getImageUrl } from '@/utils/imageUrl';

/**
 * R17-CONTROLES (20/10, REC17-011 lot 2, decision d Adel Q6 B) — UN CONTROLE du carnet (planche
 * validee P11-q6-exemple-tel ecran 4) : « À refaire avant le 12 mars 2027 » (ou « En retard
 * depuis… »), « Dernier : 12/03/2026, Société [X]. », « Noter le contrôle fait », et
 * l historique de la serie (« 12/03/2026 » / « Société [X] · rapport joint »). Sur ordinateur, en
 * PANNEAU a droite de l onglet (comme un signalement) ; au telephone, dans la FENETRE plein ecran
 * du gabarit des tunnels (COLL-R-A7), le geste en bas. Le carnet se lit par la meme cle que
 * l onglet : aucune lecture de plus.
 * @param {{ facilityId: string | null, onClose: () => void, onRenew: (series: string) => void,
 *   pleinEcran?: boolean, series: string }} props
 * @returns {import('react').ReactElement} Le controle.
 */
function FacilityCheckPanel({
  facilityId, onClose, onRenew, pleinEcran = false, series,
}) {
  const { t } = useTranslation();
  const { Colors, Fonts, Images } = useTheme();
  const carnet = useFacilityChecks(facilityId);
  // CORR-COLLECTIVITES 52-bis (31/10) : « Retirer ce contrôle » (un double appui en notait deux).
  const retrait = useRemoveFacilityCheck();
  const [confirmerRetrait, setConfirmerRetrait] = useState(false);
  const lignes = seriesRows(carnet.data?.data, series);
  const enCours = lignes.find((ligne) => ligne.current) || null;
  const titre = lignes[0]?.label || t('facilityReports.controles.titre', 'Contrôles obligatoires');

  let corps;
  if (carnet.isLoading) {
    corps = (
      <SkeletonLoader isActive wrapperStyle={[{ gap: 12 }]}>
        <View style={{ backgroundColor: Colors.primary700, borderRadius: 12, height: 72 }} />
        <View style={{ backgroundColor: Colors.primary700, borderRadius: 8, height: 44 }} />
      </SkeletonLoader>
    );
  } else if (carnet.isError || !lignes.length) {
    corps = (
      <Text style={[Fonts.p2Bold, Fonts.neutral00]} testID="controle-introuvable">
        {carnet.isError
          ? t('facilityReports.controles.erreur', 'Les contrôles n’ont pas pu être chargés.')
          : t('APIerrors.FACILITY_CHECK_NOT_FOUND', 'Ce contrôle est introuvable.')}
      </Text>
    );
  } else {
    const enRetard = enCours?.state === 'en_retard';
    const dernier = enCours
      ? [pickerFromIso(enCours.doneOn), enCours.doneBy].filter(Boolean).join(', ')
      : '';
    corps = (
      <View style={{ gap: 12 }}>
        {enCours ? (
          <View
            style={{
              backgroundColor: withAlpha(enRetard ? Colors.error500 : Colors.warning500, 0.1),
              borderColor: withAlpha(enRetard ? Colors.error500 : Colors.warning500, 0.45),
              borderRadius: 14,
              borderWidth: 1,
              gap: 4,
              padding: 14,
            }}
            testID="controle-echeance"
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {enRetard
                ? t('facilityReports.controles.enRetard', {
                  ...SANS_ECHAPPEMENT,
                  date: checkLongDate(enCours.nextDue),
                })
                : t('facilityReports.controles.aRefaire', {
                  ...SANS_ECHAPPEMENT,
                  date: checkLongDate(enCours.nextDue),
                })}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral100]}>
              {t('facilityReports.controles.dernier', { ...SANS_ECHAPPEMENT, dernier })}
            </Text>
          </View>
        ) : null}
        {enCours && !pleinEcran ? (
          <Button
            onPress={() => onRenew(series)}
            title={t('facilityReports.controles.faitBouton', 'Noter le contrôle fait')}
            variant="Primary"
          />
        ) : null}
        {enCours && !confirmerRetrait ? (
          <Button
            onPress={() => setConfirmerRetrait(true)}
            title={t('facilityReports.controles.retirerControle', 'Retirer ce contrôle')}
            variant="Ghost"
          />
        ) : null}
        {enCours && confirmerRetrait ? (
          <View accessibilityRole="alert" style={{ gap: 8 }} testID="controle-retirer-confirmation">
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t(
                'facilityReports.controles.retirerControleQuestion',
                'Retirer ce contrôle ? Il disparaît du carnet ; le contrôle d’avant redevient celui en cours.',
              )}
            </Text>
            <Button
              disabled={retrait.isPending}
              onPress={async () => {
                await retrait.mutateAsync({ checkId: enCours.documentId });
                setConfirmerRetrait(false);
                if (lignes.length <= 1) onClose();
              }}
              title={t('facilityReports.controles.retirerControleOui', 'Oui, retirer')}
              variant="Danger"
            />
            <Button
              onPress={() => setConfirmerRetrait(false)}
              title={t('common.cancel', 'Annuler')}
              variant="Ghost"
            />
          </View>
        ) : null}
        <Text accessibilityRole="header" style={[Fonts.h5Bold, Fonts.neutral00, { marginTop: 8 }]}>
          {t('facilityReports.controles.historique', 'Historique')}
        </Text>
        {lignes.map((ligne) => (
          <View key={ligne.documentId} style={{ flexDirection: 'row', gap: 10, minHeight: 44 }}>
            <View
              style={{
                backgroundColor: Colors.success500,
                borderRadius: 5,
                height: 10,
                marginTop: 6,
                width: 10,
              }}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {ligne.result
                  ? t('facilityReports.controles.histoDateResultat', {
                    ...SANS_ECHAPPEMENT,
                    date: pickerFromIso(ligne.doneOn),
                    resultat: String(t(`facilityReports.controles.resultats.${ligne.result}`)),
                  })
                  : pickerFromIso(ligne.doneOn)}
              </Text>
              {ligne.doneBy || ligne.document ? (
                <Text style={[Fonts.p3, Fonts.neutral200]}>
                  {[
                    ligne.doneBy,
                    ligne.document
                      ? t('facilityReports.controles.rapportJoint', 'rapport joint')
                      : null,
                  ].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
              {ligne.document?.url ? (
                <TouchableOpacity
                  accessibilityRole="link"
                  onPress={() => {
                    const adresse = getImageUrl(ligne.document.url);
                    if (adresse) Linking.openURL(adresse);
                  }}
                  style={{ alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44 }}
                  testID={`controle-rapport-${ligne.documentId}`}
                >
                  <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                    {t('facilityReports.controles.voirRapport', 'Voir le rapport')}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    );
  }

  if (pleinEcran) {
    return (
      <FenetrePleinEcran onRequestClose={onClose}>
        <WizardStepLayout
          headerVariant="focus"
          isNextDisabled={!enCours}
          nextLabel={t('facilityReports.controles.faitBouton', 'Noter le contrôle fait')}
          onClose={onClose}
          onNext={() => onRenew(series)}
          subtitle={carnet.data?.meta?.facility?.name || undefined}
          title={titre}
        >
          {corps}
        </WizardStepLayout>
      </FenetrePleinEcran>
    );
  }
  return (
    // Le panneau de droite d InstallationCreneaux defile deja : ici, une simple colonne.
    <View style={{ gap: 12 }} testID="controle-panneau">
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
        <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00, { flex: 1 }]}>
          {titre}
        </Text>
        <TouchableOpacity
          accessibilityLabel={t('facilityReports.controles.fermer', 'Fermer le contrôle')}
          accessibilityRole="button"
          onPress={onClose}
          style={{
            alignItems: 'center', height: 44, justifyContent: 'center', width: 44,
          }}
          testID="controle-panneau-fermer"
        >
          <Image
            source={Images.close}
            style={{ height: 14, tintColor: Colors.neutral00, width: 14 }}
          />
        </TouchableOpacity>
      </View>
      {corps}
    </View>
  );
}

export default FacilityCheckPanel;
