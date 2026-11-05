import { readFileSync } from 'fs';
import { join } from 'path';

import { getAddEventEntryLock } from '@/domains/subscription/subscriptionDecision';

// QG3 (Adel, 05/11/2026) : la carte « Ajouter un événement » de l'accueil ouvre AUSSI les matchs. Elle
// reste ouverte tant qu'il reste un match offert, même une fois les événements offerts épuisés. Le tunnel
// dit alors, dès son entrée, que les événements sont épuisés (bandeau de `EventWizardType`).
// Exception : M3 du guide Entraîneur ne peut créer qu'un entraînement, elle garde le verrou.

const ligne = (quotaType, limit, used) => ({
  limit, quotaType, remaining: Math.max(0, limit - used), used,
});
const verrou = ({
  evenements, eventOnly, matchs, niveau = 'FREE', roleKey = 'coach',
}) => getAddEventEntryLock({
  eventOnly,
  freeUsageSummary: [
    ...(evenements ? [ligne('EVENT_PUBLISH', ...evenements)] : []),
    ...(matchs ? [ligne('MATCH_PUBLISH', ...matchs)] : []),
  ],
  roleKey,
  subscriptionAccessLevel: niveau,
});

describe('la carte de l accueil', () => {
  it('événements épuisés, match offert restant : ouverte', () => {
    expect(verrou({ evenements: [2, 2], matchs: [1, 0] })).toBeNull();
  });

  it('événements et match épuisés : la feuille d achat, sur la clé des événements', () => {
    const lock = verrou({ evenements: [2, 2], matchs: [1, 1] });
    expect(lock?.decision.paywall).toBe('EVENT_LIMIT');
    expect(lock?.hint).toBeTruthy();
  });

  it('événements restants : ouverte, comme avant', () => {
    expect(verrou({ evenements: [2, 1], matchs: [1, 1] })).toBeNull();
  });

  it('compteur de match inconnu : on ne promet rien, le verrou reste', () => {
    expect(verrou({ evenements: [2, 2] })?.decision.paywall).toBe('EVENT_LIMIT');
  });

  it('abonné, ou profil qui ne peut pas acheter : jamais de verrou', () => {
    expect(verrou({ evenements: [2, 2], matchs: [1, 1], niveau: 'TEAM' })).toBeNull();
    expect(verrou({ evenements: [2, 2], matchs: [1, 1], roleKey: 'player' })).toBeNull();
  });

  it('M3 du guide : seul l entraînement compte, le verrou reste malgré le match offert', () => {
    expect(verrou({ evenements: [2, 2], eventOnly: true, matchs: [1, 0] })?.decision.paywall)
      .toBe('EVENT_LIMIT');
  });
});

describe('l écran branche bien la règle', () => {
  const source = readFileSync(join(__dirname, '../HomeHub.js'), 'utf8');

  it('la carte lit le juge partagé, et M3 du guide garde le verrou', () => {
    expect(source).toMatch(/const addEventLock = useMemo\(\s*\(\) => getAddEventEntryLock\(/);
    expect(source).toMatch(/eventOnly: tourCurrentStep\?\.missionId === 'coach_m3'/);
  });

  it('le tunnel d arrivée porte toujours le bandeau des événements épuisés', () => {
    const tunnel = readFileSync(join(__dirname, '../../event/wizard/EventWizardType.js'), 'utf8');
    expect(tunnel).toMatch(/<SubscriptionQuotaBanner[\s\S]*?quotaType="EVENT_PUBLISH"/);
  });
});
