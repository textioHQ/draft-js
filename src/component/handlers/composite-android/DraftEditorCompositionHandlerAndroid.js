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

const getEditorState = editor => editor._latestEditorState;

const getEditorNode = (editor: DraftEditor) =>
  ReactDOM.findDOMNode(editor.refs.editorContainer);

// let lastCompositionText = '';
// let compositionRange = undefined;
// let compositionText = undefined;
// let hasInsertedCompositionText = false;
// let hasMutation = false;

// const resetCompositionData = () => {
//   console.log('DECH:resetCompositionData');
//   createMutationObserverIfUndefined();
//   compositionRange = undefined;
//   compositionText = undefined;
//   hasInsertedCompositionText = false;
//   hasMutation = false;
//   lastCompositionText = '';
// };

// const handleMutations = records => {
//   hasMutation = !!records.length;
//   mutationObserver.disconnect();
// };

// let mutationObserver = undefined;

// // Need to create mutation observer on runtime, not compile time
// const createMutationObserverIfUndefined = () => {
//   if (!mutationObserver) {
//     mutationObserver = new window.MutationObserver(handleMutations);
//   }
// };

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



// const deriveSelectionFromDOM = (editor: DraftEditor): SelectionState => {
//   const editorNode = getEditorNode(editor);
//   const draftSelection = getDraftEditorSelection(
//     getEditorState(editor),
//     editorNode,
//   ).selectionState;
//   return draftSelection;
// };

// const getCompositionRange = (editor: DraftEditor, text: string): SelectionState => {
//   // Ocassionally a newline will get composed.  In this case, we want to strip it since
//   // we won't be able to match it in Draft, and it will get rewritten anyways.
//   if (text.endsWith('\n')) {
//     text = text.slice(0, text.length - 1);
//   }

//   if (!text) {
//     // The selection on editorState is likely out-of-sync, recompute it from the DOM
//     return deriveSelectionFromDOM(editor);
//   } else {
//     const draftSelection = deriveSelectionFromDOM(editor);
//     const compositionRange = findCompositionWordRange(
//       getEditorState(editor).getCurrentContent(),
//       draftSelection,
//       text,
//     );

//     return compositionRange;
//   }
// };

// function findCompositionWordRange(
//   contentState: ContentState,
//   selection: SelectionState,
//   textToFind: string,
// ) {
//   if (!selection.isCollapsed()) {
//     // Expected a collapsed selection, return early
//     return selection;
//   }

//   const block = contentState.getBlockForKey(selection.getStartKey());
//   const blockText = block.getText();
//   const selStartOffset = selection.getStartOffset();
//   const matchStartOffset = blockText.indexOf(
//     textToFind,
//     // The earliest textToFind could start is its length before the selection
//     selStartOffset - textToFind.length,
//   );

//   if (
//     // Ensure the match exists and contains the selection
//     matchStartOffset >= 0 &&
//     matchStartOffset <= selStartOffset &&
//     matchStartOffset + textToFind.length >= selStartOffset
//   ) {
//     return selection.merge({
//       anchorOffset: matchStartOffset,
//       focusOffset: matchStartOffset + textToFind.length,
//     });
//   }

//   // eslint-disable-next-line max-len
//   console.warn(`findCompositionWordRange: couldn't find index of '${textToFind}' in '${blockText}' after offset ${selStartOffset}!`);
//   return selection;
// }

// const didCompositionRangeChange = ({ compositionRange, editor }) => {
//   if (!compositionRange) {
//     return false;
//   }

//   try {
//     console.log(`window.getSelection:`, window.getSelection().getRangeAt(0).cloneRange());
//   } catch (err) {
//     console.error(err);
//   }
//   const selection = deriveSelectionFromDOM(editor);
//   console.log(`deriveSelectionFromDOM:`, selection.toJS());
//   const result = !compositionRange.hasEdgeWithin(
//     // We shouldn't need to worry about uncollapsed selections that span blocks since that'll end composition
//     selection.getStartKey(),
//     selection.getStartOffset(),
//     selection.getEndOffset(),
//   );
//   console.log('didCompositionWordRangeChange:', result);
//   return result;
// };

