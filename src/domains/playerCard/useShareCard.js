// @ts-nocheck
/**
 * useShareCard — capture de la carte (react-native-view-shot) + partage natif
 * + enregistrement dans la galerie du telephone.
 *
 * - captureToFile() : rend la carte hors-ecran -> tmpfile PNG 992×1262
 *   (taille native de la maquette, cf. design final).
 * - shareCard({ dialogTitle, message, title }) : capture puis `shareLocalFile`.
 *   L27 : l'image etait AVANT confiee a `SharePlatform.share({ url })`, que RN
 *   0.78 purge de son `url` sur Android — la carte etait donc jetee et seul le
 *   texte partait. La decision par plateforme est desormais prise UNE fois, dans
 *   `@/platform/share/fileShareContract`, et executee par `shareLocalFile` :
 *   feuille de partage sur iOS/web, « enregistrer puis ouvrir » sur Android.
 * - saveCardToGallery() : capture puis CameraRoll.saveAsset -> album FoundClub
 *   dans les photos du telephone (MediaStore ; permission WRITE demandee
 *   uniquement sur Android <= 9, plus requise au-dela).
 *
 * Perf : un seul rendu hors-ecran a la fois, debounce via `isBusy`.
 */
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import { useCallback, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { CARD_FORMATS } from '@/components/organisms/playerCard/PlayerCard';

// Suffixe de plateforme resolu par Metro/Jest (.native.js) et par Vite (.web.js),
// pas par le resolveur du linter — meme alerte que sur `visualRender.native.js`.
// eslint-disable-next-line import/extensions, import/no-unresolved -- cf. ci-dessus
import { shareLocalFile } from '@/platform/share/shareLocalFile';

const GALLERY_ALBUM = 'FoundClub';

/** Nom sous lequel l'utilisateur retrouve sa carte dans sa galerie (Android). */
export const CARD_SHARE_FILE_NAME = 'foundclub-carte-joueur.png';

/**
 * Android <= 9 (API < 29) : l'ecriture MediaStore exige encore WRITE_EXTERNAL_STORAGE.
 * Ne sert plus qu'a `saveCardToGallery` (CameraRoll) : le partage, lui, passe par
 * la regle EQUIVALENTE de `shareLocalFile`, pour ne pas en faire un 5e jumeau.
 * @returns {Promise<boolean>}
 */
const ensureLegacyWritePermission = async () => {
  if (Platform.OS !== 'android' || Number(Platform.Version) >= 29) return true;
  const status = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
  );
  return status === PermissionsAndroid.RESULTS.GRANTED;
};

/**
 * Capture, partage et enregistrement de la carte joueur.
 * @returns {{
 *   cardRef: import('react').MutableRefObject<any>,
 *   isBusy: boolean,
 *   captureToFile: () => Promise<string>,
 *   shareCard: (opts?: { dialogTitle?: string, message?: string, title?: string })
 *     => Promise<{ fileUri: string, opened: boolean, outcome: string }|null>,
 *   saveCardToGallery: () => Promise<string|null>,
 * }}
 */
export default function useShareCard() {
  const cardRef = useRef(null);
  const [isBusy, setIsBusy] = useState(false);
  const inFlightRef = useRef(false);

  const captureToFile = useCallback(async (format = 'square') => {
    const fmt = CARD_FORMATS[format] || CARD_FORMATS.square;
    return captureRef(cardRef, {
      format: 'png',
      height: fmt.height,
      quality: 1,
      result: 'tmpfile',
      width: fmt.width,
    });
  }, []);

  const shareCard = useCallback(async ({ dialogTitle, message, title } = {}) => {
    if (inFlightRef.current) return null; // debounce : une seule action a la fois
    inFlightRef.current = true;
    setIsBusy(true);
    try {
      const fileUri = await captureToFile();
      // Peut LEVER une erreur porteuse (`reason`) : permission refusee, ou
      // enregistrement impossible. L'ecran en tire sa phrase — cf. PlayerCardScreen.
      const { opened, outcome } = await shareLocalFile({
        dialogTitle,
        fileName: CARD_SHARE_FILE_NAME,
        fileUri,
        message,
        mimeType: 'image/png',
        title,
      });
      return { fileUri, opened, outcome };
    } finally {
      inFlightRef.current = false;
      setIsBusy(false);
    }
  }, [captureToFile]);

  const saveCardToGallery = useCallback(async () => {
    if (inFlightRef.current) return null;
    inFlightRef.current = true;
    setIsBusy(true);
    try {
      const allowed = await ensureLegacyWritePermission();
      if (!allowed) {
        throw new Error('gallery_permission_denied');
      }
      const uri = await captureToFile();
      const asset = await CameraRoll.saveAsset(uri, {
        album: GALLERY_ALBUM,
        type: 'photo',
      });
      return asset?.node?.image?.uri || uri;
    } finally {
      inFlightRef.current = false;
      setIsBusy(false);
    }
  }, [captureToFile]);

  return {
    captureToFile, cardRef, isBusy, saveCardToGallery, shareCard,
  };
}
