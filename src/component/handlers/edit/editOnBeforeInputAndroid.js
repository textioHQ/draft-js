'use strict';

import type DraftEditor from 'DraftEditor.react';
import type { DraftInlineStyle } from 'DraftInlineStyle';

const ReactDOM = require('ReactDOM');

const DraftModifier = require('DraftModifier');
const EditorState = require('EditorState');
const getDraftEditorSelection = require('getDraftEditorSelection');
const invariant = require('invariant');

const keyCommandPlainBackspace = require('keyCommandPlainBackspace');
const keyCommandPlainDelete = require('keyCommandPlainDelete');
const keyCommandInsertNewline = require('keyCommandInsertNewline');

const getEntityKeyForSelection = require('getEntityKeyForSelection');
const getDraftEditorSelectionWithNodes = require('getDraftEditorSelectionWithNodes');

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

const logChanges = (editor, mutation) => {
  const blocksBefore = editor._latestEditorState.getCurrentContent().getBlockMap();
  const selectionBefore = editor._latestEditorState.getSelection();
  mutation();
  const blocksAfter = editor._latestEditorState.getCurrentContent().getBlockMap();
  const selectionAfter = editor._latestEditorState.getSelection();

  if (!blocksBefore.equals(blocksAfter)) {
    console.log(
      'Blocks Changed',
      Object.values(blocksBefore.toJS()).map(v => `${v.key}: ${v.text}`),
      Object.values(blocksAfter.toJS()).map(v => `${v.key}: ${v.text}`),
    );
  }
  if (!selectionBefore.equals(selectionAfter)) {
    console.log('Selection Changed', selectionBefore.toJS(), selectionAfter.toJS());
  }
};

/**
 * When `onBeforeInput` executes, the browser is attempting to insert a
 * character into the editor. Apply this character data to the document
 */
function editOnBeforeInputAndroid(editor: DraftEditor, e: InputEvent): void {
  if (e.isComposing && !e.cancelable) {
    // Allow normal browser before for any composition events,
    // TODO: This is the hard part, we bail out here so that we
    // don't double
    return;
  }

  const staticRanges = e.getTargetRanges();
  const { inputType, data } = e;
  const editorState = editor._latestEditorState;

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
    const [affectedRange] = staticRanges;
    affectedSelection = getDraftEditorSelectionWithNodes(
      editorState,
      editorNode.firstChild,
      affectedRange.startContainer,
      affectedRange.startOffset,
      affectedRange.endContainer,
      affectedRange.endOffset,
    );
  } else {
    // If there is no affected range, we're just going to use the current native selection
    // (implies we're about to do something additive)
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
    // Allowing insertCompositionText to pass through.
    case 'insertCompositionText':
      return;

    case 'insertText':
    case 'insertFromComposition':
      if (!chars) {
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

      logChanges(editor, () => {
        e.preventDefault();
        editor.update(EditorState.forceSelection(newEditorState, newEditorState.getSelection()));
      });

      return;

    case 'deleteContentBackward':
    case 'deleteWordBackward':
    case 'deleteSoftLineBackward':
    case 'deleteContent':
    case 'deleteByCut':
      logChanges(editor, () => {
        e.preventDefault();
        editor.update(keyCommandPlainBackspace(editorStateWithCorrectSelection));
      });
      return;

    case 'deleteContentForward':
    case 'deleteWordForward':
    case 'deleteSoftLineForward':
      logChanges(editor, () => {
        e.preventDefault();
        editor.update(keyCommandPlainDelete(editorStateWithCorrectSelection));
      });
      return;

    case 'insertLineBreak':
    case 'insertParagraph':
      logChanges(editor, () => {
        e.preventDefault();
        const newState = keyCommandInsertNewline(
          editorStateWithCorrectSelection,
        );
        editor.update(
          EditorState.forceSelection(newState, newState.getSelection()),
        );
      });
      return;

    case 'insertFromPaste':
      // TODO: pastes will always be plaintext until we handle the dataTransfer object
      const pasteChars = e.dataTransfer.getData('text/plain');

      e.preventDefault();
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
      // TODO: Anything to do here?
      return;
  }
}

module.exports = editOnBeforeInputAndroid;
