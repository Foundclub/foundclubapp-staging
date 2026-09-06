import {
  memo, useCallback, useMemo, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * LA SAISIE D'UNE MESURE, SUR LE TERRAIN.
 *
 * Ce composant rend UNE mesure du protocole et tous ses essais. Trois choix
 * d'ergonomie, tous dictés par la situation réelle : dehors, mains sales, un
 * chronomètre qui tourne, parfois pas de réseau.
 *
 * 1. 🔢 **Le clavier s'ouvre sur le bon jeu de touches** et la virgule est acceptée
 *    au même titre que le point : personne ne tape « 31.4 » sur un clavier français.
 * 2. 🚨 **Une valeur hors bornes n'est jamais refusée, elle est signalée.** Refuser
 *    une saisie sur un terrain, c'est perdre la mesure. Les bornes servent à
 *    attraper une faute de frappe (un saut à 300 cm), pas à juger une performance.
 * 3. ⛔ **« Essai nul » est un bouton, pas une suppression.** Le protocole prévoit
 *    des essais annulés ; les effacer ferait perdre la trace de ce qui s'est passé
 *    et décalerait la numérotation des essais suivants.
 *
 * Les mesures `computed` ne se saisissent pas : elles s'affichent, avec leur formule.
 */

const KEYBOARDS = {
  decimal: 'decimal-pad',
  duration_s: 'decimal-pad',
  integer: 'number-pad',
};

/**
 * Accepte la virgule, refuse tout le reste. Rend une chaîne, jamais un nombre.
 * @param {string|number|null|undefined} raw ce que l'utilisateur vient de taper
 * @param {string} type type de la mesure ; `integer` interdit aussi le séparateur décimal
 * @returns {string} la saisie débarrassée des caractères impossibles, virgule devenue point
 */
const sanitize = (raw, type) => {
  const text = String(raw ?? '').replace(',', '.');
  if (type === 'integer') return text.replace(/[^\d-]/g, '');
  return text.replace(/[^\d.-]/g, '');
};

/**
 * Lit un nombre saisi, la virgule valant point decimal.
 * @param {string|number|null|undefined} raw la saisie brute
 * @returns {number|null} le nombre, ou `null` si la saisie n'en est pas un
 */
const toNumber = (raw) => {
  const parsed = Number(String(raw ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

const SIDES = ['left', 'right'];

/**
 * Un essai nul se voit en or, une valeur hors bornes en rouge, le reste est neutre.
 * @param {Record<string, string>} Colors palette du thème courant
 * @param {boolean} isInvalid l'essai a été marqué « nul » par l'éducateur
 * @param {boolean} outOfRange la valeur saisie sort des bornes du protocole
 * @returns {string} la couleur à donner à la bordure du champ
 */
const fieldBorderColor = (Colors, isInvalid, outOfRange) => {
  if (isInvalid) return Colors.gold500;
  if (outOfRange) return Colors.error500;
  return Colors.neutral600;
};

/**
 * La ligne de saisie d'UN essai : la valeur, le côté mesuré, et le bouton « essai nul ».
 * Signale une valeur hors bornes sans jamais la refuser.
 * @param {object} props
 * @param {Record<string, string>} props.Colors palette du thème courant
 * @param {boolean} props.disabled empêche la saisie sans masquer ce qui est déjà là
 * @param {Record<string, Record<string, any>>} props.Fonts styles typographiques du thème
 * @param {Record<string, any>} props.measure définition de la mesure (type, unité, bornes)
 * @param {(text: string) => void} props.onChange remonte la saisie une fois nettoyée
 * @param {() => void} props.onInvalid bascule l'essai entre « nul » et normal
 * @param {string|null} props.side côté mesuré (`left`, `right`), ou `null` si sans côté
 * @param {Record<string, Record<string, any>>} props.Spaces espacements du thème
 * @param {(key: string, options?: Record<string, any>) => string} props.t fonction de traduction
 * @param {Record<string, any>|undefined} props.value valeur déjà enregistrée pour cet essai
 * @returns {React.ReactElement} le champ de saisie de l'essai
 */
function AttemptField({
  Colors, disabled, Fonts, measure, onChange, onInvalid, side, Spaces, t, value,
}) {
  const [text, setText] = useState(value?.value ?? value?.textValue ?? '');
  const isInvalid = value?.isValid === false;

  const numeric = toNumber(text);
  const outOfRange = numeric !== null
    && ((typeof measure.min === 'number' && numeric < measure.min)
      || (typeof measure.max === 'number' && numeric > measure.max));

  const commit = useCallback((/** @type {string} */ nextText) => {
    const cleaned = measure.type === 'text' ? nextText : sanitize(nextText, measure.type);
    setText(cleaned);
    onChange(cleaned);
  }, [measure.type, onChange]);

  return (
    <View style={[Spaces.gap[4], { flex: 1 }]}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 6 }}>
        {Boolean(side) && (
          <Text style={[Fonts.caption, { color: Colors.neutral300, minWidth: 46 }]}>
            {t(`training.measures.side.${side}`)}
          </Text>
        )}
        <TextInput
          accessibilityLabel={measure.label}
          editable={!disabled}
          keyboardType={/** @type {import('react-native').KeyboardTypeOptions} */ (
            KEYBOARDS[/** @type {keyof KEYBOARDS} */ (measure.type)] || 'default'
          )}
          onChangeText={commit}
          placeholder={measure.unit || ''}
          placeholderTextColor={Colors.neutral500}
          style={[
            Fonts.p2,
            {
              backgroundColor: Colors.neutral800,
              borderColor: fieldBorderColor(Colors, isInvalid, outOfRange),
              borderRadius: 8,
              borderWidth: 1,
              color: isInvalid ? Colors.neutral400 : Colors.neutral00,
              flex: 1,
              paddingHorizontal: 10,
              paddingVertical: 8,
              textDecorationLine: isInvalid ? 'line-through' : 'none',
            },
          ]}
          value={String(text ?? '')}
        />
        <TouchableOpacity
          accessibilityLabel={t('training.actions.invalidAttempt')}
          accessibilityRole="button"
          hitSlop={{
            bottom: 8, left: 8, right: 8, top: 8,
          }}
          onPress={onInvalid}
          style={{
            borderColor: isInvalid ? Colors.gold500 : Colors.neutral600,
            borderRadius: 8,
            borderWidth: 1,
            paddingHorizontal: 8,
            paddingVertical: 8,
          }}
        >
          <Text
            style={[
              Fonts.caption,
              { color: isInvalid ? Colors.gold500 : Colors.neutral400 },
            ]}
          >
            ✕
          </Text>
        </TouchableOpacity>
      </View>

      {outOfRange && (
        <Text style={[Fonts.caption, { color: Colors.error500 }]}>
          {t('training.measures.outOfRange', { max: measure.max, min: measure.min })}
        </Text>
      )}
    </View>
  );
}

/**
 * Rend une mesure du protocole et tous ses essais, prête à être remplie sur le terrain.
 * Une mesure calculée s'affiche seulement, avec sa formule ; les autres se saisissent.
 * @param {object} props
 * @param {Record<string, any>} props.measure définition venue du serveur
 * @param {(row: Record<string, any>) => void} props.onRecord enregistre une valeur (locale d'abord)
 * @param {(row: Record<string, any>) => void} props.onToggleInvalid marque ou démarque un essai nul
 * @param {Record<string, Record<string, any>>} props.values valeurs saisies, indexées par
 *   `${attempt}|${side}`
 * @returns {React.ReactElement|null} la mesure affichée, ou rien si elle n'a pas de clé
 */
function TrainingMeasureInput({
  measure, onRecord, onToggleInvalid, values,
}) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const saved = values || {};

  const attempts = Math.max(1, Math.min(Number(measure?.attempts) || 1, 20));
  const hasSides = Boolean(measure?.sides);

  const rows = useMemo(() => {
    const sides = hasSides ? SIDES : [null];
    return Array.from({ length: attempts }, (_, i) => i + 1)
      .flatMap((attempt) => sides.map((side) => ({ attempt, side })));
  }, [attempts, hasSides]);

  if (!measure?.key) return null;

  // Une valeur calculée ne se saisit pas : elle se lit, avec sa formule sous les yeux.
  if (measure.computed) {
    return (
      <View
        style={[
          Spaces.gap[4],
          {
            borderLeftColor: Colors.neutral600,
            borderLeftWidth: 2,
            paddingLeft: 10,
          },
        ]}
      >
        <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
          {measure.label}
          {measure.unit ? ` (${measure.unit})` : ''}
          {' '}
          ·
          {t('training.measures.computed')}
        </Text>
        {Boolean(measure.formula) && (
          <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>{measure.formula}</Text>
        )}
      </View>
    );
  }

  return (
    <View style={Spaces.gap[8]}>
      <Text style={[Fonts.p2, { color: Colors.neutral00 }]}>
        {measure.label}
        {measure.unit ? (
          <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
            {`  ${measure.unit}`}
          </Text>
        ) : null}
      </Text>

      {Boolean(measure.helper) && (
        <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>{measure.helper}</Text>
      )}

      {measure.type === 'boolean' ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[true, false].map((flag) => {
            const current = saved['1|none']?.textValue;
            const active = current === (flag ? 'oui' : 'non');
            return (
              <TouchableOpacity
                accessibilityRole="button"
                key={String(flag)}
                onPress={() => onRecord({
                  attempt: 1,
                  measureKey: measure.key,
                  side: 'none',
                  textValue: flag ? 'oui' : 'non',
                  unit: measure.unit,
                })}
                style={{
                  backgroundColor: active ? Colors.primary500 : 'transparent',
                  borderColor: active ? Colors.primary500 : Colors.neutral600,
                  borderRadius: 8,
                  borderWidth: 1,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                }}
              >
                <Text style={[Fonts.p3, { color: active ? Colors.neutral00 : Colors.neutral300 }]}>
                  {flag ? 'Oui' : 'Non'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {measure.type === 'choice' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(Array.isArray(measure.choices) ? measure.choices : []).map((choice) => {
            const active = saved['1|none']?.textValue === choice;
            return (
              <TouchableOpacity
                accessibilityRole="button"
                key={choice}
                onPress={() => onRecord({
                  attempt: 1,
                  measureKey: measure.key,
                  side: 'none',
                  textValue: choice,
                  unit: measure.unit,
                })}
                style={{
                  backgroundColor: active ? Colors.primary500 : 'transparent',
                  borderColor: active ? Colors.primary500 : Colors.neutral600,
                  borderRadius: 8,
                  borderWidth: 1,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              >
                <Text
                  style={[
                    Fonts.p3,
                    { color: active ? Colors.neutral00 : Colors.neutral300 },
                  ]}
                >
                  {choice}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {measure.type !== 'boolean' && measure.type !== 'choice' ? (
        <View style={Spaces.gap[8]}>
          {rows.map(({ attempt, side }) => {
            const key = `${attempt}|${side || 'none'}`;
            const showAttemptLabel = attempts > 1 && (!measure.sides || side === SIDES[0]);
            return (
              <View key={key} style={Spaces.gap[4]}>
                {showAttemptLabel && (
                  <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
                    {t('training.measures.attempt', { number: attempt })}
                  </Text>
                )}
                <AttemptField
                  Colors={Colors}
                  disabled={false}
                  Fonts={Fonts}
                  measure={measure}
                  onChange={(text) => onRecord({
                    attempt,
                    measureKey: measure.key,
                    side: side || 'none',
                    textValue: measure.type === 'text' ? text : null,
                    unit: measure.unit,
                    value: measure.type === 'text' ? null : toNumber(text),
                  })}
                  onInvalid={() => onToggleInvalid({
                    attempt,
                    measureKey: measure.key,
                    side: side || 'none',
                  })}
                  side={side}
                  Spaces={Spaces}
                  t={t}
                  value={saved[key]}
                />
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export default memo(TrainingMeasureInput);
