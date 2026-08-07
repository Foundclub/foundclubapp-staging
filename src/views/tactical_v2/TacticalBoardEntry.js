// @ts-nocheck
import { useRoute } from '@react-navigation/native';

import MultiTeamCompositionBoard from './MultiTeamCompositionBoard';
import { shouldOpenMultiTeamBoard } from './multiTeamCompositionUtils';
import LegacyTacticalBoard from './TacticalBoard';

function TacticalBoardEntry() {
  const route = useRoute();
  const params = route?.params || {};

  if (shouldOpenMultiTeamBoard(params)) {
    return <MultiTeamCompositionBoard routeParams={params} />;
  }

  return <LegacyTacticalBoard />;
}

export default TacticalBoardEntry;
