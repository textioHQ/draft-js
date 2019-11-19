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
import type ContentState from 'ContentState';
import type SelectionState from 'SelectionState';
import type { DraftInlineStyle } from 'DraftInlineStyle';

const DraftModifier = require('DraftModifier');
const EditorState = require('EditorState');
const ReactDOM = require('ReactDOM');

const getDraftEditorSelection = require('getDraftEditorSelection');


let hasMutation = false;
let mutationObserver = null;
let compositionState = null;

const resetCompositionData = (editor) => {
  createMutationObserverIfUndefined();
  hasMutation = false;
  compositionState = getEditorState(editor);
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
  update: (editor, editorState) => {
    editor.setMode('edit');
    editor.update(EditorState.set(editorState, { inCompositionMode: false }));
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
    mutationObserver.observe(
      getEditorNode(editor),
      { childList: true, subtree: true },
    );
  },

  onCompositionEnd: function(
    editor: DraftEditor,
    e: SyntheticCompositionEvent,
  ): void {
    if (!hasMutation) {
      handleMutations(mutationObserver.takeRecords());
    }
    if (hasMutation) {
      editor.restoreEditorDOM();
    }

    const selection = deriveSelectionFromDOM(editor);
    const nextEditorState = EditorState.acceptSelection(compositionState, selection);
    DraftEditorCompositionHandlerAndroid.update(
      editor,
      nextEditorState,
    );
  },
};

module.exports = DraftEditorCompositionHandlerAndroid;
