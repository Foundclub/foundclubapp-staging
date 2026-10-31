import Joi from 'joi';

import client from '../client';

export const levelSchema = Joi.object({
  documentId: Joi.string().required(),
  name: Joi.string().required(),
}).required();

/**
 * Get all levels
 * @returns {Promise<Level[]>}
 */
export const getLevels = async () => {
  try {
    const response = await client.get('/levels', {
      params: {
        pagination: {
          page: 1,
          pageSize: 200,
        },
        sort: ['name:asc'],
      },
    });

    const schema = Joi.object({
      data: Joi.array().items(levelSchema).required(),
    }).required();

    const validationResult = await schema.validateAsync(response.data, {
      allowUnknown: true,
    });
    return validationResult.data;
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to fetch levels: ${errorToDisplay}`);
  }
};

/**
 * CORR-INSCRIPTION p17 (recette du site, décision A) — les niveaux arrivent par ordre alphabétique
 * (« Départemental », « National », « Pré-National », « Régional »…). On les range du plus bas au
 * plus
 * haut : départemental, pré-régional, régional, pré-national, national, puis le niveau
 * professionnel ;
 * dans un étage, le 3 sous le 2 sous le 1, le nom sans numéro en premier. Un nom inconnu va à la
 * fin.
 * @param {string} nom - Le nom du niveau, tel que le serveur le rend.
 * @returns {number} Son rang, du plus bas au plus haut.
 */
export const rangDuNiveau = (nom) => {
  const texte = String(nom || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const etages = [
    [/^depart/, 0], [/^pre-?\s*region/, 1], [/^region/, 2], [/^pre-?\s*nation/, 3], [/^nation/, 4],
    [/pro/, 5],
  ];
  const etage = etages.find(([motif]) => /** @type {RegExp} */ (motif).test(texte));
  if (!etage) return 1000;
  const numero = /(\d+)\s*$/.exec(texte);
  return /** @type {number} */ (etage[1]) * 10 + (numero ? 10 - Number(numero[1]) : 0);
};

/**
 * Comparateur des niveaux, du plus bas au plus haut (CORR-INSCRIPTION p17).
 * @param {{ name?: string }} a - Un niveau.
 * @param {{ name?: string }} b - Un autre.
 * @returns {number}
 */
export const compareLevels = (a, b) => (rangDuNiveau(a?.name) - rangDuNiveau(b?.name))
  || String(a?.name || '').localeCompare(String(b?.name || ''), 'fr');
