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

/**
 * CARTECODE (registre des mineurs ligne 41, « 6- C pour TOUT LE MONDE ») — ce qui part avec
 * la carte, à montrer AVANT chaque partage, et ce qui ne part jamais. Les clés sont traduites
 * par l'écran ; seules les informations réellement sur la carte sont nommées.
 * @param {object} params
 * @param {object} params.model modèle carte (buildPlayerCardModel)
 * @param {{ kind?: string, personal?: boolean }} [params.qr] cible du code QR (buildCardQrTarget)
 * @returns {{ parts: Array<{ key: string, value?: unknown }>, never: string[] }}
 */
export const buildCardDisclosure = ({ model = {}, qr = {} } = {}) => {
  const parts = [{ key: model.hasPhoto ? 'photoAndName' : 'name' }];
  if (model.age !== null && model.age !== undefined) parts.push({ key: 'age', value: model.age });
  if (model.city) parts.push({ key: 'city', value: model.city });
  if (model.height || model.weight) parts.push({ key: 'body' });
  parts.push({ key: model.isAvailable ? 'available' : 'unavailable' });
  if (qr.kind && qr.kind !== 'none') parts.push({ key: qr.personal ? 'qrProfile' : 'qrNeutral' });
  parts.push({ key: model.isAvailable ? 'messageLooking' : 'message' });
  return { never: ['contact'], parts };
};

export default buildCardShareMessage;