// var DraftEditorCompositionHandlerAndroid = {
//   update: (editor, editorState) => {
//     console.log(`DECH.update`);
//     editor.update(editorState);
//     resetCompositionData();
//   },

//   onBeforeInput: function(editor: DraftEditor, e: InputEvent): void {
//     console.log(`DECH.onBeforeInput(${e.inputType})`);
//     if (e.inputType === 'insertCompositionText') { // can be text insertion OR deletion
//       hasInsertedCompositionText = true;
//     }
//   },

//   /**
//    * A `compositionstart` event has fired while we're still in composition
//    * mode. Continue the current composition session to prevent a re-render.
//    */
//   onCompositionStart: function(
//     editor: DraftEditor,
//     e: SyntheticCompositionEvent,
//   ): void {
//     console.log(`DECH.onCompositionStart`);
//     resetCompositionData();
//     const editorNode = getEditorNode(editor);

//     mutationObserver.observe(editorNode, { childList: true, subtree: true });
//     compositionText = e.data;
//     compositionRange = getCompositionRange(editor, compositionText);
//   },

//   onCompositionUpdate: function(
//     editor: DraftEditor,
//     e: SyntheticCompositionEvent,
//   ): void {
//     console.log(`DECH.onCompositionUpdate`);
//     if (didCompositionRangeChange({ editor, compositionRange })) {
//       DraftEditorCompositionHandlerAndroid.endCurrentComposition(editor);
//       compositionText = e.data;
//       compositionRange = getCompositionRange(editor, compositionText);
//     }

//     if (!hasInsertedCompositionText) {
//       compositionText = e.data;
//       compositionRange = getCompositionRange(editor, compositionText);
//     }

//     lastCompositionText = e.data;
//   },

//   onCompositionEnd: function(
//     editor: DraftEditor,
//     e: SyntheticCompositionEvent,
//   ): void {
//     console.log(`DECH.onCompositionEnd`);

//     didCompositionRangeChange({ compositionRange, editor });

//     if (!hasMutation) {
//       handleMutations(mutationObserver.takeRecords());
//     }

//     const newText = e.data;
//     if (newText === compositionText) {
//       console.log(`DECH.onCompositionEnd: text the same "${newText}"`);
//       const nextEditorState = EditorState.acceptSelection(
//         getEditorState(editor),
//         deriveSelectionFromDOM(editor),
//       );
//       editor.setMode('edit');
//       DraftEditorCompositionHandlerAndroid.update(
//         editor,
//         EditorState.set(nextEditorState, { inCompositionMode: false }),
//       );
//     } else {
//       console.log(`DECH.onCompositionEnd: text changed newText:"${newText}" compositionText:"${compositionText}"`);
//       // If any children have been added/removed the reconciler will crash unless we restore the DOM.
//       const mustReset = hasMutation;
//       if (mustReset) {
//         editor.restoreEditorDOM();
//       }

//       const nextEditorState = replaceText(
//         getEditorState(editor),
//         newText,
//         compositionRange,
//         getEditorState(editor).getCurrentInlineStyle(),
//       );

//       editor.setMode('edit');
//       const editorStateProps = mustReset ? {
//         nativelyRenderedContent: null,
//         forceSelection: true,
//       } : {};

//       DraftEditorCompositionHandlerAndroid.update(
//         editor,
//         EditorState.set(nextEditorState, {
//           inCompositionMode: false,
//           ...editorStateProps,
//         }),
//       );
//     }
//   },

