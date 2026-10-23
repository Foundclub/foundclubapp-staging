import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, Text, TouchableOpacity, View,
} from 'react-native';

import {
  isoFromPicker,
  pickerFromIso,
  proposedNextDue,
  seriesRows,
} from '@/domains/facilityCheck/facilityCheckDisplay';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import DatePickerInput from '@/components/molecules/datePickerInput/DatePickerInput';
import Input from '@/components/molecules/input/Input';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { FenetrePleinEcran } from '@/components/organisms/seasonSlot/SeasonSlotForm';

import {
  useCreateFacilityCheck,
  useFacilityChecks,
  useMarkFacilityCheckDone,
} from '@/services/facilityCheck/facilityCheckQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

import MediaPlatform from '@/platform/media';
import { getDocumentPickerOptions } from '@/platform/media/documentUploadFormats';

/**
 * R17-CONTROLES (20/10, REC17-011 lot 2, decision d Adel Q6 B) — « NOTER UN CONTRÔLE » (planche
 * validee P11-q6-exemple-tel ecran 1) : « Quel contrôle ? », « Fait le », « Par », « Prochain
 * contrôle » (« Proposé : un an après. Modifiable. »), « Joindre le rapport (PDF, facultatif) »,
 * « Enregistrer ». Et « NOTER LE CONTRÔLE FAIT » (ecran 4, `series` donnee) : la ligne est reprise
 * (l intitule ne se saisit pas, « Par » est repris), restent la date et le rapport, le prochain se
 * recalcule avec le meme ecart que la fois precedente.
 * Au telephone, dans la FENETRE plein ecran du gabarit des tunnels (COLL-R-A7) ; sur ordinateur,
 * dans le panneau de droite de l onglet. Le serveur reste le juge (dates, rapport) : son refus se
 * dit avec son code traduit.
 * @param {{ facilityId: string | null, facilityName?: string | null, onCancel: () => void,
 *   onDone: (ligne: any) => void, pleinEcran?: boolean, series?: string | null }} props
 * @returns {import('react').ReactElement} Le formulaire.
 */
