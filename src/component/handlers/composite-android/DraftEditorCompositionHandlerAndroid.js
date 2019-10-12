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

let compositionRange = undefined;
let compositionText = undefined;
let hasInsertedCompositionText = false;

const resetCompositionData = () => {
  compositionRange = undefined;
  compositionText = undefined;
  hasInsertedCompositionText = false;
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
    //return editorState.getSelection();
    const editorNode = ReactDOM.findDOMNode(editor.refs.editorContainer);
    const draftSelection = getDraftEditorSelection(editor._latestEditorState, editorNode).selectionState;
    console.log('Computed selection', draftSelection.toJS());
    return draftSelection;
  } else {
    // get Selection for text
    console.warn('UPDATE IS NOT IMPLEMENTED YET!');
    const editorNode = ReactDOM.findDOMNode(editor.refs.editorContainer);
    const draftSelection = getDraftEditorSelection(editor._latestEditorState, editorNode).selectionState;
    console.log('Computed selection', draftSelection.toJS());
    return draftSelection;
  }
};

var DraftEditorCompositionHandler = {
  /**
   * A `compositionstart` event has fired while we're still in composition
   * mode. Continue the current composition session to prevent a re-render.
   */
  onCompositionStart: function(editor: DraftEditor, e: SyntheticCompositionEvent): void {
    resetCompositionData();
    compositionText = e.data;
    compositionRange = getCompositionRange(editor, compositionText);
    console.log(`DECH:onCompositionStart "${compositionText}"`, compositionRange.toJS());
  },

  onCompositionUpdate: function(editor: DraftEditor, e: SyntheticCompositionEvent): void {
    // Make the update!
    if (!hasInsertedCompositionText) {
      console.log('Updating composition range!');
      compositionText = e.data;
      compositionRange = getCompositionRange(editor, compositionText);
    }
    console.log(`DECH:onCompositionUpdate "${compositionText}"`, compositionRange.toJS());
  },

  onCompositionEnd: function(editor: DraftEditor, e: SyntheticCompositionEvent): void {
    // Make the update!
    const newText = e.data;
    console.log(`DECH:onCompositionEnd compText:"${compositionText}", newText:"${newText}"`, compositionRange.toJS());
    if (newText === compositionText) {
      const nextEditorState = EditorState.acceptSelection(editor._latestEditorState, compositionRange);
      console.log('Skipping update, text has not changed');
      editor.setMode('edit');
      editor.update(
            EditorState.set(nextEditorState, {inCompositionMode: false}),
        );
    } else {
      console.log('Updating Draft');
      const nextEditorState = replaceText(editor._latestEditorState, newText, compositionRange);

      editor.setMode('edit');
      editor.update(
        EditorState.set(nextEditorState, {inCompositionMode: false}),
      );

    }
    resetCompositionData();
    console.warn('Exiting composition mode', e);
  },

  onBeforeInput: function(editor: DraftEditor, e: InputEvent): void {
    if (e.inputType === 'insertCompositionText') {
      console.log('inserted composition text, will not update range anymore.', e.data);
      hasInsertedCompositionText = true;
    }
  },

};

module.exports = DraftEditorCompositionHandler;
