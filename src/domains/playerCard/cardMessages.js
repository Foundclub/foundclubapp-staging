// @ts-nocheck
/**
 * Construction PURE des textes de partage de la carte (titre + message).
 * Destination repo : app/src/domains/playerCard/cardMessages.js
 *
 * Aucun t() code en dur ici : les libelles sont injectes (le composant fournit
 * les traductions via react-i18next). Ce module ne fait QUE composer/assembler,
 * pour rester testable en isolation et coherent avec buildShareMessageWithUrl.
 */

/**
 * Titre du partage (share sheet natif).
 * @param {object} model modele issu de buildPlayerCardModel
 * @param {object} [labels] { fallbackName }
 * @returns {string}
 */
export const buildCardShareTitle = (model = {}, labels = {}) => {
  const fullName = [model.firstname, model.lastname].filter(Boolean).join(' ').trim();
  return fullName || labels.fallbackName || 'FoundClub';
};

/**
 * Message de partage. Assemble une accroche + le lien (QR/install) via le meme
 * format que buildShareMessageWithUrl (intro \n\n label:\nurl).
 * @param {object} params
 * @param {object} params.model modele carte
 * @param {object} params.labels { intro, linkLabel, availableSuffix }
 * @returns {{ title: string, message: string, url: string }}
 */
export const buildCardShareMessage = ({ labels = {}, model = {} } = {}) => {
  const title = buildCardShareTitle(model, labels);
  const parts = [];
  const intro = String(labels.intro || '').trim();
  if (intro) parts.push(intro);
  if (model.isAvailable && labels.availableSuffix) {
    parts.push(String(labels.availableSuffix).trim());
  }
  const introBlock = parts.filter(Boolean).join(' ');

  const sections = [introBlock].filter(Boolean);
  const url = String(model.qrUrl || '').trim();
  if (url) {
    const linkLabel = String(labels.linkLabel || '').trim();
    sections.push(linkLabel ? `${linkLabel} :\n${url}` : url);
  }

  return { message: sections.join('\n\n'), title, url };
};

export default buildCardShareMessage;
