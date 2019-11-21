/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule DraftEditorLeaf.react
 * @typechecks
 * @flow
 */

'use strict';

import type {DraftInlineStyle} from 'DraftInlineStyle';
import type SelectionState from 'SelectionState';

var ContentBlock = require('ContentBlock');
const DraftEditorTextNode = require('DraftEditorTextNode.react');
var React = require('React');
var ReactDOM = require('ReactDOM');
const CompositionContext = require('CompositionContext');

const invariant = require('invariant');
var setDraftEditorSelection = require('setDraftEditorSelection');


type Props = {
  // The block that contains this leaf.
  block: ContentBlock,

  // Mapping of style names to CSS declarations.
  customStyleMap: Object,

  // Function that maps style names to CSS style objects.
  customStyleFn: Function,

  // Whether to force the DOM selection after render.
  forceSelection: boolean,

  // Whether this leaf is the last in its block. Used for a DOM hack.
  isLast: boolean,

  offsetKey: string,

  // The current `SelectionState`, used to represent a selection range in the
  // editor
  selection: SelectionState,

  // The offset of this string within its block.
  start: number,

  // The set of style(s) names to apply to the node.
  styleSet: DraftInlineStyle,

  // The full text to be rendered within this node.
  text: string,
};

const doesSelectionMatterWhatsoever = (props: Props): Boolean => {
  const { selection, block, start, text } = props;

  // If selection state is irrelevant to the parent block, return false;
  if (selection == null || !selection.getHasFocus()) {
    return false;
  }

  const blockKey = block.getKey();
  const end = start + text.length;
  if (selection.hasEdgeWithin(blockKey, start, end)) {
    return true;
  }

  return false;
};

/**
 * All leaf nodes in the editor are spans with single text nodes. Leaf
 * elements are styled based on the merging of an optional custom style map
 * and a default style map.
 *
 * `DraftEditorLeaf` also provides a wrapper for calling into the imperative
 * DOM Selection API. In this way, top-level components can declaratively
 * maintain the selection state.
 */
class DraftEditorLeaf extends React.Component {
  static contextType = CompositionContext;

  /**
   * By making individual leaf instances aware of their context within
   * the text of the editor, we can set our selection range more
   * easily than we could in the non-React world.
   *
   * Note that this depends on our maintaining tight control over the
   * DOM structure of the DraftEditor component. If leaves had multiple
   * text nodes, this would be harder.
   */
  _setSelection(): void {
    const {selection, block, start, text} = this.props;
    // // If selection state is irrelevant to the parent block, no-op.
    // if (selection == null || !selection.getHasFocus()) {
    //   return;
    // }

    // const {block, start, text} = this.props;
    // const blockKey = block.getKey();
    // const end = start + text.length;
    // if (!selection.hasEdgeWithin(blockKey, start, end)) {
    //   return;
    // }

    if (!doesSelectionMatterWhatsoever(this.props)) {
      return;
    }

    const isComposing = this.context;
    if (isComposing) {
      return;
    }

    console.log(`DraftEditorLeaf(${this.props.offsetKey})._setSelection:`, selection.toJS());

    const blockKey = block.getKey();
    const end = start + text.length;

    // Determine the appropriate target node for selection. If the child
    // is not a text node, it is a <br /> spacer. In this case, use the
    // <span> itself as the selection target.
    const node = ReactDOM.findDOMNode(this);
    invariant(node, 'Missing node');
    const child = node.firstChild;
    invariant(child, 'Missing child');
    let targetNode;

    if (child.nodeType === Node.TEXT_NODE) {
      targetNode = child;
    } else if (child.tagName === 'BR') {
      targetNode = node;
    } else {
      targetNode = child.firstChild;
      invariant(targetNode, 'Missing targetNode');
    }

    try {
      setDraftEditorSelection(selection, targetNode, blockKey, start, end);
    } catch (e) {
      // Sometimes, setting the selection appears to fail on IE11 with different errors,
      // specifically 800a025e as one example.
      // In general, just catch this error and treat it as non-fatal.
      // Yes, it is unfortunate that the DOM selection will not be correct, but this can be fixed
      // by the user and then the editor can successfully recover.
    }
  }

  shouldComponentUpdate(nextProps: Props): boolean {
    const leafNode = ReactDOM.findDOMNode(this.refs.leaf);
    // const isComposing = this.context;
    invariant(leafNode, 'Missing leafNode');

    // if (isComposing && doesSelectionMatterWhatsoever(nextProps)) {
    //   console.log(`DraftEditorLeaf(${nextProps.offsetKey} IN COMPOSITION).shouldComponentUpdate:`, false);
    //   return false;
    // }

    const result = (
      leafNode.textContent !== nextProps.text ||
      nextProps.styleSet !== this.props.styleSet ||
      nextProps.forceSelection
    );

    // console.log(`DraftEditorLeaf(${nextProps.offsetKey}).shouldComponentUpdate:`, result);
    return result;
  }

  componentDidUpdate(): void {
    this._setSelection();
  }

  componentDidMount(): void {
    this._setSelection();
  }

  render(): React.Element<any> {
    const {block} = this.props;
    let {text} = this.props;

    // If the leaf is at the end of its block and ends in a soft newline, append
    // an extra line feed character. Browsers collapse trailing newline
    // characters, which leaves the cursor in the wrong place after a
    // shift+enter. The extra character repairs this.
    if (text.endsWith('\n') && this.props.isLast) {
      text += '\n';
    }

    const {customStyleMap, customStyleFn, offsetKey, styleSet} = this.props;
    let styleObj = styleSet.reduce((map, styleName) => {
      const mergedStyles = {};
      const style = customStyleMap[styleName];

      if (
        style !== undefined &&
        map.textDecoration !== style.textDecoration
      ) {
        // .trim() is necessary for IE9/10/11 and Edge
        mergedStyles.textDecoration =
          [map.textDecoration, style.textDecoration].join(' ').trim();
      }

      return Object.assign(map, style, mergedStyles);
    }, {});

    if (customStyleFn) {
      const newStyles = customStyleFn(styleSet, block);
      styleObj = Object.assign(styleObj, newStyles);
    }

    return (
      <span
        data-offset-key={offsetKey}
        ref="leaf"
        style={styleObj}>
        <DraftEditorTextNode>{text}</DraftEditorTextNode>
      </span>
    );
  }
}

module.exports = DraftEditorLeaf;