function FacilityCheckForm({
  facilityId, facilityName = null, onCancel, onDone, pleinEcran = false, series = null,
}) {
  const { t } = useTranslation();
  const { Colors, Fonts, Images } = useTheme();
  const carnet = useFacilityChecks(facilityId);
  const noter = useCreateFacilityCheck();
  const noterFait = useMarkFacilityCheckDone();
  // Le jour du serveur (Paris) ; a defaut, celui de l appareil.
  const aujourdHui = carnet.data?.meta?.today || new Date().toISOString().slice(0, 10);
  const precedent = series
    ? seriesRows(carnet.data?.data, series).find((ligne) => ligne.current) || null
    : null;
  const refait = Boolean(series);

  const [label, setLabel] = useState('');
  const [faitLe, setFaitLe] = useState(() => pickerFromIso(aujourdHui));
  const [par, setPar] = useState(() => precedent?.doneBy || '');
  const [prochain, setProchain] = useState(
    () => pickerFromIso(proposedNextDue(aujourdHui, precedent)),
  );
  const [prochainTouche, setProchainTouche] = useState(false);
  const [rapport, setRapport] = useState(/** @type {any} */ (null));
  // R17CTRL-1 (22/10, decision « 5- A ») : « Conforme » ou « Non conforme », dit a chaque fois.
  const [resultat, setResultat] = useState(/** @type {string | null} */ (null));
  const [erreur, setErreur] = useState(/** @type {string | null} */ (null));
  const envoi = refait ? noterFait : noter;

  const changerFaitLe = (/** @type {string} */ valeur) => {
    setFaitLe(valeur);
    const iso = isoFromPicker(valeur);
    // Le prochain suit la date faite tant que la Ville ne l a pas choisi elle-meme.
    if (iso && !prochainTouche) setProchain(pickerFromIso(proposedNextDue(iso, precedent)));
  };
  const changerProchain = (/** @type {string} */ valeur) => {
    setProchainTouche(true);
    setProchain(valeur);
  };
  const joindre = async () => {
    try {
      const choisis = await MediaPlatform.pickDocument({
        ...getDocumentPickerOptions(),
        localCopy: true,
        mode: 'import',
      });
      const choisi = Array.isArray(choisis) ? choisis[0] : choisis;
      if (choisi) setRapport(choisi);
    } catch {
      // Le selecteur ferme sans choix : rien a dire.
    }
  };

  const enregistrer = async () => {
    setErreur(null);
    const doneOn = isoFromPicker(faitLe);
    const nextDue = isoFromPicker(prochain);
    if (!refait && !label.trim()) {
      setErreur(t('facilityReports.controles.erreurs.label', 'Nommez le contrôle.'));
      return;
    }
    if (!doneOn || !nextDue || nextDue <= doneOn) {
      setErreur(t(
        'facilityReports.controles.erreurs.nextDue',
        'Le prochain contrôle vient après celui-ci.',
      ));
      return;
    }
    if (!resultat) {
      setErreur(t(
        'facilityReports.controles.erreurs.result',
        'Dites si le contrôle est conforme.',
      ));
      return;
    }
    const champs = {
      document: rapport, doneBy: par.trim() || null, doneOn, nextDue, result: resultat,
    };
    try {
      const reponse = refait
        ? await noterFait.mutateAsync({ checkId: precedent?.documentId, ...champs })
        : await noter.mutateAsync({ facilityId, label: label.trim(), ...champs });
      onDone(reponse?.data || null);
    } catch (refus) {
      setErreur(getErrorMessage(/** @type {any} */ (refus)));
    }
  };

  const titre = refait
    ? t('facilityReports.controles.faitBouton', 'Noter le contrôle fait')
    : t('facilityReports.controles.formTitre', 'Noter un contrôle');
  const champs = (
    <View style={{ gap: 12 }} testID="controle-formulaire">
      {refait ? (
        <Text accessibilityRole="header" style={[Fonts.h5Bold, Fonts.neutral00]}>
          {precedent?.label || ''}
        </Text>
      ) : (
        <Input
          label={t('facilityReports.controles.quel', 'Quel contrôle ?')}
          maxLength={80}
          onChangeText={setLabel}
          placeholder={t(
            'facilityReports.controles.quelPlaceholder',
            'Buts et paniers, extincteurs…',
          )}
          testID="controle-quel"
          value={label}
        />
      )}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <DatePickerInput
            label={t('facilityReports.controles.faitLe', 'Fait le')}
            maximumDate={new Date()}
            onChange={changerFaitLe}
            testID="controle-fait-le"
            value={faitLe}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Input
            label={t('facilityReports.controles.par', 'Par')}
            maxLength={120}
            onChangeText={setPar}
            placeholder={t('facilityReports.controles.parPlaceholder', 'Société, organisme')}
            testID="controle-par"
            value={par}
          />
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
          {t('facilityReports.controles.resultat', 'Résultat')}
        </Text>
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 8 }}>
          {['conforme', 'non_conforme'].map((valeur) => {
            const choisi = resultat === valeur;
            const ton = valeur === 'conforme' ? Colors.success500 : Colors.error500;
            return (
              <TouchableOpacity
                accessibilityRole="radio"
                accessibilityState={{ checked: choisi }}
                key={valeur}
                onPress={() => setResultat(valeur)}
                style={{
                  alignItems: 'center',
                  backgroundColor: choisi ? withAlpha(ton, 0.16) : 'transparent',
                  borderColor: choisi ? ton : withAlpha(Colors.neutral00, 0.2),
                  borderRadius: 12,
                  borderWidth: 1,
                  flex: 1,
                  justifyContent: 'center',
                  minHeight: 44,
                }}
                testID={`controle-resultat-${valeur}`}
              >
                <Text style={[Fonts.p2Bold, choisi ? { color: ton } : Fonts.neutral100]}>
                  {String(t(`facilityReports.controles.choix.${valeur}`))}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      <View style={{ gap: 4 }}>
        <DatePickerInput
          label={t('facilityReports.controles.prochainChamp', 'Prochain contrôle')}
          onChange={changerProchain}
          testID="controle-prochain"
          value={prochain}
        />
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {precedent
            ? t(
              'facilityReports.controles.proposeEcart',
              'Proposé : le même écart que la fois précédente. Modifiable.',
            )
            : t('facilityReports.controles.propose', 'Proposé : un an après. Modifiable.')}
        </Text>
      </View>
      {rapport ? (
        <View
          style={{
            alignItems: 'center',
            borderColor: withAlpha(Colors.primary500, 0.6),
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 10,
            minHeight: 48,
            paddingHorizontal: 12,
          }}
        >
          <Text numberOfLines={1} style={[Fonts.p3Bold, Fonts.neutral00, { flex: 1 }]}>
            {rapport.name || rapport.fileName || ''}
          </Text>
          <TouchableOpacity
            accessibilityLabel={t('facilityReports.controles.retirerRapport', 'Retirer le rapport')}
            accessibilityRole="button"
            onPress={() => setRapport(null)}
            style={{
              alignItems: 'center', height: 44, justifyContent: 'center', width: 44,
            }}
          >
            <Image
              source={Images.close}
              style={{ height: 12, tintColor: Colors.neutral00, width: 12 }}
            />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={joindre}
          style={{
            alignItems: 'center',
            borderColor: withAlpha(Colors.primary500, 0.6),
            borderRadius: 12,
            borderStyle: 'dashed',
            borderWidth: 1,
            flexDirection: 'row',
            gap: 10,
            minHeight: 48,
            paddingHorizontal: 12,
          }}
          testID="controle-rapport"
        >
          <Image
            source={Images.plus}
            style={{ height: 14, tintColor: Colors.primary200, width: 14 }}
          />
          <Text style={[Fonts.p3Bold, Fonts.primary200]}>
            {t('facilityReports.controles.joindre', 'Joindre le rapport (PDF, facultatif)')}
          </Text>
        </TouchableOpacity>
      )}
      {erreur ? (
        <Text style={[Fonts.p3Bold, Fonts.error500]} testID="controle-refus">
          {erreur}
        </Text>
      ) : null}
    </View>
  );

  if (pleinEcran) {
    return (
      <FenetrePleinEcran onRequestClose={onCancel}>
        <WizardStepLayout
          headerVariant="focus"
          isNextLoading={envoi.isPending}
          nextLabel={t('facilityReports.controles.enregistrer', 'Enregistrer')}
          onClose={onCancel}
          onNext={enregistrer}
          subtitle={facilityName || undefined}
          title={titre}
        >
          {champs}
        </WizardStepLayout>
      </FenetrePleinEcran>
    );
  }
  return (
    <View style={{ gap: 12 }} testID="controle-formulaire-panneau">
      <View style={{ gap: 2 }}>
        <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>{titre}</Text>
        {facilityName ? <Text style={[Fonts.p3, Fonts.neutral200]}>{facilityName}</Text> : null}
      </View>
      {champs}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button
          onPress={onCancel}
          style={{ flex: 1 }}
          title={t('facilityReports.controles.annuler', 'Annuler')}
          variant="Ghost"
        />
        <Button
          isLoading={envoi.isPending}
          onPress={enregistrer}
          style={{ flex: 1 }}
          title={t('facilityReports.controles.enregistrer', 'Enregistrer')}
          variant="Primary"
        />
      </View>
    </View>
  );
}

export default FacilityCheckForm;
