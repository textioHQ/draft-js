/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule editOnBeforeInputAndroid
 * @flow
 */

"use strict";

import type DraftEditor from "DraftEditor.react";
import type { DraftInlineStyle } from "DraftInlineStyle";

var ReactDOM = require("ReactDOM");

var BlockTree = require("BlockTree");
var DraftModifier = require("DraftModifier");
var EditorState = require("EditorState");
var UserAgent = require("UserAgent");
var getDraftEditorSelection = require("getDraftEditorSelection");
const invariant = require("invariant");
var UnicodeUtils = require("UnicodeUtils");

var moveSelectionForward = require("moveSelectionForward");
var removeTextWithStrategy = require("removeTextWithStrategy");
var moveSelectionBackward = require("moveSelectionBackward");
var removeTextWithStrategy = require("removeTextWithStrategy");

var getEntityKeyForSelection = require("getEntityKeyForSelection");
var getDraftEditorSelectionWithNodes = require("getDraftEditorSelectionWithNodes");
const isEventHandled = require("isEventHandled");
var isSelectionAtLeafStart = require("isSelectionAtLeafStart");
var nullthrows = require("nullthrows");
var setImmediate = require("setImmediate");
var editOnInput = require("editOnInput");
var editOnSelect = require("editOnSelect");

// When nothing is focused, Firefox regards two characters, `'` and `/`, as
// commands that should open and focus the "quickfind" search bar. This should
// *never* happen while a contenteditable is focused, but as of v28, it
// sometimes does, even when the keypress event target is the contenteditable.
// This breaks the input. Special case these characters to ensure that when
// they are typed, we prevent default on the event to make sure not to
// trigger quickfind.
var FF_QUICKFIND_CHAR = "'";
var FF_QUICKFIND_LINK_CHAR = "/";
var isFirefox = UserAgent.isBrowser("Firefox");
var isIE = UserAgent.isBrowser("IE");

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
  entityKey: ?string
): EditorState {
  var contentState = DraftModifier.replaceText(
    editorState.getCurrentContent(),
    editorState.getSelection(),
    text,
    inlineStyle,
    entityKey
  );
  return EditorState.push(editorState, contentState, "insert-characters");
}

const log = (s, ...args) => {
  console.log(`editOnBeforeInputAndroid:${s}`, ...args);
};

/**
 * When `onBeforeInput` executes, the browser is attempting to insert a
 * character into the editor. Apply this character data to the document,
 * allowing native insertion if possible.
 *
 * Native insertion is encouraged in order to limit re-rendering and to
 * preserve spellcheck highlighting, which disappears or flashes if re-render
 * occurs on the relevant text nodes.
 */
