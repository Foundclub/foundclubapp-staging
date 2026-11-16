import { normalizePlanningItem, resolvePlanningCardContent } from '@/utils/planning/planningSlots';

import {
  buildEventCustomNamePayload,
  isOtherTypeName,
  resolveEventCustomName,
  resolveEventDisplayName,
} from './eventDisplayName';

// T-NOM (16/11, tournoi « FoundClub x AR Soccer » du 19/12) — UN TOURNOI NOMME GARDE SON NOM.
//
// Constat sur la recette 38 (evenement 3442) : `customName` pose, mais `resolveEventCustomName` ne
// le rendait que pour « Autre » ⇒ la fiche et les cartes disaient « Tournoi - 19/12/2026 ».
// ⛔ JUMEAU de `admin/tests/authz/T-NOM-le-tournoi-garde-son-nom.test.js` (TNOM-5) : memes attendus.

const NOM = 'FoundClub x AR Soccer';
const TOURNOI = { name: 'Tournoi' };
const ENTRAINEMENT = { name: 'Entraînement' };

describe('T-NOM — un tournoi nomme garde son nom (app)', () => {
  it('TNOM-A — le nom donne d un tournoi est lu', () => {
    expect(resolveEventCustomName({ customName: NOM, type: TOURNOI })).toBe(NOM);
    expect(resolveEventCustomName({ customName: `  ${NOM}  `, typeName: 'Tournoi' })).toBe(NOM);
  });

  it('TNOM-B — affichage (jumeau serveur) : tournoi nomme = son nom, sinon comme avant', () => {
    const machine = 'Tournoi - 19/12/2026';
    expect(resolveEventDisplayName({ customName: NOM, name: machine, type: TOURNOI })).toBe(NOM);
    expect(resolveEventDisplayName({ name: machine, type: TOURNOI })).toBe(machine);
  });

  it('TNOM-C — la carte du planning d un tournoi nomme porte son nom', () => {
    const item = normalizePlanningItem({
      customName: NOM,
      date: '2026-12-19T18:00:00.000Z',
      documentId: 'evt-tournoi',
      name: 'Tournoi - 19/12/2026',
      type: TOURNOI,
    });
    expect(resolvePlanningCardContent(item).primaryLabel).toBe(NOM);
  });

  it('TNOM-D — temoins caracterisants : Autre, match vs X, entrainement inchanges', () => {
    expect(resolveEventCustomName({ customName: 'Loto du club', type: { name: 'Autre' } }))
      .toBe('Loto du club');
    expect(resolveEventDisplayName({
      customName: 'Glisse', opponentName: 'US Blaisoise', type: { name: 'Match' },
    })).toBe('Match vs US Blaisoise');
    expect(resolveEventCustomName({ customName: 'Glisse', type: ENTRAINEMENT })).toBe('');
    expect(resolveEventDisplayName({
      customName: 'Glisse', name: 'Entraînement - 19/12/2026 - U15', type: ENTRAINEMENT,
    })).toBe('Entraînement - 19/12/2026 - U15');
  });

  it('TNOM-E — les formulaires ne changent pas : le champ « Nom » reste au seul « Autre »', () => {
    expect(isOtherTypeName('Tournoi')).toBe(false);
    // Modifier un tournoi par l app n envoie pas de customName : le serveur garde le stocke.
    expect(buildEventCustomNamePayload('Tournoi', 'Nouveau nom')).toEqual({});
  });
});
