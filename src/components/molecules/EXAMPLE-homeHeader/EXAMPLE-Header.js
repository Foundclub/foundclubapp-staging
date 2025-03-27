import { View, Text, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
// Hooks
import useTheme from '../../../theme/themeContext';

const profilePictureDimensions = {
  width: 80,
  height: 80,
  borderRadius: 40,
};

/**
 * Header component with greeting, date and profile picture
 * @param {object} props
 * @param {string} [props.userName]
 * @param {string} [props.userImage]
 * @returns {import('react').ReactElement}
 */
function Header({ userName = 'Unknown', userImage = null }) {
  const {
    Alignments, Fonts, Spaces, ApplicationStyle,
  } = useTheme();
  const { t } = useTranslation();

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <View style={[
      Alignments.row,
      Alignments.justifySpaceBetween,
      Alignments.alignCenter,
      Alignments.fullWidth,
      Spaces.paddingVertical[12],
    ]}
    >
      <View style={[Alignments.fill]}>
        <Text
          style={[Fonts.h2,
            Fonts.primaryGreen,
            Fonts.uppercase,
            ApplicationStyle.backgroundColor.neutral252,
          ]}
          numberOfLines={1}
        >
          {t('home.todoOf')}
          {' '}
          {userName}
        </Text>
        <Text style={[Fonts.p1, Fonts.neutralFFF, ApplicationStyle.backgroundColor.neutral252,
        ]}
        >
          {today}
        </Text>
      </View>
      <View
        style={[
          profilePictureDimensions,
          Alignments.alignCenter,
          Alignments.justifyCenter,
          ApplicationStyle.backgroundColor.primaryDarkBlue,
          Spaces.padding[8],
        ]}
      >
        {userImage ? (
          <Image
            source={{ uri: userImage }}
            // @ts-expect-error because of confusion between view style and image style
            style={[Alignments.fullSize]}
            resizeMode="cover"
          />
        ) : (
          <Text style={[Fonts.p1, Fonts.neutralFFF]}>{userName?.[0]}</Text>
        )}
      </View>
    </View>
  );
}

export default Header;
