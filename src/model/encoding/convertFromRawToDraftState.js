/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule convertFromRawToDraftState
 * @flow
 */

'use strict';

var ContentState = require('ContentState');

var createCharacterList = require('createCharacterList');
var decodeEntityRanges = require('decodeEntityRanges');
var decodeInlineStyleRanges = require('decodeInlineStyleRanges');
var generateRandomKey = require('generateRandomKey');
var Immutable = require('immutable');
var convertFromRawToContentBlock = require('convertFromRawToContentBlock');

import type {RawDraftContentState} from 'RawDraftContentState';

var {Map} = Immutable;

function convertFromRawToDraftState(
  rawState: RawDraftContentState
): ContentState {
  var {blocks, entityMap} = rawState;
  var contentBlocks = blocks.map(block => convertFromRawToContentBlock(block, entityMap));

  return ContentState.createFromBlockArray(contentBlocks);
}

module.exports = convertFromRawToDraftState;