function editOnBeforeInputAndroid(editor: DraftEditor, e: InputEvent): void {
  log("top of function", editor, e, e.getTargetRanges());

  e.preventDefault();

  const staticRanges = e.getTargetRanges();
  const { inputType, data } = e;
  const editorState = editor._latestEditorState;
  const nativeSelection = global.getSelection();

  // var editorState = editor.props.editorState;
  const editorNode = ReactDOM.findDOMNode(editor.refs.editorContainer);
  invariant(editorNode, "Missing editorNode");
  invariant(
    editorNode.firstChild instanceof HTMLElement,
    "editorNode.firstChild is not an HTMLElement"
  );
  // implicitly

  const hasAffectedRanges =
    Array.isArray(staticRanges) && staticRanges.length > 0;

  // Compute
  let affectedSelection = undefined;
  if (hasAffectedRanges) {
    log("Has affected ranges");
    const [affectedRange] = staticRanges;
    log("affected range observered", affectedRange);
    affectedSelection = getDraftEditorSelectionWithNodes(
      editorState,
      editorNode.firstChild,
      affectedRange.startContainer,
      affectedRange.startOffset,
      affectedRange.endContainer,
      affectedRange.endOffset
    );
    log("affectedSelection", affectedSelection);
  } else {
    // If there is no affected range, we're just going to use the current native selection (implies we're about to do something additive)
    log("No affected ranges");
    const currentDraftSelectionFromCurrentNativeSelection = getDraftEditorSelection(
      editorState,
      editorNode.firstChild
    );
    affectedSelection = currentDraftSelectionFromCurrentNativeSelection;
  }

  const isCollapsed = affectedSelection.selectionState.isCollapsed();
  const editorStateWithCorrectSelection = EditorState.acceptSelection(
    editorState,
    affectedSelection.selectionState
  );
  const chars = data;

  switch (inputType) {
    case "insertText":
    case "insertCompositionText":
    case "insertFromComposition":
      console.log("supported input type", inputType);
      if (!chars) {
        log("no chars to apply, returning", chars, e);
        return;
      }
      const newEditorState = replaceText(
        editorStateWithCorrectSelection,
        chars,
        editorStateWithCorrectSelection.getCurrentInlineStyle(),
        getEntityKeyForSelection(
          editorStateWithCorrectSelection.getCurrentContent(),
          editorStateWithCorrectSelection.getSelection()
        )
      );
      e.preventDefault();
      editor.update(newEditorState);
      return;
    case "deleteContentBackward":
      if (isCollapsed) {
        // For some reason, this branch never seems to happen (selectionState.isCollapsed always returns false?)
        // It's fine for now as keyCommandPlainDelete captures this too, just less specific.... /shrug
        log("is collapsed, just doing a backspace command");
        const newEditorStateWithBackspace = keyCommandPlainBackspace(
          editorStateWithCorrectSelection
        );
        editor.update(newEditorStateWithBackspace);
        return;
      } else {
        // uncollapsed
        log("is uncollapsed, doing a full delete");
        const newEditorStateWithDelete = keyCommandPlainDelete(
          editorStateWithCorrectSelection
        );
        editor.update(newEditorStateWithDelete);
        return;
      }
      break;
    default:
      log("unhandled event", inputType, e);
  }

  // Don't think is necessary anymore as we're deriving seleciton from beforeInput (?)
  // React doesn't fire a selection event until mouseUp, so it's possible to
  // click to change selection, hold the mouse down, and type a character
  // without React registering it. Let's sync the selection manually now.
  // editOnSelect(editor);
  log("all done with beforeinput");
}

/**
 * Remove the selected range. If the cursor is collapsed, remove the following
 * character. This operation is Unicode-aware, so removing a single character
 * will remove a surrogate pair properly as well.
 */
function keyCommandPlainDelete(editorState: EditorState): EditorState {
  var afterRemoval = removeTextWithStrategy(
    editorState,
    strategyState => {
      var selection = strategyState.getSelection();
      var content = strategyState.getCurrentContent();
      var key = selection.getAnchorKey();
      var offset = selection.getAnchorOffset();
      var charAhead = content.getBlockForKey(key).getText()[offset];
      return moveSelectionForward(
        strategyState,
        charAhead ? UnicodeUtils.getUTF16Length(charAhead, 0) : 1
      );
    },
    "forward"
  );

  if (afterRemoval === editorState.getCurrentContent()) {
    return editorState;
  }

  var selection = editorState.getSelection();

  return EditorState.push(
    editorState,
    afterRemoval.set("selectionBefore", selection),
    selection.isCollapsed() ? "delete-character" : "remove-range"
  );
}

/**
 * Remove the selected range. If the cursor is collapsed, remove the preceding
 * character. This operation is Unicode-aware, so removing a single character
 * will remove a surrogate pair properly as well.
 */
function keyCommandPlainBackspace(editorState: EditorState): EditorState {
  var afterRemoval = removeTextWithStrategy(
    editorState,
    strategyState => {
      var selection = strategyState.getSelection();
      var content = strategyState.getCurrentContent();
      var key = selection.getAnchorKey();
      var offset = selection.getAnchorOffset();
      var charBehind = content.getBlockForKey(key).getText()[offset - 1];
      return moveSelectionBackward(
        strategyState,
        charBehind ? UnicodeUtils.getUTF16Length(charBehind, 0) : 1
      );
    },
    "backward"
  );

  if (afterRemoval === editorState.getCurrentContent()) {
    return editorState;
  }

  var selection = editorState.getSelection();
  return EditorState.push(
    editorState,
    afterRemoval.set("selectionBefore", selection),
    selection.isCollapsed() ? "backspace-character" : "remove-range"
  );
}

module.exports = editOnBeforeInputAndroid;
