import React from 'react';

import useTheme from '@/theme/themeContext';

import CMPlanningContent from '@/components/organisms/planning/CMPlanningContent';
import ScreenContainer from '@/components/templates/ScreenContainer';

/**
 * CM Planning - Unified planning view for all sections of a MultisportClub
 * @param root0
 * @param root0.navigation
 * @param root0.route
 */
function CMPlanningScreen({ navigation, route }) {
  const { cmId } = route?.params ?? {};
  const { Alignments, Spaces } = useTheme();

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Alignments.column,
        Alignments.fill,
      ]}
    >
      <CMPlanningContent cmId={cmId} navigation={navigation} />
    </ScreenContainer>
  );
}

export default CMPlanningScreen;
