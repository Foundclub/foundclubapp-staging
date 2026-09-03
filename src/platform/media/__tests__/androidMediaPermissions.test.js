import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

// PERMS (2026-09-03) — LE MANIFESTE DECLARAIT TROIS PERMISSIONS QUE PAS UNE
// LIGNE DE CODE NE DEMANDE : READ_MEDIA_IMAGES, READ_MEDIA_VIDEO, READ_MEDIA_AUDIO.
//
// 💸 CE QUE ÇA COÛTAIT : la politique Play « Photos et vidéos » (obligatoire
// depuis le 28/05/2025) impose un formulaire à toute app qui déclare
// READ_MEDIA_IMAGES ou READ_MEDIA_VIDEO sans en avoir un besoin central. Un
// envoi peut être refusé. La 1.7.13 est passée avec, en mai 2026 — ce n'était
// pas un refus certain, c'était un risque à chaque envoi.
//
// 📏 MESURE DU 2026-09-03 — les DEUX moitiés, car une seule ne prouve rien :
//   · demandé par le code : `grep PermissionsAndroid src/` rend 7 fichiers,
//     et AUCUN ne cite READ_MEDIA_*. Les seules permissions demandées sont
//     CAMERA, WRITE_EXTERNAL_STORAGE, POST_NOTIFICATIONS, ACCESS_FINE_LOCATION
//     et RECORD_AUDIO — toutes déclarées ailleurs dans le manifeste.
//   · injecté par une bibliothèque : les manifestes de `node_modules` et le
//     seul AAR du projet (notifee `core-202108261754.aar`) ont été lus.
//     READ_MEDIA_* : 0 occurrence. READ/WRITE_EXTERNAL_STORAGE viennent de
//     `react-native-blob-util` et `react-native-nitro-sound` — d'où le
//     `tools:replace="android:maxSdkVersion"` des lignes 12-13 du manifeste.
//
// 🖼️ POURQUOI CHOISIR UNE PHOTO CONTINUE DE MARCHER, sur TOUT le parc (minSdk 24) :
// `react-native-image-picker` 7.2.3 passe par `ActivityResultContracts.PickVisualMedia`
// (ImagePickerModuleImpl.java:152) — le sélecteur de photos d'AndroidX, qui
// choisit lui-même sa mise en œuvre selon la version et ne demande AUCUNE
// permission de lecture : sur Android 13+ le sélecteur système, en dessous une
// intention de type « ouvrir un document », qui accorde l'accès fichier par
// fichier. Le manifeste de la bibliothèque ne déclare d'ailleurs aucune
// permission du tout. La caméra, elle, garde CAMERA (SelectAvatar.js:256).
//
// ⚠️ CE QUE CE FICHIER NE PROUVE PAS : Jest ne sait pas ce qu'Android accorde à
// l'exécution. Il tient l'invariant de DÉCLARATION — « le code ne demande
// jamais une permission que le manifeste n'a pas » — qui est exactement ce que
// retirer une ligne du manifeste peut casser. Ce qu'accorde le téléphone se
// constate sur un téléphone.
//
// ✅ RECETTE DU 2026-09-03 — ELLE A ÉTÉ FAITE, et voici ce qu'elle a donné.
// Sur `emulator-5556` (Android 16, API 36), avec l'APK construit depuis ce
// manifeste, les trois gestes photo APRÈS le retrait des trois permissions :
//   (a) « Choisir depuis la galerie » → le sélecteur SYSTÈME s'ouvre
//       (`com.google.android.photopicker`), AUCUNE permission demandée, et
//       Android affiche de lui-même « FoundClub Staging will only have access
//       to the photos you select ». La photo choisie s'affiche dans l'app.
//   (b) « Prendre une photo » → Android demande CAMERA (celle qu'on garde),
//       la caméra s'ouvre, la photo prise s'affiche.
//   (c) « Ma carte de collection » → « Enregistrer l'image » → « Ta carte a
//       été ajoutée aux photos de ton téléphone (album FoundClub) », AUCUNE
//       permission demandée, et MediaStore contient bien la carte dans le
//       dossier `FoundClub`.
// `dumpsys package com.foundclub.staging` : AVANT 4 entrées READ_MEDIA
// (VISUAL_USER_SELECTED, IMAGES, AUDIO, VIDEO), APRÈS aucune.

