import { Image } from 'react-native';

import { getImageUrl } from '@/utils/imageUrl';

/**
 * Image component that automatically transforms Strapi URLs
 * @param {import('react-native').ImageProps & { source?: { uri?: string } }} props
 * @returns {import('react').ReactElement}
 */
function StrapiImage({ source, ...props }) {
  const transformedSource = source?.uri
    ? { ...source, uri: getImageUrl(source.uri) }
    : source;

  return <Image source={transformedSource} {...props} />;
}

export default StrapiImage;
