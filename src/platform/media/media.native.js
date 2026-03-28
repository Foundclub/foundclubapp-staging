import { pick } from '@react-native-documents/picker';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';

export const pickImage = async (options = {}) => launchImageLibrary({
  mediaType: 'photo',
  selectionLimit: 1,
  ...options,
});

export const pickDocument = async (options = {}) => pick(options);

export const capturePhoto = async (options = {}) => launchCamera({
  mediaType: 'photo',
  saveToPhotos: false,
  ...options,
});

export const recordVoiceNote = async () => {
  throw new Error('L enregistrement vocal n est pas encore adapte via platform/media.');
};

export default {
  capturePhoto,
  pickDocument,
  pickImage,
  recordVoiceNote,
};
