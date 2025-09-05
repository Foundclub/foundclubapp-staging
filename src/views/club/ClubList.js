import useTheme from '@/theme/themeContext';

import ClubListContent from '@/components/organisms/clubListContent/ClubListContent';
import ScreenContainer from '@/components/templates/ScreenContainer';
/**
 * User avatar selection screen component
 * @returns {import('react').ReactElement} User avatar screen component
 */
function ClubList() {
  // hooks
  const {
    Alignments,
    Spaces,
  } = useTheme();

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        Alignments.justifySpaceBetween,
        Alignments.column,
        Alignments.fill,
      ]}
    >
      <ClubListContent />
    </ScreenContainer>
  );
}

export default ClubList;
