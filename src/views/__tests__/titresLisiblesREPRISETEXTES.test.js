import fs from 'node:fs';
import path from 'node:path';

// REPRISE-TEXTES (revue du 01/11, point 135 et « Réserver une installation ») — sur le site,
// la règle globale « h1, h2, h3 : primary900 » de web/src/index.css repeint en bleu
// nuit les titres de ces écrans sombres : « Détail du sondage », la question du sondage,
// « Réserver une installation » se lisaient sombre sur sombre. ROUGE avant : chaque titre de
// ces écrans porte sa couleur (celle du texte autour), au lieu d'hériter de la règle globale.
const ECRANS = [
  'PollDetails.web.js',
  'booking/BookingCalendar.web.js',
  'chat/ConversationPublicEventPicker.web.js',
];

test.each(ECRANS)('🔴 %s : aucun titre h1-h3 sans couleur', (fichier) => {
  const source = fs.readFileSync(path.join(__dirname, '..', fichier), 'utf8');
  const titres = [...source.matchAll(/<h[1-3]\s+style=\{\{([\s\S]*?)\}\}\s*>/g)];
  expect(titres.length).toBeGreaterThan(0);
  const sansCouleur = titres.filter((titre) => !/\bcolor:/.test(titre[1])).map((titre) => titre[0]);
  expect(sansCouleur).toEqual([]);
});
