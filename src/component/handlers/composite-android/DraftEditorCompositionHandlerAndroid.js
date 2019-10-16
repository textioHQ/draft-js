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
let doesCompositionNeedBRReplacement = false;
let brContainer = undefined;
let br = undefined;

const resetCompositionData = () => {
  compositionRange = undefined;
  compositionText = undefined;
  hasInsertedCompositionText = false;

  doesCompositionNeedBRReplacement = false;
  brContainer = undefined;
  br = undefined;
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

function findCoveringIndex(contentState, selection, text) {
  if (!selection.isCollapsed()) {
    // Expected a collapsed selection, return early
    return selection;
  }

  const focusKey = selection.getFocusKey();
  const index = selection.getFocusOffset();
  const block = contentState.getBlockMap().get(focusKey);
  const blockText = block.getText();
  const length = text.length;

  // NOTE: offset can actually be Math.max(index - length, 0) since you can't find a match before that,
  //       and in that case you don't need a loop, you just need to validate that the match covers the index.
  let offset = 0; 
  while (true) {
    offset = blockText.indexOf(text, offset);
    if (offset === -1) {
      break;
    }
    console.log('offset', offset, text, 'in', blockText, 'looking for index', index);
    if (offset <= index && offset + length >= index) {
      return selection
        .set('anchorOffset', offset)
        .set('focusOffset', offset + length); // TODO is this inclusive/exclusive?
    }
    offset += 1;
  }
  return selection;
}

var DraftEditorCompositionHandler = {
  /**
   * A `compositionstart` event has fired while we're still in composition
   * mode. Continue the current composition session to prevent a re-render.
   */
  onCompositionStart: function(editor: DraftEditor, e: SyntheticCompositionEvent): void {
    resetCompositionData();
    compositionText = e.data;
    compositionRange = getCompositionRange(editor, compositionText);

    // When user types on empty text, which is represented as BR, browsers will
    // replace BR with text node. Because React can not recognize outer change,
    // we have to put BR immediately back manually.

    // In composition mode, as soon as a character is inserted, the <br> node is removed.
    // Thus, we do the inspection on compositionStart right before the text insertion
    // Then, on composition end, we'll insert the <br> node back, right before the composition text is inserted. 
    // (or should we do it after the text is inserted?)
    const selection = global.getSelection();
    const maybeBR = selection.anchorNode.childNodes[selection.anchorOffset];
    const brIsGoingToBeReplacedWithText =
      selection.anchorNode === selection.focusNode &&
      maybeBR != null &&
      maybeBR.nodeName === 'BR';

    doesCompositionNeedBRReplacement = brIsGoingToBeReplacedWithText;
    brContainer = selection.anchorNode;
    br = maybeBR;
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
      // Replace the missing BR the browser removed if needed, so react doesn't explode.
      if (doesCompositionNeedBRReplacement) {
        brContainer.replaceChild(
          br,
          brContainer.firstChild,
        );
      }

      const nextEditorState = replaceText(editor._latestEditorState, newText, compositionRange);

      editor.setMode('edit');
      editor.update(
        EditorState.set(nextEditorState, {inCompositionMode: false}),
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
