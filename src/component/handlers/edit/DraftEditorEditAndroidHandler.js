/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule DraftEditorEditAndroidHandler
 * @flow
 */

'use strict';

const onBeforeInput = require('editOnBeforeInputAndroid');
const onCompositionStart = require('editOnCompositionStart');
const onSelect = require('editOnSelect');

const noop = () => {};

// Noop everything except beforeInput and select...
const DraftEditorEditAndroidHandler = {
  onBeforeInput,
  onCompositionStart,
  onSelect,
  onBlur: noop,
  onCopy: noop,
  onCut: noop,
  onDragOver: noop,
  onDragStart: noop,
  onFocus: noop,
  onInput: noop,
  onKeyDown: noop,
  onPaste: noop,
};

module.exports = DraftEditorEditAndroidHandler;
