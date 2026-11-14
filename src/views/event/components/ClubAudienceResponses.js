import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import {
  CLUB_AUDIENCE_ALL,
  countClubAudienceRows,
  filterClubAudienceRows,
  getClubRelanceState,
  sortClubAudienceRows,
} from '@/domains/event/clubAudience';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Input from '@/components/molecules/input/Input';

import { useGetEventClubAudience } from '@/services/event/eventQueries';
import { remindClubAudience } from '@/services/event/eventService';

const heureDe = (/** @type {string|null} */ iso) => {
  if (!iso) return '';
  const instant = new Date(iso);
  return Number.isFinite(instant.getTime()) ? format(instant, 'HH:mm') : '';
};
const jourDe = (/** @type {string|null} */ iso) => {
  if (!iso) return '';
  const instant = new Date(iso);
  return Number.isFinite(instant.getTime()) ? format(instant, 'dd/MM') : '';
};
const initiales = (/** @type {any} */ row) => (
  String(row?.firstname || '').charAt(0) + String(row?.lastInitial || '').charAt(0)
).toUpperCase();

/**
 * EVT-CLUB-ECRANS (14/11/2026, D121) — la fiche du DIRIGEANT pour un evenement « tout le club »
 * (maquette v2, ecrans 4a / 4b / 4c ; ecran 5b sur le site avec `layout="table"`).
 * UNE liste (Q12 B), 4 compteurs qui filtrent, les filtres Age / Section / Equipe (+ Sport dans un
 * omnisports, R5 C), et « Relancer les N sans reponse » (Q13) : confirmation chiffree, relance de
 * ce
 * qui est AFFICHE, grise 24 h (R3 A), absente quand l'evenement a commence ou sans sans reponse.
 * Le parent ne la monte que pour le dirigeant (Q1 A / Q10 B) ; le serveur rend 403 sinon.
 * Les lignes ne portent ni age exact ni date de naissance (R4 A) : une tranche, calculee au
 * serveur.
 * @param {object} props Proprietes.
 * @param {any} props.event L'evenement « tout le club ».
 * @param {'list' | 'table'} [props.layout] `table` sur l'ordinateur (colonnes, recherche).
 * @returns {import('react').ReactElement} Le bloc des reponses du club.
 */
