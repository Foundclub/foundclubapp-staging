import { Dimensions } from 'react-native';

export const screenWidth = Dimensions.get('window').width;
export const screenHeight = Dimensions.get('window').height;

export const sizes = {
  0: 0,
  12: 12,
  128: 128,
  16: 16,
  160: 160,
  24: 24,
  32: 32,
  4: 4,
  40: 40,
  64: 64,
  8: 8,
  80: 80,
};

export const types = {
  gap: 'gap',
  margin: 'margin',
  marginBottom: 'marginBottom',
  marginHorizontal: 'marginHorizontal',
  marginLeft: 'marginLeft',
  marginRight: 'marginRight',
  marginTop: 'marginTop',
  marginVertical: 'marginVertical',
  padding: 'padding',
  paddingBottom: 'paddingBottom',
  paddingHorizontal: 'paddingHorizontal',
  paddingLeft: 'paddingLeft',
  paddingRight: 'paddingRight',
  paddingTop: 'paddingTop',
  paddingVertical: 'paddingVertical',
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
