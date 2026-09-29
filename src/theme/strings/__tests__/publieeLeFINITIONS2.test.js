import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

import i18n from '@/theme/strings';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

// FINITIONS2 — « Publie le » SANS ACCENT, les deux freres laisses par FINITIONS
// (recette du 28/09, qui a corrige l'onglet Convocation en « Publiée le ») :
//   · la compo multi-equipes (`multiTeamCompositionBoard.publishedOn`) ;
//   · la fiche d'une annonce de recrutement (`recruitmentAdDetails.info.publishedOn`).
// Une composition, une annonce : « Publiée le ».
//
// Ce temoin tient les deux bouts :
//   1. les phrases RENDUES par le vrai i18next de l'app ;
//   2. les textes de SECOURS ecrits en dur a cote de `t()` (ils s'affichent si
//      la clef manque) : aucun fichier de l'app ne doit plus porter « Publie le ».

const RACINE_SRC = join(__dirname, '..', '..', '..');

/**
 * Tous les fichiers .js de l'app, hors temoins.
 * @param {string} dossier
 * @returns {string[]}
 */
const sources = (dossier) => readdirSync(dossier).flatMap((nom) => {
  const chemin = join(dossier, nom);
  if (statSync(chemin).isDirectory()) {
    return nom === '__tests__' ? [] : sources(chemin);
  }
  return /\.js$/.test(nom) && !/\.test\.js$/.test(nom) ? [chemin] : [];
});

describe('FINITIONS2 5 — « Publiée le », jamais « Publie le »', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('fr');
  });

  test('la compo multi-equipes : « Publiée le 29/09/2026 10:58 »', () => {
    // Meme appel que l ecran (MultiTeamCompositionBoard.js) : la date sans echappement.
    const options = { date: '29/09/2026 10:58', ...SANS_ECHAPPEMENT };
    expect(i18n.t('multiTeamCompositionBoard.publishedOn', options))
      .toBe('Publiée le 29/09/2026 10:58');
  });

  test('l annonce de recrutement : « Publiée le »', () => {
    expect(i18n.t('recruitmentAdDetails.info.publishedOn')).toBe('Publiée le');
  });

  test('aucun texte de secours « Publie le » dans le code de l app', () => {
    const fautifs = sources(RACINE_SRC)
      .filter((chemin) => /Publie le\b/.test(readFileSync(chemin, 'utf8')))
      .map((chemin) => relative(RACINE_SRC, chemin).replace(/\\/g, '/'));

    expect(fautifs).toEqual([]);
  });
});
