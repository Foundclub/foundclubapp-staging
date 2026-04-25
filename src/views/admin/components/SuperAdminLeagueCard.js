import useTheme from '@/theme/themeContext';

import LeagueCard from '@/components/atoms/league/LeagueCard';

/**
 * SuperAdmin League card with a blue design-system surface.
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {import('react-native').ViewStyle | import('react-native').ViewStyle[]} [props.style]
 * @returns {import('react').ReactElement}
 */
function SuperAdminLeagueCard({ children, style }) {
  const { Colors } = useTheme();

  return (
    <LeagueCard
      style={[
        {
          backgroundColor: Colors.primary900,
          borderColor: Colors.primary700,
        },
        style,
      ]}
    >
      {children}
    </LeagueCard>
  );
}

export default SuperAdminLeagueCard;
