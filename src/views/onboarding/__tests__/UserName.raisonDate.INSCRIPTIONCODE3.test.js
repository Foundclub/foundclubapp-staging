// INSCRIPTION-CODE-3 (19/11/2026, décision du chef) — LA PHRASE SOUS LA DATE DE NAISSANCE dit ce
// que la carte montre : l'âge, jamais la date. Avant : « Elle sert à protéger les mineurs et à te
// proposer ta catégorie. Elle n’est jamais affichée. » (INSCRIPTION-CODE, V03). La raison reste.
import fs from 'fs';
import path from 'path';

import en from '@/theme/strings/translations/en';
import fr from '@/theme/strings/translations/fr';

describe('« Qui es-tu ? » · la phrase sous la date', () => {
  test('fr : la raison, puis « Ta date n’est jamais affichée, seulement ton âge… »', () => {
    expect(fr.userName.birthdate.raison).toBe(
      'Elle sert à protéger les mineurs et à te proposer ta catégorie. '
        + 'Ta date n’est jamais affichée, seulement ton âge sur ta carte.',
    );
  });

  test('en : la même phrase', () => {
    expect(en.userName.birthdate.raison).toBe(
      'It is used to protect minors and to suggest your category. '
        + 'Your date is never shown, only your age on your card.',
    );
  });

  test('le repli de l’écran dit la même chose que fr.js', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'UserName.js'), 'utf8');
    expect(source).toContain('seulement ton âge sur ta carte');
    expect(source).not.toContain('Elle n’est \'\n');
  });
});
