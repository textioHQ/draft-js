/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule editOnCopy
 * @flow
 */

'use strict';

import type DraftEditor from 'DraftEditor.react';

var getFragmentFromSelection = require('getFragmentFromSelection');
var setClipboardData = require('setClipboardData');

/**
 * If we have a selection, create a ContentState fragment and store
 * it in our internal clipboard. Subsequent paste events will use this
 * fragment if no external clipboard data is supplied.
 */
function editOnCopy(editor: DraftEditor, e: SyntheticClipboardEvent): void {
  var editorState = editor._latestEditorState;
  var selection = editorState.getSelection();

  // No selection, so there's nothing to copy.
  if (selection.isCollapsed()) {
    e.preventDefault();
    return;
  }

  const fragment = getFragmentFromSelection(editor._latestEditorState);
  editor.setClipboard(fragment);

  if (editor.props.convertBlockMapToClipboard) {
    const clipboardDataToSet = editor.props.convertBlockMapToClipboard(fragment);
    setClipboardData(e, editor, clipboardDataToSet);
  }
}

module.exports = editOnCopy;
