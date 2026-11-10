import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, Text, TextInput, TouchableOpacity, View,
} from 'react-native';

import {
  CUSTOM_FORMAT,
  CUSTOM_LIMITS,
  formatDurationLabel,
  getFormatLabel,
  getSportFormats,
  isSameDuration,
  parseVersusCode,
  PRECISION_MAX_LENGTH,
} from '@/domains/search/friendlyMatchFormats';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import ChoiceChipGroup from '@/components/molecules/choiceChipGroup/ChoiceChipGroup';
import InputStepper from '@/components/molecules/inputStepper/InputStepper';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useFriendlyMatchWizard } from './FriendlyMatchWizardContext';
import {
  buildFriendlyMatchAdPayload,
  getFriendlyMatchWizardStepCount,
  getFriendlyMatchWizardStepIndex,
  getFriendlyMatchWizardStepIssue,
} from './friendlyMatchWizardSteps';

const OTHER_DURATION = 'other';
const DEFAULT_MINUTES_DURATION = { minutes: 30, periods: 2 };
const DEFAULT_SETS_DURATION = { sets: 3, setsMode: 'win' };

/** Le petit repere de la carte : le nombre de joueurs, ou l abreviation du nom court. */
const PICTO_BY_CODE = /** @type {Record<string, string>} */ ({
  '3x3': '3',
  '6v6-salle': '6',
  double: '2',
  futsal: 'F',
  glace: '5',
  roller: '4',
  simple: '1',
  VII: '7',
  X: 'X',
  XIII: 'XIII',
  XV: 'XV',
});

/**
 * Le repere affiche dans la tuile de la carte.
 * @param {string} code
 * @returns {string}
 */
const getPicto = (code) => {
  const versus = parseVersusCode(code);
  return versus ? String(versus.us) : PICTO_BY_CODE[code] || code.slice(0, 2);
};

/**
 * Le nom du sport, que l equipe le porte en objet (`activities[0]`) ou en texte (`sport`).
 * @param {any} activity
 * @returns {string}
 */
const getSportName = (activity) => (
  typeof activity === 'string' ? activity : String(activity?.name || '')
).trim();

/**
 * Une valeur ramenee dans ses bornes.
 * @param {number} value
 * @param {{ min: number, max: number }} limits
 * @returns {number}
 */
const clamp = (value, limits) => Math.min(limits.max, Math.max(limits.min, value));

/**
 * Etape 2/8 — « Quel format ? » (AMICAUX-FORMAT, maquette validee par Adel le 10/11/2026).
 *
 * Les formats proposes sont ceux du SPORT de l equipe choisie a l etape 1 : une
 * carte par format, avec sa duree habituelle. Choisir un format coche cette duree
 * (le reducteur la pose) ; les autres durees courantes sont en pastilles, plus
 * « Autre durée ». « Personnalisé » est toujours la derniere carte : X contre Y,
 * une duree en minutes ou en sets, et une precision libre. Un sport hors
 * catalogue n affiche que lui — rien n est jamais bloque.
 * @param {{ navigation: any }} props
 * @returns {import('react').ReactElement}
 */
