import {
  DEFAULT_RENDER_ESTIMATE_MS,
  getRenderEstimateMs,
  getRenderProgress,
  PROGRESS_CAP,
  RENDER_ESTIMATE_MS,
} from '../renderProgress';

// S07 (2026-08-16) — LES DEUX MENSONGES QU'ON INTERDIT ICI, chiffres à l'appui.
// Une barre pleine devant un écran vide, et un compteur figé sur « 0 s », sont
// tous les deux PIRES que pas de compteur du tout : ils transforment une attente
// normale (1,6 à 2,3 s mesurées le 2026-08-07) en panne apparente.

describe('renderProgress — l estimation suit le format demandé', () => {
  it('chaque format servi par l app a son estimation, et story coûte plus que post', () => {
    expect(getRenderEstimateMs('post')).toBe(RENDER_ESTIMATE_MS.post);
    expect(getRenderEstimateMs('story')).toBe(RENDER_ESTIMATE_MS.story);
    expect(getRenderEstimateMs('a4')).toBe(RENDER_ESTIMATE_MS.a4);
    // La capture est proportionnelle aux pixels : story (8,3 Mpx) > post (5,8 Mpx).
    expect(RENDER_ESTIMATE_MS.story).toBeGreaterThan(RENDER_ESTIMATE_MS.post);
  });

  // Un format ajouté demain au serveur sans passer ici ne doit pas rendre `NaN`
  // (« encore NaN s environ ») ni 0 : il retombe sur la référence mesurée.
  it('un format inconnu, vide ou absent retombe sur la référence mesurée', () => {
    [undefined, null, '', '   ', 'a3', 'webp-du-futur'].forEach((format) => {
      expect(getRenderEstimateMs(/** @type {any} */ (format)))
        .toBe(DEFAULT_RENDER_ESTIMATE_MS);
    });
  });
});

describe('renderProgress — 🔒 la barre n atteint JAMAIS le bout', () => {
  it('au tout début, elle est à zéro (rien n est encore fait)', () => {
    expect(getRenderProgress({ elapsedMs: 0, format: 'post' }).ratio).toBe(0);
  });

  it('à la moitié du temps annoncé, elle est à la moitié du plafond', () => {
    const { ratio } = getRenderProgress({
      elapsedMs: RENDER_ESTIMATE_MS.post / 2,
      format: 'post',
    });
    expect(ratio).toBeCloseTo(PROGRESS_CAP / 2, 5);
  });

  // LE TÉMOIN D'ARRÊT : même après une minute, le bout reste réservé à l'affiche
  // qui existe. C'est la seule chose qui empêche la barre de mentir.
  it('🔒 même très en retard, elle plafonne sous 100 % — jamais pleine', () => {
    [3500, 5000, 30000, 600000].forEach((elapsedMs) => {
      const { ratio } = getRenderProgress({ elapsedMs, format: 'post' });
      expect(ratio).toBe(PROGRESS_CAP);
      expect(ratio).toBeLessThan(1);
    });
    expect(PROGRESS_CAP).toBeLessThan(1);
  });

  // Un temps écoulé négatif ou absurde (horloge du téléphone recalée pendant
  // l'attente) ne doit pas produire une barre à l'envers.
  it('un temps écoulé absurde ne fabrique pas de barre négative', () => {
    [-1, -10000, NaN, undefined, null].forEach((absurde) => {
      const { ratio } = getRenderProgress({
        elapsedMs: /** @type {any} */ (absurde),
        format: 'post',
      });
      expect(ratio).toBe(0);
    });
  });
});

describe('renderProgress — 🔒 le compteur ne se fige JAMAIS sur 0 seconde', () => {
  it('il décroît par secondes entières pendant le temps annoncé', () => {
    // post = 3 500 ms annoncées.
    expect(getRenderProgress({ elapsedMs: 0, format: 'post' }).remainingSeconds).toBe(4);
    expect(getRenderProgress({ elapsedMs: 1000, format: 'post' }).remainingSeconds).toBe(3);
    expect(getRenderProgress({ elapsedMs: 2000, format: 'post' }).remainingSeconds).toBe(2);
    expect(getRenderProgress({ elapsedMs: 3000, format: 'post' }).remainingSeconds).toBe(1);
  });

  // 🔒 LE POINT LE PLUS IMPORTANT DU LOT : la dernière seconde annonce « 1 »,
  // puis la valeur DISPARAÎT (null) — l'écran change alors de phrase. Aucune
  // valeur 0 n'existe, donc aucun écran ne peut en afficher une.
  it('🔒 la dernière seconde dit « 1 », puis il n y a plus de nombre du tout', () => {
    expect(getRenderProgress({ elapsedMs: 3499, format: 'post' }).remainingSeconds).toBe(1);
    [3500, 3501, 10000, 600000].forEach((elapsedMs) => {
      const { overrun, remainingSeconds } = getRenderProgress({ elapsedMs, format: 'post' });
      expect(overrun).toBe(true);
      expect(remainingSeconds).toBeNull();
    });
  });

  it('avant le dépassement, il n annonce jamais 0 ni un nombre négatif', () => {
    for (let elapsedMs = 0; elapsedMs < RENDER_ESTIMATE_MS.story; elapsedMs += 97) {
      const { remainingSeconds } = getRenderProgress({ elapsedMs, format: 'story' });
      expect(remainingSeconds).toBeGreaterThanOrEqual(1);
    }
  });
});
