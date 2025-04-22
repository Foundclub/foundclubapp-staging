import { getGeohashForPointAndRadius } from './placesUseCases';

/**
 * Custom hook to manage places-related logic
 * @inheritdoc
 */
const usePlaces = () => ({
  getGeohashForPointAndRadius,
});

export default usePlaces;
