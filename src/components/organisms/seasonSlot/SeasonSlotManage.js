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
  slotOccurrences,
  slotOccursOn,
  slotShape,
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
import { getParisNowAsDeviceDate, toDeviceDateFromParisInstant } from '@/utils/parisTime';

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
  const [etape, setEtape] = useState(
    /** @type {'detail' | 'retirer' | 'retirerDate'} */ (etapeInitiale),
  );
  const [erreur, setErreur] = useState(/** @type {string | null} */ (null));
  // C05 (Q3-11) : le jour de PARIS (celui du serveur), calcule une fois, pas celui de l appareil.
  const aujourdhuiParis = getParisNowAsDeviceDate();
  // COLL-C2B-BIS — la date d effet du retrait, saisie « JJ/MM/AAAA ».
  const [aPartirDu, setAPartirDu] = useState(format(aujourdhuiParis, 'dd/MM/yyyy'));
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
  // 🗓️ R17-QUAND-1, point 5 (Q1 A, planche P10-quand-tel état 7) — la FORME : « un mercredi sur
  // deux », des dates choisies ; une série se modifie ou se retire à partir d'une date (le geste
  // d'avant) ; « Retirer le mer. 21 oct. seulement » retire UNE date (`skipDate`).
  const forme = slotShape(slot);
  const enSerie = forme.recurrence === 'dates' || forme.everyWeeks > 1;
  const aujourdhui = format(aujourdhuiParis, 'yyyy-MM-dd');
  const [prochaine] = slotOccurrences(slot, { from: aujourdhui });
  const [dateARetirer, setDateARetirer] = useState(
    prochaine ? format(parseISO(prochaine), 'dd/MM/yyyy') : '',
  );
  const dateChoisie = parse(dateARetirer, 'dd/MM/yyyy', new Date());
  const jourARetirer = isValid(dateChoisie) ? format(dateChoisie, 'yyyy-MM-dd') : null;
  const dateRetirable = Boolean(jourARetirer && jourARetirer >= aujourdhui
    && slotOccursOn(slot, /** @type {string} */ (jourARetirer)));
  let rythme = t('collectiviteCreneaux.gerer.chaque', 'Chaque {{jour}}, {{heures}}', {
    heures, jour: jour.toLocaleLowerCase(), ...SANS_ECHAPPEMENT,
  });
  if (forme.recurrence === 'dates') {
    rythme = t('collectiviteCreneaux.gerer.datesHeures', {
      count: forme.dates?.length || 0,
      defaultValue_one: '{{count}} date, {{heures}}',
      defaultValue_other: '{{count}} dates, {{heures}}',
      heures,
      ...SANS_ECHAPPEMENT,
    });
  } else if (forme.everyWeeks > 1) {
    rythme = t('collectiviteCreneaux.gerer.unSurDeux', 'Un {{jour}} sur deux, {{heures}}', {
      heures, jour: jour.toLocaleLowerCase(), ...SANS_ECHAPPEMENT,
    });
  }
  const nombreDEntrainements = detail.data?.data?.sessionsCount;

  const rangee = (/** @type {string} */ libelle, /** @type {string} */ valeur) => (
    <View key={libelle} style={{ flexDirection: 'row', gap: 12, justifyContent: 'space-between' }}>
      <Text style={[Fonts.p3, Fonts.neutral300, { flexShrink: 1 }]}>{libelle}</Text>
      <Text style={[Fonts.p2Bold, Fonts.neutral00, { flexShrink: 1, textAlign: 'right' }]}>
        {valeur}
      </Text>
    </View>
  );

  if (etape === 'retirerDate') {
    const confirmerLaDate = async () => {
      if (!dateRetirable) return;
      setErreur(null);
      try {
        await retirer.mutateAsync({ data: { skipDate: jourARetirer }, slotId: slot.documentId });
        onWithdrawn?.();
        onClose();
      } catch (refus) {
        setErreur(seasonSlotErrorMessage(t, refus) || getErrorMessage(/** @type {any} */ (refus)));
      }
    };
    return (
      <View style={{ gap: 12 }}>
        <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
          {t('collectiviteCreneaux.gerer.retirerDateTitre', 'Retirer une seule date ?')}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t(
            'collectiviteCreneaux.gerer.retirerDatePerd',
            '{{qui}} n’aura pas de séance le {{date}} ; les autres dates restent. Le club est '
              + 'prévenu.',
            {
              date: jourARetirer ? formatDay(jourARetirer, { withYear: false }) : '…',
              qui,
              ...SANS_ECHAPPEMENT,
            },
          )}
        </Text>
        <DatePickerInput
          label={t('collectiviteCreneaux.gerer.quelleDate', 'Quelle date ?')}
          maximumDate={finDuCreneau}
          minimumDate={aujourdhuiParis}
          onChange={(/** @type {string} */ valeur) => {
            setDateARetirer(valeur);
            setErreur(null);
          }}
          value={dateARetirer}
        />
        {jourARetirer && !dateRetirable ? (
          <Text accessibilityRole="alert" style={[Fonts.p3, Fonts.error500]}>
            {t('collectiviteCreneaux.gerer.pasCeJour', 'Ce créneau n’a pas lieu ce jour-là.')}
          </Text>
        ) : null}
        {erreur ? (
          <Text accessibilityRole="alert" style={[Fonts.p3, Fonts.error500]}>{erreur}</Text>
        ) : null}
        <Button
          disabled={!dateRetirable}
          isLoading={retirer.isPending}
          onPress={confirmerLaDate}
          title={t('collectiviteCreneaux.gerer.retirerCetteDate', 'Retirer cette date')}
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
          {/* CORR-COLLECTIVITES 107 (31/10, Adel B) : « le créneau », jamais « la série ». */}
          {enSerie
            ? t(
              'collectiviteCreneaux.gerer.retirerCreneauTitre',
              'Retirer le créneau à partir d’une date ?',
            )
            : t('collectiviteCreneaux.gerer.retirerTitre', 'Retirer le créneau du {{jour}} ?', {
              jour: jour.toLocaleLowerCase(),
              ...SANS_ECHAPPEMENT,
            })}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {unSeulPointFinal(t(
            // R17-QUAND-1 — une série se dit par son rythme (« un mercredi sur deux, 17:30 »).
            enSerie
              ? 'collectiviteCreneaux.gerer.retirerSeriePerd'
              : 'collectiviteCreneaux.gerer.retirerPerd',
            enSerie
              ? '{{qui}} perd {{rythme}}, {{installation}}, à partir du {{date}}.'
              : '{{qui}} perd le {{jour}} {{heures}}, {{installation}}, à partir du {{date}}.',
            {
              date: formatDay(
                retraitLisible ? dateDuRetrait : aujourdhuiParis,
                { withYear: false },
              ),
              heures,
              installation: installationName || slot?.facility?.name || '',
              jour: jour.toLocaleLowerCase(),
              qui,
              rythme: rythme.charAt(0).toLocaleLowerCase() + rythme.slice(1),
              ...SANS_ECHAPPEMENT,
            },
          ))}
        </Text>
        <DatePickerInput
          label={t('collectiviteCreneaux.attribuer.aPartirDu', 'À partir du')}
          maximumDate={finDuCreneau}
          minimumDate={aujourdhuiParis}
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
          {[rythme, installationName || slot?.facility?.name].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <View style={{ gap: 8 }}>
        {rangee(
          t('collectiviteCreneaux.gerer.periode', 'Période'),
          formatPeriod(slot?.validFrom, dernierJour),
        )}
        {forme.dates ? rangee(
          t('collectiviteCreneaux.gerer.dates', 'Dates'),
          forme.dates.map((date) => formatDay(date, { withYear: false })).join(' · '),
        ) : null}
        {prochaine ? rangee(
          t('collectiviteCreneaux.gerer.prochaineSeance', 'Prochaine séance'),
          formatDay(prochaine, { withYear: false }),
        ) : null}
        {slot?.attributedAt ? rangee(
          t('collectiviteCreneaux.gerer.attribueLe', 'Attribué le'),
          // C05 (Q3-11) : un instant UTC coupe tombait la veille entre minuit et 2 h a Paris.
          formatDay(format(
            toDeviceDateFromParisInstant(slot.attributedAt) || new Date(slot.attributedAt),
            'yyyy-MM-dd',
          )),
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
            {/* CORR-COLLECTIVITES 107 (31/10, Adel B) : un seul mot, toujours juste. */}
            <Button
              onPress={() => onModify(slot)}
              title={t('collectiviteCreneaux.gerer.modifier', 'Modifier le créneau')}
              variant="Secondary"
            />
            {prochaine ? (
              <Button
                onPress={() => setEtape('retirerDate')}
                title={t(
                  'collectiviteCreneaux.gerer.retirerUneDate',
                  'Retirer le {{date}} seulement',
                  { date: formatDay(prochaine, { withYear: false }), ...SANS_ECHAPPEMENT },
                )}
                variant="Secondary"
              />
            ) : null}
            <Button
              onPress={() => setEtape('retirer')}
              title={t('collectiviteCreneaux.gerer.retirer', 'Retirer le créneau')}
              variant="Danger"
            />
            {enSerie ? (
              <Text style={[Fonts.p3, Fonts.neutral300]}>
                {t(
                  'collectiviteCreneaux.gerer.noteCreneau',
                  '« Modifier » et « Retirer le créneau » demandent « à partir du » : les dates '
                    + 'passées restent. Le club est prévenu.',
                )}
              </Text>
            ) : null}
          </>
        ) : null}
        <Button onPress={onClose} title={t('common.close', 'Fermer')} variant="Ghost" />
      </View>
    </View>
  );
}

export default SeasonSlotManage;
