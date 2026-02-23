const LEVELS = {
  debug: 10,
  error: 40,
  info: 20,
  warn: 30,
};

const DEFAULT_LEVEL = 'warn';

const isLocalAppEnvironment = () => String(process.env.APP_ENV || '').trim().toLowerCase() === 'local';

const normalizeLevel = (rawLevel) => {
  const normalized = String(rawLevel || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(LEVELS, normalized) ? normalized : DEFAULT_LEVEL;
};

const getConfiguredLevel = () => normalizeLevel(process.env.APP_LOG_LEVEL || DEFAULT_LEVEL);

const normalizeScope = (scope) => String(scope || '').trim().toLowerCase();

const parseScopeFilter = () => {
  const rawScopes = String(process.env.APP_LOG_SCOPES || '').trim();
  if (!rawScopes) return null;

  const scopes = rawScopes
    .split(',')
    .map((scope) => normalizeScope(scope))
    .filter(Boolean);

  return scopes.length ? new Set(scopes) : null;
};

const canLogVerbose = () => __DEV__ && isLocalAppEnvironment();

const shouldLogScope = (scope, level) => {
  if (level === 'warn' || level === 'error') return true;

  if (!canLogVerbose()) return false;

  const scopedFilter = parseScopeFilter();
  if (!scopedFilter) return true;
  if (scopedFilter.has('*')) return true;

  return scopedFilter.has(normalizeScope(scope));
};

const shouldLogLevel = (level) => {
  const configuredLevel = getConfiguredLevel();
  return LEVELS[level] >= LEVELS[configuredLevel];
};

const formatMessage = (scope, message) => {
  const safeScope = scope ? `[${scope}]` : '[app]';
  return `${safeScope} ${message}`;
};

const logWithLevel = (level, scope, message, meta) => {
  if (!shouldLogLevel(level)) return;
  if (!shouldLogScope(scope, level)) return;

  const formattedMessage = formatMessage(scope, message);
  if (meta === undefined) {
    if (level === 'error') {
      console.error(formattedMessage);
      return;
    }
    if (level === 'warn') {
      console.warn(formattedMessage);
      return;
    }
    if (level === 'info') {
      console.info(formattedMessage);
      return;
    }
    console.debug(formattedMessage);
    return;
  }

  if (level === 'error') {
    console.error(formattedMessage, meta);
    return;
  }
  if (level === 'warn') {
    console.warn(formattedMessage, meta);
    return;
  }
  if (level === 'info') {
    console.info(formattedMessage, meta);
    return;
  }
  console.debug(formattedMessage, meta);
};

/**
 * @param {string} scope
 * @returns {{
 *  debug: (message: string, meta?: any) => void;
 *  info: (message: string, meta?: any) => void;
 *  warn: (message: string, meta?: any) => void;
 *  error: (message: string, meta?: any) => void;
 * }}
 */
export const createLogger = (scope) => ({
  debug: (message, meta) => logWithLevel('debug', scope, message, meta),
  error: (message, meta) => logWithLevel('error', scope, message, meta),
  info: (message, meta) => logWithLevel('info', scope, message, meta),
  warn: (message, meta) => logWithLevel('warn', scope, message, meta),
});
