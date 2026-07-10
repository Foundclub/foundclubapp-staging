import { Text, TouchableOpacity, View } from 'react-native';

import useTheme from '@/theme/themeContext';

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
 * @param {() => void} [props.onPress]
 * @returns {import('react').ReactElement}
 */
function WizardOptionCard({
  avatar = null,
  compact = false,
  dashed = false,
  multi = false,
  onPress,
  selected = false,
  subtitle,
  tag,
  title,
}) {
  const { Alignments, Colors, Fonts } = useTheme();

  let backgroundColor = 'rgba(255,255,255,0.03)';
  if (dashed) {
    backgroundColor = 'transparent';
  } else if (selected) {
    backgroundColor = 'rgba(1,179,244,0.08)';
  }
  let borderColor = 'rgba(255,255,255,0.10)';
  if (dashed) {
    borderColor = 'rgba(1,179,244,0.45)';
  } else if (selected) {
    borderColor = Colors.primary500;
  }

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected }}
      activeOpacity={0.85}
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
          paddingHorizontal: 16,
          paddingVertical: 8,
        },
      ]}
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
            numberOfLines={1}
            style={[Fonts.p1Bold, dashed ? Fonts.primary500 : Fonts.neutral00, { flexShrink: 1 }]}
          >
            {title}
          </Text>
          {tag ? (
            <View
              style={{
                backgroundColor: 'rgba(1,179,244,0.14)',
                borderColor: 'rgba(1,179,244,0.35)',
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
          <Text numberOfLines={1} style={[Fonts.p4, Fonts.neutral300, { marginTop: 2 }]}>
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
            <Text style={{ color: Colors.primary900, fontSize: 12, fontWeight: '900' }}>✓</Text>
          ) : null}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export default WizardOptionCard;
