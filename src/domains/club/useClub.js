import { getClubFiltersNumber, getClubInitials } from './clubUseCase';

/**
 * Custom hook to manage club-related functionality
 * @inheritdoc
 */
const useClub = () => ({
  getClubFiltersNumber,
  getClubInitials,
});

export default useClub;
