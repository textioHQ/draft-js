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
let compositionState;
let mutationObserver;

const resetCompositionData = (editor) => {
  console.log('resetCompositionData');
  createMutationObserverIfUndefined(editor);
  compositionState = getEditorState(editor);
  hasMutation = false;
};

const handleMutations = records => {
  hasMutation = !!records.length;
  mutationObserver.disconnect();
};


// Need to create mutation observer on runtime, not compile time
const createMutationObserverIfUndefined = (editor) => {
  const node = getEditorNode(editor);
  if (!mutationObserver) {
    mutationObserver = new window.MutationObserver((records) => {
      console.groupCollapsed('onMutation:');
      console.log(node.cloneNode(true));
      handleMutations(records);
      console.groupEnd();
    });
  }
};

const getLoggableContent = (content) => content.getBlocksAsArray().map(b => `"${b.getText()}"`);

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
  console.group('replaceText');
  console.log('composition range:', compositionRange.toJS());
  console.log('state/selection before replacement:', getLoggableContent(editorState.getCurrentContent()), editorState.getSelection());
  console.log('state/selection after replacement:', getLoggableContent(contentState), contentState.getSelectionAfter());
  console.groupEnd();

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
    console.group('DECH:update');
    console.log('new state:', getLoggableContent(editorState.getCurrentContent()));
    console.log('new selection:', editorState.getSelection().toJS());

    editor.setMode('edit');
    editor.update(EditorState.set(editorState, { inCompositionMode: false }));
    resetCompositionData(editor);

    console.groupEnd();
  },

  onBeforeInput: function(editor: DraftEditor, e: InputEvent): void {
    console.group('DECH:onBeforeInput', e.inputType);
    console.log('BEFORE INPUT', deriveSelectionFromDOM(editor).toJS());
    if (e.inputType === 'insertCompositionText') {

      // A space in composition mode is probably ACTUALLY an insert, just a delightful finding.
      if (e.data === ' ') {
        console.warn('Suspicious SPACE during composition in beforeInput');
        // return;
      }

      const nextEditorState = replaceText(
        compositionState,
        e.data,
        deriveSelectionFromDOM(editor),
        getEditorState(editor).getCurrentInlineStyle(),
      );

      compositionState = EditorState.set(nextEditorState, {
        // inCompositionMode: false,
        nativelyRenderedContent: nextEditorState.getCurrentContent(),
      });
    }
    console.groupEnd();
  },

  onInput: function(
    editor: DraftEditor,
    e: SyntheticCompositionEvent,
  ): void {
    console.group('DECH:onInput', e.inputType);
    console.log('derived draft selection:', deriveSelectionFromDOM(editor).toJS());
    // if (e.inputType === 'insertCompositionText') {
    //   // A space in composition mode is ACTUALLY an insert, just a delightful finding.
    //   if (e.data !== ' ') {
    //     return;
    //   }
    //   const nextEditorState = replaceText(
    //     compositionState,
    //     e.data,
    //     deriveSelectionFromDOM(editor),
    //     getEditorState(editor).getCurrentInlineStyle(),
    //   );
    //   console.log(`onInput WOULD HAVE SET STATE TO:`, nextEditorState.getCurrentContent().getPlainText('\n'));
    //   compositionState = EditorState.set(nextEditorState, {
    //     // inCompositionMode: false,
    //     nativelyRenderedContent: nextEditorState.getCurrentContent(),
    //   });
    // }
    console.groupEnd();
  },


  /**
   * A `compositionstart` event has fired while we're still in composition
   * mode. Continue the current composition session to prevent a re-render.
   */
  onCompositionStart: function(
    editor: DraftEditor,
    e: SyntheticCompositionEvent,
  ): void {
    console.group('DECH:onCompositionStart');
    resetCompositionData(editor);
    const editorNode = getEditorNode(editor);
    mutationObserver.observe(editorNode, { childList: true, subtree: true });
    compositionState = getEditorState(editor);
    console.groupEnd();
  },


  onCompositionUpdate: function(
    editor: DraftEditor,
    e: SyntheticCompositionEvent,
  ): void {
    console.groupCollapsed('DECH:onCompositionUpdate');
    console.log('derived draft selection:', deriveSelectionFromDOM(editor).toJS());
    console.groupEnd();
  },


  onCompositionEnd: function(
    editor: DraftEditor,
    e: SyntheticCompositionEvent,
  ): void {
    console.group('DECH:onCompositionEnd');

    if (!hasMutation) { handleMutations(mutationObserver.takeRecords()); }
    if (hasMutation) { editor.restoreEditorDOM(); }

    const selection = deriveSelectionFromDOM(editor);
    console.log('derived draft selection:', selection.toJS());

    const nextEditorState = EditorState.forceSelection(compositionState, selection);
    DraftEditorCompositionHandlerAndroid.update(
      editor,
      nextEditorState,
    );

    console.groupEnd();
  },
};

module.exports = DraftEditorCompositionHandlerAndroid;
