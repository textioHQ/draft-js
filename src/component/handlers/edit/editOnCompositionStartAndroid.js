/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule editOnCompositionStart
 * @flow
 */

'use strict';

import type DraftEditor from 'DraftEditor.react';

var EditorState = require('EditorState');

/**
 * The user has begun using an IME input system. Switching to `composite-android` mode
 * allows handling composition input and disables other edit behavior.
 */
function editOnCompositionStart(editor: DraftEditor, e: SyntheticEvent): void {
  editor.setMode('composite-android');
  editor.update(
    EditorState.set(editor._latestEditorState, {inCompositionMode: true}),
  );
  console.warn('draft:editOnCompositionStart: entering composition mode', e);
  // Allow composition handler to interpret the compositionstart event
  editor._onCompositionStart(e);
}

module.exports = editOnCompositionStart;