const RACINE_SRC = join(__dirname, '..', '..', '..');
const RACINE_APP = join(RACINE_SRC, '..');
const CHEMIN_MANIFESTE = join(RACINE_APP, 'android/app/src/main/AndroidManifest.xml');

/** Les trois permissions retirées par ce lot. */
const PERMISSIONS_MEDIA_RETIREES = ['READ_MEDIA_AUDIO', 'READ_MEDIA_IMAGES', 'READ_MEDIA_VIDEO'];

/**
 * Permissions dont un écran dépend : les retirer casserait une fonctionnalité.
 * ⛔ Ce témoin positif est là pour qu'un ménage suivant ne coupe pas trop large.
 */
const PERMISSIONS_QUI_DOIVENT_RESTER = [
  'ACCESS_COARSE_LOCATION',
  'ACCESS_FINE_LOCATION',
  'CAMERA',
  'INTERNET',
  'POST_NOTIFICATIONS',
  'RECORD_AUDIO',
  'WRITE_EXTERNAL_STORAGE',
];

/**
 * Dernière version d'Android pour laquelle le code demande encore
 * WRITE_EXTERNAL_STORAGE. Au-delà, MediaStore écrit sans permission — la règle
 * est écrite deux fois, `useShareCard.js:44` et `shareLocalFile.native.js:125`
 * (`ANDROID_SCOPED_STORAGE_VERSION = 29`).
 */
const DERNIERE_VERSION_AVEC_WRITE = 28;

/**
 * Tous les fichiers de source de `src/`, tests et mocks exclus : un test qui se
 * lirait lui-même compterait ses propres chaînes comme des demandes.
 * @param {string} dossier Dossier à parcourir.
 * @returns {string[]} Chemins absolus.
 */
const listerSources = (dossier) => readdirSync(dossier).flatMap((entree) => {
  const chemin = join(dossier, entree);
  if (statSync(chemin).isDirectory()) {
    return entree === '__tests__' || entree === '__mocks__' ? [] : listerSources(chemin);
  }
  if (!/\.(?:js|jsx|ts|tsx)$/.test(entree) || /\.test\.[jt]sx?$/.test(entree)) return [];
  return [chemin];
});

/**
 * Les permissions Android que le code DEMANDE, et où. Les deux écritures sont
 * lues : la constante (`PermissionsAndroid.PERMISSIONS.X`) et le nom en toutes
 * lettres (`'android.permission.X'`).
 * @returns {Map<string, string[]>} Permission -> `chemin:ligne` qui la demande.
 */
