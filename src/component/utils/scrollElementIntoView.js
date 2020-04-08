const Style = require('Style');

const SCROLL_BUFFER = 10;

/**
 * Check the visible bounds of the scroll parent against the bounds of the element
 * and scroll it up to include the top or down to include the bottom.
 *
 * @param {Element} element to be scrolled.
 */
function scrollElementIntoView(element) {
  if (!element) {
    return;
  }

  const elementRect = element.getBoundingClientRect();
  const scrollParent = Style.getScrollParent(element);
  let scrollElement;
  let scrollRect;

  if (scrollParent === window) {
    // Window has a different API for scrolling than elements especially on
    // IE11.  Luckily we can get the documentElement (<HTML>) and operate on that.
    scrollElement = window.document.scrollingElement || window.document.documentElement;
    scrollRect = { top: 0, bottom: window.innerHeight };
  } else {
    scrollElement = scrollParent;
    scrollRect = scrollElement.getBoundingClientRect();
  }

  if (elementRect.top < scrollRect.top) {
    // If the top of the block is above the scroll element, scroll up.
    scrollElement.scrollTop -= (scrollRect.top - elementRect.top + SCROLL_BUFFER);
  } else if (elementRect.bottom > scrollRect.bottom) {
    // If the bottom of the block is below the scroll element, scroll down.
    scrollElement.scrollTop += (elementRect.bottom - scrollRect.bottom + SCROLL_BUFFER);
  }
}

module.exports = scrollElementIntoView;