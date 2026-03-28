import { Share } from 'react-native';

export const share = async (payload) => Share.share(payload);

export default {
  share,
};