const lireLesDemandesDuCode = () => {
  const parPermission = new Map();

  listerSources(RACINE_SRC).forEach((chemin) => {
    const source = readFileSync(chemin, 'utf8');
    if (!source.includes('PermissionsAndroid') && !source.includes('android.permission.')) return;

    source.split(/\r?\n/).forEach((ligne, index) => {
      const noms = [
        ...[...ligne.matchAll(/PermissionsAndroid\.PERMISSIONS\.([A-Z_]+)/g)],
        ...[...ligne.matchAll(/['"]android\.permission\.([A-Z_]+)['"]/g)],
      ].map((trouve) => trouve[1]);

      noms.forEach((nom) => {
        const ou = `${chemin.slice(RACINE_SRC.length + 1).replace(/\\/g, '/')}:${index + 1}`;
        const dejaVues = parPermission.get(nom) || [];
        if (!dejaVues.includes(ou)) parPermission.set(nom, [...dejaVues, ou]);
      });
    });
  });

  // Une extraction muette rendrait une carte vide, donc des témoins VERTS sur
  // un contrôle qui ne contrôle plus rien.
  if (parPermission.size === 0) {
    throw new Error('Aucune demande de permission lue dans src/ : la lecture ne marche plus');
  }
  return parPermission;
};

/**
 * Les permissions que le manifeste DÉCLARE réellement.
 * ⚠️ `tools:node="remove"` n'est pas une déclaration : c'est l'inverse, la
 * ligne existe pour retirer du manifeste fusionné ce qu'une bibliothèque y
 * injecte (cf. les trois lignes notifee, manifeste l.33-35).
 * @returns {Map<string, { declaree: boolean, maxSdkVersion: number|null }>} La table.
 */
const lireLesDeclarationsDuManifeste = () => {
  const manifeste = readFileSync(CHEMIN_MANIFESTE, 'utf8');
  const balises = manifeste.match(/<uses-permission\b[^>]*>/g) || [];
  if (balises.length === 0) {
    throw new Error(`Aucune balise <uses-permission> dans ${CHEMIN_MANIFESTE} : forme changée`);
  }

  const table = new Map();
  balises.forEach((balise) => {
    const nom = /android:name="android\.permission\.([A-Z_]+)"/.exec(balise);
    if (!nom) return;
    const plafond = /android:maxSdkVersion="(\d+)"/.exec(balise);
    table.set(nom[1], {
      declaree: !balise.includes('tools:node="remove"'),
      maxSdkVersion: plafond ? Number(plafond[1]) : null,
    });
  });
  return table;
};

const DEMANDES = lireLesDemandesDuCode();
const DECLARATIONS = lireLesDeclarationsDuManifeste();

/**
 * Dit si une permission finit vraiment dans le manifeste de l'app.
 * @param {string} nom Nom court de la permission.
 * @returns {boolean} `true` si elle y est declaree.
 */
const estDeclaree = (nom) => Boolean(DECLARATIONS.get(nom)?.declaree);

describe('PERMS — le manifeste Android et le code disent la meme chose', () => {
  // 🥇 TÉMOIN PRINCIPAL : c'est LUI qui rougit si un ménage retire une
  // permission dont un écran dépend. Le nom du fichier fautif est dans la
  // sortie, donc la panne se lit sans enquête.
  it.each([...DEMANDES.keys()].sort())(
    '%s, demandee par le code, est bien declaree dans le manifeste',
    (nom) => {
      expect({ declaree: estDeclaree(nom), demandee_par: DEMANDES.get(nom), nom })
        .toEqual({ declaree: true, demandee_par: DEMANDES.get(nom), nom });
    },
  );

  // 🔴 LE TÉMOIN DU LOT : ROUGE avant le retrait des lignes 9-11, VERT après.
  it.each(PERMISSIONS_MEDIA_RETIREES)('%s n est plus declaree', (nom) => {
    expect(estDeclaree(nom)).toBe(false);
  });

  // L'autre moitié : si un écran se met un jour à demander READ_MEDIA_*, il
  // faudra rouvrir le dossier Play — donc le décider, pas le subir.
  it.each(PERMISSIONS_MEDIA_RETIREES)('aucun fichier de src/ ne demande %s', (nom) => {
    expect(DEMANDES.get(nom) || []).toEqual([]);
  });

  // 🔒 TÉMOIN POSITIF : ce qui marchait marche encore.
  it.each(PERMISSIONS_QUI_DOIVENT_RESTER)('%s reste declaree', (nom) => {
    expect(estDeclaree(nom)).toBe(true);
  });

  // Le lien entre le plafond du manifeste et la règle du code : la permission
  // doit encore exister aux versions où le code la demande, sinon la demande
  // échoue et l'enregistrement de la carte se bloque tout seul.
  it('WRITE_EXTERNAL_STORAGE couvre encore Android 9 et anterieur', () => {
    const { maxSdkVersion } = DECLARATIONS.get('WRITE_EXTERNAL_STORAGE');

    const couvre = maxSdkVersion === null || maxSdkVersion >= DERNIERE_VERSION_AVEC_WRITE;

    expect(couvre).toBe(true);
  });
});

describe('PERMS — choisir une photo ne demande aucune permission de lecture', () => {
  /**
   * Lit un fichier de source du depot.
   * @param {string} cheminRelatif Chemin depuis `src/`.
   * @returns {string} Contenu du fichier.
   */
  const lireSource = (cheminRelatif) => readFileSync(join(RACINE_SRC, cheminRelatif), 'utf8');

  // 🖼️ LA RÉPONSE À « on pourra toujours publier des photos ? », côté code :
  // la couche qui ouvre la galerie ne connaît même pas PermissionsAndroid.
  it('la couche media n a aucune demande de permission', () => {
    expect(lireSource('platform/media/media.native.js')).not.toMatch(/PermissionsAndroid/);
  });

  // La caméra garde la sienne — et c'est la SEULE que l'avatar demande.
  it('SelectAvatar ne demande que CAMERA', () => {
    const source = lireSource('components/molecules/selectAvatar/SelectAvatar.js');
    const demandees = [...source.matchAll(/PermissionsAndroid\.PERMISSIONS\.([A-Z_]+)/g)]
      .map((trouve) => trouve[1]);

    expect([...new Set(demandees)]).toEqual(['CAMERA']);
  });
});
