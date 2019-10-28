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

let currentCompositionRange;
let initialCompositionRange;
let compositionRange = undefined;
let compositionText = undefined;
let hasInsertedCompositionText = false;
let hasSeenSelectionChange = false;
let lastCompositionText = '';
let hasMutation = false;

const resetCompositionData = () => {
  console.log(`resetCompositionData`);
  createMutationObserverIfUndefined();
  compositionRange = undefined;
  compositionText = undefined;
  hasInsertedCompositionText = false;
  hasMutation = false;
  currentCompositionRange = null;
  initialCompositionRange = null;
  hasSeenSelectionChange = false;
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

const getEditorNode = (editor: DraftEditor) =>
  ReactDOM.findDOMNode(editor.refs.editorContainer);

const deriveSelectionFromDOM = (editor: DraftEditor): SelectionState => {
  const editorNode = getEditorNode(editor);
  const draftSelection = getDraftEditorSelection(
    editor._latestEditorState,
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
      editor._latestEditorState.getCurrentContent(),
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



var DraftEditorCompositionHandlerAndroid = {
  onSelect: (editor, e) => {
    const draftSelection = deriveSelectionFromDOM(editor);
    console.log(`DECH:onSelect`, draftSelection.toJS());
    if (!hasSeenSelectionChange) {
      hasSeenSelectionChange = true;
    } else {
      DraftEditorCompositionHandlerAndroid.onFakeCompositionEnd(editor);
    }
  },

  onBeforeInput: function(editor: DraftEditor, e: InputEvent): void {
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
    console.warn('DECH.onCompositionStart');
    resetCompositionData();
    const editorNode = getEditorNode(editor);

    mutationObserver.observe(editorNode, { childList: true, subtree: true });
    compositionText = e.data;
    compositionRange = getCompositionRange(editor, compositionText);
    initialCompositionRange = compositionRange;
    currentCompositionRange = compositionRange;
  },

  onCompositionUpdate: function(
    editor: DraftEditor,
    e: SyntheticCompositionEvent,
  ): void {
    hasSeenSelectionChange = false;
    lastCompositionText = e.data;
    if (!hasInsertedCompositionText) {
      console.log(`DECH:onCompositionUpdate: setting compositionText to "${e.data}"`);
      compositionText = e.data;
      compositionRange = getCompositionRange(editor, compositionText);
      initialCompositionRange = compositionRange;
      currentCompositionRange = compositionRange;
      return;
    }

    // If the user moves the caret from one word to another, only compositionupdate
    // will fire. We need to detect when that happens so that
    console.warn(`DECH:onCompositionUpdate "${e.data}"`);

    // const length = e.data.length;
    // const start = compositionRange.getStartOffset();
  },

  onCompositionEnd: function(
    editor: DraftEditor,
    e: SyntheticCompositionEvent,
  ): void {
    if (!hasMutation) {
      handleMutations(mutationObserver.takeRecords());
    }
    console.warn('DECH.onCompositionEnd:hasMutation', hasMutation);

    const newText = e.data;
    if (newText === compositionText) {
      console.log(`DECH.onCompositionEnd:newText===compositionText: "${newText}"`);
      const nextEditorState = EditorState.acceptSelection(
        editor._latestEditorState,
        compositionRange,
      );
      editor.setMode('edit');
      editor.update(
        EditorState.set(nextEditorState, { inCompositionMode: false }),
      );
    } else {
      console.log(`DECH.onCompositionEnd:newText"${newText}" compositionText:"${compositionText}"`);
      // If any children have been added/removed the reconciler will crash unless we restore the dom.
      const mustReset = hasMutation;
      if (mustReset) {
        editor.restoreEditorDOM();
      }

      const nextEditorState = replaceText(
        editor._latestEditorState,
        newText,
        compositionRange,
        editor._latestEditorState.getCurrentInlineStyle(),
      );

      editor.setMode('edit');
      const editorStateProps = mustReset ? {
        nativelyRenderedContent: null,
        forceSelection: true,
      } : {};
      editor.update(
        EditorState.set(nextEditorState, {
          inCompositionMode: false,
          ...editorStateProps,
        }),
      );
    }
    resetCompositionData();
  },


  onFakeCompositionEnd: function(editor) {
    console.warn(`DECH:onFakeCompositionEnd "${compositionText}"`, compositionRange.toJS());
    const nextEditorState = replaceText(
      editor._latestEditorState,
      lastCompositionText,
      compositionRange,

      // // TODO
      // editor._latestEditorState.getCurrentInlineStyle()
    );
    editor.update(nextEditorState);
    resetCompositionData();
  },

};

module.exports = DraftEditorCompositionHandlerAndroid;
