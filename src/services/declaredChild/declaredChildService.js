// @ts-nocheck
import Joi from 'joi';

import { createLogger } from '@/utils/logger/logger';

import client from '../client';
import { buildChildPayload } from './declaredChildRules';

// Re-export : les appelants historiques du service continuent de marcher.
export { buildChildPayload };

/**
 * PARENT P2 — LES QUATRE GESTES DE « MES ENFANTS ».
 *
 * Le tiroir serveur (`admin/src/api/declared-child/`) n'a QUE quatre routes, et
 * c'est sa protection principale : ni `find` global, ni `findOne` par
 * identifiant. Ce fichier ne peut donc pas en inventer une cinquième.
 *
 * 🔒 CE QUE LE SERVEUR NE REND JAMAIS : la date de naissance. Il rend un `age`
 * calculé (`declared-child.ts`, `toPublicChild`) — exactement comme le profil
 * public d'un compte. Conséquence directe et voulue sur l'écran de
 * modification : il ne peut PAS pré-remplir la date. Une clef absente reste
 * absente, et le serveur garde alors celle qu'il a en base.
 */

const declaredChildLogger = createLogger('declared-child');

/**
 * 🧨 CHAQUE CHAMP FACULTATIF PEUT ARRIVER À `null`.
 *
 * `toPublicChild` construit `club`, `team`, `photo`, `position` et `number` avec
 * `|| null` / `?? null` : ils SONT nuls sur une fiche qui vient d'être créée.
 * Un `optional()` sans `allow(null)` refuserait la ligne — et c'est exactement
 * le défaut qui a vidé un écran entier ailleurs dans ce dépôt (une liste validée
 * en bloc meurt pour une ligne).
 */
const declaredChildSchema = Joi.object({
  age: Joi.number().allow(null).optional(),
  club: Joi.object().unknown(true).allow(null).optional(),
  documentId: Joi.string().required(),
  firstname: Joi.string().allow('', null).optional(),
  lastname: Joi.string().allow('', null).optional(),
  number: Joi.number().allow(null).optional(),
  photo: Joi.object().unknown(true).allow(null).optional(),
  position: Joi.string().allow('', null).optional(),
  team: Joi.object().unknown(true).allow(null).optional(),
}).required();

/**
 * Valide LIGNE PAR LIGNE, jamais le tableau entier.
 *
 * Un enfant illisible est écarté et journalisé ; les autres s'affichent. Une
 * validation en bloc ferait disparaître toute la fratrie pour une seule fiche
 * abîmée — et sans la moindre trace côté serveur, puisque la réponse est un 200.
 * @param {any} responseData - Le corps de la réponse.
 * @returns {Promise<any[]>} Les fiches lisibles.
 */
const selectValidChildren = async (responseData) => {
  const entries = Array.isArray(responseData?.data) ? responseData.data : [];
  /** @type {any[]} */
  const enfants = [];
  /** @type {string[]} */
  const ecartes = [];

  await Promise.all(entries.map(async (/** @type {any} */ entry) => {
    try {
      enfants.push(await declaredChildSchema.validateAsync(entry, { allowUnknown: true }));
    } catch {
      ecartes.push(String(entry?.documentId || 'sans-identifiant'));
    }
  }));

  if (ecartes.length) {
    declaredChildLogger.warn('fiche(s) enfant illisible(s) ecartee(s)', {
      documentIds: ecartes,
      rejected: ecartes.length,
    });
  }

  // Le serveur trie déjà par date de création ; `Promise.all` ne garantit pas
  // l'ordre d'insertion, on le rétablit sur l'ordre d'origine.
  return entries
    .map((/** @type {any} */ entry) => enfants.find(
      (enfant) => enfant.documentId === entry?.documentId,
    ))
    .filter(Boolean);
};

/**
 * GET /declared-children/mine — MES enfants déclarés.
 * @returns {Promise<any[]>} Les fiches, les plus anciennes d'abord.
 */
export const getMyDeclaredChildren = async () => {
  const response = await client.get('/declared-children/mine');
  return selectValidChildren(response?.data);
};

/**
 * POST /declared-children — déclarer un enfant.
 * @param {object} payload - La charge, fabriquée par `buildChildPayload`.
 * @returns {Promise<any>} La fiche créée.
 */
export const createDeclaredChild = async (payload) => {
  const response = await client.post('/declared-children', { data: payload });
  return response?.data?.data || null;
};

/**
 * PUT /declared-children/:documentId — corriger une fiche à moi.
 * @param {string} documentId - L'identifiant STABLE de la fiche.
 * @param {object} payload - Les seuls champs à corriger.
 * @returns {Promise<any>} La fiche corrigée.
 */
export const updateDeclaredChild = async (documentId, payload) => {
  const response = await client.put(`/declared-children/${documentId}`, { data: payload });
  return response?.data?.data || null;
};

/**
 * DELETE /declared-children/:documentId — effacer VRAIMENT une fiche à moi.
 *
 * Le serveur supprime la ligne, il n'anonymise pas : pour un mineur,
 * l'effacement est un droit. Ce qui survit malgré tout — le prénom déjà figé
 * dans une composition passée — est dit à l'écran, pas ici.
 * @param {string} documentId - L'identifiant de la fiche.
 * @returns {Promise<any>} L'accusé de suppression.
 */
export const deleteDeclaredChild = async (documentId) => {
  const response = await client.delete(`/declared-children/${documentId}`);
  return response?.data?.data || null;
};
