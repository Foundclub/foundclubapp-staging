const roundLayoutValue = (value) => Math.round(value);

const isFiniteNumber = (value) => (
  typeof value === 'number' && Number.isFinite(value)
);

const toLayout = (rect) => {
  if (!rect || !isFiniteNumber(rect.width) || !isFiniteNumber(rect.height)) {
    return null;
  }

  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  return {
    height: roundLayoutValue(rect.height),
    width: roundLayoutValue(rect.width),
    x: roundLayoutValue(rect.left),
    y: roundLayoutValue(rect.top),
  };
};

const cloneRect = (rect) => ({
  bottom: rect.bottom,
  height: rect.height,
  left: rect.left,
  right: rect.right,
  top: rect.top,
  width: rect.width,
});

const isNearlyEqual = (left, right, tolerance = 2) => (
  Math.abs((left || 0) - (right || 0)) <= tolerance
);

const areRectsStable = (left, right) => (
  isNearlyEqual(left?.top, right?.top)
  && isNearlyEqual(left?.left, right?.left)
  && isNearlyEqual(left?.width, right?.width)
  && isNearlyEqual(left?.height, right?.height)
);

const resolveTargetNode = (target) => {
  if (!target) return null;
  if (typeof target === 'function') {
    return target();
  }
  return target;
};

export const waitForWindowScrollToSettleOnWeb = (targetTop, options = {}) => new Promise((resolve) => {
  if (typeof window === 'undefined') {
    resolve();
    return;
  }

  const timeoutMs = options.timeoutMs ?? 1600;
  const startTime = Date.now();
  let stableFrames = 0;
  let lastScrollY = window.scrollY;

  const check = () => {
    const currentScrollY = window.scrollY;
    const isStable = isNearlyEqual(currentScrollY, lastScrollY, 1);
    const reachedTarget = isNearlyEqual(currentScrollY, targetTop, 2);

    if (isStable && reachedTarget) {
      stableFrames += 1;
    } else if (isStable) {
      stableFrames += 0.5;
    } else {
      stableFrames = 0;
    }

    if (stableFrames >= 2 || (Date.now() - startTime) >= timeoutMs) {
      resolve();
      return;
    }

    lastScrollY = currentScrollY;
    requestAnimationFrame(check);
  };

  requestAnimationFrame(check);
});

export const measureTutorialTargetOnWeb = (target, options = {}) => new Promise((resolve) => {
  if (typeof window === 'undefined') {
    resolve(null);
    return;
  }

  const timeoutMs = options.timeoutMs ?? 1200;
  const stabilityFrames = options.stabilityFrames ?? 2;
  const requireVisible = options.requireVisible ?? true;
  const allowOffscreenFallback = options.allowOffscreenFallback ?? false;
  const viewportTop = options.viewportTop ?? 0;
  const viewportBottom = options.viewportBottom ?? window.innerHeight;
  const startTime = Date.now();

  let lastRect = null;
  let stableFrameCount = 0;

  const check = () => {
    const currentNode = resolveTargetNode(target);
    if (!currentNode || typeof currentNode.getBoundingClientRect !== 'function') {
      if ((Date.now() - startTime) >= timeoutMs) {
        resolve(null);
      } else {
        requestAnimationFrame(check);
      }
      return;
    }

    const rect = currentNode.getBoundingClientRect();
    const nextLayout = toLayout(rect);
    if (!nextLayout) {
      if ((Date.now() - startTime) >= timeoutMs) {
        resolve(null);
      } else {
        requestAnimationFrame(check);
      }
      return;
    }

    const isVisible = rect.bottom > viewportTop && rect.top < viewportBottom;

    if (lastRect && areRectsStable(lastRect, rect) && (!requireVisible || isVisible)) {
      stableFrameCount += 1;
    } else {
      stableFrameCount = 0;
    }

    lastRect = cloneRect(rect);

    if (stableFrameCount >= stabilityFrames) {
      resolve(nextLayout);
      return;
    }

    if ((Date.now() - startTime) >= timeoutMs) {
      resolve((!requireVisible || isVisible || allowOffscreenFallback) ? nextLayout : null);
      return;
    }

    requestAnimationFrame(check);
  };

  requestAnimationFrame(check);
});

export const scrollTutorialTargetIntoViewOnWeb = async (target, options = {}) => {
  if (typeof window === 'undefined') {
    return null;
  }

  const topInset = options.topInset ?? 120;
  const bottomInset = options.bottomInset ?? 112;
  const preferredPlacement = options.preferredPlacement ?? 'center';
  const tooltipHeight = options.tooltipHeight ?? 220;
  const tooltipGap = options.tooltipGap ?? 20;
  const targetViewportMargin = options.targetViewportMargin ?? 20;
  const timeoutMs = options.timeoutMs ?? 1600;
  const measureTimeoutMs = options.measureTimeoutMs ?? 1200;
  const initialLayout = await measureTutorialTargetOnWeb(target, {
    allowOffscreenFallback: true,
    requireVisible: false,
    stabilityFrames: 1,
    timeoutMs: 320,
    viewportBottom: window.innerHeight - bottomInset,
    viewportTop: topInset,
  });

  if (!initialLayout) {
    return null;
  }

  const viewportHeight = window.innerHeight;
  const usableViewportTop = topInset;
  const usableViewportBottom = Math.max(topInset + 1, viewportHeight - bottomInset);
  const usableViewportHeight = Math.max(1, usableViewportBottom - usableViewportTop);

  const targetAbsoluteTop = window.scrollY + initialLayout.y;
  const targetAbsoluteCenter = targetAbsoluteTop + (initialLayout.height / 2);
  const maxTargetTop = Math.max(
    usableViewportTop + targetViewportMargin,
    usableViewportBottom - initialLayout.height - targetViewportMargin,
  );
  const desiredViewportTop = preferredPlacement === 'above'
    ? Math.min(
      maxTargetTop,
      usableViewportTop + tooltipHeight + tooltipGap,
    )
    : preferredPlacement === 'below'
      ? Math.max(
        usableViewportTop + targetViewportMargin,
        usableViewportBottom - tooltipHeight - tooltipGap - initialLayout.height,
      )
      : clamp(
        usableViewportTop + (usableViewportHeight / 2) - (initialLayout.height / 2),
        usableViewportTop + targetViewportMargin,
        maxTargetTop,
      );
  const desiredViewportCenter = desiredViewportTop + (initialLayout.height / 2);
  const maxScrollTop = Math.max(
    0,
    document.documentElement.scrollHeight - window.innerHeight,
  );
  const desiredScrollTop = Math.min(
    Math.max(0, targetAbsoluteCenter - desiredViewportCenter),
    maxScrollTop,
  );

  if (!isNearlyEqual(window.scrollY, desiredScrollTop, 2)) {
    window.scrollTo({
      behavior: 'smooth',
      top: desiredScrollTop,
    });
    await waitForWindowScrollToSettleOnWeb(desiredScrollTop, { timeoutMs });
  }

  return measureTutorialTargetOnWeb(target, {
    allowOffscreenFallback: false,
    requireVisible: true,
    stabilityFrames: 2,
    timeoutMs: measureTimeoutMs,
    viewportBottom: window.innerHeight,
    viewportTop: 0,
  });
};