function ClubAudienceResponses({ event, layout = 'list' }) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const eventId = String(event?.documentId || '');
  const { data, error, isLoading } = useGetEventClubAudience(eventId);
  /** @type {Record<string, string>} */
  const filtresDeDepart = { ...CLUB_AUDIENCE_ALL };
  const [filters, setFilters] = useState(filtresDeDepart);
  const [openFilter, setOpenFilter] = useState(/** @type {string|null} */ (null));
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isReminding, setIsReminding] = useState(false);
  const [remindMessage, setRemindMessage] = useState('');
  const isTable = layout === 'table';

  const rows = useMemo(() => sortClubAudienceRows(data?.rows || []), [data?.rows]);
  const displayed = useMemo(() => filterClubAudienceRows(rows, filters), [rows, filters]);
  const counts = useMemo(() => countClubAudienceRows(rows, filters), [rows, filters]);
  const relance = getClubRelanceState(data?.relance || null, displayed);
  const isFiltered = Object.keys(CLUB_AUDIENCE_ALL).some(
    (key) => filters[key] !== /** @type {Record<string, string>} */ (CLUB_AUDIENCE_ALL)[key],
  );
  const keyRows = displayed.filter((row) => relance.keys.includes(String(row?.key)));
  const remindsParentsOnly = keyRows.length > 0 && keyRows.every((row) => row?.kind === 'child');

  /** @type {Record<string, string>} */
  const AGE_LABELS = {
    adult: t('eventClubAudience.ageAdult', 'Adultes'),
    teen: t('eventClubAudience.ageTeen', '13 à 17 ans'),
    under13: t('eventClubAudience.ageUnder13', 'Moins de 13 ans'),
    unknown: t('eventClubAudience.ageUnknown', 'Âge non renseigné'),
  };
  /** @type {Record<string, string>} */
  const SECTION_LABELS = {
    feminine: t('eventClubAudience.sectionFeminine', 'Féminine'),
    masculine: t('eventClubAudience.sectionMasculine', 'Masculine'),
  };
  /** @type {Record<string, string>} */
  const ANSWER_LABELS = {
    absent: t('eventClubAudience.answerAbsent', 'Absent'),
    none: t('eventClubAudience.answerNone', 'Sans réponse'),
    present: t('eventClubAudience.answerPresent', 'Présent'),
  };
  const allMasc = t('eventClubAudience.allMasculine', 'tous');
  const allFem = t('eventClubAudience.allFeminine', 'toutes');
  const noTeam = t('eventClubAudience.noTeam', 'Sans équipe');

  const teamOptions = useMemo(() => {
    const seen = new Map();
    rows.forEach((row) => {
      const id = String(row?.team?.documentId || '');
      if (id && !seen.has(id)) seen.set(id, String(row?.team?.name || ''));
    });
    return [...seen.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ label, value }));
  }, [rows]);
  const sportOptions = useMemo(
    () => [...new Set(rows.map((row) => row?.sport).filter(Boolean))]
      .sort()
      .map((value) => ({ label: value, value })),
    [rows],
  );

  const FILTERS = [
    {
      allLabel: allMasc,
      key: 'age',
      label: t('eventClubAudience.filterAge', 'Âge'),
      options: ['under13', 'teen', 'adult', 'unknown'].map((value) => ({
        label: AGE_LABELS[value],
        short:
          value === 'under13'
            ? t('eventClubAudience.ageUnder13Short', '-13 ans')
            : AGE_LABELS[value],
        value,
      })),
    },
    {
      allLabel: allFem,
      key: 'section',
      label: t('eventClubAudience.filterSection', 'Section'),
      options: ['feminine', 'masculine'].map((value) => ({ label: SECTION_LABELS[value], value })),
    },
    {
      allLabel: allFem,
      key: 'team',
      label: t('eventClubAudience.filterTeam', 'Équipe'),
      options: [...teamOptions, { label: noTeam, value: 'none' }],
    },
    ...(data?.multisport
      ? [
        {
          allLabel: allMasc,
          key: 'sport',
          label: t('eventClubAudience.filterSport', 'Sport'),
          options: sportOptions,
        },
      ]
      : []),
  ];

  const setFilter = (/** @type {string} */ key, /** @type {string} */ value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const rowSubtitle = (/** @type {any} */ row) => {
    const parts = [row?.team?.name || noTeam];
    if (row?.isCoach || row?.kind === 'coach') {
      parts.push(t('eventClubAudience.coach', 'entraîneur'));
    } else if (row?.section && SECTION_LABELS[row.section]) {
      parts.push(SECTION_LABELS[row.section]);
    }
    if (row?.kind === 'child') parts.push(t('eventClubAudience.byParent', 'réponse de son parent'));
    if (!row?.answer && row?.remindedAt) {
      parts.push(
        t('eventClubAudience.remindedAt', {
          defaultValue: 'relancé à {{time}}',
          time: heureDe(row.remindedAt),
        }),
      );
    }
    return parts.join(' · ');
  };
  const answerOf = (/** @type {any} */ row) => (
    row?.answer === 'present' || row?.answer === 'absent' ? row.answer : 'none'
  );
  const answerColor = (/** @type {string} */ answer) => {
    if (answer === 'present') return Colors.success500;
    if (answer === 'absent') return Colors.error500;
    return Colors.neutral300;
  };

  const handleRemind = async () => {
    setIsConfirmOpen(false);
    setIsReminding(true);
    setRemindMessage('');
    try {
      const report = await remindClubAudience({ eventId, keys: relance.keys });
      setRemindMessage(
        t('eventClubAudience.remindDone', {
          count: report?.remindedCount || 0,
          defaultValue: '{{count}} personnes relancées.',
        }),
      );
      await queryClient.invalidateQueries({ queryKey: ['event-club-audience', eventId] });
    } catch (_error) {
      setRemindMessage(
        t('eventClubAudience.remindError', 'La relance n’est pas partie. Réessaie.'),
      );
    } finally {
      setIsReminding(false);
    }
  };

  const surface = {
    backgroundColor: Colors.primary700,
    borderColor: withAlpha(Colors.primary500, 0.24),
    borderWidth: 1,
  };

  if (isLoading) {
    return (
      <View style={[ApplicationStyle.card, Spaces.padding[16], surface]}>
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t('eventClubAudience.loading', 'Chargement des réponses du club…')}
        </Text>
      </View>
    );
  }
  if (error || !data) {
    return (
      <View style={[ApplicationStyle.card, Spaces.padding[16], surface]}>
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t('eventClubAudience.error', 'Impossible de charger les réponses du club.')}
        </Text>
      </View>
    );
  }

  const renderCounter = (
    /** @type {string} */ answer,
    /** @type {number} */ count,
    /** @type {string} */ label,
  ) => {
    const active = filters.answer === answer;
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        key={answer}
        onPress={() => setFilter('answer', active && answer !== 'all' ? 'all' : answer)}
        style={[
          Spaces.paddingVertical[8],
          Spaces.paddingHorizontal[12],
          {
            backgroundColor: active ? Colors.primary500 : withAlpha(Colors.primary500, 0.1),
            borderRadius: 14,
            flexBasis: isTable ? 0 : '22%',
            flexGrow: 1,
            minWidth: 72,
          },
        ]}
        testID={`club-audience-count:${answer}`}
      >
        <Text style={[Fonts.h4Bold, { color: active ? Colors.neutral900 : Colors.neutral00 }]}>
          {String(count)}
        </Text>
        <Text style={[Fonts.p4, { color: active ? Colors.neutral900 : Colors.neutral200 }]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderFilterPill = (/** @type {any} */ filter) => {
    const value = filters[filter.key];
    const active = value !== 'all';
    const option = filter.options.find((/** @type {any} */ item) => item.value === value);
    return (
      <View
        key={filter.key}
        style={[
          Alignments.row,
          Alignments.alignCenter,
          {
            backgroundColor: active ? Colors.primary500 : 'transparent',
            borderColor: Colors.primary500,
            borderRadius: 999,
            borderWidth: 1,
            columnGap: 6,
            paddingHorizontal: 12,
            paddingVertical: 6,
          },
        ]}
      >
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => setOpenFilter(filter.key)}
          style={[Alignments.row, { columnGap: 6 }]}
          testID={`club-audience-filter:${filter.key}`}
        >
          <Text style={[Fonts.p3Bold, { color: active ? Colors.neutral900 : Colors.primary500 }]}>
            {filter.label}
          </Text>
          <Text style={[Fonts.p3, { color: active ? Colors.neutral900 : Colors.neutral200 }]}>
            {active ? option?.short || option?.label || '' : filter.allLabel}
          </Text>
        </TouchableOpacity>
        {active ? (
          <TouchableOpacity
            accessibilityLabel={t('eventClubAudience.clearFilters', 'Tout effacer')}
            accessibilityRole="button"
            onPress={() => setFilter(filter.key, 'all')}
            testID={`club-audience-filter-clear:${filter.key}`}
          >
            <Text style={[Fonts.p3Bold, { color: Colors.neutral900 }]}>×</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  const openedFilter = FILTERS.find((filter) => filter.key === openFilter) || null;

  const renderRow = (/** @type {any} */ row) => {
    const answer = answerOf(row);
    const name = `${row?.firstname || ''} ${row?.lastInitial ? `${row.lastInitial}.` : ''}`.trim();
    if (isTable) {
      return (
        <View
          key={row.key}
          style={[
            Alignments.row,
            Alignments.alignCenter,
            Spaces.paddingVertical[8],
            {
              borderBottomColor: withAlpha(Colors.neutral00, 0.06),
              borderBottomWidth: 1,
              columnGap: 12,
            },
          ]}
          testID={`club-audience-row:${row.key}`}
        >
          <View style={{ flex: 3, minWidth: 0 }}>
            <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00]}>
              {name}
            </Text>
            {row?.kind === 'child' || row?.isCoach ? (
              <Text style={[Fonts.p4, Fonts.neutral300]}>
                {row?.isCoach
                  ? t('eventClubAudience.coach', 'entraîneur')
                  : t('eventClubAudience.byParent', 'réponse de son parent')}
              </Text>
            ) : null}
          </View>
          <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral100, { flex: 2 }]}>
            {row?.team?.name || noTeam}
          </Text>
          <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral100, { flex: 2 }]}>
            {row?.ageBracket === 'adult'
              ? t('eventClubAudience.ageAdultOne', 'Adulte')
              : AGE_LABELS[row?.ageBracket] || AGE_LABELS.unknown}
          </Text>
          <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral100, { flex: 2 }]}>
            {SECTION_LABELS[row?.section] || '—'}
          </Text>
          <Text numberOfLines={1} style={[Fonts.p3Bold, { color: answerColor(answer), flex: 2 }]}>
            {ANSWER_LABELS[answer]}
          </Text>
        </View>
      );
    }
    return (
      <View
        key={row.key}
        style={[
          Alignments.row,
          Alignments.alignCenter,
          Spaces.paddingVertical[8],
          { columnGap: 12 },
        ]}
        testID={`club-audience-row:${row.key}`}
      >
        <View
          style={[
            Alignments.center,
            {
              backgroundColor: withAlpha(Colors.primary500, 0.16),
              borderRadius: 18,
              height: 36,
              width: 36,
            },
          ]}
        >
          <Text style={[Fonts.p3Bold, Fonts.primary500]}>{initiales(row)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00]}>
            {name}
          </Text>
          <Text numberOfLines={2} style={[Fonts.p4, Fonts.neutral300]}>
            {rowSubtitle(row)}
          </Text>
        </View>
        <Text style={[Fonts.p3Bold, { color: answerColor(answer) }]}>{ANSWER_LABELS[answer]}</Text>
      </View>
    );
  };

  const remindTitle = relance.waiting
    ? t('eventClubAudience.remindWaiting', {
      defaultValue: 'Relancé à {{time}}',
      time: heureDe(relance.lastRemindedAt),
    })
    : t(isFiltered ? 'eventClubAudience.remindCtaFiltered' : 'eventClubAudience.remindCta', {
      count: relance.keys.length,
      defaultValue: isFiltered
        ? 'Relancer les {{count}} sans réponse affichés'
        : 'Relancer les {{count}} sans réponse',
    });
  const remindBlock = relance.visible ? (
    <View style={[Spaces.gap[4]]}>
      <Button
        disabled={relance.waiting || isReminding}
        isLoading={isReminding}
        onPress={() => setIsConfirmOpen(true)}
        title={remindTitle}
        variant="Primary"
      />
      {relance.waiting ? (
        <Text style={[Fonts.p4, Fonts.neutral300]}>
          {t('eventClubAudience.remindWaitingHint', {
            date: jourDe(relance.nextReminderAt),
            defaultValue:
              'Nouvelle relance possible le {{date}} à {{time}}, '
              + 'pour ceux qui n’auront toujours pas répondu.',
            time: heureDe(relance.nextReminderAt),
          })}
        </Text>
      ) : null}
      {!relance.waiting && remindsParentsOnly ? (
        <Text style={[Fonts.p4, Fonts.neutral300]}>
          {t('eventClubAudience.remindParentsHint', 'Ce sont leurs parents qui sont relancés.')}
        </Text>
      ) : null}
    </View>
  ) : null;

  return (
    <View
      style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[12], surface]}
      testID="event-club-audience-responses"
    >
      <View
        style={[
          Alignments.row,
          Alignments.justifySpaceBetween,
          Alignments.alignCenter,
          { columnGap: 12, flexWrap: 'wrap', rowGap: 8 },
        ]}
      >
        <Text style={[Fonts.p3Bold, Fonts.neutral300, { letterSpacing: 1 }]}>
          {t('eventClubAudience.listTitle', 'LES RÉPONSES DU CLUB')}
        </Text>
        {isTable ? remindBlock : null}
      </View>

      <View style={[Alignments.row, { columnGap: 8, flexWrap: 'wrap', rowGap: 8 }]}>
        {renderCounter('all', counts.all, t('eventClubAudience.countAll', 'tous'))}
        {renderCounter('present', counts.present, t('eventClubAudience.countPresent', 'présents'))}
        {renderCounter('absent', counts.absent, t('eventClubAudience.countAbsent', 'absents'))}
        {renderCounter(
          'unanswered',
          counts.unanswered,
          t('eventClubAudience.countUnanswered', 'sans réponse'),
        )}
      </View>

      {isTable ? (
        <Input
          density="compact"
          icon="search"
          onChangeText={(value) => setFilter('search', value)}
          placeholder={t('eventClubAudience.searchPlaceholder', 'Rechercher un nom')}
          value={filters.search}
        />
      ) : null}

      <View style={[Alignments.row, { columnGap: 8, flexWrap: 'wrap', rowGap: 8 }]}>
        {FILTERS.map(renderFilterPill)}
      </View>

      <View style={[Alignments.row, Alignments.alignCenter, { columnGap: 8 }]}>
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {isFiltered
            ? t('eventClubAudience.filteredCount', {
              count: displayed.length,
              defaultValue: '{{count}} sur {{total}}',
              total: rows.length,
            })
            : t('eventClubAudience.peopleCount', {
              count: rows.length,
              defaultValue: '{{count}} personnes · ordre alphabétique',
            })}
        </Text>
        {isFiltered ? (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setFilters({ ...CLUB_AUDIENCE_ALL })}
            testID="club-audience-clear"
          >
            <Text style={[Fonts.p3Bold, Fonts.primary500]}>
              {t('eventClubAudience.clearFilters', 'Tout effacer')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {isTable ? (
        <View style={[Alignments.row, Spaces.paddingVertical[4], { columnGap: 12 }]}>
          <Text style={[Fonts.p4Bold, Fonts.neutral300, { flex: 3 }]}>
            {t('eventClubAudience.columnName', 'NOM')}
          </Text>
          <Text style={[Fonts.p4Bold, Fonts.neutral300, { flex: 2 }]}>
            {t('eventClubAudience.columnTeam', 'ÉQUIPE')}
          </Text>
          <Text style={[Fonts.p4Bold, Fonts.neutral300, { flex: 2 }]}>
            {t('eventClubAudience.columnAge', 'ÂGE')}
          </Text>
          <Text style={[Fonts.p4Bold, Fonts.neutral300, { flex: 2 }]}>
            {t('eventClubAudience.columnSection', 'SECTION')}
          </Text>
          <Text style={[Fonts.p4Bold, Fonts.neutral300, { flex: 2 }]}>
            {t('eventClubAudience.columnAnswer', 'RÉPONSE')}
          </Text>
        </View>
      ) : null}

      <View>{displayed.map(renderRow)}</View>

      {remindMessage ? <Text style={[Fonts.p3Bold, Fonts.neutral100]}>{remindMessage}</Text> : null}
      {isTable ? null : remindBlock}

      {openedFilter ? (
        <BottomModal
          close={() => setOpenFilter(null)}
          isVisible
          scrollable={false}
          webPresentation="dialog"
        >
          <View style={[Spaces.paddingTop[24], Spaces.paddingBottom[24], Spaces.gap[8]]}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{openedFilter.label}</Text>
            {[{ label: openedFilter.allLabel, value: 'all' }, ...openedFilter.options].map(
              (option) => {
                const selected = filters[openedFilter.key] === option.value;
                return (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={option.value}
                    onPress={() => {
                      setFilter(openedFilter.key, option.value);
                      setOpenFilter(null);
                    }}
                    style={[Spaces.paddingVertical[12]]}
                    testID={`club-audience-option:${openedFilter.key}:${option.value}`}
                  >
                    <Text style={[Fonts.p2, selected ? Fonts.primary500 : Fonts.neutral00]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              },
            )}
          </View>
        </BottomModal>
      ) : null}

      {isConfirmOpen ? (
        <BottomModal
          close={() => setIsConfirmOpen(false)}
          isVisible
          scrollable={false}
          webPresentation="dialog"
        >
          <View style={[Spaces.paddingTop[24], Spaces.paddingBottom[24], Spaces.gap[16]]}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
              {t('eventClubAudience.remindConfirmTitle', {
                count: relance.keys.length,
                defaultValue: 'Relancer {{count}} personnes ?',
              })}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t('eventClubAudience.remindConfirmBody', {
                defaultValue: 'Elles recevront : « Tu n’as pas encore répondu pour {{name}}. »',
                name: event?.customName || event?.name || '',
                ...SANS_ECHAPPEMENT,
              })}
            </Text>
            <View style={[Spaces.gap[12]]}>
              <Button
                onPress={handleRemind}
                title={t('eventClubAudience.remindConfirmCta', 'Relancer')}
                variant="Primary"
              />
              <Button
                onPress={() => setIsConfirmOpen(false)}
                title={t('eventClubAudience.cancel', 'Annuler')}
                variant="Secondary"
              />
            </View>
          </View>
        </BottomModal>
      ) : null}
    </View>
  );
}

export default ClubAudienceResponses;
