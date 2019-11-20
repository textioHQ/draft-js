/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule CompositionContextProvider
 * @flow
 */

import type EditorState from 'EditorState';

const React = require('React');
const CompositionContext = require('CompositionContext');

type Props = {
  editorState: EditorState,
  children: any
};

function CompositionContextProvider({ editorState, children }: Props) {
  return (
    <CompositionContext.Provider value={editorState.isInCompositionMode()}>
      {children}
    </CompositionContext.Provider>
  );
}

module.exports = CompositionContextProvider;
