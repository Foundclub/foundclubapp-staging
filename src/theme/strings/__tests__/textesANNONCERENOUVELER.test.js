import { readFileSync } from 'fs';
import { join } from 'path';

import i18n from '@/theme/strings';

// ANNONCE-RENOUVELER, point 4 (05/10) — les textes de « Renouveler 30 jours » et de
// l'echeance, rendus par le VRAI i18next de l'app, en francais ET en anglais. Le repli en
// ligne de l'ecran (`t('clef', 'texte')`) doit dire la meme chose que fr.js : c'est lui que
// voit un temoin sans dictionnaire, et i18next le montrerait si la clef disparaissait.
// Ecrit ROUGE contre app `fef46aa2` (les clefs n'existaient pas : i18next rendait le repli
// en francais, meme en anglais).

const ECRAN = join(__dirname, '..', '..', '..', 'views', 'recruitment', 'RecruitmentAdDetails.js');
const DATE = { date: '12 novembre' };

/** Clef => [francais, anglais], avec la date d'exemple pour les gabarits. */
const TEXTES = {
  action: ['Renouveler 30 jours', 'Renew for 30 days'],
  errorForbidden: [
    'Seul l’auteur de l’annonce peut la renouveler.',
    'Only the author of the ad can renew it.',
  ],
  errorGeneric: [
    'Impossible de prolonger l’annonce pour le moment. Vérifie ta connexion et réessaie.',
    'Unable to extend the ad right now. Check your connection and try again.',
  ],
  errorTitle: ['Renouvellement impossible', 'Renewal failed'],
  expiredSince: ['Expirée depuis le 12 novembre', 'Expired on 12 novembre'],
  expiresOn: ['Expire le 12 novembre', 'Expires on 12 novembre'],
  successBody: ['Annonce prolongée jusqu’au 12 novembre.', 'Ad extended until 12 novembre.'],
  successBodyWithoutDate: [
    'Ton annonce repart pour 30 jours.',
    'Your ad is live again for 30 days.',
  ],
  successTitle: ['Annonce renouvelée', 'Ad renewed'],
};

/** Le repli ecrit dans l'ecran, gabarit compris. */
const REPLIS = {
  expiredSince: 'Expirée depuis le {{date}}',
  expiresOn: 'Expire le {{date}}',
  successBody: 'Annonce prolongée jusqu’au {{date}}.',
};

afterAll(async () => {
  await i18n.changeLanguage('fr');
});

describe('ANNONCE-RENOUVELER (4) — les textes du renouvellement', () => {
  it.each(Object.entries(TEXTES))('%s en francais', async (clef, [francais]) => {
    await i18n.changeLanguage('fr');
    expect(i18n.t(`recruitmentAdDetails.renewal.${clef}`, DATE)).toBe(francais);
  });

  it.each(Object.entries(TEXTES))('%s en anglais', async (clef, [, anglais]) => {
    await i18n.changeLanguage('en');
    expect(i18n.t(`recruitmentAdDetails.renewal.${clef}`, DATE)).toBe(anglais);
  });

  it.each(Object.keys(TEXTES))('%s : l ecran l appelle, avec le francais en repli', (clef) => {
    const source = readFileSync(ECRAN, 'utf8');
    const repli = /** @type {Record<string, string>} */ (REPLIS)[clef]
      || /** @type {Record<string, string[]>} */ (TEXTES)[clef][0];
    expect(source).toContain(`'recruitmentAdDetails.renewal.${clef}'`);
    expect(source).toContain(`'${repli}'`);
  });
});
