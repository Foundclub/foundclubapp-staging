import {
  buildInstallLandingUrl,
  buildPublicWebUrl,
  resolveWebAppOrigin,
  toPublicOrigin,
} from '@/utils/shareLinks';

import { buildRuntimeEndpoints, DEFAULT_PUBLIC_ORIGIN } from '@/config/runtimeUrls.shared';

// TRIO / POINT 2 — LE REPLI POINTAIT SUR UN DOMAINE QUE FOUNDCLUB NE SERT PAS.
//
// 🔎 CE QUE `publicOrigin` DESIGNE, ET C'EST LA QUESTION QUI DECIDE DE TOUT :
// c'est l'origine de l'API, pas celle du site. Preuves, lues le 2026-09-01 :
//   · elle sort de `API_PUBLIC_URL`, sinon de `toPublicOrigin(API_URL)` ;
//   · elle fabrique `uploadUrl = <origine>/api/upload` et le `socketUrl` ;
//   · l'app l'expose sous le nom `getPublicApiOrigin`, et ses seuls
//     consommateurs sont `imageUrl.js`, `mediaUrl.js` et les pieces jointes de
//     `Conversation.js` — c'est-a-dire OU VIVENT LES MEDIAS ;
//   · `buildInstallLandingUrl` y accroche `/install.html`, une page qui vit
//     physiquement dans `admin/public/install.html`, donc sur le serveur d'API.
// ⇒ Le site (`foundclub.app`) est une AUTRE valeur, `DEFAULT_WEB_APP_ORIGIN`,
// et elle est deja correcte. Mettre `foundclub.app` ici enverrait les photos et
// les avatars sur le site : ce serait le contraire d'une correction.
//
// 🧨 LE DEFAUT : le repli valait `https://foundclub.com` — ni l'API
// (`api.foundclubpro.com`), ni le site (`foundclub.app`). Un domaine mort.
//
// ⚠️ CE QUE CE TEMOIN NE PRETEND PAS : ce repli ne part PAS en production
// aujourd'hui. `.env.production` porte `API_URL=https://api.foundclubpro.com/api`,
// donc `publicOrigin` en est derive et le repli n'est jamais atteint. Il
// n'apparait que dans une construction SANS `API_URL` — et ce jour-la, il vaut
// mieux qu'il pointe sur l'API que sur un domaine que personne ne sert.

describe('l\'origine de repli quand AUCUNE variable d\'environnement n\'est posee', () => {
  test('la constante ne nomme plus foundclub.com', () => {
    expect(DEFAULT_PUBLIC_ORIGIN).not.toContain('foundclub.com');
    expect(DEFAULT_PUBLIC_ORIGIN).toBe('https://api.foundclubpro.com');
  });

  test('runtimeUrls : sans API_URL ni API_PUBLIC_URL, le repli est celui de l\'API', () => {
    const runtime = buildRuntimeEndpoints({
      apiPublicUrlEnv: '',
      apiUrlEnv: '',
      appEnv: 'production',
      isDev: false,
      isEmulator: false,
      platformOs: 'android',
      socketUrlEnv: '',
    });

    expect(runtime.publicOrigin).toBe('https://api.foundclubpro.com');
  });

  test('shareLinks : la page d\'installation reste sur le serveur qui la sert', () => {
    // `install.html` vit dans `admin/public/`. La poser sur le site donnerait
    // un 404 a chaque invitation partagee.
    expect(toPublicOrigin('')).toBe('https://api.foundclubpro.com');
    expect(buildInstallLandingUrl({
      apiUrl: '',
      env: 'production',
      id: 'team-1',
      source: 'sms',
      type: 'team',
    })).toBe(
      'https://api.foundclubpro.com/install.html?env=production&id=team-1&source=sms&type=team',
    );
  });

  test('LES DEUX FICHIERS PARTAGENT LA MEME CONSTANTE', () => {
    // 🔒 Le vrai piege de ce point : `shareLinks.js` se sert de cette valeur
    // comme d'un TEMOIN (« cette origine est le repli, donc rien n'est
    // configure, donc ce n'est pas le site »). Deux copies qui divergent, et ce
    // temoin cesse silencieusement de reconnaitre son propre repli.
    expect(resolveWebAppOrigin({
      apiUrl: '',
      publicOrigin: DEFAULT_PUBLIC_ORIGIN,
      webUrl: '',
    })).toBe('https://foundclub.app');
  });
});

describe('le SITE, lui, ne bouge pas', () => {
  test('un lien de partage construit sans aucune variable vise foundclub.app', () => {
    expect(resolveWebAppOrigin({ apiUrl: '', publicOrigin: '', webUrl: '' }))
      .toBe('https://foundclub.app');
    expect(buildPublicWebUrl({
      apiUrl: '',
      path: '/clubs/abc',
      publicOrigin: '',
      webUrl: '',
    })).toBe('https://foundclub.app/clubs/abc');
  });

  test('en production reelle, l\'origine API ne se fait pas passer pour le site', () => {
    // La valeur que `.env.production` produit vraiment.
    expect(resolveWebAppOrigin({
      apiUrl: 'https://api.foundclubpro.com/api',
      publicOrigin: 'https://api.foundclubpro.com',
      webUrl: '',
    })).toBe('https://foundclub.app');
  });
});
