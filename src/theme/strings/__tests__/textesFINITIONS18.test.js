/* eslint-disable max-len -- des phrases entieres, comparees telles quelles */
import { readFileSync } from 'fs';
import { join } from 'path';

import i18n from '@/theme/strings';

// FINITIONS18 · POINT 12 (tournee T16) — les textes relevés : un texte de développeur sur le site
// (« La version web couvre maintenant aussi… au plus proche du flow mobile », Modifier un
// événement), « Événement crée », « 0 club prévenu » (une fermeture qui ne touchait aucun club),
// « 1 annulées » (fiche d'un club, côté mairie). ROUGE avant.

const SRC = join(__dirname, '..', '..', '..');
const lire = (/** @type {string} */ chemin) => readFileSync(join(SRC, chemin), 'utf8');

afterAll(async () => {
  await i18n.changeLanguage('fr');
});

describe('FINITIONS18 12 — les textes de la T16', () => {
  it('🔴 « Modifier un événement » (site) ne montre plus de texte de développeur', () => {
    const site = lire('views/event/EventEdit.web.js');
    expect(site).not.toMatch(/t\('eventEdit\.theWebVersionNowAlso'/);
    expect(site).not.toMatch(/flow mobile/);
  });

  it('🔴 « Événement créé », partout où il s affiche', async () => {
    await i18n.changeLanguage('fr');
    expect(i18n.t('celebrationCatalog.eventCreated.title')).toBe('Événement créé');
    expect(i18n.t('eventDetails.eventCreatedCheckTheLast')).toBe('Événement créé. Vérifie les derniers détails avant de le partager.');
    expect(i18n.t('eventWizard.recap.featured.warningTitle')).toBe('Événement créé');
    ['services/celebrations/celebrationCatalog.js', 'views/event/EventDetails.web.js', 'views/event/wizard/EventWizardRecap.js']
      .forEach((fichier) => expect(lire(fichier)).not.toMatch(/Événement crée[^r]/));
  });

  it('🔴 aucun club prévenu se dit « Aucun club prévenu », pas « 0 club prévenu »', async () => {
    await i18n.changeLanguage('fr');
    expect(i18n.t('collectiviteFermetures.carte.clubs', { count: 0 })).toBe('Aucun club prévenu');
    expect(i18n.t('collectiviteFermetures.carte.clubs', { count: 1 })).toBe('1 club prévenu');
    expect(i18n.t('collectiviteFermetures.carte.clubs', { count: 3 })).toBe('3 clubs prévenus');
  });

  it('🔴 « 1 annulée », « 2 annulées » : le libellé s accorde au nombre', async () => {
    await i18n.changeLanguage('fr');
    expect(i18n.t('collectiviteChiffres.utilisation.annulees', { count: 1 })).toBe('annulée');
    expect(i18n.t('collectiviteChiffres.utilisation.annulees', { count: 2 })).toBe('annulées');
    expect(lire('views/collectivite/CollectiviteClubDetails.js'))
      .toMatch(/t\('collectiviteChiffres\.utilisation\.annulees', \{\s*count:/);
  });
});