function FriendlyMatchWizardFormat({ navigation }) {
  const {
    Alignments, Colors, Fonts, Images, Spaces,
  } = /** @type {any} */ (useTheme());
  const { dispatch, state } = useFriendlyMatchWizard();
  const { t } = useTranslation();

  const sportName = getSportName(state.activity);
  const formats = useMemo(() => getSportFormats(sportName), [sportName]);
  const selected = formats.find((format) => format.code === state.format) || null;
  const isCustom = state.format === CUSTOM_FORMAT;
  const custom = state.formatCustom || { them: 7, us: 7 };
  const duration = state.formatDuration || null;
  const issue = getFriendlyMatchWizardStepIssue('format', state);

  // « Autre durée » s ouvre d elle-meme quand la duree du brouillon n est pas
  // une des pastilles (brouillon recharge sur le site, par exemple).
  const listedIndex = selected
    ? selected.durations.findIndex((item) => isSameDuration(item, duration))
    : -1;
  const [isOtherDuration, setIsOtherDuration] = useState(Boolean(selected) && listedIndex < 0);
  const showDurationEditor = isCustom
    || (Boolean(selected) && (isOtherDuration || listedIndex < 0));
  const isSetsDuration = duration?.sets !== undefined;

  // Fonds calcules hors rendu : `verify:theme-contract` (voir FriendlyMatchWizardHosting).
  const selectedSurface = withAlpha(Colors.primary500, 0.08);
  const restingSurface = withAlpha(Colors.primary900, 0.66);
  const restingBorder = withAlpha(Colors.neutral00, 0.12);
  const tileSurface = withAlpha(Colors.primary500, 0.12);
  const mutedInk = withAlpha(Colors.neutral100, 0.63);
  const blockStyle = [
    Spaces.gap[8],
    Spaces.padding[12],
    { backgroundColor: withAlpha(Colors.primary900, 0.66), borderRadius: 16 },
  ];

  const setDuration = (/** @type {any} */ next) => dispatch({
    payload: next,
    type: 'SET_FORMAT_DURATION',
  });

  /**
   * Fait avancer un compteur de la duree, dans ses bornes.
   * @param {'minutes' | 'periods' | 'sets'} key
   * @param {number} delta
   * @returns {void}
   */
  const stepDuration = (key, delta) => {
    const base = duration || DEFAULT_MINUTES_DURATION;
    const current = Number(base[key] ?? DEFAULT_MINUTES_DURATION[key] ?? 1);
    setDuration({ ...base, [key]: clamp(current + delta, CUSTOM_LIMITS[key]) });
  };

  /**
   * Fait avancer « Nous » ou « Eux », dans les bornes du personnalise.
   * @param {'them' | 'us'} side
   * @param {number} delta
   * @returns {void}
   */
  const stepPlayers = (side, delta) => dispatch({
    payload: { [side]: clamp(custom[side] + delta, CUSTOM_LIMITS.players) },
    type: 'SET_FORMAT_CUSTOM',
  });

  const chooseFormat = (/** @type {string} */ code) => {
    setIsOtherDuration(false);
    const format = formats.find((item) => item.code === code);
    let nextDuration = format?.durations[0] || null;
    if (code === CUSTOM_FORMAT) {
      nextDuration = isCustom && duration ? duration : DEFAULT_MINUTES_DURATION;
    }
    dispatch({ payload: { code, duration: nextDuration }, type: 'SET_FORMAT' });
  };

  const renderCard = ({
    code, label, picto, subLabel,
  }) => {
    const isSelected = state.format === code;
    return (
      <TouchableOpacity
        accessibilityLabel={`${label}. ${subLabel}`}
        accessibilityRole="radio"
        accessibilityState={{ selected: isSelected }}
        key={code}
        onPress={() => chooseFormat(code)}
        style={[
          Alignments.row,
          Alignments.alignCenter,
          Spaces.gap[12],
          Spaces.paddingHorizontal[12],
          {
            backgroundColor: isSelected ? selectedSurface : restingSurface,
            borderColor: isSelected ? Colors.primary500 : restingBorder,
            borderRadius: 16,
            borderStyle: code === CUSTOM_FORMAT && !isSelected ? 'dashed' : 'solid',
            borderWidth: 1.5,
            minHeight: 64,
          },
        ]}
        testID={`friendlyFormat.option.${code}`}
      >
        <View style={[
          Alignments.alignCenter,
          Alignments.justifyCenter,
          {
            backgroundColor: tileSurface, borderRadius: 12, height: 40, width: 40,
          },
        ]}
        >
          <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>{picto}</Text>
        </View>
        <View style={[Alignments.grow1, { flexShrink: 1 }]}>
          <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>{label}</Text>
          <Text style={[Fonts.p3, Spaces.marginTop[4], { color: mutedInk }]}>{subLabel}</Text>
        </View>
        {isSelected ? (
          <Image
            source={Images.check}
            style={{
              height: 17, resizeMode: 'contain', tintColor: Colors.primary500, width: 17,
            }}
          />
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderStepper = (/** @type {string} */ label, value, onDecrement, onIncrement) => (
    <View style={[Alignments.grow1]}>
      <InputStepper
        label={label}
        onDecrement={onDecrement}
        onIncrement={onIncrement}
        tone="tunnel"
        value={value}
      />
    </View>
  );

  const renderDurationEditor = () => (
    <View style={[Spaces.gap[12]]}>
      {isCustom ? (
        <SegmentedControl
          onChange={(value) => setDuration(
            value === 'sets' ? DEFAULT_SETS_DURATION : DEFAULT_MINUTES_DURATION,
          )}
          options={[
            { label: t('friendlyMatch.wizard.format.inMinutes', 'En minutes'), value: 'minutes' },
            { label: t('friendlyMatch.wizard.format.inSets', 'En sets'), value: 'sets' },
          ]}
          value={isSetsDuration ? 'sets' : 'minutes'}
        />
      ) : null}
      {isSetsDuration ? (
        <View style={[Spaces.gap[12]]}>
          {renderStepper(
            t('friendlyMatch.wizard.format.sets', 'Sets'),
            duration.sets,
            () => stepDuration('sets', -1),
            () => stepDuration('sets', 1),
          )}
          <SegmentedControl
            onChange={(value) => setDuration({ ...duration, setsMode: value })}
            options={[
              { label: t('friendlyMatch.wizard.format.setsWin', 'gagnants'), value: 'win' },
              { label: t('friendlyMatch.wizard.format.setsPlay', 'joués'), value: 'play' },
            ]}
            value={duration.setsMode === 'play' ? 'play' : 'win'}
          />
        </View>
      ) : (
        <View style={[Alignments.row, Spaces.gap[12]]}>
          {renderStepper(
            t('friendlyMatch.wizard.format.periods', 'Périodes'),
            duration?.periods || DEFAULT_MINUTES_DURATION.periods,
            () => stepDuration('periods', -1),
            () => stepDuration('periods', 1),
          )}
          {renderStepper(
            t('friendlyMatch.wizard.format.minutes', 'Minutes'),
            duration?.minutes || DEFAULT_MINUTES_DURATION.minutes,
            () => stepDuration('minutes', -CUSTOM_LIMITS.minutes.step),
            () => stepDuration('minutes', CUSTOM_LIMITS.minutes.step),
          )}
        </View>
      )}
    </View>
  );

  const payload = buildFriendlyMatchAdPayload(state);
  const resultLabel = [
    getFormatLabel(payload.format, sportName),
    formatDurationLabel(duration),
  ].filter(Boolean).join(' · ');

  const durationOptions = selected ? [
    ...selected.durations.map((item, index) => ({
      label: index === 0
        ? t('friendlyMatch.wizard.format.usualDuration', '{{duration}} (habituel)', {
          duration: formatDurationLabel(item), ...SANS_ECHAPPEMENT,
        })
        : formatDurationLabel(item),
      value: String(index),
    })),
    {
      label: t('friendlyMatch.wizard.format.otherDuration', 'Autre durée'),
      value: OTHER_DURATION,
    },
  ] : [];

  const subtitle = formats.length > 0
    ? t(
      'friendlyMatch.wizard.format.subtitle',
      'Les formats proposés sont ceux du {{sport}}.',
      { sport: sportName.toLowerCase(), ...SANS_ECHAPPEMENT },
    )
    : t(
      'friendlyMatch.wizard.format.subtitleCustomOnly',
      'Décris ton format : combien vous serez sur le terrain, et combien de temps.',
    );

  return (
    <WizardStepLayout
      isNextDisabled={Boolean(issue)}
      onBack={() => navigation.goBack()}
      onNext={() => navigation.navigate(RouteNames.FriendlyMatchWizardHosting)}
      stepCount={getFriendlyMatchWizardStepCount()}
      stepIndex={getFriendlyMatchWizardStepIndex('format')}
      subtitle={subtitle}
      title={t('friendlyMatch.wizard.format.title', 'Quel format ?')}
    >
      <View style={[Spaces.gap[12]]}>
        {state.team?.name ? (
          <Text style={[Fonts.p3Bold, { color: Colors.primary100 }]}>
            {[state.team.name, sportName].filter(Boolean).join(' · ')}
          </Text>
        ) : null}

        {formats.map((format) => renderCard({
          code: format.code,
          label: format.label,
          picto: getPicto(format.code),
          subLabel: [format.detail, formatDurationLabel(format.durations[0])]
            .filter(Boolean)
            .join(' · '),
        }))}
        {renderCard({
          code: CUSTOM_FORMAT,
          label: t('friendlyMatch.wizard.format.custom', 'Personnalisé'),
          picto: '+',
          subLabel: t(
            'friendlyMatch.wizard.format.customHint',
            'Tu choisis le nombre de joueurs et la durée',
          ),
        })}

        {selected ? (
          <View style={[Spaces.gap[12], Spaces.marginTop[8]]}>
            <ChoiceChipGroup
              onSelect={(value) => {
                setIsOtherDuration(value === OTHER_DURATION);
                if (value !== OTHER_DURATION) setDuration(selected.durations[Number(value)]);
              }}
              options={durationOptions}
              selectedValue={showDurationEditor ? OTHER_DURATION : String(listedIndex)}
              title={t('friendlyMatch.wizard.format.duration', 'Durée')}
            />
            {showDurationEditor ? renderDurationEditor() : null}
          </View>
        ) : null}

        {isCustom ? (
          <View style={[Spaces.gap[12], Spaces.marginTop[8]]}>
            <View style={blockStyle}>
              <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
                {t('friendlyMatch.wizard.format.players', 'Joueurs sur le terrain')}
              </Text>
              <View style={[Alignments.row, Spaces.gap[12]]}>
                {renderStepper(
                  t('friendlyMatch.wizard.format.us', 'Nous'),
                  custom.us,
                  () => stepPlayers('us', -1),
                  () => stepPlayers('us', 1),
                )}
                {renderStepper(
                  t('friendlyMatch.wizard.format.them', 'Eux'),
                  custom.them,
                  () => stepPlayers('them', -1),
                  () => stepPlayers('them', 1),
                )}
              </View>
              <Text style={[Fonts.small, { color: mutedInk }]}>
                {t(
                  'friendlyMatch.wizard.format.playersHint',
                  'Gardien compris. « Eux » suit « Nous » tant que tu ne le touches pas.',
                )}
              </Text>
            </View>

            <View style={blockStyle}>
              <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
                {t('friendlyMatch.wizard.format.duration', 'Durée')}
              </Text>
              {renderDurationEditor()}
            </View>

            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
                {t('friendlyMatch.wizard.format.precision', 'Une précision ? (facultatif)')}
              </Text>
              <TextInput
                accessibilityLabel={t(
                  'friendlyMatch.wizard.format.precisionLabel',
                  'Précision sur le format',
                )}
                maxLength={PRECISION_MAX_LENGTH}
                onChangeText={(value) => dispatch({ payload: value, type: 'SET_FORMAT_PRECISION' })}
                placeholder={t(
                  'friendlyMatch.wizard.format.precisionPlaceholder',
                  'Ex : mi-terrain, gardien volant, matchs en tournante…',
                )}
                placeholderTextColor={Colors.neutral400}
                style={[Fonts.p1, {
                  backgroundColor: withAlpha(Colors.primary900, 0.94),
                  borderColor: withAlpha(Colors.primary500, 0.15),
                  borderRadius: 12,
                  borderWidth: 1,
                  color: Colors.neutral00,
                  minHeight: 48,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                }]}
                value={state.formatPrecision || ''}
              />
            </View>
          </View>
        ) : null}

        {resultLabel && state.format ? (
          <Text style={[Fonts.p3, { color: Colors.neutral200 }]} testID="friendlyFormat.result">
            {t('friendlyMatch.wizard.format.result', 'Sur l’annonce : {{result}}', {
              result: resultLabel, ...SANS_ECHAPPEMENT,
            })}
          </Text>
        ) : null}

        {issue && state.format ? (
          <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>{issue}</Text>
        ) : null}
      </View>
    </WizardStepLayout>
  );
}

export default FriendlyMatchWizardFormat;
