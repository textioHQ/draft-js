/**
 * @providesModule areLevel2InputEventsSupported
 * @typechecks
 * @flow
 * 
 * This method determines if we're in a browser which fires native 'beforeinput'
 * events (Level 1 support) and allows that event to be cancellable (Level 2 support)
 * 
 * It's borrowed from Slate https://github.com/ianstormtaylor/slate/blob/9694b228464d8b4d874074496a4c0a50f6ec4614/packages/slate-dev-environment/src/index.js#L74-L79
 */

'use strict';

function areLevel2InputEventsSupported(): boolean {
  const element = window.document.createElement('div');
  element.contentEditable = true;
  const support = 'onbeforeinput' in element;
  return support;
}

module.exports = areLevel2InputEventsSupported;
