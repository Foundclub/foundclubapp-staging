/**
 * La question de la mission 1, chargée au geste : elle tire le client HTTP, que la couche du guide,
 * montée partout, n'a pas à charger pour autant (voir `useTour.js`).
 * @returns {import('react').ComponentType} L'écran de la question.
 */
const loadTourTeamChoice = () => {
  // eslint-disable-next-line global-require
  const TourTeamChoice = require('@/components/molecules/tour/TourTeamChoice').default;
  return TourTeamChoice;
};

export default loadTourTeamChoice;