//   // When the user moves the caret from one word to another, we only see a
//   // compositionupdate (no compositionend for the old word, no compositionstart
//   // for the new word like one might expect given that moving the cursor commits
//   // the current composition text.
//   //
//   // We need to detect when the user moves the selection and add the previous
//   // word under composition to the contentState so that text doesn't disappear
//   // when draft rerenders when compositionend does fire.
//   endCurrentComposition: editor => {
//     console.log(`DECH.endCurrentComposition`);
//     const nextEditorState = replaceText(
//       getEditorState(editor),
//       lastCompositionText,
//       compositionRange,
//       getEditorState(editor).getCurrentInlineStyle(),
//     );
//     DraftEditorCompositionHandlerAndroid.update(editor, nextEditorState);
//   },
// };



class DraftEditorCompositionHandlerAndroid {
  constructor() {
    // Methods
    this.attachBeforeInputListener = this.attachBeforeInputListener.bind(this);
    this.initializeObserver = this.initializeObserver.bind(this);
    this.onCompositionUpdate = this.onCompositionUpdate.bind(this);
    this.onCompositionStart = this.onCompositionStart.bind(this);
    this.onCompositionEnd = this.onCompositionEnd.bind(this);
    this.handleMutation = this.handleMutation.bind(this);
    this.onBeforeInput = this.onBeforeInput.bind(this);
    this.deriveSelection = this.deriveSelection.bind(this);
    this.getDomSelection = this.getDomSelection.bind(this);
    this.startObserving = this.startObserving.bind(this);
    this.stopObserving = this.stopObserving.bind(this);
    this.onSelect = this.onSelect.bind(this);
    this.setState = this.setState.bind(this);
    this.onInput = this.onInput.bind(this);
    this.update = this.update.bind(this);
    this.reset = this.reset.bind(this);

    // debug utilities
    this.name = 'DECH';
    this.warn = this.warn = (label, ...args) =>
      console.warn(`${this.name}:${label}`, ...args);
    this.log = this.log = (label, ...args) =>
      console.log(`${this.name}:${label}`, ...args);

    this.hasAttachedListener = false;

    // initialize
    this.reset();
  }


  /****************************************************************************
   * STATE MANAGEMENT
   ****************************************************************************/
  setState(changes) {
    this.state = Object.assign(this.state, changes);
  }
  update(editor, state) {
    this.warn('update');
    editor.update(state);
    this.reset();
  }
  reset() {
    this.warn('reset');
    this.state = {
      initialState: null,
      currentState: null,
      hasMutation: false,
      initialRange: null,
      range: null,
      lastText: '',
      text: '',
    };
  }

  /****************************************************************************
   * MUTATION OBSERVER
   ****************************************************************************/
  initializeObserver() {
    if (!this.observer) {
      this.observer = new MutationObserver(this.handleMutation);
    }
  }
  startObserving(editor) {
    this.initializeObserver();
    this.observer.observe(getEditorNode(editor), { childList: true, subtree: true });
  }
  stopObserving() {
    this.observer.disconnect();
  }
  handleMutation(mutations) {
    console.group('handleMutation');
    this.log('mutations', mutations);
    this.setState({ hasMutation: true });
    console.groupEnd();
  }
  restoreDomIfNecessary(editor) {
    console.groupCollapsed('restoreDomIfNecessary');
    this.handleMutation(this.observer.takeRecords());
    if (this.state.hasMutation) {
      editor.restoreEditorDOM();
    }
    console.groupEnd();
  }

  /****************************************************************************
   * SELECTION
   ****************************************************************************/
  getDomSelection() {
    try {
      return window
        .getSelection()
        .getRangeAt(0)
        .cloneRange();
    } catch (err) {
      console.error(err);
    }
    return null;
  }
  deriveSelection(editor) {
    return getDraftEditorSelection(
      getEditorState(editor),
      getEditorNode(editor),
    ).selectionState;
  }


  /****************************************************************************
   * INPUT HANDLERS
   ****************************************************************************/

