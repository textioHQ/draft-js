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

const EditorState = require('EditorState');

const onBeforeInput = require('editOnBeforeInputAndroid');
const onBlur = require('editOnBlur');
const onFocus = require('editOnFocus');
const onKeyDown = require('editOnKeyDown');
const onCompositionStart = require('editOnCompositionStart');
const onSelect = require('editOnSelect');
const onCopy = require('editOnCopy');
const onPaste = require('editOnPaste');

/**
 * For Android, we need to re-force the selection immediately outside the event to get the caret in
 * the proper position and to re-trigger the keyboard.
 *
 * @param {DraftEditor} editor
 * @param {KeyEvent} e
 */
function handlePaste(editor, e) {
  onPaste(editor, e);

  // Force a reset of the selection on the next tick.
  // `forceSelection` is needed or else the selection will be at the start of the pasted fragment.
  // `setImmediate` is needed or else the keyboard will close.
  setImmediate(() => {
    editor.update(
      EditorState.forceSelection(editor._latestEditorState, editor._latestEditorState.getSelection()),
    );
  });
}

/**
 * Note most Android keyboards will only emit the Unidentified key (229)
 * However it WILL emit Enter (13), we pass this through to support plugins
 * that trigger on Enter.
 *
 * All other interactions are handled with beforeInput.
 *
 * @param {DraftEditor} editor
 * @param {KeyEvent} e
 */
function handleKeyDown(editor, e) {
  const keyCode = e.which;
  if (keyCode === 13 /* Enter */) {
    onKeyDown(editor, e);
  }
}

// Only handle the following events:
const DraftEditorEditAndroidHandler = {
  onBeforeInput,
  onBlur,
  onFocus,
  onCompositionStart,
  onCopy,
  onPaste: handlePaste,
  onKeyDown: handleKeyDown,
  onSelect,
};

module.exports = DraftEditorEditAndroidHandler;
