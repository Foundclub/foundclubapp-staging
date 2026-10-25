import { format, isValid, parse } from 'date-fns';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, Text, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import DatePickerInput from '@/components/molecules/datePickerInput/DatePickerInput';
import DayPicker from '@/components/molecules/dayPicker/DayPicker';
import TimePickerInput from '@/components/molecules/timePickerInput/TimePickerInput';

const DATE_INPUT_FORMAT = 'dd/MM/yyyy';
const TIME_INPUT_FORMAT = 'HH:mm';
const MIN_RECURRENCE_INTERVAL = 1;

/**
 * 🧨 LA HAUTEUR DE LA FEUILLE « REPETER », ET POURQUOI ELLE EST OBLIGATOIRE.
 *
 * Defaut trouve a la recette du 2026-08-07 : la feuille « ne defile pas jusqu'en
 * bas » et « ses boutons sont inatteignables » ⇒ la recurrence est inutilisable
 * sur un vrai telephone. Ce n'est pas une impression, c'est une soustraction.
 *
 * `BottomModal` a DEUX mises en page, et c'est `snapPoints` qui choisit.
 *  - SANS `snapPoints` : la feuille se dimensionne sur son contenu, et sa seule
 *    zone defilante est plafonnee a 70 % de la hauteur d'ECRAN
 *    (`BottomModal.js:322`) dans un conteneur SANS flex. L'entete et le pied
 *    s'empilent PAR-DESSUS ce plafond, ils ne s'y taillent pas une place.
 *  - AVEC `snapPoints` : conteneur et zone defilante passent en `flex: 1`
 *    (`BottomModal.js:298` et `:322`). La zone defilante prend exactement ce
 *    que l'entete et le pied lui laissent. Le pied reste donc toujours a
 *    l'ecran, quel que soit le contenu.
 *
 * Le calcul qui condamne la premiere mise en page, sur un iPhone 14
 * (ecran 844 pt, encoche 47) : la feuille ne peut pas depasser
 * 844 - (47 + 20) = 777 pt (`topInset`, `BottomModal.js:274`), or
 * entete 64 + zone defilante 0,7 x 844 = 590,8 + pied 162 = 816,8 pt.
 * Des que le contenu reclame plus de 777 - 64 - 162 = 551 pt, le pied — qui
 * n'est PAS dans la zone defilante — passe sous le bord bas de la feuille, et
 * AUCUN defilement ne peut l'y ramener. La feuille de recurrence (frequence,
 * cadence, jours, deux dates) depasse ce seuil.
 *
 * ⛔ `BottomModal` est utilise par 70 fichiers, dont les feuilles payantes : on
 * ne le modifie pas. On utilise la mise en page qu'il prevoit deja pour ce cas,
 * comme le font deja une quarantaine de feuilles de ce depot.
 * @type {string[]}
 */
const RECURRENCE_SHEET_SNAP_POINTS = ['90%'];

export const toDateInputText = (/** @type {Date} */ valeur) => format(valeur, DATE_INPUT_FORMAT);
export const toTimeInputText = (/** @type {Date} */ valeur) => format(valeur, TIME_INPUT_FORMAT);

export const mergeDateInput = (/** @type {string} */ text, /** @type {Date} */ fallbackDate) => {
  const parsed = parse(text, DATE_INPUT_FORMAT, fallbackDate);
  return isValid(parsed) ? parsed : fallbackDate;
};

export const mergeTimeInput = (/** @type {string} */ text, /** @type {Date} */ referenceDate) => {
  const [hours, minutes] = String(text || '').split(':').map(Number);
  const merged = new Date(referenceDate);
  merged.setHours(
    Number.isFinite(hours) ? hours : 0,
    Number.isFinite(minutes) ? minutes : 0,
    0,
    0,
  );
  return merged;
};

/**
 * Le nombre de periodes saisi, au moins 1.
 * @param {unknown} rawValue - La saisie.
 * @returns {number} Le nombre.
 */
