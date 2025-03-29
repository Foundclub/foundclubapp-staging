import { CardStyleInterpolators } from '@react-navigation/stack';

export const commonOptions = {
  headerShown: true,
  headerBackTitleVisible: false,
  title: '',
  // headerBackImage: () => <HeaderBackButton />,
  headerShadowVisible: false,
  cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
};
