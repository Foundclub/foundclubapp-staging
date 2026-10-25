// BH02 (BUGHUNT 24/10) — P3-21 : sur le web en développement, une API sur localhost n'est pas
// « un appareil physique » : le démarrage ne doit pas être bloqué.
import { buildRuntimeEndpoints } from '@/config/runtimeUrls.shared';

const runtime = (platformOs) => buildRuntimeEndpoints({
  apiPublicUrlEnv: '',
  apiUrlEnv: 'http://localhost:1337/api',
  appEnv: 'local',
  isDev: true,
  isEmulator: false,
  platformOs,
  socketUrlEnv: 'http://localhost:1337',
});

it('web + localhost en développement : aucune erreur de boucle locale', () => {
  expect(runtime('web').errors.filter((e) => e.includes('loopback'))).toEqual([]);
});

it('un vrai téléphone garde l\'alerte', () => {
  expect(runtime('android').errors.some((e) => e.includes('physical device'))).toBe(true);
});
