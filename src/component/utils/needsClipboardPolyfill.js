/**
 * @providesModule needsClipboardPolyfill
 * @typechecks
 * @flow
 */

'use strict';

var UserAgent = require('UserAgent');

function needsClipboardPolyfill() {
  const isEdge = UserAgent.isBrowser('Edge');
  const isIE = UserAgent.isBrowser('IE');
  const isSafari = UserAgent.isBrowser('Safari < 10');
  return isEdge || isIE || isSafari;
}

module.exports = needsClipboardPolyfill;
