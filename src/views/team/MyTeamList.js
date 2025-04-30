import useTheme from '@/theme/themeContext';

import TeamListContent from '@/components/organisms/teamListContent/TeamListContent';
import ScreenContainer from '@/components/templates/ScreenContainer';

/**
 * Team list screen component
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Team list screen component
 */
function MyTeamList({ route }) {
  const { playerId } = route?.params ?? {};

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
      <TeamListContent playerId={playerId} />
    </ScreenContainer>
  );
}

export default MyTeamList;
