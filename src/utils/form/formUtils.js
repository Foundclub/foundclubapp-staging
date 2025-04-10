import { t } from 'i18next';

/**
 * Get field error.
 * @param {object} param - The parameters.
 * @param {import('react-hook-form').FieldErrors<any>} param.errors - The errors object.
 * @param {string} param.fieldName - The field name.
 * @returns {string | undefined} - The error message.
 */
export const getFieldError = ({ errors, fieldName }) => (
  errors?.[fieldName]?.message
    ? t(errors?.[fieldName]?.message?.toString() || '')
    : undefined
);
