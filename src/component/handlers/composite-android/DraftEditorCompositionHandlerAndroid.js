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
const logEditorState = require('logEditorState');

const getDraftEditorSelection = require('getDraftEditorSelection');

let lastCompositionText = '';
let compositionRange = undefined;
let compositionText = undefined;
let hasInsertedCompositionText = false;
let hasMutation = false;

const resetCompositionData = () => {
  console.log('DECH:resetCompositionData');
  createMutationObserverIfUndefined();
  compositionRange = undefined;
  compositionText = undefined;
  hasInsertedCompositionText = false;
  hasMutation = false;
  lastCompositionText = '';
};

const handleMutations = records => {
  hasMutation = !!records.length;
  mutationObserver.disconnect();
};

let mutationObserver = undefined;

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

const getCompositionRange = (editor: DraftEditor, text: string): SelectionState => {
  // Ocassionally a newline will get composed.  In this case, we want to strip it since
  // we won't be able to match it in Draft, and it will get rewritten anyways.
  if (text.endsWith('\n')) {
    text = text.slice(0, text.length - 1);
  }

  if (!text) {
    // The selection on editorState is likely out-of-sync, recompute it from the DOM
    return deriveSelectionFromDOM(editor);
  } else {
    const draftSelection = deriveSelectionFromDOM(editor);
    const compositionRange = findCompositionWordRange(
      getEditorState(editor).getCurrentContent(),
      draftSelection,
      text,
    );

    return compositionRange;
  }
};

function findCompositionWordRange(
  contentState: ContentState,
  selection: SelectionState,
  textToFind: string,
) {
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
    matchStartOffset >= 0 &&
    matchStartOffset <= selStartOffset &&
    matchStartOffset + textToFind.length >= selStartOffset
  ) {
    return selection.merge({
      anchorOffset: matchStartOffset,
      focusOffset: matchStartOffset + textToFind.length,
    });
  }

  // eslint-disable-next-line max-len
  console.warn(`findCompositionWordRange: couldn't find index of '${textToFind}' in '${blockText}' after offset ${selStartOffset}!`);
  return selection;
}

const didCompositionRangeChange = ({ compositionRange, editor }) => {
  if (!compositionRange) {
    return false;
  }

  const selection = deriveSelectionFromDOM(editor);
  const result = !compositionRange.hasEdgeWithin(
    // We shouldn't need to worry about uncollapsed selections that span blocks since that'll end composition
    selection.getStartKey(),
    selection.getStartOffset(),
    selection.getEndOffset(),
  );
  console.log('didCompositionWordRangeChange:', result);
  return result;
};

var DraftEditorCompositionHandlerAndroid = {
  update: (editor, editorState) => {
    console.log(`DECH.update`);
    editor.update(editorState);
    resetCompositionData();
  },

  onBeforeInput: function(editor: DraftEditor, e: InputEvent): void {
    console.log(`DECH.onBeforeInput(${e.inputType})`);
    if (e.inputType === 'insertCompositionText') {
      hasInsertedCompositionText = true;
    }
  },

  /**
   * A `compositionstart` event has fired while we're still in composition
   * mode. Continue the current composition session to prevent a re-render.
   */
  onCompositionStart: function(
    editor: DraftEditor,
    e: SyntheticCompositionEvent,
  ): void {
    console.log(`DECH.onCompositionStart`);
    resetCompositionData();
    const editorNode = getEditorNode(editor);

    mutationObserver.observe(editorNode, { childList: true, subtree: true });
    compositionText = e.data;
    compositionRange = getCompositionRange(editor, compositionText);
  },

  onCompositionUpdate: function(
    editor: DraftEditor,
    e: SyntheticCompositionEvent,
  ): void {
    console.log(`DECH.onCompositionUpdate`);
    if (didCompositionRangeChange({ editor, compositionRange })) {
      DraftEditorCompositionHandlerAndroid.endCurrentComposition(editor);
      compositionText = e.data;
      compositionRange = getCompositionRange(editor, compositionText);
    }

    if (!hasInsertedCompositionText) {
      compositionText = e.data;
      compositionRange = getCompositionRange(editor, compositionText);
    }

    lastCompositionText = e.data;
  },

  onCompositionEnd: function(
    editor: DraftEditor,
    e: SyntheticCompositionEvent,
  ): void {
    console.log(`DECH.onCompositionEnd`);
    if (!hasMutation) {
      handleMutations(mutationObserver.takeRecords());
    }

    const newText = e.data;
    if (newText === compositionText) {
      console.log(`DECH.onCompositionEnd: text the same "${newText}"`);
      const nextEditorState = EditorState.acceptSelection(
        getEditorState(editor),
        deriveSelectionFromDOM(editor),
      );
      editor.setMode('edit');
      DraftEditorCompositionHandlerAndroid.update(
        editor,
        EditorState.set(nextEditorState, { inCompositionMode: false }),
      );
    } else {
      console.log(`DECH.onCompositionEnd: text changed "${newText}"`);
      // If any children have been added/removed the reconciler will crash unless we restore the DOM.
      const mustReset = hasMutation;
      if (mustReset) {
        editor.restoreEditorDOM();
      }

      const nextEditorState = replaceText(
        getEditorState(editor),
        newText,
        compositionRange,
        getEditorState(editor).getCurrentInlineStyle(),
      );

      editor.setMode('edit');
      const editorStateProps = mustReset ? {
        nativelyRenderedContent: null,
        forceSelection: true,
      } : {};

      DraftEditorCompositionHandlerAndroid.update(
        editor,
        EditorState.set(nextEditorState, {
          inCompositionMode: false,
          ...editorStateProps,
        }),
      );
    }
  },

  // When the user moves the caret from one word to another, we only see a
  // compositionupdate (no compositionend for the old word, no compositionstart
  // for the new word like one might expect given that moving the cursor commits
  // the current composition text.
  //
  // We need to detect when the user moves the selection and add the previous
  // word under composition to the contentState so that text doesn't disappear
  // when draft rerenders when compositionend does fire.
  endCurrentComposition: editor => {
    console.log(`DECH.endCurrentComposition`);
    const nextEditorState = replaceText(
      getEditorState(editor),
      lastCompositionText,
      compositionRange,
      getEditorState(editor).getCurrentInlineStyle(),
    );
    DraftEditorCompositionHandlerAndroid.update(editor, nextEditorState);
  },
};

module.exports = DraftEditorCompositionHandlerAndroid;
