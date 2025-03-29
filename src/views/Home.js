import { Text } from 'react-native';
// hooks
import useTheme from '../theme/themeContext';
import { useAuth } from '../domains/EXAMPLE-auth/EXAMPLE-useAuth';
// components
import ScreenContainer from '../components/templates/ScreenContainer';
import Button from '../components/atoms/button/Button';

/**
 * Home screen component.
 * @returns {import('react').ReactElement}
 */
function Home() {
  // hooks
  const {
    Fonts, Spaces,
  } = useTheme();
  const { logout } = useAuth();

  return (
    <ScreenContainer
      style={[Spaces.paddingVertical[24]]}
    >
      <Text style={[Fonts.h1, Fonts.neutral00]}>
        HOME
      </Text>
      <Button variant="Primary" title="Logout" onPress={logout} />
    </ScreenContainer>
  );
}

export default Home;
