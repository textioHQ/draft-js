/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule DraftEditorCompositionHandlerAndroid
 * @typechecks
 * @flow
 */

'use strict';

import type DraftEditor from 'DraftEditor.react';
import type SelectionState from 'SelectionState';
import type { DraftInlineStyle } from 'DraftInlineStyle';

const DraftModifier = require('DraftModifier');
const EditorState = require('EditorState');
const ReactDOM = require('ReactDOM');

const getDraftEditorSelection = require('getDraftEditorSelection');
const compositionTimeoutDelay = 1500;

let hasMutation = false;
let mutationObserver = null;
let compositionState = null;
let compositionTimeoutId = null;

const resetCompositionData = (editor) => {
  createMutationObserverIfUndefined();
  hasMutation = false;
  compositionState = getEditorState(editor);
  cancelCompositionTimeout();
};

const handleMutations = records => {
  hasMutation = !!records.length;
  mutationObserver.disconnect();
};

// Need to create mutation observer on runtime, not compile time
const createMutationObserverIfUndefined = () => {
  if (!mutationObserver) {
    mutationObserver = new window.MutationObserver(handleMutations);
  }
};

const startCompositionTimeout = (editor) => {
  cancelCompositionTimeout();

  if (!getEditorState(editor).isInCompositionMode()) {
    // Update silently to avoid triggering onChange.  We want future renders to go through,
    // but the higher level editor should probably not concern itself with whether the EditorState
    // is in composition mode.
    editor.silentlyUpdate(EditorState.set(getEditorState(editor), { inCompositionMode: true }));
  }

  compositionTimeoutId = setTimeout(() => {
    // If we are at a safe point to exit composition mode, do so to let renders through.
    const editorState = getEditorState(editor);
    if (editorState.isInCompositionMode() && isSafeToExitCompositionMode(editor, compositionState)) {
      DraftEditorCompositionHandlerAndroid.commit(editor, compositionState);
    }
  }, compositionTimeoutDelay);
};

const cancelCompositionTimeout = () => {
  if (compositionTimeoutId) {
    clearTimeout(compositionTimeoutId);
    compositionTimeoutId = null;
  }
};

/**
 * Checks to see if the uncommitted composition state can safely be updated.
 * If a composition range is updated, the caret _should_ move to the end of the range.
 * This means we can allow updates through when the caret wouldn't be moved.
 *
 * @param {DraftEditor} current editor
 * @param {EditorState} compositionState
 */
const isSafeToExitCompositionMode = (editor, compositionState: EditorState) => {
  const selection = deriveSelectionFromDOM(editor);
  const block = compositionState
        .getCurrentContent()
        .getBlockForKey(selection.getEndKey());

  // The end offset is exclusive, so this will get the character following the caret.
  const offset = selection.getEndOffset();
  const char = block.getText()[offset];

  // Check to see if the following character is a non word character, if
  // it is, it should be safe to allow the composition to change.
  return (!char || char.match(/\W/));
};

/**
 * Replace the current selection with the specified text string, with the
 * inline style and entity key applied to the newly inserted text.
 */
function replaceText(
    editorState: EditorState,
    text: string,
    compositionRange: SelectionState,
    inlineStyle: DraftInlineStyle,
  ): EditorState {
  const contentState = DraftModifier.replaceText(
      editorState.getCurrentContent(),
      compositionRange,
      text,
      inlineStyle,
  );
  return EditorState.push(editorState, contentState, 'insert-characters');
}

const getEditorState = editor => editor._latestEditorState;

const setIsInCompositionMode = (editorState: EditorState, inCompositionMode) => (
  EditorState.set(editorState, { inCompositionMode })
);

const getEditorNode = (editor: DraftEditor) =>
  ReactDOM.findDOMNode(editor.refs.editorContainer);

const deriveSelectionFromDOM = (editor: DraftEditor): SelectionState => {
  const editorNode = getEditorNode(editor);
  const draftSelection = getDraftEditorSelection(
    getEditorState(editor),
    editorNode,
  ).selectionState;
  return draftSelection;
};

var DraftEditorCompositionHandlerAndroid = {
  commit: (editor, editorState) => {
    const selection = deriveSelectionFromDOM(editor);
    editorState = EditorState.acceptSelection(editorState, selection);
    editorState = setIsInCompositionMode(editorState, false);
    editor.update(editorState);

    resetCompositionData(editor);
  },

  onBeforeInput: function(editor: DraftEditor, e: InputEvent): void {
    if (e.inputType === 'insertCompositionText') {
      const nextEditorState = replaceText(
        compositionState,
        e.data,
        deriveSelectionFromDOM(editor),
        getEditorState(editor).getCurrentInlineStyle(),
      );
      compositionState = EditorState.set(nextEditorState, {
        nativelyRenderedContent: nextEditorState.getCurrentContent(),
      });
    }
  },

  onCompositionStart: function(
    editor: DraftEditor,
    e: SyntheticCompositionEvent,
  ): void {
    resetCompositionData(editor);
    startCompositionTimeout(editor);
    mutationObserver.observe(
      getEditorNode(editor),
      { childList: true, subtree: true },
    );
  },

  onCompositionUpdate: function(
    editor: DraftEditor,
    e: SyntheticCompositionEvent,
  ): void {
    startCompositionTimeout(editor);
  },

  onCompositionEnd: function(
    editor: DraftEditor,
    e: SyntheticCompositionEvent,
  ): void {
    // If no mutation has been detected yet, flush any pending events.
    if (!hasMutation) {
      handleMutations(mutationObserver.takeRecords());
    }

    // If there are mutations now, restore the dom to prevent React from failing during reconciliation.
    if (hasMutation) {
      editor.restoreEditorDOM();
    }

    editor.setMode('edit');
    DraftEditorCompositionHandlerAndroid.commit(editor, compositionState);
  },
};

module.exports = DraftEditorCompositionHandlerAndroid;
