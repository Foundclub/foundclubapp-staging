import PlanningWeekFullscreenBase from './PersonalPlanningWeekFullscreen.js';

function PersonalPlanningWeekFullscreen(props) {
  const route = props?.route || {};

  return (
    <PlanningWeekFullscreenBase
      {...props}
      route={{
        ...route,
        params: {
          ...(route?.params || {}),
          sourceType: route?.params?.sourceType || 'personal',
        },
      }}
    />
  );
}

export default PersonalPlanningWeekFullscreen;
