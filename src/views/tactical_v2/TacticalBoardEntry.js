// @ts-nocheck
import { useRoute } from '@react-navigation/native';

import MultiTeamCompositionBoard from './MultiTeamCompositionBoard';
import { inferIsMultiTeamComposition } from './multiTeamCompositionUtils';
import LegacyTacticalBoard from './TacticalBoard';

function TacticalBoardEntry() {
  const route = useRoute();
  const params = route?.params || {};

  if (inferIsMultiTeamComposition(params)) {
    return <MultiTeamCompositionBoard routeParams={params} />;
  }

  return <LegacyTacticalBoard />;
}

export default TacticalBoardEntry;
