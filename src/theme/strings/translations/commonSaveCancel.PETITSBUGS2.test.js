import en from '@/theme/strings/translations/en';
import fr from '@/theme/strings/translations/fr';

// PETITSBUGS-2 (tournee 2.6.83) — en anglais, le bas de « My profile » disait encore
// « Enregistrer / Annuler ». `common.save` et `common.cancel` n existaient dans AUCUNE
// langue : les 45 appels du code affichaient leur repli francais. Les deux clefs existent
// maintenant, en francais (meme texte que le repli) et en anglais.

describe('PETITSBUGS-2 — common.save et common.cancel', () => {
  test('ROUGE-AVANT — les deux clefs existent dans les deux langues', () => {
    expect(fr.common.save).toBe('Enregistrer');
    expect(fr.common.cancel).toBe('Annuler');
    expect(en.common.save).toBe('Save');
    expect(en.common.cancel).toBe('Cancel');
  });
});
