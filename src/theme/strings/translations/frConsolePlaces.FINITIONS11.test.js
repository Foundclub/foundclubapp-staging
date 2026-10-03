/* eslint-disable max-len -- les phrases de fr.js sont citées en entier */
import fs from 'fs';
import path from 'path';

import fr from '@/theme/strings/translations/fr';

// FINITIONS11-COLL (03/10), point 4 — LA CONSOLE DIT « PLACE », PAS « SLOT » (FINITIONS10,
// question 2). Le tableau de bord du super-admin (AdminDashboard) montrait « Slot source: #3 »
// (`sourceTeamSlot.slotNumber`) et « 2 slots resynchronises. » apres une resynchronisation des droits
// d equipe. Les valeurs de fr.js ET les replis du code disent « place(s) ». Aucune clef renommee.
// ROUGE avant le lot.

const i18nextTemoin = require('i18next');

const i18n = i18nextTemoin.default || i18nextTemoin;
i18n.init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: fr } },
});

const CONSOLE = path.resolve(__dirname, '..', '..', '..', 'views', 'admin', 'AdminDashboard.js');

describe('FINITIONS11-COLL (4) — la console dit « place »', () => {
  it('« Place source : » et « n place(s) resynchronisée(s) » dans fr.js', () => {
    expect(i18n.t('adminDashboard.entitlement.sourceSlot')).toBe('Place source :');
    expect(i18n.t('adminDashboard.teamSync.doneMessage', { count: 1 })).toBe('1 place resynchronisée.');
    expect(i18n.t('adminDashboard.teamSync.doneMessage', { count: 3 })).toBe('3 places resynchronisées.');
  });

  it('les replis du code ne disent plus « slot »', () => {
    const source = fs.readFileSync(CONSOLE, 'utf8');
    const replis = [...source.matchAll(/'([^'\n]*\bslots?\b[^'\n]*)'/gi)].map((trouve) => trouve[1]);
    expect(replis).toEqual([]);
  });
});
