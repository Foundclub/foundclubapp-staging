import { closureRefusalText } from '@/domains/facilityClosure/facilityClosureDisplay';

/**
 * Reads an API refusal without depending on the HTTP transport wrapper.
 * @param {any} error API error.
 * @returns {string|null} Server code.
 */
export const getErrorCode = (error) => (
  error?.details?.code || error?.response?.data?.error?.details?.code
  || error?.response?.data?.error?.code || error?.response?.data?.code || error?.code || null
);

/**
 * Explains known creation refusals in French, including the old production wrapper.
 * @param {any} error API error.
 * @param {string} fallback Generic error message.
 * @param {any} t Translation function.
 * @returns {string} Message shown to the organizer.
 */
export const getCreationErrorMessage = (error, fallback, t) => {
  const message = error?.response?.data?.error?.message
    || error?.response?.data?.error || error?.response?.data?.message || error?.message || fallback;
  // CRFERM (13/10, COL-011) : le refus porte la fermeture (`details.closure`, admin CRFERM S2-2) ;
  // la phrase la dit au « tu » (lieu inconnu ici : « Cette installation est fermée … »).
  if (getErrorCode(error) === 'EVENT_FACILITY_CLOSED') {
    const details = error?.details || error?.response?.data?.error?.details || null;
    return closureRefusalText(t, details?.closure || null);
  }
  const normalized = String(message).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (normalized.includes('entrainements ouverts exigent au moins une place externe')) {
    return `${t(
      'eventEdit.trainingOpen.externalLimitRequired',
      'Indique combien de places externes tu ouvres pour cet entraînement.',
    )} ${t('eventWizard.steps.participants.minimumExternalPlaces', 'Minimum : 1 place externe.')}`;
  }
  return typeof message === 'string' ? message : fallback;
};
