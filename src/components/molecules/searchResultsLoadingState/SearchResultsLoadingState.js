import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Loader from '@/components/atoms/loader/Loader';

/**
 * Loading state displayed while search results are resolving.
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.description]
 * @returns {import('react').ReactElement}
 */
function SearchResultsLoadingState({
  description,
  title,
}) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();

  return (
    <View
      style={[
        ApplicationStyle.backgroundColor.primary900,
        ApplicationStyle.borderRadius16,
        Alignments.alignCenter,
        Spaces.gap[12],
        Spaces.padding[24],
        Spaces.marginVertical[24],
        {
          borderColor: `${Colors.primary500}33`,
          borderWidth: 1,
        },
      ]}
    >
      <Loader color={Colors.primary500} size="small" />
      <Text style={[Fonts.h3, Fonts.neutral00, Fonts.textCenter]}>
        {title}
      </Text>
      {description ? (
        <Text style={[Fonts.p1, Fonts.neutral200, Fonts.textCenter]}>
          {description}
        </Text>
      ) : null}
    </View>
  );
}

export default SearchResultsLoadingState;
