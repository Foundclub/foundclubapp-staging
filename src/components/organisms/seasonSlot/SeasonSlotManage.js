import {
  format, isValid, parse, parseISO,
} from 'date-fns';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import {
  finDuCreneau as dernierJourDuCreneau,
  formatDay,
  formatPeriod,
  seasonSlotErrorMessage,
  slotWho,
  timeRange,
  unSeulPointFinal,
  weekdayName,
} from '@/domains/seasonSlot/seasonSlotDisplay';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import DatePickerInput from '@/components/molecules/datePickerInput/DatePickerInput';

import { useSeasonSlot, useWithdrawSeasonSlot } from '@/services/seasonSlot/seasonSlotQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

/**
 * 📐 COLL-C2B (02/10) — GERER un creneau de saison (design HY521H1, P4v2-creneaux, ecrans 4 et
 * 5 ; P4v2-creneaux-ordi, B et D) : ce qu il est, depuis quand, ses entrainements poses (contrat
 * C2A §4.4), puis « Modifier le creneau » et « Retirer le creneau ».
 *
 * Retirer demande une confirmation et le dit (D67, decision d Adel du 01/10) : les entrainements
 * deja poses RESTENT, le club les garde ou les annule lui-meme, et la mairie peut retablir le
 * creneau depuis la liste. Le serveur ne touche aucune seance (§4.6).
 * COLL-C2B-BIS (03/10) — planche 23 : le retrait vaut « a partir du » une date CHOISIE (aujourd hui
 * par defaut, jusqu a la fin du creneau) ; les seances posees apres cette date restent aussi (D67).
 *
 * Un lecteur qui ne gere pas l installation (`meta.canManage` faux) ne voit AUCUN geste.
 * ⛔ Aucun nom de personne : un club, une equipe, des heures.
 * @param {{
 *   canManage: boolean,
 *   etapeInitiale?: 'detail' | 'retirer',
 *   installationName?: string | null,
 *   onClose: () => void,
 *   onModify: (creneau: any) => void,
 *   onWithdrawn?: () => void,
 *   slot: any,
 * }} props
 * @returns {import('react').ReactElement} La feuille.
 */
