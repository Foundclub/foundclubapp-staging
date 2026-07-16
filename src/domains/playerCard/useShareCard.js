// @ts-nocheck
/**
 * useShareCard — capture de la carte (react-native-view-shot) + partage natif
 * + enregistrement dans la galerie du telephone.
 *
 * - captureToFile() : rend la carte hors-ecran -> tmpfile PNG 992×1262
 *   (taille native de la maquette, cf. design final).
 * - shareCard({ message, title }) : capture puis SharePlatform.share.
 *   ⚠ Android : Share.share ignore `url` -> texte seul (limitation RN connue).
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

import SharePlatform from '@/platform/share';

const GALLERY_ALBUM = 'FoundClub';

/** Android <= 9 (API < 29) : l'ecriture MediaStore exige encore WRITE_EXTERNAL_STORAGE. */
const ensureLegacyWritePermission = async () => {
  if (Platform.OS !== 'android' || Number(Platform.Version) >= 29) return true;
  const status = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
  );
  return status === PermissionsAndroid.RESULTS.GRANTED;
};

/**
 * @returns {{
 *   cardRef: import('react').MutableRefObject<any>,
 *   isBusy: boolean,
 *   captureToFile: () => Promise<string>,
 *   shareCard: (opts?: { message?: string, title?: string }) => Promise<string|null>,
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

  const shareCard = useCallback(async ({ message, title } = {}) => {
    if (inFlightRef.current) return null; // debounce : une seule action a la fois
    inFlightRef.current = true;
    setIsBusy(true);
    try {
      const uri = await captureToFile();
      await SharePlatform.share({ message, title, url: uri });
      return uri;
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
