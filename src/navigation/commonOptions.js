import { CardStyleInterpolators } from '@react-navigation/stack';
import HeaderBackButton from '../components/atoms/EXAMPLE-headerBackButton/EXAMPLE-HeaderBackButton';

export const commonOptions = {
  headerShown: true,
  headerBackTitleVisible: false,
  title: '',
  headerBackImage: () => <HeaderBackButton />,
  headerShadowVisible: false,
  cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
};
