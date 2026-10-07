import {
  AUTORISATIONS_PAR_DEFAUT,
  autorisationsDuGroupe,
  autorisationsModifiees,
  envoiReserveAuxAdmins,
  peutDansLeGroupe,
  resumeDesAutorisations,
} from './autorisationsDuGroupe';

// MSG1BA (§3.15, §3.16) — les autorisations d'un groupe (contrat MESSAGERIE-1B §5).

const t = (/** @type {string} */ _cle, /** @type {any} */ repli) => {
  const gabarit = typeof repli === 'string' ? repli : repli?.defaultValue;
  return String(gabarit).replace(/\{\{(\w+)\}\}/g, (m, nom) => String(repli?.[nom] ?? m));
};

describe('autorisationsDuGroupe', () => {
  test('AG1 — les defauts du contrat : nom non, photo non, messages oui, ajout non', () => {
    expect(AUTORISATIONS_PAR_DEFAUT).toEqual({
      membersCanAddMembers: false,
      membersCanEditName: false,
      membersCanEditPhoto: false,
      membersCanSendMessages: true,
    });
  });

  test('AG2 — serveur d avant 1B (pas de `groupPermissions`) : null ; sinon les 4 clefs', () => {
    expect(autorisationsDuGroupe({ type: 'group' })).toBeNull();
    expect(autorisationsDuGroupe({ groupPermissions: { membersCanEditName: true } })).toEqual({
      ...AUTORISATIONS_PAR_DEFAUT,
      membersCanEditName: true,
    });
  });

  test('AG3 — a la creation, seul ce qui differe des defauts part ; rien = undefined', () => {
    expect(autorisationsModifiees(AUTORISATIONS_PAR_DEFAUT)).toBeUndefined();
    expect(autorisationsModifiees({
      ...AUTORISATIONS_PAR_DEFAUT,
      membersCanSendMessages: false,
    })).toEqual({ membersCanSendMessages: false });
  });

  test('AG4 — admin : tout ; membre : selon la clef ; serveur d avant : admins seuls', () => {
    const ouvert = { ...AUTORISATIONS_PAR_DEFAUT, membersCanEditName: true };
    expect(peutDansLeGroupe({ autorisations: null, estAdmin: true }, 'membersCanEditName'))
      .toBe(true);
    expect(peutDansLeGroupe({ autorisations: ouvert, estAdmin: false }, 'membersCanEditName'))
      .toBe(true);
    expect(peutDansLeGroupe({ autorisations: ouvert, estAdmin: false }, 'membersCanEditPhoto'))
      .toBe(false);
    expect(peutDansLeGroupe({ autorisations: null, estAdmin: false }, 'membersCanAddMembers'))
      .toBe(false);
  });

  test('AG5 — « seuls les admins envoient » : jamais pour un admin, jamais sans 1B', () => {
    const ferme = { ...AUTORISATIONS_PAR_DEFAUT, membersCanSendMessages: false };
    expect(envoiReserveAuxAdmins({ autorisations: ferme, estAdmin: false })).toBe(true);
    expect(envoiReserveAuxAdmins({ autorisations: ferme, estAdmin: true })).toBe(false);
    expect(envoiReserveAuxAdmins({ autorisations: null, estAdmin: false })).toBe(false);
  });

  test('AG6 — le resume du pack', () => {
    expect(resumeDesAutorisations(AUTORISATIONS_PAR_DEFAUT, t)).toBe('Les membres peuvent écrire');
    expect(resumeDesAutorisations({
      membersCanAddMembers: true,
      membersCanEditName: true,
      membersCanEditPhoto: false,
      membersCanSendMessages: true,
    }, t)).toBe('Les membres peuvent écrire, renommer, ajouter des membres');
    expect(resumeDesAutorisations({
      ...AUTORISATIONS_PAR_DEFAUT,
      membersCanSendMessages: false,
    }, t)).toBe('Seuls les admins peuvent agir');
  });
});
