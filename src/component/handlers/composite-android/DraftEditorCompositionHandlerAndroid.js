/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule DraftEditorCompositionHandler
 * @flow
 */

'use strict';

import type DraftEditor from 'DraftEditor.react';

const DraftModifier = require('DraftModifier');
const EditorState = require('EditorState');
const ReactDOM = require('ReactDOM');

const getDraftEditorSelection = require('getDraftEditorSelection');
const ElementSnapshot = require('ElementSnapshot');

let compositionRange = undefined;
let compositionText = undefined;
let hasInsertedCompositionText = false;

const resetCompositionData = () => {
  compositionRange = undefined;
  compositionText = undefined;
  hasInsertedCompositionText = false;

  DraftEditorCompositionHandler.snapshot = null;
};

/**
 * Replace the current selection with the specified text string, with the
 * inline style and entity key applied to the newly inserted text.
 */
function replaceText(
    editorState: EditorState,
    text: string,
    compositionRange: SelectionState,
    // inlineStyle: DraftInlineStyle,
    // entityKey: ?string,
  ): EditorState {
  var contentState = DraftModifier.replaceText(
      editorState.getCurrentContent(),
      compositionRange,
      text,
    //   inlineStyle,
    //   entityKey,
    );
  return EditorState.push(editorState, contentState, 'insert-characters');
}

const getCompositionRange = (editor, text) => {
  if (!text) {
    // get Selection (Assuming editorState is correct…)
    // Since we know editorState is often out of sync right now, derive from the DOM:
    const editorNode = ReactDOM.findDOMNode(editor.refs.editorContainer);
    const draftSelection = getDraftEditorSelection(editor._latestEditorState, editorNode).selectionState;
    return draftSelection;
  } else {
    // get Selection for text
    const editorNode = ReactDOM.findDOMNode(editor.refs.editorContainer);
    const draftSelection = getDraftEditorSelection(editor._latestEditorState, editorNode).selectionState;

    const compositionRange = findCoveringIndex(editor._latestEditorState.getCurrentContent(), draftSelection, text);

    return compositionRange;
  }
};

function findCoveringIndex(contentState, selection, textToFind) {
  if (!selection.isCollapsed()) {
    // Expected a collapsed selection, return early
    return selection;
  }

  const block = contentState.getBlockForKey(selection.getStartKey());
  const blockText = block.getText();
  const selStartOffset = selection.getStartOffset();
  const matchStartOffset = blockText.indexOf(
    textToFind,
    // The earliest textToFind could start is its length before the selection
    selStartOffset - textToFind.length,
  );

  if (
    // Ensure the match exists and contains the selection
    matchStartOffset > 0 &&
    matchStartOffset <= selStartOffset &&
    matchStartOffset + textToFind.length >= selStartOffset
  ) {
    return selection.merge({
      anchorOffset: matchStartOffset,
      focusOffset: matchStartOffset + textToFind.length,
    });
  }

  console.warn(
    `findCoveringIndex: couldn't find index of '${textToFind}' in '${blockText}' after offset ${selStartOffset}!`,
  );
  return selection;
}

var DraftEditorCompositionHandler = {
  snapshot: null,
  /**
   * A `compositionstart` event has fired while we're still in composition
   * mode. Continue the current composition session to prevent a re-render.
   */
  onCompositionStart: function(editor: DraftEditor, e: SyntheticCompositionEvent): void {
    resetCompositionData();
    compositionText = e.data;
    compositionRange = getCompositionRange(editor, compositionText);
  },

  onCompositionUpdate: function(editor: DraftEditor, e: SyntheticCompositionEvent): void {
    // Make the update!
    if (!hasInsertedCompositionText) {
      compositionText = e.data;
      compositionRange = getCompositionRange(editor, compositionText);
    }
  },

  onCompositionEnd: function(editor: DraftEditor, e: SyntheticCompositionEvent): void {
    // Make the update!
    const newText = e.data;
    if (newText === compositionText) {
      const nextEditorState = EditorState.acceptSelection(editor._latestEditorState, compositionRange);
      editor.setMode('edit');
      editor.update(
            EditorState.set(nextEditorState, {inCompositionMode: false}),
        );
    } else {
      const nextEditorState = replaceText(editor._latestEditorState, newText, compositionRange);

      editor.setMode('edit');
      editor.update(
        EditorState.set(nextEditorState, { inCompositionMode: false }),
      );
    }
    resetCompositionData();
  },

  onBeforeInput: function(editor: DraftEditor, e: InputEvent): void {
    if (e.inputType === 'insertCompositionText') {
      hasInsertedCompositionText = true;
    }
  },

};

module.exports = DraftEditorCompositionHandler;
