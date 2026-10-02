import fr from '@/theme/strings/translations/fr';

import { buildProfileFormValues, profileSchema } from '../profileFormContract';

// FINITIONS8 · POINT 4 (tournee 9) — « TAILLE (M) » ACCEPTAIT 182 SANS CONTROLE.
//
// Le formulaire du profil (ProfileEdit, ProfileEdit.web, SelfProfilePlayerCoach — tous par ce
// contrat) acceptait n'importe quelle chaine : 182 sous « Taille (m) » partait au serveur, et la
// fiche affichait « 182 m ». L'inscription, elle, demandait deja des centimetres.
// ✅ Une seule unite a la saisie : les CENTIMETRES, entre 100 et 250. Une ancienne valeur en
// metres (« 1,80 ») est relue et convertie ; ce qui part au serveur est toujours en cm.
// L'affichage : UserDetails.FINITIONS8.taille.test.js.

const valider = (/** @type {string} */ height) => profileSchema.validate({
  firstname: 'Hugo',
  height,
  lastname: 'Lemaire',
});

describe('FINITIONS8 · point 4 — la taille se saisit en centimetres, bornee', () => {
  test('🚨 « 1820 » est refusee, avec un message qui dit la borne', () => {
    const { error } = valider('1820');

    expect(error?.details?.map((detail) => detail.path.join('.'))).toEqual(['height']);
    expect(error?.details?.[0]?.message).toBe('profile.fields.height.invalid');
    expect(fr.profile.fields.height.invalid).toBe('Entre 100 et 250 cm (ex : 182)');
  });

  test.each(['50', '0', 'grand', '2,9 m'])('🚨 « %s » est refusee', (saisie) => {
    expect(valider(saisie).error).toBeDefined();
  });

  test.each([
    ['182', '182'],
    ['1,82', '182'],
    ['1.75', '175'],
    [' 182 cm ', '182'],
  ])('« %s » est acceptee et part au serveur en centimetres : « %s »', (saisie, envoyee) => {
    const { error, value } = valider(saisie);

    expect(error).toBeUndefined();
    expect(value.height).toBe(envoyee);
  });

  test('vide reste permis : la taille est facultative', () => {
    expect(valider('').error).toBeUndefined();
  });

  test('🚨 le champ dit son unite : « Taille (cm) », exemple « 180 »', () => {
    expect(fr.profile.fields.height.label).toBe('Taille (cm)');
    expect(fr.profile.fields.height.placeholder).toBe('Ex : 180');
  });

  test('🚨 une ancienne valeur en metres se pre-remplit en centimetres', () => {
    const valeurs = buildProfileFormValues({ height: '1,80' }, (/** @type {string} */ v) => v);

    expect(valeurs.height).toBe('180');
  });

  test('une valeur illisible se pre-remplit telle quelle, pour etre corrigee', () => {
    const valeurs = buildProfileFormValues({ height: 'grand' }, (/** @type {string} */ v) => v);

    expect(valeurs.height).toBe('grand');
  });
});
