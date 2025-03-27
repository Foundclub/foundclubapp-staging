export const directions = /** @type {const} */ ({
  column: 'column',
  columnReverse: 'column-reverse',
  row: 'row',
  rowReverse: 'row-reverse',
});

export const positions = /** @type {const} */ ({
  center: 'center',
  end: 'flex-end',
  start: 'flex-start',
  stretch: 'stretch',
  around: 'space-around',
  between: 'space-between',
  absolute: 'absolute',
  relative: 'relative',
  static: 'static',
  wrap: 'wrap',
  nowrap: 'nowrap',
  wrapReverse: 'wrap-reverse',
});

export const dimensions = /** @type {const} */ ({
  fullPercent: '100%',
});

export const overflows = /** @type {const} */ ({
  hidden: 'hidden',
  visible: 'visible',
  scroll: 'scroll',
});

/**
 * All alignements classes
 * @inheritdoc
 */
const alignements = {
  // flex-direction
  column: {
    flexDirection: directions.column,
  },
  columnReverse: {
    flexDirection: directions.columnReverse,
  },
  row: {
    flexDirection: directions.row,
  },
  rowReverse: {
    flexDirection: directions.rowReverse,
  },
  // align-items
  alignCenter: {
    alignItems: positions.center,
  },
  alignEnd: {
    alignItems: positions.end,
  },
  alignStart: {
    alignItems: positions.start,
  },
  alignStretch: {
    alignItems: positions.stretch,
  },
  // align-self
  selfStretch: {
    alignSelf: positions.stretch,
  },
  selfCenter: {
    alignSelf: positions.center,
  },
  // justify-content
  justifyCenter: {
    justifyContent: positions.center,
  },
  justifyEnd: {
    justifyContent: positions.end,
  },
  justifySpaceAround: {
    justifyContent: positions.around,
  },
  justifySpaceBetween: {
    justifyContent: positions.between,
  },
  justifyStart: {
    justifyContent: positions.start,
  },
  // flex and flex-grow
  fill: {
    flex: 1,
  },
  grow1: {
    flexGrow: 1,
  },
  scrollSpaceAround: {
    flexGrow: 1,
    justifyContent: positions.around,
  },
  scrollSpaceBetween: {
    flexGrow: 1,
    justifyContent: positions.between,
  },
  // Size
  fullSize: {
    height: dimensions.fullPercent,
    width: dimensions.fullPercent,
  },
  fullWidth: {
    width: dimensions.fullPercent,
  },
  fullHeight: {
    height: dimensions.fullPercent,
  },
  // transform
  mirror: {
    transform: [{ scaleX: -1 }],
  },
  rotate90: {
    transform: [{ rotate: '90deg' }],
  },
  rotate90Inverse: {
    transform: [{ rotate: '-90deg' }],
  },
  // position
  relative: {
    position: positions.relative,
  },
  absolute: {
    position: positions.absolute,
  },
  static: {
    position: positions.static,
  },
  // wrap
  wrap: {
    flexWrap: positions.wrap,
  },
  noWrap: {
    flexWrap: positions.nowrap,
  },
  // overflow
  overflowHidden: {
    overflow: overflows.hidden,
  },
  overflowVisible: {
    overflow: overflows.visible,
  },
  overflowScroll: {
    overflow: overflows.scroll,
  },
};

/**
 * @type {{[key in keyof typeof alignements]: import("react-native").ViewStyle}}
 */
export default alignements;
