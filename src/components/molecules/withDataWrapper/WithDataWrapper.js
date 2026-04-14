import { View } from 'react-native';

import ErrorWrapper from '@/components/atoms/errorWrapper/ErrorWrapper';
import SkeletonLoader from '@/components/atoms/skeletonLoader/SkeletonLoader';

/**
 * Content wrapper component that handles loading and error states.
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {boolean} props.isLoading
 * @param {unknown} [props.error]
 * @param {string} [props.backgroundColor]
 * @param {Array<import('react-native').ViewStyle>} [props.wrapperStyle]
 * @returns {import('react').ReactElement}
 */
function WithDataWrapper({
  backgroundColor,
  children,
  error,
  isLoading,
  wrapperStyle,
}) {
  if (isLoading) {
    return (
      <SkeletonLoader
        backgroundColor={backgroundColor}
        isActive
        wrapperStyle={wrapperStyle}
      >
        {children}
      </SkeletonLoader>
    );
  }

  if (error) {
    return (
      <ErrorWrapper
        error={error}
        wrapperStyle={wrapperStyle}
      >
        {children}
      </ErrorWrapper>
    );
  }

  return <View style={wrapperStyle}>{children}</View>;
}

export default WithDataWrapper;
