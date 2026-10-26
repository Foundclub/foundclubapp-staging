import fr from '@/theme/strings/translations/fr';

import { profileSchema } from '../profileFormContract';

// CHOIX3 (« 11- A », P5-24, 26/10) — LE CONTRAT DU PROFIL BORNE LA TAILLE ET LE POIDS, SELON L'AGE.
// Adulte : 100 a 230 cm, 25 a 200 kg ; mineur : 50 a 230 cm, 10 a 200 kg ; age inconnu = adulte.
// L'age se lit dans la date de naissance du formulaire (JJ/MM/AAAA).

const anneeIlYa = (/** @type {number} */ ans) => new Date().getFullYear() - ans;

const valider = (/** @type {Record<string, string>} */ champs) => profileSchema.validate({
  firstname: 'Hugo',
  lastname: 'Lemaire',
  ...champs,
});

const erreurDe = (/** @type {any} */ resultat) => resultat.error?.details?.map(
  (/** @type {any} */ d) => `${d.path.join('.')}:${d.message}`,
);

describe('CHOIX3 — la taille', () => {
  test('🚨 adulte, 240 cm : refuse (le plafond passe de 250 a 230)', () => {
    expect(erreurDe(valider({ birthdate: '10/04/1995', height: '240' })))
      .toEqual(['height:profile.fields.height.invalid']);
    expect(fr.profile.fields.height.invalid).toBe('Entre 100 et 230 cm (ex : 182)');
  });

  test('🚨 un enfant de 8 ans, 90 cm : accepte, en centimetres', () => {
    const { error, value } = valider({ birthdate: `01/01/${anneeIlYa(8)}`, height: '90' });

    expect(error).toBeUndefined();
    expect(value.height).toBe('90');
  });

  test('🚨 un enfant, 40 cm : refuse, avec la borne des mineurs', () => {
    expect(erreurDe(valider({ birthdate: `01/01/${anneeIlYa(8)}`, height: '40' })))
      .toEqual(['height:profile.fields.height.invalidMinor']);
    expect(fr.profile.fields.height.invalidMinor).toBe('Entre 50 et 230 cm (ex : 140)');
  });

  test('sans date de naissance : les bornes de l adulte', () => {
    expect(valider({ height: '90' }).error).toBeDefined();
    expect(valider({ height: '182' }).error).toBeUndefined();
  });
});

describe('CHOIX3 — le poids', () => {
  test.each(['20', '201', 'lourd', '-5'])('🚨 adulte, « %s » kg : refuse', (poids) => {
    expect(erreurDe(valider({ birthdate: '10/04/1995', weight: poids })))
      .toEqual(['weight:profile.fields.weight.invalid']);
  });

  test.each([['75', '75'], ['72,5', '72.5'], [' 80 kg ', '80']])(
    'adulte, « %s » : accepte, part en « %s »',
    (poids, envoye) => {
      const { error, value } = valider({ birthdate: '10/04/1995', weight: poids });

      expect(error).toBeUndefined();
      expect(value.weight).toBe(envoye);
    },
  );

  test('🚨 un enfant de 8 ans, 24 kg : accepte ; 8 kg : refuse avec la borne des mineurs', () => {
    const birthdate = `01/01/${anneeIlYa(8)}`;

    expect(valider({ birthdate, weight: '24' }).error).toBeUndefined();
    expect(erreurDe(valider({ birthdate, weight: '8' })))
      .toEqual(['weight:profile.fields.weight.invalidMinor']);
    expect(fr.profile.fields.weight.invalid).toBe('Entre 25 et 200 kg (ex : 75)');
    expect(fr.profile.fields.weight.invalidMinor).toBe('Entre 10 et 200 kg (ex : 40)');
  });

  test('vide reste permis : le poids est facultatif', () => {
    expect(valider({ weight: '' }).error).toBeUndefined();
  });
});
