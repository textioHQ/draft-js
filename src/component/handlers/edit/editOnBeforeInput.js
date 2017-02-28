/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule editOnBeforeInput
 * @flow
 */

'use strict';

var BlockTree = require('BlockTree');
var DraftModifier = require('DraftModifier');
var EditorState = require('EditorState');
var UserAgent = require('UserAgent');

var getEntityKeyForSelection = require('getEntityKeyForSelection');
var isSelectionAtLeafStart = require('isSelectionAtLeafStart');
var nullthrows = require('nullthrows');
var setImmediate = require('setImmediate');
var editOnInput = require('editOnInput');
var editOnSelect = require('editOnSelect');

import type DraftEditor from 'DraftEditor.react';
import type {DraftInlineStyle} from 'DraftInlineStyle';
const isEventHandled = require('isEventHandled');

// When nothing is focused, Firefox regards two characters, `'` and `/`, as
// commands that should open and focus the "quickfind" search bar. This should
// *never* happen while a contenteditable is focused, but as of v28, it
// sometimes does, even when the keypress event target is the contenteditable.
// This breaks the input. Special case these characters to ensure that when
// they are typed, we prevent default on the event to make sure not to
// trigger quickfind.
var FF_QUICKFIND_CHAR = '\'';
var FF_QUICKFIND_LINK_CHAR = '\/';
var isFirefox = UserAgent.isBrowser('Firefox');
var isIE = UserAgent.isBrowser('IE');

function mustPreventDefaultForCharacter(character: string): boolean {
  return (
    isFirefox && (
      character == FF_QUICKFIND_CHAR ||
      character == FF_QUICKFIND_LINK_CHAR
    )
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
  return EditorState.push(editorState, contentState, 'insert-characters');
}

/**
 * When `onBeforeInput` executes, the browser is attempting to insert a
 * character into the editor. Apply this character data to the document,
 * allowing native insertion if possible.
 *
 * Native insertion is encouraged in order to limit re-rendering and to
 * preserve spellcheck highlighting, which disappears or flashes if re-render
 * occurs on the relevant text nodes.
 */
function editOnBeforeInput(editor: DraftEditor, e: SyntheticInputEvent): void {

  // React doesn't fire a selection event until mouseUp, so it's possible to click to change selection, hold the mouse
  // down, and type a character without React registering it. Let's sync the selection manually now.
  editOnSelect(editor);

  var chars = e.data;

  // In some cases (ex: IE ideographic space insertion) no character data
  // is provided. There's nothing to do when this happens.
  if (!chars) {
    return;
  }

  // Allow the top-level component to handle the insertion manually. This is
  // useful when triggering interesting behaviors for a character insertion,
  // Simple examples: replacing a raw text ':)' with a smile emoji or image
  // decorator, or setting a block to be a list item after typing '- ' at the
  // start of the block.
  if (
    editor.props.handleBeforeInput &&
    isEventHandled(editor.props.handleBeforeInput(chars))
  ) {
    e.preventDefault();
    return;
  }

  // If selection is collapsed, conditionally allow native behavior. This
  // reduces re-renders and preserves spellcheck highlighting. If the selection
  // is not collapsed, we will re-render.
  var editorState = editor._latestEditorState;
  var selection = editorState.getSelection();

  if (!selection.isCollapsed()) {
    e.preventDefault();
    editor.update(
      replaceText(
        editorState,
        chars,
        editorState.getCurrentInlineStyle(),
        getEntityKeyForSelection(
          editorState.getCurrentContent(),
          editorState.getSelection()
        )
      )
    );
    return;
  }

  var mayAllowNative = !isSelectionAtLeafStart(editorState);
  var newEditorState = replaceText(
    editorState,
    chars,
    editorState.getCurrentInlineStyle(),
    getEntityKeyForSelection(
      editorState.getCurrentContent(),
      editorState.getSelection()
    )
  );

  if (!mayAllowNative) {
    e.preventDefault();
    editor.update(newEditorState);
    return;
  }

  var anchorKey = selection.getAnchorKey();
  var anchorTree = editorState.getBlockTree(anchorKey);

  // Check the old and new "fingerprints" of the current block to determine
  // whether this insertion requires any addition or removal of text nodes,
  // in which case we would prevent the native character insertion.
  var originalFingerprint = BlockTree.getFingerprint(anchorTree);
  var newFingerprint = BlockTree.getFingerprint(
    newEditorState.getBlockTree(anchorKey)
  );

  if (
    mustPreventDefaultForCharacter(chars) ||
    originalFingerprint !== newFingerprint ||
    (
      nullthrows(newEditorState.getDirectionMap()).get(anchorKey) !==
      nullthrows(editorState.getDirectionMap()).get(anchorKey)
    )
  ) {
    e.preventDefault();
    editor.update(newEditorState);
  } else {
    newEditorState = EditorState.set(newEditorState, {
      nativelyRenderedContent: newEditorState.getCurrentContent(),
    });

    editor._updatedNativeInsertionBlock = editorState.getCurrentContent().getBlockForKey(
      editorState.getSelection().getAnchorKey()
    );

    // Allow the native insertion to occur and update our internal state
    // to match. If editor.update() does something like changing a typed
    // 'x' to 'abc' in an onChange() handler, we don't want our editOnInput()
    // logic to squash that change in favor of the typed 'x'. Set a flag to
    // ignore the next editOnInput() event in favor of what's in our internal state.
    editor.update(newEditorState, true);

    var editorStateAfterUpdate = editor._latestEditorState;
    var contentStateAfterUpdate = editorStateAfterUpdate.getCurrentContent();
    var expectedContentStateAfterUpdate = editorStateAfterUpdate.getNativelyRenderedContent();

    if (expectedContentStateAfterUpdate && expectedContentStateAfterUpdate === contentStateAfterUpdate) {
      if (isIE) {
        setImmediate(() => {
          editOnInput(editor);
        });
      }
    } else {
      // Outside callers (via the editor.onChange prop) have changed the editorState
      // No longer allow native insertion.
      e.preventDefault();
      editor._updatedNativeInsertionBlock = null;
      editor._renderNativeContent = false;
    }
  }
}

module.exports = editOnBeforeInput;