function SeasonSlotManage({
  canManage,
  etapeInitiale = 'detail',
  installationName = null,
  onClose,
  onModify,
  onWithdrawn,
  slot,
}) {
  const { t } = useTranslation();
  const { Colors, Fonts, Spaces } = useTheme();
  const detail = useSeasonSlot(slot?.documentId);
  const retirer = useWithdrawSeasonSlot();
  // Depuis le planning, « Retirer le creneau » ouvre directement la confirmation.
  const [etape, setEtape] = useState(/** @type {'detail' | 'retirer'} */ (etapeInitiale));
  const [erreur, setErreur] = useState(/** @type {string | null} */ (null));
  // COLL-C2B-BIS — la date d effet du retrait, saisie « JJ/MM/AAAA ».
  const [aPartirDu, setAPartirDu] = useState(format(new Date(), 'dd/MM/yyyy'));
  const dateDuRetrait = parse(aPartirDu, 'dd/MM/yyyy', new Date());
  const retraitLisible = isValid(dateDuRetrait);
  // FINITIONS15 point 4 (T14, C15b) : la fin d'un créneau RETIRÉ est la veille du retrait
  // (`effectiveUntil`), comme dans la liste ; la période et la date du retrait la lisent aussi.
  const dernierJour = dernierJourDuCreneau(slot);
  const finDuCreneau = dernierJour ? parseISO(dernierJour) : undefined;
  // Le serveur a le dernier mot : s il dit que ce compte ne gere pas, aucun geste.
  const gere = canManage && detail.data?.meta?.canManage !== false;

  const jour = weekdayName(slot?.weekday);
  const heures = timeRange(slot?.startTime, slot?.endTime);
  const qui = slotWho(slot);
  const nombreDEntrainements = detail.data?.data?.sessionsCount;

  const rangee = (/** @type {string} */ libelle, /** @type {string} */ valeur) => (
    <View key={libelle} style={{ flexDirection: 'row', gap: 12, justifyContent: 'space-between' }}>
      <Text style={[Fonts.p3, Fonts.neutral300, { flexShrink: 1 }]}>{libelle}</Text>
      <Text style={[Fonts.p2Bold, Fonts.neutral00, { flexShrink: 1, textAlign: 'right' }]}>
        {valeur}
      </Text>
    </View>
  );

  if (etape === 'retirer') {
    const confirmer = async () => {
      setErreur(null);
      try {
        await retirer.mutateAsync({
          data: { effectiveFrom: format(dateDuRetrait, 'yyyy-MM-dd') },
          slotId: slot.documentId,
        });
        onWithdrawn?.();
        onClose();
      } catch (refus) {
        setErreur(seasonSlotErrorMessage(t, refus) || getErrorMessage(/** @type {any} */ (refus)));
      }
    };
    return (
      <View style={{ gap: 12 }}>
        <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
          {t('collectiviteCreneaux.gerer.retirerTitre', 'Retirer le créneau du {{jour}} ?', {
            jour: jour.toLocaleLowerCase(),
            ...SANS_ECHAPPEMENT,
          })}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {unSeulPointFinal(t(
            'collectiviteCreneaux.gerer.retirerPerd',
            '{{qui}} perd le {{jour}} {{heures}}, {{installation}}, à partir du {{date}}.',
            {
              date: formatDay(retraitLisible ? dateDuRetrait : new Date(), { withYear: false }),
              heures,
              installation: installationName || slot?.facility?.name || '',
              jour: jour.toLocaleLowerCase(),
              qui,
              ...SANS_ECHAPPEMENT,
            },
          ))}
        </Text>
        <DatePickerInput
          label={t('collectiviteCreneaux.attribuer.aPartirDu', 'À partir du')}
          maximumDate={finDuCreneau}
          minimumDate={new Date()}
          onChange={(/** @type {string} */ valeur) => {
            setAPartirDu(valeur);
            setErreur(null);
          }}
          value={aPartirDu}
        />
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t('collectiviteCreneaux.gerer.clubPrevenu', 'Le club est prévenu.')}
        </Text>
        <View
          style={[
            Spaces.padding[12],
            {
              backgroundColor: withAlpha(Colors.neutral00, 0.05),
              borderColor: withAlpha(Colors.neutral00, 0.12),
              borderRadius: 14,
              borderWidth: 1,
              gap: 6,
            },
          ]}
        >
          <Text style={[Fonts.p3, Fonts.neutral100]}>
            {t(
              'collectiviteCreneaux.gerer.d67',
              'Ses entraînements déjà posés sur ce créneau restent : le club les garde ou les '
                + 'annule lui-même.',
            )}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t(
              'collectiviteCreneaux.gerer.retablirPlusTard',
              'Une erreur ? Vous pourrez rétablir le créneau depuis la liste.',
            )}
          </Text>
        </View>
        {erreur ? (
          <Text accessibilityRole="alert" style={[Fonts.p3, Fonts.error500]}>{erreur}</Text>
        ) : null}
        <Button
          disabled={!retraitLisible}
          isLoading={retirer.isPending}
          onPress={confirmer}
          title={t('collectiviteCreneaux.gerer.retirer', 'Retirer le créneau')}
          variant="Danger"
        />
        <Button
          onPress={() => setEtape('detail')}
          title={t('common.cancel', 'Annuler')}
          variant="Ghost"
        />
      </View>
    );
  }

  let entrainements = '';
  if (Number.isInteger(nombreDEntrainements)) {
    entrainements = t('collectiviteCreneaux.gerer.entrainements', {
      count: nombreDEntrainements,
      defaultValue_one: '{{count}} cette saison',
      defaultValue_other: '{{count}} cette saison',
    });
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 4 }}>
        <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>{qui}</Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {[
            t('collectiviteCreneaux.gerer.chaque', 'Chaque {{jour}}, {{heures}}', {
              heures,
              jour: jour.toLocaleLowerCase(),
              ...SANS_ECHAPPEMENT,
            }),
            installationName || slot?.facility?.name,
          ].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <View style={{ gap: 8 }}>
        {rangee(
          t('collectiviteCreneaux.gerer.periode', 'Période'),
          formatPeriod(slot?.validFrom, dernierJour),
        )}
        {slot?.attributedAt ? rangee(
          t('collectiviteCreneaux.gerer.attribueLe', 'Attribué le'),
          formatDay(String(slot.attributedAt).slice(0, 10)),
        ) : null}
        {slot?.plateau?.name ? rangee(
          t('collectiviteCreneaux.gerer.plateau', 'Plateau'),
          slot.plateau.name,
        ) : null}
        {slot?.source === 'request' ? rangee(
          t('collectiviteCreneaux.gerer.origine', 'Origine'),
          t('collectiviteCreneaux.gerer.demandeAcceptee', 'Demande acceptée'),
        ) : null}
        {detail.isLoading ? <Loader /> : null}
        {entrainements ? rangee(
          t('collectiviteCreneaux.gerer.entrainementsPoses', 'Entraînements posés'),
          entrainements,
        ) : null}
      </View>
      <View style={{ gap: 8 }}>
        {gere ? (
          <>
            <Button
              onPress={() => onModify(slot)}
              title={t('collectiviteCreneaux.gerer.modifier', 'Modifier le créneau')}
              variant="Secondary"
            />
            <Button
              onPress={() => setEtape('retirer')}
              title={t('collectiviteCreneaux.gerer.retirer', 'Retirer le créneau')}
              variant="Danger"
            />
          </>
        ) : null}
        <Button onPress={onClose} title={t('common.close', 'Fermer')} variant="Ghost" />
      </View>
    </View>
  );
}

export default SeasonSlotManage;
