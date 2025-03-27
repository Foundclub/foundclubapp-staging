import { View } from 'react-native';
import SkeletonLoader from '../../atoms/skeletonLoader/SkeletonLoader';
import ErrorWrapper from '../../atoms/errorWrapper/ErrorWrapper';

/**
 * Content wrapper component that handles loading and error states.
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {boolean} props.isLoading
 * @param {boolean} props.isError
 * @param {string} [props.error]
 * @param {string} [props.backgroundColor]
 * @param {Array<import('react-native').ViewStyle>} [props.wrapperStyle]
 * @returns {import('react').ReactElement}
 */
function WithDataWrapper({
  children,
  isLoading,
  isError,
  error,
  backgroundColor,
  wrapperStyle,
}) {
  if (isLoading) {
    return (
      <SkeletonLoader
        isActive
        backgroundColor={backgroundColor}
        wrapperStyle={wrapperStyle}
      >
        {children}
      </SkeletonLoader>
    );
  }

  if (isError) {
    return (
      <ErrorWrapper
        wrapperStyle={wrapperStyle}
        error={error}
      >
        {children}
      </ErrorWrapper>
    );
  }

  return <View style={wrapperStyle}>{children}</View>;
}

export default WithDataWrapper;
