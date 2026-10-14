import { Text, TouchableOpacity, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import MemberAvatar from '@/components/molecules/memberAvatar/MemberAvatar';

/**
 * Carte d'option de tunnel « choisir = toucher » (handoff decision 2) :
 * ligne pleine page avec titre, sous-titre, tag, avatar initiales et
 * marqueur de selection (radio ou case selon multi). La variante dashed
 * sert aux actions de creation (« + Créer… »).
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.subtitle]
 * @param {string} [props.tag] - Pilule courte (ex. « Toi », « Sport du club »).
 * @param {{ avatarUrl?: string | null; firstname?: string | null;
 *   lastname?: string | null } | null} [props.avatar] - Avatar membre (photo sinon initiales).
 * @param {boolean} [props.selected]
 * @param {boolean} [props.multi] - Case a cocher carree au lieu du radio rond.
 * @param {boolean} [props.dashed] - Variante action (bordure pointillee cyan).
 * @param {boolean} [props.compact] - Hauteur reduite (listes longues).
 * @param {'button' | 'radio' | 'checkbox'} [props.accessibilityRole] - PAR-L4 : « radio » ou
 *   « checkbox » font LIRE l'etat coche (`aria-checked` sur le site) ; « button » par defaut,
 *   comme avant, pour les tunnels qui ne le demandent pas.
 * @param {boolean} [props.disabled] - PAR-L4 : un choix impossible (enfant deja en equipe…) :
 *   la carte reste visible, s'eteint, et ne se touche plus.
 * @param {number} [props.titleLines] - Lignes du titre (1 par defaut).
 * @param {number} [props.subtitleLines] - Lignes du sous-titre (1 par defaut).
 * @param {string} [props.testID]
 * @param {() => void} [props.onPress]
 * @returns {import('react').ReactElement}
 */
function WizardOptionCard({
  accessibilityRole = 'button',
  avatar = null,
  compact = false,
  dashed = false,
  disabled = false,
  multi = false,
  onPress,
  selected = false,
  subtitle,
  subtitleLines = 1,
  tag,
  testID = undefined,
  title,
  titleLines = 1,
}) {
  const { Alignments, Colors, Fonts } = useTheme();

  // PAR-L4 — les teintes passent par `withAlpha` (memes valeurs que les rgba ecrits a la main).
  let backgroundColor = withAlpha(Colors.neutral00, 0.03);
  if (dashed) {
    backgroundColor = 'transparent';
  } else if (selected) {
    backgroundColor = withAlpha(Colors.primary500, 0.08);
  }
  let borderColor = withAlpha(Colors.neutral00, 0.1);
  if (dashed) {
    borderColor = withAlpha(Colors.primary500, 0.45);
  } else if (selected) {
    borderColor = Colors.primary500;
  }
  // Un bouton ne dit pas « coche » (ARIA) : seuls « radio » et « checkbox » portent `checked`.
  const role = dashed ? 'button' : accessibilityRole;
  const accessibilityState = role === 'button'
    ? { selected }
    : { checked: selected, disabled, selected };

  return (
    <TouchableOpacity
      accessibilityRole={role}
      accessibilityState={accessibilityState}
      activeOpacity={0.85}
      disabled={disabled}
      onPress={onPress}
      style={[
        Alignments.row,
        Alignments.alignCenter,
        {
          backgroundColor,
          borderColor,
          borderRadius: 16,
          borderStyle: dashed ? 'dashed' : 'solid',
          borderWidth: 1.5,
          columnGap: 12,
          marginBottom: 10,
          minHeight: compact ? 54 : 62,
          opacity: disabled ? 0.55 : 1,
          paddingHorizontal: 16,
          paddingVertical: 8,
        },
      ]}
      testID={testID}
    >
      {avatar ? (
        <MemberAvatar
          avatarUrl={avatar.avatarUrl}
          firstname={avatar.firstname}
          lastname={avatar.lastname}
          size={38}
        />
      ) : null}
      <View style={Alignments.fill}>
        <View style={[Alignments.row, Alignments.alignCenter, { columnGap: 8 }]}>
          <Text
            numberOfLines={titleLines}
            style={[Fonts.p1Bold, dashed ? Fonts.primary500 : Fonts.neutral00, { flexShrink: 1 }]}
          >
            {title}
          </Text>
          {tag ? (
            <View
              style={{
                backgroundColor: withAlpha(Colors.primary500, 0.14),
                borderColor: withAlpha(Colors.primary500, 0.35),
                borderRadius: 999,
                borderWidth: 1,
                paddingHorizontal: 8,
                paddingVertical: 2,
              }}
            >
              <Text
                style={[
                  Fonts.p4Bold,
                  Fonts.primary200,
                  { letterSpacing: 0.5, textTransform: 'uppercase' },
                ]}
              >
                {tag}
              </Text>
            </View>
          ) : null}
        </View>
        {subtitle ? (
          <Text
            numberOfLines={subtitleLines}
            style={[Fonts.p4, Fonts.neutral300, { marginTop: 2 }]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {!dashed ? (
        <View
          style={{
            alignItems: 'center',
            backgroundColor: selected ? Colors.primary500 : 'transparent',
            borderColor: selected ? Colors.primary500 : Colors.neutral600,
            borderRadius: multi ? 7 : 999,
            borderWidth: 2,
            height: 22,
            justifyContent: 'center',
            width: 22,
          }}
        >
          {selected ? (
            <SvgIcon color={Colors.primary900} height={12} name="check" width={12} />
          ) : null}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export default WizardOptionCard;
