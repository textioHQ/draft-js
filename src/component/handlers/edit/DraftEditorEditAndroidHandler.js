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
const onBlur = require('editOnBlur');
const onCompositionStart = require('editOnCompositionStart');
const onCopy = require('editOnCopy');
const onCut = require('editOnCut');
const onDragOver = require('editOnDragOver');
const onDragStart = require('editOnDragStart');
const onFocus = require('editOnFocus');
const onInput = require('editOnInput');
const onKeyDown = require('editOnKeyDown');
const onPaste = require('editOnPaste');
const onSelect = require('editOnSelect');

const noop = () => {};

// Noop everything except beforeInput and select...
const DraftEditorEditAndroidHandler = {
  onBeforeInput,
  onBlur: noop,
  onCompositionStart: onCompositionStart,
  onCopy: noop,
  onCut: noop,
  onDragOver: noop,
  onDragStart: noop,
  onFocus: noop,
  onInput: noop,
  onKeyDown: noop,
  onPaste: noop,
  onSelect,
};

module.exports = DraftEditorEditAndroidHandler;
