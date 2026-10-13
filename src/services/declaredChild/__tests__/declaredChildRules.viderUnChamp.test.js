import { buildChildEditPayload, buildChildPayload } from '../declaredChildRules';

/**
 * PAR-L5L6 (13/10, design parent E09) — VIDER UN CHAMP L'EFFACE VRAIMENT.
 *
 * Aujourd'hui, `buildChildPayload` n'envoie pas un champ vide : un parent qui efface le
 * maillot de sa fille garde le maillot en base, et la fiche le lui remontre. En MODIFICATION,
 * un champ facultatif vidé alors qu'il portait une valeur part donc à `null`.
 *
 * 🔎 Côté serveur, VÉRIFIÉ EN LECTURE (admin `origin/staging` `fe1d5eb8`,
 * `src/api/declared-child/services/declared-child-rules.js`, `pickWritableFields`) : une clé
 * PRÉSENTE est écrite — `number: null` → `toJerseyNumber(null)` = `null` ; `position: null` →
 * `toTrimmedText(null)` = `''`, que `toPublicChild` rend `null`. `updateOwnedChild` passe ces
 * champs tels quels à `documents().update`.
 *
 * 🔒 Ce qui n'a pas été VU n'est jamais effacé : on n'envoie `null` que si l'écran MONTRAIT une
 * valeur et que le champ est vide. Une fiche ouverte avant que sa valeur soit lue (le site,
 * ouvert à froid sur le formulaire) ne perd rien.
 */

test('🔴 maillot et poste vidés : ils partent à null (le serveur les efface)', () => {
  expect(buildChildEditPayload(
    {
      firstname: 'Anissa', lastname: 'Test', number: '', position: '',
    },
    { number: 7, position: 'Meneuse' },
  )).toEqual({
    firstname: 'Anissa', lastname: 'Test', number: null, position: null,
  });
});

test('un poste fait d espaces est un poste vidé', () => {
  expect(buildChildEditPayload({ position: '   ' }, { position: 'Meneuse' }))
    .toEqual({ position: null });
});

test('un maillot n° 0 affiché puis vidé part aussi à null (0 est une valeur)', () => {
  expect(buildChildEditPayload({ number: '' }, { number: 0 })).toEqual({ number: null });
});

test('valeurs gardées ou changées : la même charge qu avant', () => {
  const champs = {
    firstname: 'Anissa', lastname: 'Test', number: '9', position: 'Pivot',
  };

  expect(buildChildEditPayload(champs, { number: 7, position: 'Meneuse' }))
    .toEqual(buildChildPayload(champs));
});

test('🔒 rien n était affiché : un champ vide ne part pas (rien d invisible effacé)', () => {
  expect(buildChildEditPayload({ number: '', position: '' }, { number: null, position: null }))
    .toEqual({});
  expect(buildChildEditPayload({ number: '', position: '' }, {})).toEqual({});
  expect(buildChildEditPayload({ number: '', position: '' })).toEqual({});
});

test('la CRÉATION ne change pas : un champ vide n est jamais envoyé', () => {
  expect(buildChildPayload({ number: '', position: '' })).toEqual({});
});
