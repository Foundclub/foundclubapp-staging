// @ts-nocheck
import { buildPreservedApiError } from '@/utils/errors/apiError';

import { buildMinorParentalDeclarationPayload } from '../../constants/parentalDeclaration';
import client from '../client';

/**
 * PARENT-LIEN — LES SEPT PORTES DU LIEN PARENT ↔ COMPTE D'UN ENFANT (13 à 17 ans).
 *
 * Serveur : `admin/src/api/parent-link-request/` (routes/parent-link-request-custom.ts).
 * Le parent DEMANDE (numéro de l'enfant + déclaration parentale signée), l'ENFANT accepte
 * ou refuse depuis son compte, et peut retirer le lien. Rien ne relie un compte sans son
 * acceptation : ce fichier ne sait pas écrire `parentAccount`, et le serveur non plus en
 * dehors de l'acceptation.
 *
 * 🔒 UN NUMÉRO NE RÉVÈLE RIEN : la réponse à une demande est la même qu'un compte existe ou
 * non. L'écran ne doit donc jamais dire « compte trouvé » ou « introuvable ».
 *
 * Les erreurs gardent leur STATUT et leur CODE serveur (`PARENT_LINK_…`) : l'écran distingue
 * « renseigne ta date de naissance » d'un numéro impossible et d'une panne.
 */

// Le lecteur du code d'erreur vit dans un module PUR, relu ici pour les appelants du service.
export { parentLinkErrorCode } from './parentLinkErrors';

/**
 * Enveloppe commune : `{ data }` du serveur, ou une erreur qui garde statut et code.
 * @param {() => Promise<any>} call - L'appel.
 * @param {string} prefix - Le préfixe de journal.
 * @returns {Promise<any>} La donnée.
 */
const unwrap = async (call, prefix) => {
  try {
    const response = await call();
    return response?.data?.data ?? null;
  } catch (error) {
    throw buildPreservedApiError(error, prefix);
  }
};

/**
 * POST /parent-links — le parent demande le lien.
 * La déclaration parentale est celle de l'inscription des moins de 15 ans (même texte, même
 * version, même empreinte) : c'est LE PARENT qui la signe ici.
 * @param {{ declaredChildDocumentId?: string, phoneNumber: string }} params - La saisie.
 * @returns {Promise<any>} La demande, vue du parent.
 */
export const requestParentLink = ({ declaredChildDocumentId, phoneNumber }) => unwrap(
  () => client.post('/parent-links', {
    data: {
      ...(declaredChildDocumentId ? { declaredChildDocumentId } : {}),
      legalAcceptance: buildMinorParentalDeclarationPayload({
        metadata: { declaredChildDocumentId: declaredChildDocumentId || null },
        sourceScreen: 'parent_link_request',
        targetType: 'parent_link_request',
      }),
      phoneNumber: String(phoneNumber || '').trim(),
    },
  }),
  'Parent link request failed',
);

/**
 * GET /parent-links/as-parent — les comptes de MES enfants reliés, et mes demandes en cours.
 * @returns {Promise<{ children: any[], requests: any[] }>} La vue du parent.
 */
export const getParentLinksAsParent = async () => {
  const data = await unwrap(
    () => client.get('/parent-links/as-parent'),
    'Parent links (parent) failed',
  );
  return {
    children: Array.isArray(data?.children) ? data.children : [],
    requests: Array.isArray(data?.requests) ? data.requests : [],
  };
};

/**
 * POST /parent-links/:documentId/cancel — le parent retire sa demande.
 * @param {string} documentId - La demande.
 * @returns {Promise<any>} L'accusé.
 */
export const cancelParentLink = (documentId) => unwrap(
  () => client.post(`/parent-links/${encodeURIComponent(documentId)}/cancel`),
  'Parent link cancel failed',
);

/**
 * GET /parent-links/as-child — qui est relié à MON compte, et qui le demande.
 * @returns {Promise<{ eligible: boolean, parent: any, requests: any[] }>} La vue de l'enfant.
 */
export const getParentLinksAsChild = async () => {
  const data = await unwrap(
    () => client.get('/parent-links/as-child'),
    'Parent links (child) failed',
  );
  return {
    eligible: data?.eligible === true,
    parent: data?.parent || null,
    requests: Array.isArray(data?.requests) ? data.requests : [],
  };
};

/**
 * POST /parent-links/:documentId/accept — l'enfant accepte : le SEUL geste qui écrit le lien.
 * @param {string} documentId - La demande.
 * @returns {Promise<any>} Le parent désormais relié.
 */
export const acceptParentLink = (documentId) => unwrap(
  () => client.post(`/parent-links/${encodeURIComponent(documentId)}/accept`),
  'Parent link accept failed',
);

/**
 * POST /parent-links/:documentId/refuse — l'enfant refuse.
 * @param {string} documentId - La demande.
 * @returns {Promise<any>} L'accusé.
 */
export const refuseParentLink = (documentId) => unwrap(
  () => client.post(`/parent-links/${encodeURIComponent(documentId)}/refuse`),
  'Parent link refuse failed',
);

/**
 * POST /parent-links/unlink — l'enfant retire le lien. Effet immédiat côté serveur.
 * @returns {Promise<any>} L'accusé.
 */
export const unlinkParent = () => unwrap(
  () => client.post('/parent-links/unlink'),
  'Parent unlink failed',
);
