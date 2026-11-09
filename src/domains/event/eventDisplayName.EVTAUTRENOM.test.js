import {
  getEventWizardNextRoute,
  getEventWizardStepRoutes,
} from '@/views/event/wizard/eventWizardDetectionUtils';

import { RouteNames } from '@/navigation/routeNames';

import { normalizePlanningItem, resolvePlanningCardContent } from '@/utils/planning/planningSlots';

import {
  buildEventCustomNamePayload,
  EVENT_CUSTOM_NAME_MAX_LENGTH,
  EVENT_CUSTOM_NAME_MIN_LENGTH,
  isEventCustomNameRejected,
  isEventCustomNameValid,
  normalizeEventCustomName,
  resolveEventDisplayName,
} from './eventDisplayName';
import { createEventPayload } from './eventUseCases';

// EVT-AUTRE-NOM (07/11) — UN EVENEMENT « AUTRE » PORTE LE NOM QU'ON LUI DONNE.
//
// Demande d'Adel : apres la tuile « Autre », l'etape suivante demande « Quel est
// le nom de votre evenement ? », et l'evenement s'affiche sous ce nom.
// Jumeau serveur : `admin/tests/authz/EVT-AUTRE-NOM-nom-de-l-evenement.test.js`
// (temoin 8, memes attendus).

const TYPE_AUTRE = { name: 'Autre' };
const TYPE_ENTRAINEMENT = { name: 'Entraînement' };

describe('EVT-AUTRE-NOM/1 — le titre affiche', () => {
  test('un « Autre » nomme montre son nom, meme si le nom machine est en base', () => {
    expect(resolveEventDisplayName({
      customName: 'Repas du club',
      name: 'Autre - 12/09/2026 - U15',
      type: TYPE_AUTRE,
    })).toBe('Repas du club');
  });

  test('un « Autre » sans nom (ancien parc, ancienne version) garde « Autre »', () => {
    expect(resolveEventDisplayName({ type: TYPE_AUTRE })).toBe('Autre');
    expect(resolveEventDisplayName({ customName: '  ', type: TYPE_AUTRE })).toBe('Autre');
  });

  test('hors « Autre », un nom glisse ne renomme rien', () => {
    expect(resolveEventDisplayName({
      customName: 'Un nom glisse',
      name: 'Entraînement - 12/09/2026 - U15',
      type: TYPE_ENTRAINEMENT,
    })).toBe('Entraînement - 12/09/2026 - U15');
  });
});

describe('EVT-AUTRE-NOM/2 — la saisie', () => {
  test('les blancs sont retires et ecrases', () => {
    expect(normalizeEventCustomName('  Repas   du   club  ')).toBe('Repas du club');
  });

  test('3 a 60 caracteres : trop court et trop long refuses, les bornes passent', () => {
    expect(EVENT_CUSTOM_NAME_MIN_LENGTH).toBe(3);
    expect(EVENT_CUSTOM_NAME_MAX_LENGTH).toBe(60);
    expect(isEventCustomNameValid('ab')).toBe(false);
    expect(isEventCustomNameValid('  ab   ')).toBe(false);
    expect(isEventCustomNameValid('abc')).toBe(true);
    expect(isEventCustomNameValid('y'.repeat(60))).toBe(true);
    expect(isEventCustomNameValid('x'.repeat(61))).toBe(false);
  });
});

describe('EVT-AUTRE-NOM/3 — l etape du nom suit la tuile « Autre », et elle seule', () => {
  test('« Autre » : Type, puis Nom, puis Equipe', () => {
    expect(RouteNames.EventWizardName).toBe('EventWizardName');
    const routes = getEventWizardStepRoutes({ type: TYPE_AUTRE });
    expect(routes.slice(0, 3)).toEqual([
      RouteNames.EventWizardType,
      RouteNames.EventWizardName,
      RouteNames.EventWizardTeam,
    ]);
    expect(getEventWizardNextRoute(RouteNames.EventWizardType, { type: TYPE_AUTRE }))
      .toBe(RouteNames.EventWizardName);
  });

  test('les autres types ne voient jamais cette etape', () => {
    ['Entraînement', 'Match', 'Stage', 'Tournoi', "Détection / Séance d'essai"].forEach((name) => {
      expect(getEventWizardStepRoutes({ type: { name } })).not.toContain('EventWizardName');
    });
  });
});

describe('EVT-AUTRE-NOM/4 — le fabricant de requetes garde le nom', () => {
  test('createEventPayload recopie customName tel quel', () => {
    const requete = createEventPayload({
      customName: 'Repas du club',
      date: '12/09/2026',
      startTime: new Date('2026-09-12T14:00:00.000Z'),
      type: 'type-autre',
    });
    expect(requete.customName).toBe('Repas du club');
  });
});

describe('EVT-AUTRE-NOM/5 — la frise et les cartes du planning', () => {
  const brut = (surcharges = {}) => ({
    date: '2026-09-12T14:00:00.000Z',
    documentId: 'evt-1',
    name: 'Repas du club',
    team: { documentId: 'team-u15', name: 'U15' },
    type: { name: 'Autre' },
    ...surcharges,
  });

  test('un « Autre » nomme : son nom en titre, pas « Autre » (vue normale)', () => {
    const item = normalizePlanningItem(brut({ customName: 'Repas du club' }));
    const contenu = resolvePlanningCardContent(item);
    expect(contenu.primaryLabel).toBe('Repas du club');
  });

  test('un « Autre » nomme : son nom en titre, pas l equipe (Mon planning)', () => {
    const contenu = resolvePlanningCardContent(
      normalizePlanningItem(brut({ customName: 'Repas du club' })),
      { profile: 'teamFocused' },
    );
    expect(contenu.primaryLabel).toBe('Repas du club');
  });

  test('un « Autre » sans nom garde « Autre », et Mon planning garde l equipe', () => {
    const sansNom = normalizePlanningItem(brut({ name: 'Autre - 12/09/2026 - U15' }));
    expect(resolvePlanningCardContent(sansNom).primaryLabel).toBe('Autre');
    expect(resolvePlanningCardContent(sansNom, { profile: 'teamFocused' }).primaryLabel)
      .toBe('U15');
  });
});

describe('EVT-AUTRE-NOM/6 — l edition', () => {
  test('un « Autre » envoie son nom nettoye, ou null pour l effacer', () => {
    expect(buildEventCustomNamePayload('Autre', ' Loto  du club '))
      .toEqual({ customName: 'Loto du club' });
    expect(buildEventCustomNamePayload('Autre', '')).toEqual({ customName: null });
  });

  test('les autres types n envoient rien', () => {
    expect(buildEventCustomNamePayload('Entraînement', 'Glisse')).toEqual({});
  });

  test('vide passe (ancien « Autre »), hors bornes est refuse', () => {
    expect(isEventCustomNameRejected('')).toBe(false);
    expect(isEventCustomNameRejected('ab')).toBe(true);
    expect(isEventCustomNameRejected('x'.repeat(61))).toBe(true);
    expect(isEventCustomNameRejected('Loto du club')).toBe(false);
  });
});
