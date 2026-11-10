import fs from 'fs';
import path from 'path';

import en from '@/theme/strings/translations/en';
import fr from '@/theme/strings/translations/fr';

// FINITIONS-T8 point 3 (10/11) — le bouton rond « Nouvelle conversation » de la messagerie
// lisait `messaging.newConversation`, clef absente des deux langues : l'interface anglaise
// annonçait son étiquette d'accessibilité en français (texte de repli).
const SRC = path.resolve(__dirname, '..', '..');

describe('FINITIONS-T8 — étiquette du bouton « Nouvelle conversation »', () => {
  test('la clef existe en français et en anglais', () => {
    expect(fr.messaging.newConversation).toBe('Nouvelle conversation');
    expect(en.messaging.newConversation).toBe('New conversation');
  });

  test('les deux écrans qui la lisent passent par cette clef', () => {
    const messaging = fs.readFileSync(path.join(SRC, 'views', 'Messaging.js'), 'utf8');
    const nouvelle = fs.readFileSync(path.join(SRC, 'views', 'NewConversation.js'), 'utf8');
    expect(messaging).toMatch(/t\('messaging\.newConversation'/);
    expect(nouvelle).toMatch(/t\('messaging\.newConversation'/);
  });
});
