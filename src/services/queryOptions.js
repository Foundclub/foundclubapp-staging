export const keepPreviousPageData = (/** @type {any} */ previousData) => previousData;

/**
 * @param {{ placeholderData?: any }} [options]
 * @returns {any}
 */
export const getPlaceholderDataOption = (options = {}) => (
  Object.prototype.hasOwnProperty.call(options || {}, 'placeholderData')
    ? options.placeholderData
    : keepPreviousPageData
);
