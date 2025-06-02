import { useTranslation } from 'react-i18next';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import TeamListContent from '@/components/organisms/teamListContent/TeamListContent';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

/**
 * Team list screen component
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Team list screen component
 */
function TeamList({ navigation, route }) {
  const { clubId } = route?.params ?? {};
  const { t } = useTranslation();
  const { canManageTeam } = useAuth();

  // hooks
  const {
    Alignments,
    Spaces,
  } = useTheme();

  const handleAddTeam = () => {
    navigation.navigate(RouteNames.TeamEdit, {
      clubId,
    });
  };

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
      <TeamListContent clubId={clubId} />
      {
        canManageTeam ? (
          <Button
            onPress={handleAddTeam}
            title={t('teamList.actions.add')}
            variant="Primary"
          />
        ) : null
      }
    </ScreenContainer>
  );
}

export default TeamList;
