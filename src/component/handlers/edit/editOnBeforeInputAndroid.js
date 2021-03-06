'use strict';

import type DraftEditor from 'DraftEditor.react';
import type { DraftInlineStyle } from 'DraftInlineStyle';

const ReactDOM = require('ReactDOM');

const DraftModifier = require('DraftModifier');
const EditorState = require('EditorState');
const getDraftEditorSelection = require('getDraftEditorSelection');
const invariant = require('invariant');
const isEventHandled = require('isEventHandled');
const onCopy = require('editOnCopy');
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

/**
 * When `onBeforeInput` executes, the browser is attempting to insert a
 * character into the editor. Apply this character data to the document.
 */
function editOnBeforeInputAndroid(editor: DraftEditor, e: InputEvent): void {
  if (e.isComposing && !e.cancelable) {
    // Allow normal browser before for any composition events.
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

  // Allow the top-level component to handle the insertion manually. This is
  // useful when triggering interesting behaviors for a character insertion,
  // Simple examples: replacing a raw text ':)' with a smile emoji or image
  // decorator, or setting a block to be a list item after typing '- ' at the
  // start of the block.
  if (
    editor.props.handleBeforeInput &&
    isEventHandled(editor.props.handleBeforeInput(chars, editorStateWithCorrectSelection))
  ) {
    e.preventDefault();
    return;
  }

  switch (inputType) {
    // Allowing insertCompositionText to pass through.
    case 'insertCompositionText':
      return;

    case 'insertText':
    case 'insertFromComposition': {
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

      e.preventDefault();
      editor.update(EditorState.forceSelection(newEditorState, newEditorState.getSelection()));

      return;
    }

    case 'deleteContentBackward':
    case 'deleteWordBackward':
    case 'deleteSoftLineBackward':
    case 'deleteContent': {
      e.preventDefault();
      editor.update(keyCommandPlainBackspace(editorStateWithCorrectSelection));
      return;
    }

    case 'deleteByCut': {
      onCopy(editor, e);
      e.preventDefault();
      editor.update(keyCommandPlainBackspace(editorStateWithCorrectSelection));
      return;
    }

    case 'deleteContentForward':
    case 'deleteWordForward':
    case 'deleteSoftLineForward': {
      e.preventDefault();
      editor.update(keyCommandPlainDelete(editorStateWithCorrectSelection));
      return;
    }

    case 'insertLineBreak':
    case 'insertParagraph': {
      e.preventDefault();
      const newState = keyCommandInsertNewline(
        editorStateWithCorrectSelection,
      );
      editor.update(
        EditorState.forceSelection(newState, newState.getSelection()),
      );
      return;
    }

    case 'insertFromPaste': {
      // Allow insert `insertFromPaste` to pass through, it will be handled in the Android handler
      // by `editOnPaste`.
      return;
    }

    default:
      return;
  }
}

module.exports = editOnBeforeInputAndroid;
