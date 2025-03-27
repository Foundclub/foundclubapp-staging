import { cloneElement, Children } from 'react';

const ELEMENTS_TO_EXCLUDE = [
  'View',
  'ScrollView',
  'KeyboardAvoidingView',
  'FlashList',
  'FlatList',
  'TabView',
];

/**
 * Add background Color to each element in given elements beside View ones
 * @param {any} childrenToEdit - The children to edit.
 * @returns {import('react').ReactNode} The edited children.
 */
export const addBackgroundOnDeepTextChildren = (childrenToEdit) => Children.map(
  childrenToEdit,
  (child) => {
    if (!child?.type) {
      return child;
    }
    const childStyle = Array.isArray(child?.props?.style) || !child?.props?.style
      ? child?.props?.style : [child?.props?.style];
    const isChildTypeIgnored = ELEMENTS_TO_EXCLUDE?.includes(child?.type?.name)
    || ELEMENTS_TO_EXCLUDE?.includes(child?.type?.displayName);
    if (child.props?.children) {
      return cloneElement(
        child,
        !isChildTypeIgnored
          ? {
            style: [{ backgroundColor: 'white' }].concat(childStyle || []),
          }
          : { style: childStyle || [] },
        addBackgroundOnDeepTextChildren(child.props.children),
      );
    }
    return cloneElement(
      child,
      !isChildTypeIgnored
        ? { style: [{ backgroundColor: 'white' }].concat(childStyle || []) }
        : { style: childStyle || [] },
    );
  },
);

/**
 * Capitalize the first letter of a string.
 * @param {string} value - The value to capitalize.
 * @returns {string} The capitalized value.
 */
export const capitalizedValue = (value) => {
  if (value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
  return '';
};
