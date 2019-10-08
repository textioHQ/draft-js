'use strict';

import type DraftEditor from 'DraftEditor.react';
import type { DraftInlineStyle } from 'DraftInlineStyle';

const ReactDOM = require('ReactDOM');

const BlockTree = require('BlockTree');
const DraftModifier = require('DraftModifier');
const EditorState = require('EditorState');
const UserAgent = require('UserAgent');
const getDraftEditorSelection = require('getDraftEditorSelection');
const invariant = require('invariant');

const keyCommandPlainBackspace = require('keyCommandPlainBackspace');
const keyCommandPlainDelete = require('keyCommandPlainDelete');
const keyCommandInsertNewline = require('keyCommandInsertNewline');

const getEntityKeyForSelection = require('getEntityKeyForSelection');
const getDraftEditorSelectionWithNodes = require('getDraftEditorSelectionWithNodes');

// When nothing is focused, Firefox regards two characters, `'` and `/`, as
// commands that should open and focus the "quickfind" search bar. This should
// *never* happen while a contenteditable is focused, but as of v28, it
// sometimes does, even when the keypress event target is the contenteditable.
// This breaks the input. Special case these characters to ensure that when
// they are typed, we prevent default on the event to make sure not to
// trigger quickfind.
var FF_QUICKFIND_CHAR = "'";
var FF_QUICKFIND_LINK_CHAR = '/';
var isFirefox = UserAgent.isBrowser('Firefox');
var isIE = UserAgent.isBrowser('IE');

function mustPreventDefaultForCharacter(character: string): boolean {
  return (
    isFirefox &&
    (character == FF_QUICKFIND_CHAR || character == FF_QUICKFIND_LINK_CHAR)
  );
}

/**
 * Replace the current selection with the specified text string, with the
 * inline style and entity key applied to the newly inserted text.
 */
function replaceText(
  editorState: EditorState,
  text: string,
  inlineStyle: DraftInlineStyle,
  entityKey: ?string,
): EditorState {
  var contentState = DraftModifier.replaceText(
    editorState.getCurrentContent(),
    editorState.getSelection(),
    text,
    inlineStyle,
    entityKey,
  );
  return EditorState.push(editorState, contentState, 'insert-characters');
}

const log = (s, ...args) => {
  console.log(`editOnBeforeInputAndroid:${s}`, ...args);
};

/**
 * When `onBeforeInput` executes, the browser is attempting to insert a
 * character into the editor. Apply this character data to the document
 */
function editOnBeforeInputAndroid(editor: DraftEditor, e: InputEvent): void {
  log('top of function', editor, e, e.getTargetRanges());

  if (e.isComposing && !e.cancelable) {
    // Allow normal browser before for any composition events,
    // TODO: This is the hard part, we bail out here so that we
    // don't double
    return;
  }

  e.preventDefault();

  const staticRanges = e.getTargetRanges();
  const { inputType, data } = e;
  const editorState = editor._latestEditorState;
  const nativeSelection = global.getSelection();

  // var editorState = editor.props.editorState;
  const editorNode = ReactDOM.findDOMNode(editor.refs.editorContainer);

  invariant(editorNode, 'Missing editorNode');
  invariant(
    editorNode.firstChild instanceof HTMLElement,
    'editorNode.firstChild is not an HTMLElement',
  );

  const hasAffectedRanges =
    staticRanges && Array.isArray(staticRanges) && staticRanges.length > 0;

  // Compute
  let affectedSelection = undefined;
  if (hasAffectedRanges) {
    log('Has affected ranges');
    const [affectedRange] = staticRanges;
    log('affected range observered', affectedRange);
    affectedSelection = getDraftEditorSelectionWithNodes(
      editorState,
      editorNode.firstChild,
      affectedRange.startContainer,
      affectedRange.startOffset,
      affectedRange.endContainer,
      affectedRange.endOffset,
    );
    log('affectedSelection', affectedSelection);
  } else {
    // If there is no affected range, we're just going to use the current native selection
    // (implies we're about to do something additive)
    log('No affected ranges');
    const currentDraftSelectionFromCurrentNativeSelection = getDraftEditorSelection(
      editorState,
      editorNode.firstChild,
    );
    affectedSelection = currentDraftSelectionFromCurrentNativeSelection;
  }

  const editorStateWithCorrectSelection = EditorState.acceptSelection(
    editorState,
    affectedSelection.selectionState,
  );
  const chars = data;

  switch (inputType) {
    case 'insertText':
    case 'insertCompositionText':
    case 'insertFromComposition':
      if (!chars) {
        log('no chars to apply, returning', chars, e);
        return;
      }
      const newEditorState = replaceText(
        editorStateWithCorrectSelection,
        chars,
        editorStateWithCorrectSelection.getCurrentInlineStyle(),
        getEntityKeyForSelection(
          editorStateWithCorrectSelection.getCurrentContent(),
          editorStateWithCorrectSelection.getSelection(),
        ),
      );

      editor.update(newEditorState);
      return;

    case 'deleteContentBackward':
    case 'deleteWordBackward':
    case 'deleteSoftLineBackward':
    case 'deleteContent':
    case 'deleteByCut':
      editor.update(keyCommandPlainBackspace(editorStateWithCorrectSelection));
      return;

    case 'deleteContentForward':
    case 'deleteWordForward':
    case 'deleteSoftLineForward':
      editor.update(keyCommandPlainDelete(editorStateWithCorrectSelection));
      return;

    case 'insertLineBreak':
    case 'insertParagraph':
      editor.update(keyCommandInsertNewline(editorStateWithCorrectSelection));
      return;

    case 'insertFromPaste':
      // TODO pastes will always be plaintext until we handle the dataTransfer object
      const pasteChars = e.dataTransfer.getData('text/plain');

      editor.update(
        replaceText(
          editorStateWithCorrectSelection,
          pasteChars,
          editorStateWithCorrectSelection.getCurrentInlineStyle(),
          getEntityKeyForSelection(
            editorStateWithCorrectSelection.getCurrentContent(),
            editorStateWithCorrectSelection.getSelection(),
          ),
        ),
      );
      return;

    default:
      log('Unhandled input type', inputType, e);
  }

  // Don't think is necessary anymore as we're deriving seleciton from beforeInput (?)
  // React doesn't fire a selection event until mouseUp, so it's possible to
  // click to change selection, hold the mouse down, and type a character
  // without React registering it. Let's sync the selection manually now.
  // editOnSelect(editor);

  log('Done with beforeinput handler, returning');
  return;
}

module.exports = editOnBeforeInputAndroid;
