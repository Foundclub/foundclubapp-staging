import fs from 'fs';
import path from 'path';

// 🐞 BUGHUNT P7-13 (BH06) — une participation en échec affichait DEUX alertes : celle de
// `onError` de la mutation, puis celle du `catch` de l'appelant (`mutateAsync`). Dans la
// fenêtre de participation, l'erreur s'écrivait en plus DANS la fenêtre. Les deux appelants
// disent déjà l'erreur : la mutation se tait.

const SOURCE = fs.readFileSync(path.resolve(__dirname, '..', 'ParticipantEventList.js'), 'utf8');

const optionsDe = (/** @type {string} */ nom) => {
  const debut = SOURCE.indexOf(`const ${nom} = useMutation({`);
  expect(debut).toBeGreaterThan(-1);
  return SOURCE.slice(debut, SOURCE.indexOf('\n  });', debut));
};

test.each(['createEventParticipationMutation', 'joinReservationMutation'])(
  'P7-13 — %s ne lève pas sa propre alerte (l appelant le dit déjà)',
  (nom) => {
    expect(optionsDe(nom)).not.toContain('Alert.alert');
    expect(SOURCE).toMatch(new RegExp(`await ${nom}\.mutateAsync`));
  },
);
