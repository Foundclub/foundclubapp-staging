// Le VRAI i18next : les libelles viennent de `fr.js` et `en.js`, pas des replis.
import '@/theme/strings';

import i18next from 'i18next';

import { COACH_ROLE_OPTIONS, getCoachRoleLabel } from '../coachRoles';

// RECRUTER-TUNNEL (audit V1, H3) — la table qui traduit `coachRole`. Elle est
// lue par le tunnel, son recapitulatif et Mes activites : si une valeur du
// serveur n'y figure pas, elle s'affiche brute, exactement le defaut de H3.

// L'enumeration `coachRole` du schema serveur
// (`admin/src/api/recruitment-ad/content-types/recruitment-ad/schema.json`).
const ROLES_DU_SERVEUR = [
  'entraineur_principal',
  'entraineur_adjoint',
  'preparateur_physique',
  'entraineur_gardiens',
  'analyste_video',
  'team_manager',
  'other',
];

afterEach(async () => {
  await i18next.changeLanguage('fr');
});

describe('coachRoles — la table des roles d entraineur', () => {
  it('couvre CHAQUE valeur que le serveur peut enregistrer', () => {
    expect(COACH_ROLE_OPTIONS.map((option) => option.value)).toEqual(ROLES_DU_SERVEUR);
  });

  it('aucun libelle n est la valeur technique', () => {
    COACH_ROLE_OPTIONS.forEach((option) => {
      expect(option.label).not.toBe(option.value);
      expect(option.label).not.toContain('_');
    });
  });

  it('« entraineur_adjoint » se lit « Entraîneur adjoint », puis « Assistant coach » en anglais', async () => {
    expect(getCoachRoleLabel('entraineur_adjoint')).toBe('Entraîneur adjoint');

    await i18next.changeLanguage('en');

    expect(getCoachRoleLabel('entraineur_adjoint')).toBe('Assistant coach');
  });

  it('un role « autre » se lit par sa precision, et sans precision par « Autre rôle »', () => {
    expect(getCoachRoleLabel('other', '  Préparateur mental ')).toBe('Préparateur mental');
    expect(getCoachRoleLabel('other', '')).toBe('Autre rôle');
  });

  it('sans role, rien ; un role inconnu de la table reste tel quel', () => {
    expect(getCoachRoleLabel(undefined)).toBe('');
    expect(getCoachRoleLabel('Coach adjoint')).toBe('Coach adjoint');
  });
});