  // Keep a temporary editorState off to the side as the current state
  // On beforeinput, replace the derivedSelection (the comp range before the
  // inserted character) with the e.data to generate the new current editorState
  onBeforeInput(editor: DraftEditor, e: InputEvent) {
    console.group('onBeforeInput', e.inputType, e);

    const derivedSelection = this.deriveSelection(editor);
    this.log('derivedSelection', derivedSelection.toJS());

    console.groupEnd();
  }

  attachBeforeInputListener(editor) {
    if (!this.hasAttachedListener) {

    }
  }
  handleBeforeInput(editor: DraftEditor, e: InputEvent) {
    console.group('handleBeforeInput', e.inputType, e);

    const derivedSelection = this.deriveSelection(editor);
    this.log('derivedSelection', derivedSelection.toJS());

    console.groupEnd();
  }

  onInput(editor: DraftEditor, e: SyntheticInputEvent) {
    console.group('onInput', e.nativeEvent.inputType, e.nativeEvent);
    // this.log('editorState.getSelection()', getEditorState(editor).getSelection().toJS());
    this.log('DOM selection', this.getDomSelection());
    const derivedSelection = this.deriveSelection(editor);
    this.log('derivedSelection', derivedSelection.toJS());
    console.groupEnd();
  }

  onSelect(editor: DraftEditor, e) {
    console.group('onSelect');
    // this.log('editorState.getSelection()', getEditorState(editor).getSelection().toJS());
    const derivedSelection = this.deriveSelection(editor);
    this.log('derivedSelection', derivedSelection.toJS());
    console.groupEnd();
  }


  /****************************************************************************
   * COMPOSITION HANDLERS
   ****************************************************************************/
  onCompositionStart(editor: DraftEditor, e: SyntheticCompositionEvent) {
    console.group('onCompositionStart');
    this.reset();
    this.startObserving(editor);

    const initialState = getEditorState(editor);
    this.setState({ initialState });
    this.log(
      'editorState.getSelection()',
      initialState.getSelection().toJS(),
    );
    this.log('DOM selection', this.getDomSelection());

    const derivedSelection = this.deriveSelection(editor);
    this.log('derivedSelection', derivedSelection.toJS());

    console.groupEnd();
  }


  onCompositionUpdate(editor: DraftEditor, e: SyntheticCompositionEvent) {
    console.group(`onCompositionUpdate: "${e.data}"`);
    const compositionText = e.data;
    this.setState({ lastText: compositionText });

    // this.log('editorState.getSelection()', getEditorState(editor).getSelection().toJS());

    this.log('DOM selection', this.getDomSelection());

    // The offsets here are relative to the new state, not the old one
    //
    // This range will include the whole composition range except the inserted
    // character (assuming it's inserted at the end of the word). For example,
    // if you type "T" the range is a collapsed caret at the start. If you then
    // type "h", the range includes the T only. If you type "e" next, the range
    // is around the "Th" aka, it's the range before the new char is inserted --
    // Immediately afterwards, a selectionchange will fire updating the selection
    // to be after the inserted character.
    //
    // If they move the selection somewhere else, the DOM-derived selection will
    // be collapsed again and the compositionupdate won't be preceded by a
    // beforeinput, whether or not they moved the caret within the current
    // composition range or outside it.
    const derivedSelection = this.deriveSelection(editor);
    this.log('derivedSelection', derivedSelection.toJS());
    this.setState({ range: derivedSelection });


    console.groupEnd();
  }


  onCompositionEnd(editor: DraftEditor, e: SyntheticCompositionEvent) {
    console.group(`onCompositionEnd: "${e.data}"`);
    this.restoreDomIfNecessary(editor);

    // this.log('editorState.getSelection()', getEditorState(editor).getSelection().toJS());
    this.log('DOM selection', this.getDomSelection());
    const derivedSelection = this.deriveSelection(editor);
    this.log('derivedSelection', derivedSelection.toJS());

    const text = e.data;
    this.log('text', `"${text}"`);

    editor.setMode('edit');


    console.groupEnd();
  }
}

module.exports = new DraftEditorCompositionHandlerAndroid();
