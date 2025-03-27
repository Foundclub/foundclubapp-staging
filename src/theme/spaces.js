import { Dimensions } from 'react-native';

export const screenWidth = Dimensions.get('window').width;
export const screenHeight = Dimensions.get('window').height;

export const sizes = {
  0: 0,
  4: 4,
  8: 8,
  12: 12,
  16: 16,
  24: 24,
  32: 32,
  40: 40,
  64: 64,
  80: 80,
  128: 128,
  160: 160,
};

export const types = {
  marginHorizontal: 'marginHorizontal',
  marginVertical: 'marginVertical',
  marginTop: 'marginTop',
  margin: 'margin',
  marginBottom: 'marginBottom',
  marginRight: 'marginRight',
  marginLeft: 'marginLeft',
  padding: 'padding',
  paddingHorizontal: 'paddingHorizontal',
  paddingVertical: 'paddingVertical',
  paddingTop: 'paddingTop',
  paddingBottom: 'paddingBottom',
  paddingRight: 'paddingRight',
  paddingLeft: 'paddingLeft',
  gap: 'gap',
};

/**
 * Generate classes defining margin and padding for every sizes defined above
 * @returns {import('./types').Spaces} - The generated classes.
 */
const getSpaces = () => {
  /**
   * @type {import('./types').Spaces}
   */
  // @ts-expect-error because we can't use typescript as type to define the accumulator
  const initialAcc = {};
  return Object.keys(types).reduce(
    (acc, type) => ({
      ...acc,
      [type]: Object.entries(sizes).reduce(
        (accSize, [key, value]) => ({
          ...accSize,
          [key]: {
            [type]: value,
          },
        }),
        {},
      ),
    }),
    initialAcc,
  );
};

export default getSpaces();
