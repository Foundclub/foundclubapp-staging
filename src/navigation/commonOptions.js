import { CardStyleInterpolators } from '@react-navigation/stack';

import Header from '@/components/atoms/header/Header';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';

export const commonOptions = {
  cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
  headerBackImage: () => <HeaderBackButton />,
  headerBackTitle: '',
  headerShadowVisible: false,
  headerShown: true,
  headerTitle: () => <Header />,
  headerTransparent: true,
  title: '',
};
