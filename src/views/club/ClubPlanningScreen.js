import ClubFacilityPlanningContainer from '../../components/organisms/planning/ClubFacilityPlanningContainer';

/**
 *
 * @param root0
 * @param root0.clubId
 * @param root0.cmId
 * @param root0.initialFacilityId
 * @param root0.initialScope
 * @param root0.initialSelectionKey
 * @param root0.allowSharedPlanning
 */
function ClubPlanning({
  allowSharedPlanning = false,
  clubId,
  cmId = null,
  initialFacilityId = null,
  initialScope = 'club',
  initialSelectionKey = null,
}) {
  return (
    <ClubFacilityPlanningContainer
      allowSharedPlanning={allowSharedPlanning}
      clubId={clubId}
      cmId={cmId}
      initialFacilityId={initialFacilityId}
      initialScope={initialScope}
      initialSelectionKey={initialSelectionKey}
    />
  );
}

export default ClubPlanning;
