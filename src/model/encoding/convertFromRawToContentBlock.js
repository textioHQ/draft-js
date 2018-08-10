/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule convertFromRawToContentBlock
 * @flow
 */

'use strict';

import type {RawDraftContentBlock} from 'RawDraftContentBlock';

var ContentBlock = require('ContentBlock');
var DraftEntity = require('DraftEntity');

var createCharacterList = require('createCharacterList');
var decodeEntityRanges = require('decodeEntityRanges');
var decodeInlineStyleRanges = require('decodeInlineStyleRanges');
var generateRandomKey = require('generateRandomKey');
var Immutable = require('immutable');

var {Map} = Immutable;

function convertFromRawToContentBlock(
  block: RawDraftContentBlock,
  entityMap: {[key: string]: RawDraftEntity},
): ContentBlock {
  var fromStorageToLocal = {};

  // TODO: Update this once we completely remove DraftEntity
  Object.keys(entityMap).forEach(
    storageKey => {
      var encodedEntity = entityMap[storageKey];
      var {type, mutability, data} = encodedEntity;
      var newKey = DraftEntity._create(type, mutability, data || {});
      fromStorageToLocal[storageKey] = newKey;
    },
  );
  var {
    key,
    type,
    text,
    depth,
    inlineStyleRanges,
    entityRanges,
    data,
  } = block;
  key = key || generateRandomKey();
  type = type || 'unstyled';
  depth = depth || 0;
  inlineStyleRanges = inlineStyleRanges || [];
  entityRanges = entityRanges || [];
  data = Map(data);

  var inlineStyles = decodeInlineStyleRanges(text, inlineStyleRanges);

  // Translate entity range keys to the DraftEntity map.
  var filteredEntityRanges = entityRanges
    .filter(range => fromStorageToLocal.hasOwnProperty(range.key))
    .map(range => {
      return {...range, key: fromStorageToLocal[range.key]};
    });

  var entities = decodeEntityRanges(text, filteredEntityRanges);
  var characterList = createCharacterList(inlineStyles, entities);

  return new ContentBlock({key, type, text, depth, characterList, data});
}

module.exports = convertFromRawToContentBlock;
