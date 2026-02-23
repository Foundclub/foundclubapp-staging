import React from 'react';

import ClubFacilityPlanningContainer from '../../components/organisms/planning/ClubFacilityPlanningContainer';

/**
 *
 * @param root0
 * @param root0.clubId
 */
function ClubPlanning({ clubId }) {
  return (
    <ClubFacilityPlanningContainer clubId={clubId} />
  );
}

export default ClubPlanning;
