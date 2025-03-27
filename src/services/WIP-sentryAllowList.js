/**
 * A map of ignored API status codes.
 * @type {{ [key: number]: boolean }}
 */
export const ignoredApiStatusCodes = {
  // 401: true, // Example
};

/**
 * A map of ignored API error codes.
 * @type {{ [key: string]: boolean }}
 */
export const ignoredApiErrorCodes = {
  // leave_post_overlap: true, // Example
};

/**
 * Captures a Sentry exception if the error code is not ignored.
 * @param {import("axios").AxiosError} error - The axios error.
 * @returns {boolean} Whether the error was captured.
 */
export const isInSentryExceptionsAllowList = (error) => {
  const errorCode = error.response?.data?.code;
  const statusCode = error.response?.status || 0;
  return ignoredApiErrorCodes[errorCode] || ignoredApiStatusCodes[statusCode];
};
