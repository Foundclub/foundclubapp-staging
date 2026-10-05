import { canManageTeamAd, isAdAuthor } from '../teamMembership';

// ANNONCE-RENOUVELER (decision d'Adel « renouveler A », 05/10) — point 1 : QUI voit
// « Renouveler 30 jours ».
//
// Le serveur ne laisse renouveler que l'AUTEUR de l'annonce :
//   admin/src/api/recruitment-ad/controllers/recruitment-ad-custom.ts (renew)
//   `if (ad.author?.id !== user.id) return ctx.forbidden(...)`.
// La police de la route (`can-manage-recruitment-ad`) laisse passer les entraineurs et
// les dirigeants de l'equipe ; c'est le controleur qui les refuse ensuite. L'app ne doit
// donc PAS reprendre `canManageTeamAd` (qui dit oui a toute l'equipe) : un co-entraineur
// verrait un bouton qui repond 403 a chaque appui.
//
// Les comptes arrivent comme `sanitizeUser` les rend : `id` a null, `documentId` rempli.

const TEAM = { club: { documentId: 'club-mfc' }, documentId: 'team-u15' };
const AD = { author: { documentId: 'u-auteur', id: 7 }, documentId: 'ad-u15', team: TEAM };

const AUTEUR = { documentId: 'u-auteur', id: null, trainedTeams: [] };
const CO_ENTRAINEUR = { documentId: 'u-coach', id: null, trainedTeams: [TEAM] };

describe('ANNONCE-RENOUVELER 1 — isAdAuthor : l auteur, et lui seul', () => {
  it('le compte connecte qui a cree l annonce en est l auteur', () => {
    expect(isAdAuthor(AD, AUTEUR)).toBe(true);
  });

  it('le CO-ENTRAINEUR gere l annonce mais n en est pas l auteur', () => {
    expect(canManageTeamAd(AD, CO_ENTRAINEUR)).toBe(true);
    expect(isAdAuthor(AD, CO_ENTRAINEUR)).toBe(false);
  });

  it('les deux formes de compte : par documentId, ou par id quand le documentId manque', () => {
    expect(isAdAuthor(AD, { id: 7 })).toBe(true);
    expect(isAdAuthor(AD, { id: 8 })).toBe(false);
  });

  it('sans auteur (les 125 annonces de prod d avant ANNONCE-AUTEUR), personne', () => {
    expect(isAdAuthor({ ...AD, author: null }, AUTEUR)).toBe(false);
    expect(isAdAuthor({ ...AD, author: undefined }, AUTEUR)).toBe(false);
  });

  it('sans compte ou sans annonce, non', () => {
    expect(isAdAuthor(AD, null)).toBe(false);
    expect(isAdAuthor(null, AUTEUR)).toBe(false);
    expect(isAdAuthor(AD, { documentId: '', id: null })).toBe(false);
  });
});
