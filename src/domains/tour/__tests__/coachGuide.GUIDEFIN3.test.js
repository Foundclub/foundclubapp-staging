import { COACH_GUIDE } from '@/domains/tour/coachGuide';

// GUIDE-FINITIONS-3 (rejeu 2 du guide Entraîneur, 29/10) : ce que le catalogue
// doit dire pour que la couche cadre la bonne chose.
// - R2-3 / b1-card (A17, C02) : sans séance à venir, ou sans la séance de M3
//   (bonus relancé depuis Mon compte), rien n'était cadré ni proposé ;
// - N11 bis (39) : le bouton flottant du Planning chevauchait la carte cadrée ;
// - R2-7 rv-m3 (R03) : « Depuis l'accueil… » affiché sur Équipes, rien de cadré.

const step = (id) => COACH_GUIDE.steps.find((candidate) => candidate.id === id);

describe('b1-card — ouvrir une séance à venir, ou dire qu’il n’y en a pas', () => {
  it('sans la séance de M3 : la prochaine séance du planning est cadrée', () => {
    expect(step('b1-card').targetsFor({ created: {} })).toContain('planning.event.next');
  });

  it('séance de M3 connue : elle d’abord, puis la prochaine (témoin N11)', () => {
    const later = new Date(Date.now() + 86400000).toISOString();
    const targets = step('b1-card').targetsFor({
      created: {
        'event.created': { dates: [{ date: later, documentId: 'ev-2' }], documentId: 'ev-1' },
      },
    });
    expect(targets[0]).toBe('planning.event.ev-2');
    expect(targets).toContain('planning.event.next');
  });

  it('aucune séance à venir : le bouton « Ajouter un événement » et un texte honnête', () => {
    const { fallback } = step('b1-card');
    expect(fallback?.targets).toEqual(['planning.fab']);
    expect(fallback.text).toMatch(/aucune séance à venir/i);
    expect(fallback.text).toMatch(/passe ce bonus/i);
  });

  it('pendant b1-card, le bouton flottant du Planning se range (N11 bis)', () => {
    expect(step('b1-card').hidesFloatingAction).toBe(true);
  });
});

describe('rv-m3 — la visite ne parle pas de l’accueil depuis Équipes', () => {
  it('carte de l’accueil absente : l’onglet Accueil est cadré, le texte le dit', () => {
    const { fallback } = step('rv-m3');
    expect(fallback?.targets).toEqual(['dock.home']);
    expect(fallback.text).not.toMatch(/^Depuis l’accueil/);
    expect(fallback.text).toMatch(/accueil/i);
  });
});

describe('Place réservée sous le titre (R2-2, R2-4)', () => {
  it('chaque écran du tunnel équipe et b2-start la demandent', () => {
    ['tw1', 'tw2', 'tw3', 'tw4', 'tw5', 'tw6', 'tw7', 'tw8', 'b2-start'].forEach((id) => {
      expect([id, step(id).bubbleSlot]).toEqual([id, true]);
    });
  });
});
