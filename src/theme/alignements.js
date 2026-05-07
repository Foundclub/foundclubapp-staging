export const directions = /** @type {const} */ ({
  column: 'column',
  columnReverse: 'column-reverse',
  row: 'row',
  rowReverse: 'row-reverse',
});

export const positions = /** @type {const} */ ({
  absolute: 'absolute',
  around: 'space-around',
  between: 'space-between',
  center: 'center',
  end: 'flex-end',
  nowrap: 'nowrap',
  relative: 'relative',
  start: 'flex-start',
  static: 'static',
  stretch: 'stretch',
  wrap: 'wrap',
  wrapReverse: 'wrap-reverse',
});

export const dimensions = /** @type {const} */ ({
  fullPercent: '100%',
});

export const overflows = /** @type {const} */ ({
  hidden: 'hidden',
  scroll: 'scroll',
  visible: 'visible',
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
  // compatibility aliases
  center: {
    alignItems: positions.center,
    justifyContent: positions.center,
  },
  // align-self
  selfCenter: {
    alignSelf: positions.center,
  },
  selfStart: {
    alignSelf: positions.start,
  },
  selfStretch: {
    alignSelf: positions.stretch,
  },
  // justify-content
  justifyBetween: {
    justifyContent: positions.between,
  },
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
  rowBetween: {
    alignItems: positions.center,
    flexDirection: directions.row,
    justifyContent: positions.between,
  },
  spaceBetween: {
    justifyContent: positions.between,
  },
  // flex and flex-grow
  fill: {
    flex: 1,
  },
  grow1: {
    flexGrow: 1,
  },
  mainCenter: {
    alignItems: positions.center,
    flex: 1,
    justifyContent: positions.center,
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
  fullHeight: {
    height: dimensions.fullPercent,
  },
  fullSize: {
    height: dimensions.fullPercent,
    width: dimensions.fullPercent,
  },
  fullWidth: {
    width: dimensions.fullPercent,
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
  absolute: {
    position: positions.absolute,
  },
  relative: {
    position: positions.relative,
  },
  static: {
    position: positions.static,
  },
  // wrap
  noWrap: {
    flexWrap: positions.nowrap,
  },
  wrap: {
    flexWrap: positions.wrap,
  },
  // overflow
  overflowHidden: {
    overflow: overflows.hidden,
  },
  overflowScroll: {
    overflow: overflows.scroll,
  },
  overflowVisible: {
    overflow: overflows.visible,
  },
};

/**
 * @type {{[key in keyof typeof alignements]: import("react-native").ViewStyle}}
 */
export default alignements;
