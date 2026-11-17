// T-PAGES-6 (17/11/2026, point 7) : la règle de secours des 10 minutes (Adel « 8a oui », T-D55), dans la
// MÊME phrase que la durée des matchs : le fichier est exempté de la porte « français en dur » avec un
// plafond de lignes (D210), une ligne de source neuve le ferait remonter.
import fs from 'fs';
import path from 'path';

import { SECTIONS_DU_REGLEMENT } from '../reglementTournoi';

const REGLE_10_MIN = 'À 24 équipes, si le premier coup d\'envoi part après 19 h 45, les matchs de la phase de '
  + 'ligue durent 10 min au lieu de 12. La phase finale reste à 12 min. L\'organisateur l\'annonce au briefing '
  + 'des capitaines.';

const paragraphes = SECTIONS_DU_REGLEMENT.flatMap((section) => section.paragraphes || []);

test('🔴 T-PAGES-6 (7) — la règle des 10 minutes suit la durée des matchs, dans le même paragraphe', () => {
  const duree = paragraphes.find((p) => p.startsWith('Chaque match dure 12 min'));
  expect(duree).toBe(`Chaque match dure 12 min, sans mi-temps, phase finale comprise. ${REGLE_10_MIN}`);
});

test('T-PAGES-6 (7) — aucune ligne de source neuve : le fichier garde ses lignes', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'reglementTournoi.js'), 'utf8');
  expect(source.split('\n').filter((ligne) => ligne.includes('Chaque match dure 12 min'))).toHaveLength(1);
  expect(source.split('\n').filter((ligne) => ligne.includes('19 h 45'))).toHaveLength(1);
});
