const selectFile = (accept, options = {}) => new Promise((resolve, reject) => {
  if (typeof document === 'undefined') {
    reject(new Error('Le navigateur ne supporte pas le sélecteur de fichiers.'));
    return;
  }

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.multiple = Boolean(options.multiple);
  if (options.capture) {
    input.capture = options.capture;
  }

  input.addEventListener('change', () => {
    const [file] = Array.from(input.files || []);
    resolve(file || null);
  }, { once: true });

  input.click();
});

export const pickImage = async (options = {}) => selectFile('image/*', options);

export const pickDocument = async (options = {}) => selectFile(options.accept || '*/*', options);

export const capturePhoto = async () => selectFile('image/*', { capture: 'environment' });

/**
 * Y01 — parité d'API avec le natif. Le navigateur ne fabrique aucun fichier
 * temporaire : un `File` porte déjà sa taille, il n'y a rien à remesurer.
 * @returns {Promise<undefined>} Toujours `undefined` : non mesuré.
 */
export const getLocalFileSize = async () => undefined;

const getSupportedVoiceMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return '';

  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || '';
};

const stopMediaTracks = (stream) => {
  stream?.getTracks?.().forEach((track) => {
    try {
      track.stop();
    } catch (_error) {
      // Best effort cleanup.
    }
  });
};

export const recordVoiceNote = async () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    throw new Error('Le navigateur est requis pour enregistrer une note vocale.');
  }

  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    throw new Error('L enregistrement vocal web n est pas pris en charge par ce navigateur.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = getSupportedVoiceMimeType();
  const chunks = [];
  const startedAt = Date.now();
  const fileName = `voice-note-${startedAt}.${mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'm4a' : 'webm'}`;
  let isCancelled = false;
  let resolveResult;
  let rejectResult;

  const result = new Promise((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });

  const recorder = mimeType
    ? new MediaRecorder(stream, { mimeType })
    : new MediaRecorder(stream);

  recorder.addEventListener('dataavailable', (event) => {
    if (event.data && event.data.size > 0) {
      chunks.push(event.data);
    }
  });

  recorder.addEventListener('error', (event) => {
    stopMediaTracks(stream);
    rejectResult(event?.error || new Error('L enregistrement vocal a échoué.'));
  });

  recorder.addEventListener('stop', () => {
    stopMediaTracks(stream);

    if (isCancelled) {
      rejectResult(new Error('VOICE_NOTE_RECORDING_CANCELLED'));
      return;
    }

    const blob = new Blob(chunks, { type: mimeType || recorder.mimeType || 'audio/webm' });
    const file = new File([blob], fileName, { type: blob.type || 'audio/webm' });

    resolveResult({
      durationMs: Math.max(0, Date.now() - startedAt),
      file,
      mime: file.type || 'audio/webm',
      name: file.name,
      size: file.size,
      uri: URL.createObjectURL(file),
    });
  });

  recorder.start();

  return {
    cancel: async () => {
      if (recorder.state === 'inactive') {
        stopMediaTracks(stream);
        return;
      }

      isCancelled = true;
      recorder.stop();
      await result.catch(() => undefined);
    },
    result,
    stop: async () => {
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }

      return result;
    },
  };
};

export default {
  capturePhoto,
  getLocalFileSize,
  pickDocument,
  pickImage,
  recordVoiceNote,
};
