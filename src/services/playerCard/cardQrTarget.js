// @ts-nocheck
/**
 * Construit la cible du QR code de la carte joueur/coach/equipe.
 * Destination repo : app/src/services/playerCard/cardQrTarget.js
 *
 * v1 : aucune page profil public web n'existe (verifie : web/src/seo/routes.ts
 * n'expose que clubs & events/teams). Le QR pointe donc sur l'install landing
 * tracke (chantier A). Des qu'une page profil public existera, passer
 * isProfilePublic=true + publicPath pour basculer automatiquement.
 *
 * La DECISION (quelle URL choisir) est isolee dans `resolveCardQrTarget` (PUR,
 * teste). La resolution reelle des URLs delegue a app/src/utils/shareLinks.js.
 */
import {
  buildInstallLandingUrl,
  buildPublicWebUrl,
} from '@/utils/shareLinks';

/**
 * Decision pure : choisit l'URL du QR selon la disponibilite d'une page publique.
 * Ne fait AUCUN reseau, aucune construction d'URL (les URLs sont passees toutes faites).
 * @param {object} args
 * @param {boolean} [args.isProfilePublic] le profil a-t-il une page web publique ?
 * @param {string|null} [args.publicUrl] URL de la page profil publique (si dispo)
 * @param {string|null} [args.installUrl] URL de l'install landing tracke (fallback)
 * @returns {{ url: string, kind: 'public'|'install'|'none' }}
 */
export const resolveCardQrTarget = ({
  installUrl = null,
  isProfilePublic = false,
  publicUrl = null,
} = {}) => {
  if (isProfilePublic && publicUrl) {
    return { kind: 'public', url: publicUrl };
  }
  if (installUrl) {
    return { kind: 'install', url: installUrl };
  }
  return { kind: 'none', url: '' };
};

/**
 * Construit la cible du QR pour un joueur/coach a partir de son userData.
 * @param {object} params
 * @param {object} params.user userData Strapi
 * @param {'player'|'coach'|'team'} [params.audience]
 * @param {boolean} [params.isProfilePublic] v2 : true quand la page web existera
 * @param {string} [params.publicPath] v2 : ex. `/joueurs/<id>/<slug>`
 * @returns {{ url: string, kind: 'public'|'install'|'none' }}
 */
export const buildCardQrTarget = ({
  audience = 'player',
  isProfilePublic = false,
  publicPath = null,
  user = {},
} = {}) => {
  const id = user?.documentId || user?.id || '';
  const installUrl = buildInstallLandingUrl({
    id: String(id),
    source: 'card',
    type: audience,
  });
  const publicUrl = isProfilePublic && publicPath
    ? buildPublicWebUrl({ path: publicPath })
    : null;
  return resolveCardQrTarget({ installUrl, isProfilePublic, publicUrl });
};

export default buildCardQrTarget;
