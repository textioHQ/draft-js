/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule logEditorState
 * @typechecks
 * @flow
 */

/* eslint-disable no-console */
const SELECTED = `color: blue;`;
const UN_SELECTED = `color: black;`;

export const logSelectedText = (content, selection, label = '') => {
  console.group(`ContentState: "${label}"`);
  let inSelection = false;
  content.getBlocksAsArray().forEach(block => {
    const text = block.getText();
    if (block.getKey() === selection.getStartKey()) {
      inSelection = true;
    }
    if (!inSelection) {
      console.log(`%c${text}`, UN_SELECTED);
    } else {
      const startOffset =
        block.getKey() === selection.getStartKey()
          ? selection.getStartOffset()
          : 0;
      const endOffset =
        block.getKey() === selection.getEndKey()
          ? selection.getEndOffset()
          : block.getLength();
      const textInSelection = text.slice(startOffset, endOffset);
      let textBeforeSelection = text.slice(0, startOffset);
      let textAfterSelection = text.slice(endOffset);
      if (block.getKey() === selection.getStartKey()) {
        textBeforeSelection = `${textBeforeSelection}|`;
      }
      if (
        block.getKey() === selection.getEndKey() &&
        !selection.isCollapsed()
      ) {
        textAfterSelection = `|${textAfterSelection}`;
      }
      console.log(
        `%c${textBeforeSelection}%c${textInSelection}%c${textAfterSelection}`,
        UN_SELECTED,
        SELECTED,
        UN_SELECTED,
      );
    }
    if (block.getKey() === selection.getEndKey()) {
      inSelection = false;
    }
  });
  console.groupEnd();
};

export const logEditorState = (editorState, label) => {
  logSelectedText(editorState.getCurrentContent(), editorState.getSelection(), label);
};

