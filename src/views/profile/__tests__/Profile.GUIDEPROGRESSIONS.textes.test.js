import fs from 'fs';
import path from 'path';

import en from '@/theme/strings/translations/en';
import fr from '@/theme/strings/translations/fr';

// GUIDE-PROGRESSIONS (Adel D45, « 222 B » ; chef, Q1 B, 12/11) : chaque guide garde sa progression.
// La question « Le guide en pause s'arrête et sa progression repart de zéro » disait le contraire :
// elle est retirée de Mon compte, et ses textes avec, en français comme en anglais.
describe('GUIDE-PROGRESSIONS — plus de texte « sa progression repart de zéro »', () => {
  it('fr et en n’ont plus profile.coachGuide.switchConfirm', () => {
    expect(fr.profile.coachGuide.switchConfirm).toBeUndefined();
    expect(en.profile.coachGuide.switchConfirm).toBeUndefined();
  });

  it('les autres textes du menu du guide restent, dans les deux langues', () => {
    expect(Object.keys(fr.profile.coachGuide).sort()).toEqual(
      Object.keys(en.profile.coachGuide).sort(),
    );
    expect(fr.profile.coachGuide.resume).toBe('Reprendre là où j’en étais');
    expect(fr.profile.coachGuide.restartConfirm.cancel).toBe('Annuler');
  });

  it('Mon compte ne lit plus ces textes', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'Profile.js'), 'utf8');
    expect(source).not.toMatch(/profile\.coachGuide\.switchConfirm/);
  });
});
