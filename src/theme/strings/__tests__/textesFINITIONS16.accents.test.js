/* eslint-disable max-len -- des phrases entieres, comparees telles quelles */
import { readFileSync } from 'fs';
import { join } from 'path';

import i18n from '@/theme/strings';

// FINITIONS16 · POINT 19 (vague 4, tournee T15 §4 l. 51) — LES TEXTES ENCORE SANS ACCENTS,
// relevés à l'écran avec leur source. Rendus par le VRAI i18next de l'app (le dictionnaire, pas
// un repli) ; les textes écrits EN DUR dans un écran sont lus dans sa source. ROUGE avant.

const VUES = join(__dirname, '..', '..', '..', 'views');

/** Clé => le texte français attendu. */
const TEXTES = {
  'eventCardNew.training': 'ENTRAÎNEMENT',
  'eventDetails.capacity': 'Capacité',
  'eventDetails.openTheTrainingSessionTo':
    'Ouvre l’entraînement pour accueillir des joueurs externes sans compter les membres de tes équipes.',
  'eventDetails.youCanAlreadyCreateThe':
    'Tu peux déjà créer les équipes même sans participant : les postes resteront libres et se compléteront ensuite.',
  // R17-ROLES (REC17-006, 19/10) : « COACH / PROF » (avant : « ENTRAÎNEUR »).
  'recruitmentAdCard.coachAudience': 'COACH / PROF',
};

afterAll(async () => {
  await i18n.changeLanguage('fr');
});

describe('FINITIONS16 19 — les textes relevés par la T15, avec leurs accents', () => {
  it.each(Object.entries(TEXTES))('🔴 %s', async (clef, francais) => {
    await i18n.changeLanguage('fr');
    expect(i18n.t(clef)).toBe(francais);
  });

  it('🔴 « Épingler » / « Désépingler » (Messaging.js, repli : la clé n’existe pas au dictionnaire)', () => {
    const source = readFileSync(join(VUES, 'Messaging.js'), 'utf8');
    expect(source).not.toMatch(/'Epingler'|'Desepingler'|de desepingler|d'epingler/);
    expect(source).toContain("t('messaging.pin', 'Épingler')");
    expect(source).toContain("t('messaging.unpin', 'Désépingler')");
  });

  // `common.retry` / `common.team` manquent au dictionnaire EXPRES (mines connues de
  // frClefsAtteignables : « Actualiser », « Recharger »…) : c'est leur REPLI qui s'affiche.
  it('🔴 les replis affichés de « common.retry » / « common.team » ont leurs accents', () => {
    const fautifs = [
      ['components', 'organisms', 'externalCompetitionPromptGate', 'ExternalCompetitionPromptGate.js'],
      ['views', 'NewConversation.js'],
      ['views', 'event', 'wizard', 'components', 'EventWizardOpponentInvite.js'],
      ['views', 'notification', 'NotificationDetails.js'],
    ].filter((chemin) => /t\('common\.(retry|team)', '(Reessayer|Equipe)'\)/.test(readFileSync(join(VUES, '..', ...chemin), 'utf8')))
      .map((chemin) => chemin.join('/'));
    expect(fautifs).toEqual([]);
  });

  it('🔴 « Session fermée » sur la page d’un événement du site (écrit en dur)', () => {
    const source = readFileSync(join(VUES, 'event', 'EventDetails.web.js'), 'utf8');
    expect(source).not.toMatch(/'fermee'/);
    expect(source).toContain("'fermée'");
  });

  it('🔴 les replis du site disent la même chose que le dictionnaire', () => {
    const source = readFileSync(join(VUES, 'event', 'EventDetails.web.js'), 'utf8');
    expect(source).toContain(`t('eventDetails.capacity', '${TEXTES['eventDetails.capacity']}')`);
    expect(source).toContain(TEXTES['eventDetails.openTheTrainingSessionTo']);
    expect(source).toContain(TEXTES['eventDetails.youCanAlreadyCreateThe']);
  });
});
