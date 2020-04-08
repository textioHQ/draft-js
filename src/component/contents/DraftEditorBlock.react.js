/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule DraftEditorBlock.react
 * @typechecks
 * @flow
 */

'use strict';

import type ContentBlock from 'ContentBlock';
import type ContentState from 'ContentState';
import type { DraftDecoratorType } from 'DraftDecoratorType';
import type SelectionState from 'SelectionState';
import type { BidiDirection } from 'UnicodeBidiDirection';
import type { List } from 'immutable';

const DraftEditorLeaf = require('DraftEditorLeaf.react');
const DraftOffsetKey = require('DraftOffsetKey');
const React = require('React');
const ReactDOM = require('ReactDOM');
const Scroll = require('Scroll');
const Style = require('Style');
const UnicodeBidi = require('UnicodeBidi');
const UnicodeBidiDirection = require('UnicodeBidiDirection');

const cx = require('cx');
const getElementPosition = require('getElementPosition');
const getScrollPosition = require('getScrollPosition');
const getViewportDimensions = require('getViewportDimensions');
const invariant = require('invariant');
const nullthrows = require('nullthrows');

const SCROLL_BUFFER = 10;

type Props = {
  contentState: ContentState,
  block: ContentBlock,
  customStyleMap: Object,
  customStyleFn: Function,
  tree: List<any>,
  selection: SelectionState,
  decorator: DraftDecoratorType,
  forceSelection: boolean,
  direction: BidiDirection,
  blockProps?: Object,
  startIndent?: boolean,
  blockStyleFn: Function,
};

/**
 * The default block renderer for a `DraftEditor` component.
 *
 * A `DraftEditorBlock` is able to render a given `ContentBlock` to its
 * appropriate decorator and inline style components.
 */
class DraftEditorBlock extends React.Component {
  shouldComponentUpdate(nextProps: Props): boolean {
    return (
      this.props.block !== nextProps.block ||
      this.props.tree !== nextProps.tree ||
      this.props.direction !== nextProps.direction ||
      (
        isBlockOnSelectionEdge(
          nextProps.selection,
          nextProps.block.getKey(),
        ) &&
        nextProps.forceSelection
      )
    );
  }

  /**
   * When a block is mounted and overlaps the selection state, we need to make
   * sure that the cursor is visible to match native behavior. This may not
   * be the case if the user has pressed `RETURN` or pasted some content, since
   * programatically creating these new blocks and setting the DOM selection
   * will miss out on the browser natively scrolling to that position.
   *
   * To replicate native behavior, if the block overlaps the selection state
   * on mount, force the scroll position. Check the visible bounds of the scroll
   * parent against the bounds of the new block and scroll up or down to bring
   * it into view.
   */
  componentDidMount(): void {
    const selection = this.props.selection;
    const endKey = selection.getEndKey();

    if (!selection.getHasFocus() || endKey !== this.props.block.getKey()) {
      return;
    }

    const blockElement = this._element;
    if (blockElement == null) {
      return;
    }

    const blockRect = blockElement.getBoundingClientRect();
    const scrollParent = Style.getScrollParent(blockElement);
    let scrollElement;
    let scrollRect;

    if (scrollParent === window) {
      // Window itself has a different API for scrolling than elements especially on
      // IE11.  Luckily we can get the documentElement (<HTML>) and operate on that.
      scrollElement = window.document.documentElement;
      scrollRect = { top: 0, bottom: window.innerHeight };
    } else {
      scrollElement = scrollParent;
      scrollRect = scrollElement.getBoundingClientRect();
    }

    if (blockRect.top < scrollRect.top) {
      // If the top of the block is above the scroll element, scroll up.
      scrollElement.scrollTop -= (scrollRect.top - blockRect.top + SCROLL_BUFFER);
    } else if (blockRect.bottom > scrollRect.bottom) {
      // If the bottom of the block is below the scroll element, scroll down.
      scrollElement.scrollTop += (blockRect.bottom - scrollRect.bottom + SCROLL_BUFFER);
    }
  }



  _renderChildren(): Array<React.Element<any>> {
    var block = this.props.block;
    var blockKey = block.getKey();
    var text = block.getText();
    var lastLeafSet = this.props.tree.size - 1;
    var hasSelection = isBlockOnSelectionEdge(this.props.selection, blockKey);

    return this.props.tree.map((leafSet, ii) => {
      var leavesForLeafSet = leafSet.get('leaves');
      var lastLeaf = leavesForLeafSet.size - 1;
      var leaves = leavesForLeafSet.map((leaf, jj) => {
        var offsetKey = DraftOffsetKey.encode(blockKey, ii, jj);
        var start = leaf.get('start');
        var end = leaf.get('end');
        return (
          <DraftEditorLeaf
            key={offsetKey}
            offsetKey={offsetKey}
            block={block}
            start={start}
            selection={hasSelection ? this.props.selection : undefined}
            forceSelection={this.props.forceSelection}
            text={text.slice(start, end)}
            styleSet={block.getInlineStyleAt(start)}
            customStyleMap={this.props.customStyleMap}
            customStyleFn={this.props.customStyleFn}
            isLast={ii === lastLeafSet && jj === lastLeaf}
          />
        );
      }).toArray();

      var decoratorKey = leafSet.get('decoratorKey');
      if (decoratorKey == null) {
        return leaves;
      }

      if (!this.props.decorator) {
        return leaves;
      }

      var decorator = nullthrows(this.props.decorator);

      var DecoratorComponent = decorator.getComponentForKey(decoratorKey);
      if (!DecoratorComponent) {
        return leaves;
      }

      var decoratorProps = decorator.getPropsForKey(decoratorKey);
      var decoratorOffsetKey = DraftOffsetKey.encode(blockKey, ii, 0);
      var decoratedText = text.slice(
        leavesForLeafSet.first().get('start'),
        leavesForLeafSet.last().get('end'),
      );

      // Resetting dir to the same value on a child node makes Chrome/Firefox
      // confused on cursor movement. See http://jsfiddle.net/d157kLck/3/
      var dir = UnicodeBidiDirection.getHTMLDirIfDifferent(
        UnicodeBidi.getDirection(decoratedText),
        this.props.direction,
      );

      return (
        <DecoratorComponent
          {...decoratorProps}
          contentState={this.props.contentState}
          decoratedText={decoratedText}
          dir={dir}
          key={decoratorKey}
          entityKey={block.getEntityAt(leafSet.get('start'))}
          offsetKey={decoratorOffsetKey}>
          {leaves}
        </DecoratorComponent>
      );
    }).toArray();
  }

  render(): React.Element<any> {
    const { direction, offsetKey } = this.props;
    const className = cx({
      'public/DraftStyleDefault/block': true,
      'public/DraftStyleDefault/ltr': direction === 'LTR',
      'public/DraftStyleDefault/rtl': direction === 'RTL',
    });

    return (
      <div
        data-offset-key={offsetKey}
        className={className}
        ref={ref => (this._element = ref)}
      >
        {this._renderChildren()}
      </div>
    );
  }
}

/**
 * Return whether a block overlaps with either edge of the `SelectionState`.
 */
function isBlockOnSelectionEdge(
  selection: SelectionState,
  key: string,
): boolean {
  return (
    selection.getAnchorKey() === key ||
    selection.getFocusKey() === key
  );
}

module.exports = DraftEditorBlock;
