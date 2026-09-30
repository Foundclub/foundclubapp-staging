import { readFileSync } from 'fs';
import { join } from 'path';

import i18n from '@/theme/strings';

// FINITIONS-AUDIT, point 2 (30/09) — le bouton du proprietaire d'une annonce disait
// « Avis de recherche » : un nom d'affiche, pas une action. L'audit V1 proposait
// « Créer l'affiche à partager », tranche par le chef ; le lot GERER-ANNONCE l'a mesure
// a UNE seule clef (`recruitmentAdDetails.owner.posterCta`, un seul appelant).
// Rendu par le VRAI i18next de l'app, en francais ET en anglais, et le repli en ligne
// de l'ecran suit le francais (sans fr.js, i18next afficherait le repli).
// Ecrit ROUGE contre app `eea59817`.

const CLEF = 'recruitmentAdDetails.owner.posterCta';
const ECRAN = join(__dirname, '..', '..', '..', 'views', 'recruitment', 'RecruitmentAdDetails.js');

afterAll(async () => {
  await i18n.changeLanguage('fr');
});

describe('FINITIONS-AUDIT (2) — « Créer l’affiche à partager »', () => {
  it('en francais', async () => {
    await i18n.changeLanguage('fr');
    expect(i18n.t(CLEF)).toBe('Créer l’affiche à partager');
  });

  it('en anglais', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t(CLEF)).toBe('Create the poster to share');
  });

  it('le repli en ligne de l ecran dit la meme chose que fr.js', () => {
    expect(readFileSync(ECRAN, 'utf8'))
      .toContain(`t('${CLEF}', 'Créer l’affiche à partager')`);
  });
});
