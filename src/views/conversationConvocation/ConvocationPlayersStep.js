import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import ConvocationGlyph from '@/components/atoms/convocationGlyph/ConvocationGlyph';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import { buildManualCallUpPlayer } from '@/views/matchCallUp/matchCallUpUtils';

import {
  getCompositionPlayerAvatarUrl,
  getCompositionPlayerLabel,
} from '@/utils/compositionPlayer';

import {
  getRowAnswer,
  selectWholeSquad,
  SIDE_BENCH,
  SIDE_PITCH,
  toggleConvocationSelection,
} from './convocationWizardUtils';

/**
 * Le choix Terrain | Banc d'un joueur coche. Toucher le choix ne change que la place.
 * @param {object} props
 * @param {string} props.name Le nom du joueur (lecteur d'ecran).
 * @param {(side: string) => void} props.onChange
 * @param {string} props.value `pitch` | `bench`.
 * @returns {import('react').ReactElement}
 */
function SideToggle({ name, onChange, value }) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  const option = (
    /** @type {string} */ side,
    /** @type {string} */ label,
    /** @type {string} */ color,
  ) => {
    const isOn = value === side;
    return (
      <TouchableOpacity
        accessibilityLabel={`${name} : ${label}`}
        accessibilityRole="radio"
        accessibilityState={{ checked: isOn, selected: isOn }}
        hitSlop={4}
        key={side}
        onPress={() => onChange(side)}
        style={[styles.sideOption, isOn ? { backgroundColor: color } : null]}
        testID={`convocation-side-${side}`}
      >
        <Text
          style={[
            Fonts.p3Bold,
            { color: isOn ? Colors.primary900 : withAlpha(Colors.neutral00, 0.8) },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };
  return (
    <View
      accessibilityRole="radiogroup"
      style={[styles.sideTrack, { backgroundColor: withAlpha(Colors.neutral900, 0.3) }]}
    >
      {option(SIDE_PITCH, t('conversationConvocation.players.pitch'), Colors.primary500)}
      {option(SIDE_BENCH, t('conversationConvocation.players.bench'), Colors.warning400)}
    </View>
  );
}

/**
 * MESSAGERIE-1C — ETAPE 2 « JOUEURS » (pack messagerie §3.12, §5).
 *
 * L'effectif, une case a cocher a gauche (cochee = convoque), le choix Terrain | Banc a droite
 * quand la case est cochee, « Tout l'effectif », et en tete « Ajouter un joueur (nom, prenom) ».
 *
 * 🔒 « manuels B » + « oui » (Adel, 07/10) : les joueurs ajoutes a la main de la derniere
 * convocation arrivent DECOCHES, et un joueur a la main non coche peut etre « Retire de la
 * liste ». En modification, la reponse deja donnee s'affiche sous le nom.
 * @param {object} props
 * @param {any[]} props.bench Les lignes convoquees au banc.
 * @param {boolean} [props.isList] CONVLISTE : convocation en liste, sans Terrain / Banc.
 * @param {boolean} [props.isLoading]
 * @param {boolean} [props.isUpdate] Une convocation est deja publiee pour cet evenement.
 * @param {(player: any) => void} props.onAddManualPlayer
 * @param {(playerId: string) => void} props.onRemoveManualPlayer
 * @param {(next: Record<string, string>) => void} props.onSelectionChange
 * @param {any[]} props.pitch Les lignes convoquees sur le terrain.
 * @param {any} [props.responses] `{ byPlayerId }` de la convocation publiee.
 * @param {Array<{ id: string, isManual: boolean, player: any }>} props.rows
 * @param {Record<string, string>} props.selection
 * @returns {import('react').ReactElement}
 */
function ConvocationPlayersStep({
  bench,
  isList = false,
  isLoading = false,
  isUpdate = false,
  onAddManualPlayer,
  onRemoveManualPlayer,
  onSelectionChange,
  pitch,
  responses = null,
  rows,
  selection,
}) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  const [isAdding, setIsAdding] = useState(false);
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');

  const canAdd = Boolean(`${firstname}${lastname}`.trim());
  const caps = [Fonts.p3Bold, styles.caps, { color: withAlpha(Colors.neutral00, 0.6) }];
  const divider = { borderTopColor: withAlpha(Colors.neutral00, 0.06) };
  const field = [
    Fonts.p2,
    styles.input,
    {
      backgroundColor: Colors.primary800,
      borderColor: Colors.primary700,
      color: Colors.neutral00,
    },
  ];

  const closeForm = () => {
    setIsAdding(false);
    setFirstname('');
    setLastname('');
  };

  const handleAdd = () => {
    if (!canAdd) return;
    onAddManualPlayer(buildManualCallUpPlayer({ firstname, lastname }));
    closeForm();
  };

  return (
    <View testID="convocation-step-players">
      <View style={styles.listHeader}>
        <Text style={caps}>
          {isList
            ? t('conversationConvocation.players.countsList', {
              count: bench.length + pitch.length,
            })
            : t('conversationConvocation.players.counts', {
              bench: bench.length, pitch: pitch.length,
            })}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => onSelectionChange(selectWholeSquad(selection, rows))}
          testID="convocation-whole-squad"
        >
          <Text style={[Fonts.p3Bold, styles.wholeSquad, { color: Colors.primary500 }]}>
            {t('conversationConvocation.players.wholeSquad')}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: Colors.primary700 }]}>
        {isAdding ? (
          <View style={styles.form}>
            <View style={styles.formRow}>
              <TextInput
                accessibilityLabel={t('conversationConvocation.players.firstname')}
                autoFocus
                onChangeText={setFirstname}
                placeholder={t('conversationConvocation.players.firstname')}
                placeholderTextColor={Colors.neutral400}
                style={field}
                testID="convocation-add-firstname"
                value={firstname}
              />
              <TextInput
                accessibilityLabel={t('conversationConvocation.players.lastname')}
                onChangeText={setLastname}
                onSubmitEditing={handleAdd}
                placeholder={t('conversationConvocation.players.lastname')}
                placeholderTextColor={Colors.neutral400}
                returnKeyType="done"
                style={field}
                testID="convocation-add-lastname"
                value={lastname}
              />
            </View>
            <View style={styles.formRow}>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={closeForm}
                style={[styles.formButton, { borderColor: withAlpha(Colors.neutral00, 0.3) }]}
                testID="convocation-add-cancel"
              >
                <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
                  {t('conversationConvocation.players.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ disabled: !canAdd }}
                disabled={!canAdd}
                onPress={handleAdd}
                style={[
                  styles.formButton,
                  styles.formButtonFilled,
                  { backgroundColor: Colors.primary500, opacity: canAdd ? 1 : 0.4 },
                ]}
                testID="convocation-add-confirm"
              >
                <Text style={[Fonts.p2Bold, { color: Colors.primary900 }]}>
                  {t('conversationConvocation.players.confirmAdd')}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={[Fonts.p3, { color: withAlpha(Colors.neutral00, 0.6) }]}>
              {t('conversationConvocation.players.addHint')}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setIsAdding(true)}
            style={styles.addRow}
            testID="convocation-add-player"
          >
            <View
              style={[styles.addIcon, { backgroundColor: withAlpha(Colors.primary500, 0.16) }]}
            >
              <ConvocationGlyph color={Colors.primary500} name="userPlus" size={18} />
            </View>
            <Text style={[Fonts.p2Bold, styles.addLabel, { color: Colors.primary500 }]}>
              {t('conversationConvocation.players.add')}
            </Text>
          </TouchableOpacity>
        )}

        {isLoading ? (
          <View style={[styles.state, divider]}>
            <ActivityIndicator color={Colors.primary500} />
            <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
              {t('conversationConvocation.players.loading')}
            </Text>
          </View>
        ) : null}
        {!isLoading && rows.length === 0 ? (
          <Text style={[Fonts.p2, styles.state, divider, { color: Colors.neutral300 }]}>
            {t('conversationConvocation.players.empty')}
          </Text>
        ) : null}

        {!isLoading ? rows.map((row) => {
          const side = selection[row.id];
          const isChecked = Boolean(side);
          const name = getCompositionPlayerLabel(row.player);
          const answer = getRowAnswer(responses, row);
          let subtitle = t('conversationConvocation.players.player');
          let subtitleColor = withAlpha(Colors.neutral00, 0.55);
          if (answer === 'manual') {
            subtitle = t('conversationConvocation.players.manual');
          } else if (answer === 'absent') {
            subtitle = t('conversationConvocation.players.saidAbsent');
            subtitleColor = Colors.error500;
          } else if (answer === 'present') {
            subtitle = t('conversationConvocation.players.saidPresent');
            subtitleColor = Colors.success500;
          }
          return (
            <View key={row.id} style={[styles.row, divider]} testID={`convocation-row-${row.id}`}>
              <TouchableOpacity
                accessibilityLabel={`${name}, ${subtitle}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isChecked }}
                onPress={() => onSelectionChange(toggleConvocationSelection(selection, row.id))}
                style={styles.rowMain}
                testID={`convocation-check-${row.id}`}
              >
                <View
                  style={[
                    styles.checkbox,
                    isChecked
                      ? { backgroundColor: Colors.primary500 }
                      : { borderColor: withAlpha(Colors.neutral00, 0.4), borderWidth: 2 },
                  ]}
                >
                  {isChecked ? (
                    <ConvocationGlyph color={Colors.primary900} name="check" size={15} />
                  ) : null}
                </View>
                <ProfileAvatar
                  imageUrl={row.isManual ? undefined : getCompositionPlayerAvatarUrl(row.player)}
                  name={name}
                  size={38}
                />
                <View style={styles.rowText}>
                  <Text
                    numberOfLines={1}
                    style={[Fonts.p2Bold, styles.name, { color: Colors.neutral00 }]}
                  >
                    {name}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      answer && answer !== 'manual' ? Fonts.p3Bold : Fonts.p3,
                      styles.subtitle,
                      { color: subtitleColor },
                    ]}
                  >
                    {subtitle}
                  </Text>
                </View>
              </TouchableOpacity>
              {isChecked && !isList ? (
                <SideToggle
                  name={name}
                  onChange={(next) => onSelectionChange({ ...selection, [row.id]: next })}
                  value={side}
                />
              ) : null}
              {row.isManual && !isChecked ? (
                <TouchableOpacity
                  accessibilityLabel={t('conversationConvocation.players.removeLabel', {
                    name, ...SANS_ECHAPPEMENT,
                  })}
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => onRemoveManualPlayer(row.id)}
                  style={[styles.remove, { borderColor: withAlpha(Colors.neutral00, 0.25) }]}
                  testID={`convocation-remove-${row.id}`}
                >
                  <SvgIcon color={Colors.neutral300} height={14} name="close" width={14} />
                </TouchableOpacity>
              ) : null}
            </View>
          );
        }) : null}
      </View>

      {isUpdate ? (
        <Text style={[Fonts.p3, styles.editHint, { color: withAlpha(Colors.neutral00, 0.6) }]}>
          {t('conversationConvocation.players.editHint')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  addIcon: {
    alignItems: 'center',
    borderRadius: 19,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  addLabel: {
    flex: 1,
    fontSize: 15,
  },
  addRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    height: 56,
    paddingHorizontal: 12,
  },
  caps: {
    fontSize: 12,
    letterSpacing: 1.2,
  },
  card: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  checkbox: {
    alignItems: 'center',
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  editHint: {
    fontSize: 12.5,
    lineHeight: 18,
    marginHorizontal: 4,
    marginTop: 10,
  },
  form: {
    gap: 8,
    padding: 12,
  },
  formButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1.5,
    flex: 1,
    height: 40,
    justifyContent: 'center',
  },
  formButtonFilled: {
    borderWidth: 0,
  },
  formRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    fontSize: 15,
    height: 42,
    paddingHorizontal: 12,
  },
  listHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    marginHorizontal: 2,
    marginTop: 12,
  },
  name: {
    fontSize: 15,
  },
  remove: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  row: {
    alignItems: 'center',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 58,
    paddingHorizontal: 12,
  },
  rowMain: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 58,
    minWidth: 0,
  },
  rowText: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  sideOption: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sideTrack: {
    borderRadius: 999,
    flexDirection: 'row',
    gap: 2,
    padding: 3,
  },
  state: {
    alignItems: 'center',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  subtitle: {
    fontSize: 12.5,
  },
  wholeSquad: {
    fontSize: 13,
    padding: 4,
  },
});

export default ConvocationPlayersStep;
