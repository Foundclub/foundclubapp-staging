const selectFile = (accept, options = {}) => new Promise((resolve, reject) => {
  if (typeof document === 'undefined') {
    reject(new Error('Le navigateur ne supporte pas le selecteur de fichiers.'));
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

export const recordVoiceNote = async () => {
  throw new Error('L enregistrement vocal web n est pas encore pris en charge.');
};

export default {
  capturePhoto,
  pickDocument,
  pickImage,
  recordVoiceNote,
};
