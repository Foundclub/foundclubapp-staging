import { readFileSync } from 'fs';
import { join } from 'path';

import {
  buildFileTooLargeMessage,
  checkImageSize,
  MAX_UPLOAD_IMAGE_BYTES,
  PHOTO_MAX_DIMENSION,
  PHOTO_PICKER_LIMITS,
  PHOTO_QUALITY,
} from '../photoLimits';

// FILET Y01 — « une photo prise avec la caméra est refusée, fichier trop lourd ».
//
// 📏 MESURE DU 2026-08-19 (sharp 0.34, image photo-réaliste, bruit + dégradés) :
// | Cas                                        | JPEG q0.8 | PNG sans perte | Facteur |
// | photo brute 4032x3024 (12 Mpx)             |  2,81 Mo  |    30,85 Mo    |   x11   |
// | avatar réduit à 1000x1000                  |   237 Ko  |     2,53 Mo    |   x11   |
// | re-capture view-shot, iPhone x3 (3000x3000)|  2,08 Mo  |    22,80 Mo    |   x11   |
// ⚠️ L'amplification x3 est propre à iOS (RNViewShot.mm l.113 capture à
// l'échelle de l'écran) ; Android rend la taille demandée (ViewShot.java l.440).
//
// 🎯 CE QUE CE FICHIER GARDE, et pourquoi ce n'est PAS un test de constante :
// aucun plafond du SERVEUR n'est atteignable par une photo (mesuré : greffon
// d'upload Strapi 1 Go par défaut, corps de requête 200 Mo via formidable,
// Caddy sans directive de taille). Le seul plafond qui parle à l'utilisateur
// est celui de l'app. Le défaut n'était donc pas un plafond trop bas : c'était
// qu'AUCUN chemin ne réduisait la photo avant de l'envoyer.
//
// ⚠️ CE QU'IL NE PROUVE PAS : Jest n'a ni appareil photo ni encodeur JPEG. Il
// contrôle les CONSIGNES données à la bibliothèque native, pas les octets
// qu'elle produit. Les octets se constatent sur un téléphone.

const RACINE_SOURCES = join(__dirname, '..', '..', '..');

/**
 * Lit un fichier de source du dépôt.
 * @param {string} cheminRelatif Chemin depuis `src/`.
 * @returns {string} Le contenu du fichier.
 */
const lireSource = (cheminRelatif) => readFileSync(join(RACINE_SOURCES, cheminRelatif), 'utf8');

// TOUS les endroits d'où une photo part vers le serveur. Recensés le
// 2026-08-19 par `grep launchCamera|launchImageLibrary|capturePhoto|pickImage`.
// ⛔ Une nouvelle entrée dans cette liste sans les limites fait ROUGIR ce test.
const CHEMINS_QUI_ENVOIENT_UNE_PHOTO = [
  'platform/media/media.native.js',
  'components/molecules/selectAvatar/SelectAvatar.js',
  'views/Conversation.js',
  'views/league/details/SquadDetailsScreen.js',
  'views/league/match/EndMatchScreen.js',
  'views/admin/AdminPopupCampaignForm.js',
  'views/admin/SuperAdminEntryForm.js',
  'services/admin/adminClubContentService.js',
];

describe('Y01 — la taille d une photo avant l envoi', () => {
  // 🥇 TÉMOIN N°2 : l'image envoyée est redimensionnée AVANT l'envoi.
  //
  // C'est le témoin principal du lot : le 2026-08-19, un seul fichier sur huit
  // posait `maxWidth`/`maxHeight` (SelectAvatar). Partout ailleurs, la photo
  // partait à la définition brute du capteur. `quality` seul ne suffit PAS : il
  // recompresse, il ne réduit pas le nombre de pixels.
  //
  // Deux façons d'être en règle, et une seule d'être en faute :
  //   - reprendre les limites partagées (`PHOTO_PICKER_LIMITS`) ; OU
  //   - déclarer ses propres bornes, plus strictes — c'est le cas de
  //     `SelectAvatar`, qui plafonne un avatar à 1000 px.
  // ⛔ Ne rien déclarer du tout est le défaut que ce lot corrige.
  it.each(CHEMINS_QUI_ENVOIENT_UNE_PHOTO)('réduit la photo dans %s', (cheminRelatif) => {
    const source = lireSource(cheminRelatif);

    expect(source).toMatch(/PHOTO_PICKER_LIMITS|maxWidth/);
    expect(source).toMatch(/PHOTO_PICKER_LIMITS|maxHeight/);
  });

  // 🔒 TÉMOIN N°3 : la qualité reste utilisable — on compresse, on ne détruit
  // pas. Un écusson de club illisible serait pire que le défaut de départ.
  it('garde une définition et une compression exploitables', () => {
    // 2048 px de côté reste au-dessus de la définition de tout écran de l'app.
    expect(PHOTO_MAX_DIMENSION).toBeGreaterThanOrEqual(1024);
    // q0.8 est la qualité que la caméra appliquait déjà : rien n'est dégradé.
    expect(PHOTO_QUALITY).toBeGreaterThanOrEqual(0.7);
    expect(PHOTO_QUALITY).toBeLessThanOrEqual(1);
    expect(PHOTO_PICKER_LIMITS).toEqual({
      maxHeight: PHOTO_MAX_DIMENSION,
      maxWidth: PHOTO_MAX_DIMENSION,
      quality: PHOTO_QUALITY,
    });
  });

  // 🥇 TÉMOIN N°1 : une photo de la taille d'un appareil récent passe.
  // Chiffres mesurés ci-dessus, ramenés en octets.
  it('laisse passer une photo d appareil récent', () => {
    const photoReduite2048 = Math.round(0.98 * 1024 * 1024); // 2048x2048, JPEG q0.8
    const photoBrute12Mpx = Math.round(2.81 * 1024 * 1024); // 4032x3024, JPEG q0.8

    expect(checkImageSize(photoReduite2048)).toBe('');
    // Même NON réduite, une photo JPEG d'appareil récent passe : ce n'est donc
    // pas le plafond qui était trop bas, c'est le PNG qui gonflait le fichier.
    expect(checkImageSize(photoBrute12Mpx)).toBe('');
  });

  // 🚫 TÉMOIN N°4 : un fichier VRAIMENT trop gros est toujours refusé, et le
  // message dit la taille maximale.
  it('refuse un fichier vraiment trop gros en nommant le plafond', () => {
    const recapturePngIphoneX3 = Math.round(22.8 * 1024 * 1024); // mesuré, cf. tableau

    const refus = checkImageSize(recapturePngIphoneX3);
    expect(refus).not.toBe('');
    expect(refus).toContain('15 Mo');
    expect(refus).toBe(buildFileTooLargeMessage(MAX_UPLOAD_IMAGE_BYTES));
  });

  // 🛟 On ne refuse jamais ce qu'on n'a pas mesuré : une taille absente laisse
  // passer. Sans cette règle, effacer `fileSize` transformerait le garde-fou en
  // refus systématique.
  it('ne refuse pas une taille inconnue', () => {
    expect(checkImageSize(undefined)).toBe('');
    expect(checkImageSize(0)).toBe('');
    expect(checkImageSize(null)).toBe('');
  });
});
