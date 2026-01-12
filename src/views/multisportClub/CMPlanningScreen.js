import React from 'react';
import ScreenContainer from '@/components/templates/ScreenContainer';
import CMPlanningContent from '@/components/organisms/planning/CMPlanningContent';
import useTheme from '@/theme/themeContext';

/**
 * CM Planning - Unified planning view for all sections of a MultisportClub
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
