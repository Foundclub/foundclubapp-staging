/**
 * ACQ-SENTRY-SERVEUR : ce que l'application laisse partir chez Sentry.
 *
 * Mesuré le 03/11/2026 sur 10 événements réels : un numéro de téléphone dans le fil
 * d'actions (`/api/search/events?q=...`, production) et le texte libre des recherches
 * en clair. Le SDK enregistre chaque adresse appelée, paramètres compris.
 *
 * On garde le chemin, les noms des paramètres et les valeurs de pure structure
 * (pagination, tri, champs demandés) : c'est ce qui sert à réparer. Toute autre valeur
 * part masquée, quelle que soit sa forme : une liste de motifs raterait un nom.
 *
 * Pas de `URLSearchParams` : celui de React Native est partiel.
 *
 * ponytail: e-mails et numéros sont masqués par motif dans le texte libre des journaux
 * et des erreurs ; un nom de personne y passerait. Sortie : ne plus journaliser de texte
 * saisi. Mesuré le 03/11 : 0 contact dans 164 journaux.
 */
const KEPT_VALUES = /^(fields|locale|pagination|populate|sort|status)(\[|$)/;
const MASK = '[retire]';
const EMAIL_PATTERN = /[^\s@()<>"',;:]+@[^\s@()<>"',;:]+/g;
const PHONE_PATTERN = /(?:\+|\b00)\d[\d .-]{7,}\d|\b0[1-9](?:[ .-]?\d{2}){4}\b/g;
const URL_WITH_QUERY = /(?:https?:\/\/|\/api\/)[^\s"'?#]*[?#][^\s"']*/g;

/**
 * Décode un nom de paramètre sans jamais lever.
 * @param {string} name - Le nom, peut-être encodé.
 * @returns {string} Le nom lisible.
 */
const decodeName = (name) => {
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
};

/**
 * Masque les valeurs d'une chaîne de paramètres, garde les noms.
 * @param {string} query - La chaîne, sans le `?`.
 * @returns {string} La chaîne nettoyée.
 */
const scrubQuery = (query) => query.split('&').map((pair) => {
  const separator = pair.indexOf('=');
  if (separator < 0) return pair;
  const name = pair.slice(0, separator);
  const decoded = decodeName(name);
  // `populate[club][filters][email][$eq]` commence comme une structure et porte une valeur.
  const isStructure = KEPT_VALUES.test(decoded) && !decoded.includes('filters');
  return `${name}=${isStructure ? pair.slice(separator + 1) : MASK}`;
}).join('&');

/**
 * Retire le fragment d'une adresse et masque les valeurs de ses paramètres.
 * @param {any} url - L'adresse.
 * @returns {any} L'adresse nettoyée ; ce qui n'est pas du texte reste tel quel.
 */
export const scrubUrl = (url) => {
  if (typeof url !== 'string') return url;
  const [withoutFragment] = url.split('#');
  const separator = withoutFragment.indexOf('?');
  if (separator < 0) return withoutFragment;
  return `${withoutFragment.slice(0, separator)}?${scrubQuery(withoutFragment.slice(separator + 1))}`;
};

/**
 * Nettoie un texte libre : adresses, e-mails, numéros.
 * @param {string} text - Le texte.
 * @returns {string} Le texte nettoyé.
 */
const scrubText = (text) => text
  .replace(URL_WITH_QUERY, (url) => scrubUrl(url))
  .replace(EMAIL_PATTERN, MASK)
  .replace(PHONE_PATTERN, MASK);

/**
 * Nettoie tous les textes d'une valeur : le SDK range le corps d'une erreur serveur
 * dans `extra.__serialized__`.
 * @param {any} value - La valeur.
 * @returns {any} La valeur nettoyée.
 */
const scrubDeep = (value) => {
  if (typeof value === 'string') return scrubText(value);
  if (Array.isArray(value)) return value.map(scrubDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, scrubDeep(child)]));
  }
  return value;
};

/**
 * Nettoie le bloc `data` d'une ligne du fil ou d'une requête tracée.
 * @param {any} data - Le bloc.
 * @returns {void}
 */
const scrubData = (data) => {
  if (!data) return;
  delete data.arguments;
  delete data['http.fragment'];
  if (typeof data['http.query'] === 'string') {
    data['http.query'] = scrubQuery(data['http.query'].replace(/^\?/, ''));
  }
  if (data.url) data.url = scrubUrl(data.url);
};

/**
 * Nettoie une ligne du fil d'actions, avant qu'elle n'entre dans le fil natif.
 * @param {any} breadcrumb - La ligne.
 * @returns {any} La ligne nettoyée.
 */
export const scrubSentryBreadcrumb = (breadcrumb) => {
  scrubData(breadcrumb.data);
  if (typeof breadcrumb.message === 'string') breadcrumb.message = scrubText(breadcrumb.message);
  return breadcrumb;
};

/**
 * Dernier passage avant l'envoi d'une erreur ou d'une trace : le fil venu du natif
 * n'est pas passé par `beforeBreadcrumb`.
 * @param {any} event - L'événement.
 * @returns {any} L'événement nettoyé, jamais perdu.
 */
export const scrubSentryEvent = (event) => {
  try {
    event.breadcrumbs?.forEach(scrubSentryBreadcrumb);
    event.spans?.forEach((/** @type {any} */ span) => {
      scrubData(span.data);
      if (typeof span.description === 'string') span.description = scrubText(span.description);
    });
    scrubData(event.contexts?.trace?.data);
    if (event.request?.url) event.request.url = scrubUrl(event.request.url);
    delete event.request?.query_string;
    if (event.extra) event.extra = scrubDeep(event.extra);
  } catch {
    // Une panne sans contexte vaut mieux qu'une panne perdue ou une donnée qui part.
    delete event.breadcrumbs;
    delete event.extra;
    delete event.spans;
    delete event.request;
  }
  event.exception?.values?.forEach((/** @type {any} */ exception) => {
    if (typeof exception.value === 'string') exception.value = scrubText(exception.value);
  });
  if (typeof event.message === 'string') event.message = scrubText(event.message);
  return event;
};
