import { Image, Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * Avatar membre du handoff design : photo de profil si disponible, sinon
 * initiales (fond cyan 16 %, texte primary500) — jamais d'icone generique.
 * @param {object} props
 * @param {string | null} [props.avatarUrl] - URL de la photo de profil.
 * @param {string | null} [props.firstname]
 * @param {string | null} [props.lastname]
 * @param {number} [props.size] - Diametre en pt (defaut 40).
 * @param {boolean} [props.outlined] - Bordure cyan 2pt (variante heros).
 * @returns {import('react').ReactElement}
 */
function MemberAvatar({
  avatarUrl = null,
  firstname = null,
  lastname = null,
  outlined = false,
  size = 40,
}) {
  const { Colors, Fonts } = useTheme();
  const initials = `${String(firstname || '').trim().charAt(0)}${String(lastname || '').trim().charAt(0)}`
    .toUpperCase() || '·';

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={{
          borderColor: outlined ? Colors.primary500 : 'transparent',
          borderRadius: 999,
          borderWidth: outlined ? 2 : 0,
          height: size,
          width: size,
        }}
      />
    );
  }

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: 'rgba(1,179,244,0.16)',
        borderColor: outlined ? Colors.primary500 : 'transparent',
        borderRadius: 999,
        borderWidth: outlined ? 2 : 0,
        height: size,
        justifyContent: 'center',
        width: size,
      }}
    >
      <Text
        style={[
          Fonts.p2Bold,
          Fonts.primary500,
          { fontSize: Math.max(11, Math.round(size * 0.29)) },
        ]}
      >
        {initials}
      </Text>
    </View>
  );
}

export default MemberAvatar;