export const intervalleLu = (rawValue) => {
  const parsed = Number.parseInt(String(rawValue ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : MIN_RECURRENCE_INTERVAL;
};

export const areSameDay = (/** @type {Date} */ firstDate, /** @type {Date} */ secondDate) => (
  firstDate.getFullYear() === secondDate.getFullYear()
  && firstDate.getMonth() === secondDate.getMonth()
  && firstDate.getDate() === secondDate.getDate()
);

/**
 * 🎨 FINITIONS13-COLL (04/10) — LE DÉBUT DE LA RÉPÉTITION SUIT LE JOUR DE LA SÉANCE tant qu'on ne
 * l'a pas choisi ailleurs : resté au jour d'avant, ou plus tôt que la séance, il prend son nouveau
 * jour ; choisi plus tard, il reste. Tournée T13 (C2_2a) : « samedi 3 octobre », le jour de la
 * saisie, pour une séance le jeudi 8 ; déplacée au 22, la série aurait gardé les 8 et 15.
 * @param {Date | null} debut - Le début de la répétition retenu.
 * @param {Date} ancienne - Le jour de la séance avant le changement.
 * @param {Date} nouvelle - Le nouveau jour de la séance.
 * @returns {Date} Le début à retenir.
 */
export const debutDeRepetitionSuivant = (debut, ancienne, nouvelle) => (
  !debut || areSameDay(debut, ancienne) || debut < nouvelle ? new Date(nouvelle) : debut
);

/**
 * 🐞 FINITIONS15 point 1 (T14, C08 et C08b) — LE JOUR DE LA RÉPÉTITION SUIT LE JOUR DE LA SÉANCE
 * quand c'est le seul retenu : la répétition ne portait que le jour présélectionné (celui de
 * l'ancienne date), le jour de la nouvelle date le remplace. Avant, il s'ajoutait à côté (lundi +
 * jeudi) et la série prenait des séances en trop. Plusieurs jours choisis par l'utilisateur :
 * son choix reste (l'effet qui suit y ajoute le jour de la séance, comme avant).
 * @param {any[]} jours - Les jours retenus (0 = dimanche).
 * @param {Date} ancienne - Le jour de la séance avant le changement.
 * @param {Date} nouvelle - Le nouveau jour de la séance.
 * @returns {any[]} Les jours à retenir.
 */
export const joursDeRepetitionSuivants = (jours, ancienne, nouvelle) => (
  Array.isArray(jours) && jours.length === 1 && Number(jours[0]) === ancienne.getDay()
    ? [nouvelle.getDay()]
    : jours
);

export const buildDefaultRecurrenceEndDate = (
  /** @type {Date} */ startDate,
  /** @type {string} */ frequency,
  /** @type {number} */ interval,
) => {
  const fallbackEnd = new Date(startDate);
  if (frequency === 'month') {
    fallbackEnd.setMonth(fallbackEnd.getMonth() + Math.max(1, interval));
    return fallbackEnd;
  }
  fallbackEnd.setDate(fallbackEnd.getDate() + (7 * Math.max(1, interval)));
  return fallbackEnd;
};

/**
 * Le libelle d'une cadence : « Toutes les semaines », « Tous les 3 mois »…
 *
 * Ecrit UNE fois : la rangee « Repeter » l'affiche pour la valeur enregistree, et la feuille
 * l'affiche pour le brouillon en cours d'edition.
 * @param {any} t Traducteur `useTranslation` (son type surcharge ne se decrit
 *   pas en JSDoc sans reecrire les surcharges d'i18next).
 * @param {string} frequency `week` ou `month`.
 * @param {number} interval Nombre de periodes.
 * @returns {string} Le libelle affichable.
 */
export const buildRecurrenceIntervalLabel = (t, frequency, interval) => {
  const safeInterval = Math.max(MIN_RECURRENCE_INTERVAL, interval);
  if (frequency === 'month') {
    return safeInterval === 1
      ? t('eventWizard.steps.logistics.recurrenceIntervalMonthlyOne', 'Tous les mois')
      : t(
        'eventWizard.steps.logistics.recurrenceIntervalMonthlyMany',
        'Tous les {{count}} mois',
        { count: safeInterval },
      );
  }

  return safeInterval === 1
    ? t('eventWizard.steps.logistics.recurrenceIntervalWeeklyOne', 'Toutes les semaines')
    : t(
      'eventWizard.steps.logistics.recurrenceIntervalWeeklyMany',
      'Toutes les {{count}} semaines',
      { count: safeInterval },
    );
};

/**
 * La repetition, telle que la rangee « Repeter » et sa feuille l'editent.
 * @typedef {object} Repetition
 * @property {boolean} actif - Repeter, ou « Une seule fois ».
 * @property {string} frequence - `week` ou `month`.
 * @property {string} intervalleTexte - Nombre de periodes, tel que saisi.
 * @property {any[]} jours - Les jours de la semaine retenus (0 = dimanche).
 * @property {Date | null} du - Date a partir de laquelle la repetition court.
 * @property {Date | null} au - Date de fin de la repetition.
 */

/**
 * Ce que la feuille « Repeter » edite, tant qu'on n'a pas touche « Appliquer ».
 * @typedef {object} BrouillonDeRecurrence
 * @property {any[]} days Les jours de la semaine retenus.
 * @property {any} endDate Date de fin de la repetition.
 * @property {string} frequency `week` ou `month`.
 * @property {string} intervalText Nombre de periodes, tel que saisi.
 * @property {any} startDate Date a partir de laquelle la repetition court.
 */

/**
 * 🗓️ DATESDABORD (23/10/2026, recette iPhone d'Adel, point 9) — LE BLOC « DATE ET HORAIRE » DE
 * LA CREATION D'EVENEMENT, PARTAGE : la date, le debut, la fin, et la rangee « Repeter » (D09)
 * avec sa feuille (semaine ou mois, tous les N, les jours, du … au …). Sorti tel quel de
 * `EventWizardLogistics` pour qu'« Attribuer un créneau » de la Ville ait LE MEME modele
 * (« il faut vraiment utiliser le même modèle », Adel). Il ne tient que le brouillon de la
 * feuille ; les valeurs appartiennent a l'ecran qui l'affiche (proprietes controlees).
 * Temoins : __tests__/DateEtHoraire.DATESDABORD.test.js, et ceux de l'etape « Date & horaire ».
 * @param {{
 *   date: Date,
 *   debut: Date | null,
 *   fin: Date | null,
 *   finApres?: string | null,
 *   libelleDate?: string | null,
 *   libelleDebut?: string | null,
 *   libelleFin?: string | null,
 *   onDate: (date: Date) => void,
 *   onDebut: (debut: Date) => void,
 *   onFin: (fin: Date) => void,
 *   onRepetition?: (repetition: Omit<Repetition, 'actif'> | null) => void,
 *   pleines?: Array<{ end: number, start: number }>,
 *   repetition?: Repetition | null,
 *   sansRepetition?: boolean,
 *   sousLaDate?: import('react').ReactNode,
 *   webZIndex?: number,
 * }} props - `debut` / `fin` nuls : l heure reste a choisir (« Attribuer ») ; `libelleDate`,
 *   `libelleDebut`, `libelleFin` : les mots de l ecran (« Première date », « Début », « Fin » de
 *   la Ville) ; `finApres` et
 *   `pleines` : les memes reglages que `TimePickerInput` (A7-UX) ;
 *   `onRepetition(null)` revient a « Une seule fois » ; `sousLaDate` : une ligne de l ecran
 *   juste sous la date (« complet … » de la Ville, DATESDABORD 7- B) ; `webZIndex` : la couche de la feuille sur
 *   le site (au-dessus d une fenetre plein ecran, comme la feuille des vacances, R17-QUAND-2-BIS).
 * @returns {import('react').ReactElement} Le bloc.
 */
function DateEtHoraire({
  date,
  debut,
  fin,
  finApres = null,
  libelleDate = null,
  libelleDebut = null,
  libelleFin = null,
  onDate,
  onDebut,
  onFin,
  onRepetition = () => {},
  pleines = undefined,
  repetition = null,
  sansRepetition = false,
  sousLaDate = null,
  webZIndex = undefined,
}) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  const cardSurface = 'rgba(4, 31, 44, 0.82)';
  const cardBorder = 'rgba(1, 179, 244, 0.24)';
  const fieldBorder = 'rgba(1, 179, 244, 0.26)';
  const chipSurface = 'rgba(1, 179, 244, 0.08)';
  const chipBorder = 'rgba(1, 179, 244, 0.24)';
  const intervalControlSurface = 'rgba(1, 179, 244, 0.1)';
  const intervalControlBorder = 'rgba(1, 179, 244, 0.28)';
  // Grammaire d'intertitre du pack : petite capitale espacee, gris clair. La
  // maquette demande 11,5 pt ; la rampe saute de 10 (`p4`) a 12 (`p3`) — on
  // prend le VOISIN plutot qu'une taille en dur qu'aucune porte ne verrait.
  const intertitreStyle = [Fonts.p3Bold, Fonts.neutral300, { letterSpacing: 1 }];

  const isRecurrent = Boolean(repetition?.actif);
  const recurrenceFrequency = repetition?.frequence || 'week';
  const recurrenceInterval = intervalleLu(repetition?.intervalleTexte || 1);
  const recurrenceIntervalLabel = useMemo(
    () => buildRecurrenceIntervalLabel(t, recurrenceFrequency, recurrenceInterval),
    [recurrenceFrequency, recurrenceInterval, t],
  );

  // D09 — la recurrence se replie dans une feuille du bas. Elle s'y edite sur un
  // BROUILLON : sortir par le fond ou par le geste ne doit RIEN enregistrer.
  // Seul « Appliquer » ecrit, seul « Ne pas repeter » eteint.
  const [isRecurrenceSheetOpen, setIsRecurrenceSheetOpen] = useState(false);
  const [recurrenceDraft, setRecurrenceDraft] = useState(
    /** @type {BrouillonDeRecurrence | null} */ (null),
  );
  const draftInterval = intervalleLu(recurrenceDraft?.intervalText);
  const draftIntervalLabel = useMemo(
    () => buildRecurrenceIntervalLabel(t, recurrenceDraft?.frequency || 'week', draftInterval),
    [draftInterval, recurrenceDraft?.frequency, t],
  );
  const canDecreaseRecurrenceInterval = draftInterval > MIN_RECURRENCE_INTERVAL;

  const intervalAdjustButtonStyle = (/** @type {boolean} */ isEnabled) => ([
    ApplicationStyle.card,
    Alignments.alignCenter,
    Alignments.justifyCenter,
    {
      backgroundColor: isEnabled ? 'rgba(1, 179, 244, 0.16)' : 'rgba(1, 179, 244, 0.08)',
      borderColor: intervalControlBorder,
      borderRadius: 14,
      height: 46,
      opacity: isEnabled ? 1 : 0.45,
      width: 46,
    },
  ]);

  const patchRecurrenceDraft = (/** @type {Partial<BrouillonDeRecurrence>} */ partialUpdate) => {
    setRecurrenceDraft((current) => (current ? { ...current, ...partialUpdate } : current));
  };

  const handleDecreaseRecurrenceInterval = () => {
    patchRecurrenceDraft({
      intervalText: String(Math.max(MIN_RECURRENCE_INTERVAL, draftInterval - 1)),
    });
  };

  const handleIncreaseRecurrenceInterval = () => {
    patchRecurrenceDraft({ intervalText: String(draftInterval + 1) });
  };

  /**
   * Ouvre la feuille sur une COPIE des valeurs enregistrees.
   *
   * Le jour de base est seme ici quand aucun n'est encore choisi : c'est ce que
   * faisait deja l'effet qui suit l'allumage de la recurrence, on le rend
   * simplement visible des l'ouverture.
   */
  const handleOpenRecurrenceSheet = () => {
    const baseStartDate = repetition?.du ? new Date(repetition.du) : new Date(date);
    const jours = Array.isArray(repetition?.jours) ? repetition.jours : [];
    setRecurrenceDraft({
      days: jours.length > 0 ? jours : [date.getDay()],
      endDate: repetition?.au
        ? new Date(repetition.au)
        : buildDefaultRecurrenceEndDate(baseStartDate, recurrenceFrequency, recurrenceInterval),
      frequency: recurrenceFrequency,
      intervalText: repetition?.intervalleTexte || '1',
      startDate: baseStartDate,
    });
    setIsRecurrenceSheetOpen(true);
  };

  /** Enregistre le brouillon et allume la recurrence. Le SEUL chemin d'ecriture. */
  const handleApplyRecurrence = () => {
    if (!recurrenceDraft) return;
    onRepetition({
      au: recurrenceDraft.endDate,
      du: recurrenceDraft.startDate,
      frequence: recurrenceDraft.frequency,
      intervalleTexte: recurrenceDraft.intervalText,
      jours: recurrenceDraft.days,
    });
    setIsRecurrenceSheetOpen(false);
  };

  /** Revient a « une seule fois ». Les valeurs saisies restent, elles ne servent plus. */
  const handleClearRecurrence = () => {
    onRepetition(null);
    setIsRecurrenceSheetOpen(false);
  };

  return (
    <View style={[Spaces.gap[12]]}>
      <Text style={intertitreStyle}>
        {t('eventWizard.steps.logistics.dateTimeGroupLabel', 'DATE ET HORAIRE')}
      </Text>

      <DatePickerInput
        label={libelleDate || t('eventEdit.fields.date.label')}
        minimumDate={new Date()}
        onChange={(/** @type {string} */ text) => onDate(mergeDateInput(text, date))}
        value={toDateInputText(date)}
      />
      {sousLaDate}

      <View style={[Alignments.row, Spaces.gap[12]]}>
        <View style={{ flex: 1 }}>
          <TimePickerInput
            label={libelleDebut || t('eventEdit.fields.startTime.label')}
            onChange={(/** @type {string} */ text) => onDebut(mergeTimeInput(text, debut || date))}
            pleines={pleines}
            value={debut ? toTimeInputText(debut) : ''}
          />
        </View>
        <View style={{ flex: 1 }}>
          <TimePickerInput
            apres={finApres}
            label={libelleFin || t('eventEdit.fields.endTime.label')}
            onChange={(/** @type {string} */ text) => onFin(mergeTimeInput(text, fin || date))}
            value={fin ? toTimeInputText(fin) : ''}
          />
        </View>
      </View>

      {/* D09 — « Repeter » est une RANGEE-VALEUR a chevron, pas un
          interrupteur : un switch qui ouvre une fenetre serait
          incoherent. La valeur reste lisible sans ouvrir la feuille, et
          le defaut est « Une seule fois ». */}
      {!sansRepetition ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ expanded: isRecurrenceSheetOpen }}
          activeOpacity={0.85}
          onPress={handleOpenRecurrenceSheet}
          style={[
            ApplicationStyle.card,
            Spaces.paddingHorizontal[16],
            Alignments.row,
            Alignments.alignCenter,
            {
              backgroundColor: cardSurface,
              borderColor: cardBorder,
              borderRadius: 16,
              columnGap: 12,
              minHeight: 56,
            },
          ]}
          testID="date-et-horaire-repeter"
        >
          <Text style={[Fonts.p1Bold, Fonts.neutral00, { flex: 1 }]}>
            {t('eventWizard.steps.logistics.repeatRowLabel', 'Répéter')}
          </Text>
          <Text style={[Fonts.p3Bold, Fonts.neutral300]}>
            {isRecurrent
              ? recurrenceIntervalLabel
              : t('eventWizard.steps.logistics.repeatRowOnce', 'Une seule fois')}
          </Text>
          <Image
            source={Images.chevronDown}
            style={{
              height: 16,
              tintColor: Colors.neutral600,
              transform: [{ rotate: '-90deg' }],
              width: 16,
            }}
          />
        </TouchableOpacity>
      ) : null}

      {/* D09 — la recurrence a quitte la page pour une feuille du bas :
          l'etape ne s'allonge plus jamais. Les champs sont les MEMES, le
          defaut reste « une seule fois ». */}
      {!sansRepetition && recurrenceDraft ? (
        <BottomModal
          close={() => setIsRecurrenceSheetOpen(false)}
          footerComponent={(
            <View style={[Spaces.gap[8]]}>
              <Button
                onPress={handleApplyRecurrence}
                title={t('eventWizard.steps.logistics.repeatApply', 'Appliquer')}
                variant="Primary"
              />
              <TouchableOpacity
                accessibilityRole="button"
                onPress={handleClearRecurrence}
                style={Spaces.paddingVertical[12]}
              >
                <Text style={[Fonts.p2Bold, Fonts.neutral200, Fonts.textCenter]}>
                  {t('eventWizard.steps.logistics.repeatClear', 'Ne pas répéter')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          headerComponent={(
            <Text style={[Fonts.h4Black, Fonts.neutral00]}>
              {t('eventWizard.steps.logistics.repeatSheetTitle', "Répéter l'événement")}
            </Text>
          )}
          isVisible={isRecurrenceSheetOpen}
          snapPoints={RECURRENCE_SHEET_SNAP_POINTS}
          // `webZIndex` n'existe que sur le site (BottomModal.web.js).
          {.../** @type {any} */ ({ webZIndex })}
        >
          <View style={[Spaces.gap[16]]}>
            <View style={[Spaces.gap[8]]}>
              <Text style={intertitreStyle}>
                {t('eventEdit.fields.recurrenceFrequency.label')}
              </Text>
              <View style={[Alignments.row, Spaces.gap[12]]}>
                {['week', 'month'].map((value) => {
                  const selected = recurrenceDraft.frequency === value;
                  return (
                    <TouchableOpacity
                      key={value}
                      onPress={() => patchRecurrenceDraft({ frequency: value })}
                      style={[
                        ApplicationStyle.card,
                        Spaces.paddingVertical[8],
                        Spaces.paddingHorizontal[16],
                        {
                          backgroundColor: selected
                            ? withAlpha(Colors.primary500, 0.16)
                            : chipSurface,
                          borderColor: selected ? Colors.primary500 : chipBorder,
                        },
                      ]}
                    >
                      <Text style={[Fonts.p2Bold, selected ? Fonts.primary100 : Fonts.neutral100]}>
                        {value === 'week'
                          ? t('eventEdit.fields.recurrenceFrequency.options.week')
                          : t('eventEdit.fields.recurrenceFrequency.options.month')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={[Spaces.gap[8]]}>
              <Text style={intertitreStyle}>
                {t('eventWizard.steps.logistics.recurrenceInterval')}
              </Text>
              <View
                style={[
                  ApplicationStyle.card,
                  Spaces.padding[12],
                  Alignments.row,
                  Alignments.alignCenter,
                  Alignments.justifySpaceBetween,
                  { backgroundColor: intervalControlSurface, borderColor: fieldBorder },
                ]}
              >
                <TouchableOpacity
                  accessibilityLabel={t(
                    'eventWizard.steps.logistics.recurrenceIntervalDecrement',
                    "Reduire l'intervalle de récurrence",
                  )}
                  disabled={!canDecreaseRecurrenceInterval}
                  onPress={handleDecreaseRecurrenceInterval}
                  style={intervalAdjustButtonStyle(canDecreaseRecurrenceInterval)}
                >
                  <Text style={[Fonts.h3, Fonts.primary500]}>-</Text>
                </TouchableOpacity>

                <View style={[
                  Alignments.alignCenter,
                  Spaces.gap[4],
                  { flex: 1 },
                  Spaces.paddingHorizontal[12],
                ]}
                >
                  <Text style={[Fonts.h2, Fonts.neutral00, { textAlign: 'center' }]}>
                    {draftInterval}
                  </Text>
                  <Text style={[Fonts.p3, Fonts.neutral200, { textAlign: 'center' }]}>
                    {draftIntervalLabel}
                  </Text>
                </View>

                <TouchableOpacity
                  accessibilityLabel={t(
                    'eventWizard.steps.logistics.recurrenceIntervalIncrement',
                    "Augmenter l'intervalle de récurrence",
                  )}
                  onPress={handleIncreaseRecurrenceInterval}
                  style={intervalAdjustButtonStyle(true)}
                >
                  <Text style={[Fonts.h3, Fonts.primary500]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {recurrenceDraft.frequency === 'week' ? (
              <View style={[Spaces.gap[8]]}>
                <Text style={intertitreStyle}>
                  {t('eventWizard.steps.logistics.recurrenceDays')}
                </Text>
                <DayPicker
                  onChange={(/** @type {any[]} */ days) => patchRecurrenceDraft({ days })}
                  selectedDays={recurrenceDraft.days}
                />
                <Text style={[Fonts.p3, Fonts.neutral300]}>
                  {t(
                    'eventWizard.steps.logistics.recurrenceBaseDayHint',
                    "Le jour de l'événement est présélectionné. Tu peux ajouter d'autres jours.",
                  )}
                </Text>
              </View>
            ) : null}

            {/* ⚠️ Le pack ne montre que « Jusqu'au ». La date de DEBUT est
                conservee : elle est saisissable aujourd'hui et alimente
                `recurrenceStartDate`. La retirer supprimerait une donnee,
                pas un ornement. */}
            <DatePickerInput
              label={t('eventEdit.fields.recurrenceStartDate.label')}
              onChange={(/** @type {string} */ text) => patchRecurrenceDraft({
                startDate: mergeDateInput(text, recurrenceDraft.startDate || new Date()),
              })}
              value={toDateInputText(recurrenceDraft.startDate || new Date())}
            />
            <DatePickerInput
              label={t('eventEdit.fields.recurrenceEndDate.label')}
              onChange={(/** @type {string} */ text) => patchRecurrenceDraft({
                endDate: mergeDateInput(text, recurrenceDraft.endDate || new Date()),
              })}
              value={toDateInputText(recurrenceDraft.endDate || new Date())}
            />
          </View>
        </BottomModal>
      ) : null}
    </View>
  );
}

export default DateEtHoraire;
