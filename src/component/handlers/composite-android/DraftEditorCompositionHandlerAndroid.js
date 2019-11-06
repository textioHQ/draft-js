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
let hasSeenSelectionChange = false;

const resetCompositionData = () => {
  createMutationObserverIfUndefined();
  compositionRange = undefined;
  compositionText = undefined;
  hasInsertedCompositionText = false;
  hasMutation = false;
  lastCompositionText = '';
  hasSeenSelectionChange = false;
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

// const draftSelection = deriveSelectionFromDOM(editor);

// use selection.hasEdgeWithin to compare a DOM-derived selection on compositionupdate to a previous compositionrange
const didCompositionRangeChange = ({ compositionRange, editor }) => {
  console.group('DECH:didCompositionRangeChange');
  // We shouldn't need to worry about uncollapsed selections b/c that'll end composition
  if (!compositionRange) {
    console.error(`NO composition range!!`);
    console.groupEnd();
    return false;
  }

  try {
    console.log(`DECH:didCompositionRangeChange:compositionRange:`, compositionRange.toJS());
    logEditorState(EditorState.acceptSelection(getEditorState(editor), compositionRange));

    const selection = deriveSelectionFromDOM(editor);
    console.log(`DECH:didCompositionRangeChange:draftSelection:`, selection.toJS());
    logEditorState(
      EditorState.acceptSelection(getEditorState(editor), compositionRange)
    );

    const didChange = !compositionRange.hasEdgeWithin(
        selection.getStartKey(),
        selection.getStartOffset(),
        selection.getEndOffset(),
      );
    console.log(
      'DECH:didCompositionRangeChange:didChange?:',
      didChange,
    );
    console.groupEnd();
    return didChange;

  } catch (err) {
    console.log(`ERROR in didCompositionRangeChange`);
    console.error(err);
  }
  console.groupEnd();
  return false;
};

var DraftEditorCompositionHandlerAndroid = {
  onBeforeInput: function(editor: DraftEditor, e: InputEvent): void {
    if (e.inputType === 'insertCompositionText') {
      hasInsertedCompositionText = true;
    }
    // const whitelist = [
    //   'insertCompositionText',
    // ];
  },

  onSelect: (editor: DraftEditor): void => {
    // const editorNode = getEditorNode(editor);
    // const range = getCompositionRange(editor, lastCompositionText);
    const selection = deriveSelectionFromDOM(editor);
    console.log(`DECH.onSelect:DOM selection:`, selection.toJS());
  },

  // onSelect: (editor: DraftEditor): void => {
  //   console.warn(`DECH.onSelect:hasSeenSelectionChange already:`, hasSeenSelectionChange);
  //   if (!hasSeenSelectionChange) {
  //     hasSeenSelectionChange = true;
  //   } else {
  //     DraftEditorCompositionHandlerAndroid.endCurrentComposition(editor);
  //   }
  // },

  /**
   * A `compositionstart` event has fired while we're still in composition
   * mode. Continue the current composition session to prevent a re-render.
   */
  onCompositionStart: function(
    editor: DraftEditor,
    e: SyntheticCompositionEvent,
  ): void {
    console.warn(`DECH.onCompositionStart`);
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
    console.warn(`DECH.onCompositionUpdate`);

    if (didCompositionRangeChange({ editor, compositionRange })) {
      DraftEditorCompositionHandlerAndroid.endCurrentComposition(editor);
      compositionText = e.data;
      compositionRange = getCompositionRange(editor, compositionText);
      console.log(`DECH.onCompositionUpdate(after):compositionText: "${compositionText}"`);
      console.log(
        `DECH.onCompositionUpdate(after):compositionRange`,
        compositionRange ? compositionRange.toJS() : null,
      );
    }

    lastCompositionText = e.data;

    if (!hasInsertedCompositionText) {
      compositionText = e.data;
      compositionRange = getCompositionRange(editor, compositionText);
    }
  },

  onCompositionEnd: function(
    editor: DraftEditor,
    e: SyntheticCompositionEvent,
  ): void {
    console.warn(`DECH.onCompositionEnd`);
    if (!hasMutation) {
      handleMutations(mutationObserver.takeRecords());
    }

    const newText = e.data;
    if (newText === compositionText) {
      const nextEditorState = EditorState.acceptSelection(
        getEditorState(editor),
        compositionRange,
      );
      editor.setMode('edit');
      DraftEditorCompositionHandlerAndroid.update(
        editor,
        EditorState.set(nextEditorState, { inCompositionMode: false }),
      );
    } else {
      // If any children have been added/removed the reconciler will crash unless we restore the dom.
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
      console.log('DECH:onCompositionEnd:nextEditorState:');
      logEditorState(nextEditorState);

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
  endCurrentComposition: (editor) => {
    console.warn('DECH.endCurrentComposition:');
    console.log(`lastCompositionText: "${lastCompositionText}"`);
    console.log(`compositionRange:`, compositionRange ? compositionRange.toJS() : null);
    const nextEditorState = replaceText(
      getEditorState(editor),
      lastCompositionText,
      compositionRange,
      getEditorState(editor).getCurrentInlineStyle(),
    );
    console.log(`DECH.endCurrentComposition:nextEditorState:`);
    logEditorState(nextEditorState);
    DraftEditorCompositionHandlerAndroid.update(editor, nextEditorState);
  },

  update: (editor, editorState) => {
    editor.update(editorState);
    resetCompositionData();
  },

};

module.exports = DraftEditorCompositionHandlerAndroid;
