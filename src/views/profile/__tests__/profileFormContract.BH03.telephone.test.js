import { profileSchema } from '../profileFormContract';

// BH03 · P11-08 — un profil SANS numero de telephone ne pouvait pas etre enregistre :
// `phoneNumber: Joi.string()` refusait '' et null.
describe('BH03 · P11-08 — telephone vide', () => {
  test.each(['', null])('phoneNumber %p est accepte', (phoneNumber) => {
    const profil = { firstname: 'Hugo', lastname: 'Lemaire', phoneNumber };
    const { error } = profileSchema.validate(profil);
    expect(error).toBeUndefined();
  });
});
