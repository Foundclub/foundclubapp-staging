/* eslint-disable max-len -- des phrases entieres, comparees telles quelles */
import { readFileSync } from 'fs';
import { join } from 'path';

import i18n from '@/theme/strings';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

import { lireLeMomentCourt } from '@/utils/date';

// FINITIONS16 · POINT 19 (vague 4, tournee T15 §10) — les DATES relevees a l'ecran :
//   · « Publiée le 05/10/2026 16:05:20 » (une composition publiee : `toLocaleString`, secondes
//     comprises) ; la planche de la feuille de match (S10) ecrit « Publiée le 1 oct. à 22:39 » ;
//   · « mer 30/09/2026 » (la fiche d'une annonce : « Publiée le mer 05/08/2026 », photo A6b) ;
//     la meme fiche ecrit deja son echeance « Expire le 4 septembre ».
// ROUGE avant.

const SRC = join(__dirname, '..', '..', '..');
const lire = (...chemin) => readFileSync(join(SRC, ...chemin), 'utf8');

beforeAll(async () => {
  await i18n.changeLanguage('fr');
});

describe('FINITIONS16 19 — les dates comme les planches', () => {
  it('🔴 le moment court : « 5 oct. » et « 16:05 », sans secondes', () => {
    expect(lireLeMomentCourt(new Date(2026, 9, 5, 16, 5, 20).toISOString()))
      .toEqual({ date: '5 oct.', time: '16:05' });
    expect(lireLeMomentCourt('')).toBeNull();
    expect(lireLeMomentCourt('pas une date')).toBeNull();
  });

  it('🔴 une composition publiee : « Publiée le 5 oct. à 16:05 » (page de l evenement et compo multi-equipes)', () => {
    const moment = { date: '5 oct.', time: '16:05', ...SANS_ECHAPPEMENT };
    expect(i18n.t('eventDetails.publishedOnAt', moment)).toBe('Publiée le 5 oct. à 16:05');
    expect(i18n.t('multiTeamCompositionBoard.publishedOn', moment)).toBe('Publiée le 5 oct. à 16:05');
  });

  it('🔴 plus aucun `publishedAt).toLocaleString(` (la date avec ses secondes)', () => {
    const fautifs = [
      ['views', 'event', 'EventDetails.js'],
      ['views', 'event', 'EventDetails.web.js'],
      ['views', 'tactical_v2', 'MultiTeamCompositionBoard.js'],
    ].filter((chemin) => /publishedAt\)\.toLocaleString\(/.test(lire(...chemin)))
      .map((chemin) => chemin.join('/'));
    expect(fautifs).toEqual([]);
  });

  it('🔴 la date d une detection : « {{date}} à {{hour}} »', () => {
    expect(i18n.t('recruitmentAdDetails.detectionModal.dateAtHour', { date: 'mer. 30 sept.', hour: '19:00', ...SANS_ECHAPPEMENT }))
      .toBe('mer. 30 sept. à 19:00');
    expect(lire('views', 'recruitment', 'RecruitmentAdDetails.js')).not.toContain("'{{date}} a {{hour}}'");
  });

  it('🔴 la fiche et la carte d une annonce n ecrivent plus « mer 30/09/2026 »', () => {
    const fautifs = [
      ['views', 'recruitment', 'RecruitmentAdDetails.js'],
      ['components', 'molecules', 'recruitmentAdCard', 'RecruitmentAdCard.js'],
    ].filter((chemin) => lire(...chemin).includes('formatDateWithDayPrefix('))
      .map((chemin) => chemin.join('/'));
    expect(fautifs).toEqual([]);
  });
});
