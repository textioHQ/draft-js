/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 * @flow strict-local
 * @emails oncall+draft_js
 */

'use strict';

const ComposedEntityMutability = require('ComposedEntityMutability');

/**
 * An enum representing the possible "mutability" options for an entity.
 * This refers to the behavior that should occur when inserting or removing
 * characters in a text range with an entity applied to it.
 *
 * `MUTABLE`:
 *   The text range can be modified freely. Generally used in cases where
 *   the text content and the entity do not necessarily have a direct
 *   relationship. For instance, the text and URI for a link may be completely
 *   different. The user is allowed to edit the text as needed, and the entity
 *   is preserved and applied to any characters added within the range.
 *
 * `IMMUTABLE`:
 *   Not to be confused with immutable data structures used to represent the
 *   state of the editor. Immutable entity ranges cannot be modified in any
 *   way. Adding characters within the range will remove the entity from the
 *   entire range. Deleting characters will delete the entire range. Example:
 *   Facebook Page mentions.
 *
 * `SEGMENTED`:
 *   Segmented entities allow the removal of partial ranges of text, as
 *   separated by a delimiter. Adding characters within the range will remove
 *   the entity from the entire range. Deleting characters within a segmented
 *   entity will delete only the segments affected by the deletion. Example:
 *   Facebook User mentions.
 *
 * `PLAIN`:
 *   Plain entities lack the customized behavior of the other entity types, and
 *   should be used when the desired behavior doesn 't fall cleanly into the use
 *   cases of the other entity types.They don 't automatically expand like
 *   mutable entities, and they aren't deleted like immutable or segmented
 *   entities.They are designed to serve as a blank slate that custom behavior
 *   can be build on top of.
 */

export type DraftEntityMutability = $Keys<typeof ComposedEntityMutability>;
