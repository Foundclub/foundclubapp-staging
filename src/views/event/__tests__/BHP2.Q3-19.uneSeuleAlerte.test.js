import fs from 'fs';
import path from 'path';

// 🐞 BUGHUNT P2 Q3-19 (PERSISTANT P7-13) — un refus de participation affichait 2 ou 3 alertes :
// le filet global (`queryClient.js`, MutationCache) parle pour toute mutation sans
// `meta.preventToastError`, en plus de l'alerte de l'écran. Chaque écran garde UN message :
//   - EventListContent : celui de l'appelant (alerte ou erreur dans la fenêtre) ;
//   - ParticipantEventList : idem (P7-13 avait retiré l'alerte locale, pas le filet) ;
//   - ReservationListContent : l'alerte locale, car `JoinEventModal` n'attrape pas l'erreur.

const lire = (/** @type {string} */ chemin) => fs.readFileSync(path.resolve(__dirname, '..', '..', '..', chemin), 'utf8');

const optionsDe = (/** @type {string} */ source, /** @type {string} */ nom) => {
  const debut = source.indexOf(`const ${nom} = useMutation({`);
  expect(debut).toBeGreaterThan(-1);
  return source.slice(debut, source.indexOf('\n  });', debut));
};

const CAS = [
  ['components/organisms/eventListContent/EventListContent.js', 'createEventParticipationMutation', false],
  ['components/organisms/eventListContent/EventListContent.js', 'joinReservationMutation', false],
  ['views/event/ParticipantEventList.js', 'createEventParticipationMutation', false],
  ['views/event/ParticipantEventList.js', 'joinReservationMutation', false],
  ['components/organisms/reservationListContent/ReservationListContent.js', 'joinReservationMutation', true],
];

test.each(CAS)('Q3-19 — %s · %s : le filet global se tait', (chemin, nom) => {
  expect(optionsDe(lire(chemin), nom)).toMatch(/meta:\s*\{\s*preventToastError:\s*true\s*\}/);
});

test.each(CAS)('Q3-19 — %s · %s : une seule alerte à l écran', (chemin, nom, alerteLocale) => {
  const options = optionsDe(lire(chemin), nom);
  const onError = options.slice(0, options.indexOf('onSuccess'));
  expect(onError.includes('Alert.alert')).toBe(alerteLocale);
});
