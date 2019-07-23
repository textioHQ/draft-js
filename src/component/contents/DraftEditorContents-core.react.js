/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 * @flow
 * @emails oncall+draft_js
 */

'use strict';

import type {BlockNodeRecord} from 'BlockNodeRecord';
import type {DraftBlockRenderMap} from 'DraftBlockRenderMap';
import type {DraftInlineStyle} from 'DraftInlineStyle';
import type EditorState from 'EditorState';
import type {BidiDirection} from 'UnicodeBidiDirection';

const DraftEditorBlock = require('DraftEditorBlock.react');
const DraftOffsetKey = require('DraftOffsetKey');
const React = require('React');

const cx = require('cx');
const joinClasses: (
  className?: ?string,
  ...classes: Array<?string>
) => string = require('joinClasses');
const nullthrows = require('nullthrows');

type Props = {
  blockRenderMap: DraftBlockRenderMap,
  blockRendererFn: (block: BlockNodeRecord) => ?Object,
  blockStyleFn?: (block: BlockNodeRecord) => string,
  customStyleFn?: (style: DraftInlineStyle, block: BlockNodeRecord) => ?Object,
  customStyleMap?: Object,
  editorKey?: string,
  editorState: EditorState,
  textDirectionality?: BidiDirection,
};

/**
 * Provide default styling for list items. This way, lists will be styled with
 * proper counters and indentation even if the caller does not specify
 * their own styling at all. If more than five levels of nesting are needed,
 * the necessary CSS classes can be provided via `blockStyleFn` configuration.
 */
const getListItemClasses = (
  type: string,
  depth: number,
  shouldResetCount: boolean,
  direction: BidiDirection,
): string => {
  return cx({
    'public/DraftStyleDefault/unorderedListItem':
      type === 'unordered-list-item',
    'public/DraftStyleDefault/orderedListItem': type === 'ordered-list-item',
    'public/DraftStyleDefault/reset': shouldResetCount,
    'public/DraftStyleDefault/depth0': depth === 0,
    'public/DraftStyleDefault/depth1': depth === 1,
    'public/DraftStyleDefault/depth2': depth === 2,
    'public/DraftStyleDefault/depth3': depth === 3,
    'public/DraftStyleDefault/depth4': depth >= 4,
    'public/DraftStyleDefault/listLTR': direction === 'LTR',
    'public/DraftStyleDefault/listRTL': direction === 'RTL',
  });
};

/**
 * `DraftEditorContents` is the container component for all block components
 * rendered for a `DraftEditor`. It is optimized to aggressively avoid
 * re-rendering blocks whenever possible.
 *
 * This component is separate from `DraftEditor` because certain props
 * (for instance, ARIA props) must be allowed to update without affecting
 * the contents of the editor.
 */
class DraftEditorContents extends React.Component<Props> {
  shouldComponentUpdate(nextProps: Props): boolean {
    const prevEditorState = this.props.editorState;
    const nextEditorState = nextProps.editorState;

    const prevDirectionMap = prevEditorState.getDirectionMap();
    const nextDirectionMap = nextEditorState.getDirectionMap();

    // Text direction has changed for one or more blocks. We must re-render.
    if (prevDirectionMap !== nextDirectionMap) {
      return true;
    }

    const didHaveFocus = prevEditorState.getSelection().getHasFocus();
    const nowHasFocus = nextEditorState.getSelection().getHasFocus();

    if (didHaveFocus !== nowHasFocus) {
      return true;
    }

    const nextNativeContent = nextEditorState.getNativelyRenderedContent();

    const wasComposing = prevEditorState.isInCompositionMode();
    const nowComposing = nextEditorState.isInCompositionMode();

    // If the state is unchanged or we're currently rendering a natively
    // rendered state, there's nothing new to be done.
    if (
      prevEditorState === nextEditorState ||
      (nextNativeContent !== null &&
        nextEditorState.getCurrentContent() === nextNativeContent) ||
      (wasComposing && nowComposing)
    ) {
      return false;
    }

    const prevContent = prevEditorState.getCurrentContent();
    const nextContent = nextEditorState.getCurrentContent();
    const prevDecorator = prevEditorState.getDecorator();
    const nextDecorator = nextEditorState.getDecorator();
    return (
      wasComposing !== nowComposing ||
      prevContent !== nextContent ||
      prevDecorator !== nextDecorator ||
      nextEditorState.mustForceSelection()
    );
  }

  render(): React.Node {
    const {
      blockRenderMap,
      blockRendererFn,
      blockStyleFn,
      customStyleMap,
      customStyleFn,
      editorState,
      editorKey,
      textDirectionality,
    } = this.props;

    const content = editorState.getCurrentContent();
    const selection = editorState.getSelection();
    const forceSelection = editorState.mustForceSelection();
    const decorator = editorState.getDecorator();
    const directionMap = nullthrows(editorState.getDirectionMap());

    const blocksAsArray = content.getBlocksAsArray();
    const processedBlocks = [];

    let currentDepth = null;
    let lastWrapperTemplate = null;
    let lastCustomWrapperTemplate = null;

    for (let ii = 0; ii < blocksAsArray.length; ii++) {
      const block = blocksAsArray[ii];
      const key = block.getKey();
      const blockType = block.getType();

      const customRenderer = blockRendererFn(block);
      let CustomComponent, customProps, customEditable, customWrapperTemplate;
      if (customRenderer) {
        CustomComponent = customRenderer.component;
        customProps = customRenderer.props;
        customEditable = customRenderer.editable;
        customWrapperTemplate = customRenderer.wrapperTemplate;
      }

      const direction = textDirectionality
        ? textDirectionality
        : directionMap.get(key);
      const offsetKey = DraftOffsetKey.encode(key, 0, 0);
      const componentProps = {
        contentState: content,
        block,
        blockProps: customProps,
        blockStyleFn,
        customStyleMap,
        customStyleFn,
        decorator,
        direction,
        forceSelection,
        key,
        offsetKey,
        selection,
        tree: editorState.getBlockTree(key),
      };

      const configForType =
        blockRenderMap.get(blockType) || blockRenderMap.get('unstyled');
      const wrapperTemplate = configForType.wrapper;

      const Element =
        configForType.element || blockRenderMap.get('unstyled').element;

      const depth = block.getDepth();
      let className = '';
      if (blockStyleFn) {
        className = blockStyleFn(block);
      }

      // List items are special snowflakes, since we handle nesting and
      // counters manually.
      if (Element === 'li') {
        const shouldResetCount =
          lastWrapperTemplate !== wrapperTemplate ||
          lastCustomWrapperTemplate !== customWrapperTemplate ||
          currentDepth === null ||
          depth > currentDepth;
        className = joinClasses(
          className,
          getListItemClasses(blockType, depth, shouldResetCount, direction),
        );
      }

      const Component = CustomComponent || DraftEditorBlock;
      let childProps = {
        className,
        'data-block': true,
        'data-editor': editorKey,
        'data-offset-key': offsetKey,
        key,
      };
      if (customEditable !== undefined) {
        childProps = {
          ...childProps,
          contentEditable: customEditable,
          suppressContentEditableWarning: true,
        };
      }

      const child = React.createElement(
        Element,
        childProps,
        <Component {...componentProps} />,
      );

      processedBlocks.push({
        block: child,
        key,
        offsetKey,
        wrapperTemplate,
        customWrapperTemplate,
      });

      if (wrapperTemplate || customWrapperTemplate) {
        currentDepth = block.getDepth();
      } else {
        currentDepth = null;
      }
      lastWrapperTemplate = wrapperTemplate;
      lastCustomWrapperTemplate = customWrapperTemplate;
    }

    // Note on code below:
    // processedBlocks will contain all merged blocks
    // For example: header blocks,body blocks,and footer blocks will be merged into processedBlocks (in order)
    // We need to manually group by type (header,body,footer) and apply any custom wrapper.
    // Then we need group those blocks (i.e. header blocks) by any specific wrapping needed internally by Draft (wrapping <li>'s in a <ul>)
    // We then put everything back together at the end (outputBlocks)

    // Group contiguous runs of blocks that have the same wrapperTemplate
    const outputBlocks = [];
    for (let ii = 0; ii < processedBlocks.length; ) {
      const info: any = processedBlocks[ii];

      // Group by customWrapperTemplate (if exists)
      // Note: If we ever want to remove customWrapperTemplates, remove this block
      // customWrapperTemplate will also wrap the internal wrapperTemplate by default
      if (info.customWrapperTemplate) {
        // Group by custom template
        const blocksInCustomWrapper = [];
        do {
          blocksInCustomWrapper.push(processedBlocks[ii]);
          ii++;
        } while (
          ii < processedBlocks.length &&
          processedBlocks[ii].customWrapperTemplate ===
            info.customWrapperTemplate
        );

        const blocksInInternalWrapper = [];
        for (let jj = 0; jj < blocksInCustomWrapper.length; ) {
          const accum = [];
          const blockRef = blocksInCustomWrapper[jj];

          if (blockRef.wrapperTemplate) {
            do {
              accum.push(blocksInCustomWrapper[jj].block);
              jj++;
            } while (
              jj < blocksInCustomWrapper.length &&
              blocksInCustomWrapper[jj].wrapperTemplate === blockRef.wrapperTemplate
            );
            const internalWrapperElement = React.cloneElement(
              blockRef.wrapperTemplate, {
                key: blockRef.key + '-wrap',
                'data-offset-key': blockRef.offsetKey,
              },
              accum,
            );
            blocksInInternalWrapper.push(internalWrapperElement);
          } else {
            blocksInInternalWrapper.push(blockRef.block);
            jj++;
          }
        }

        // Finally wrap the grouped internally-wrapped elements into the customTemplateWrapper
        const customWrapperElement = React.cloneElement(
          info.customWrapperTemplate,
          {
            key: info.key + '-custom-wrap',
            'data-offset-key': info.offsetKey,
          },
          blocksInInternalWrapper,
        );
        outputBlocks.push(customWrapperElement);

        // If there's only a wrapperTemplate (internal wrapper), only group by that
      } else if (info.wrapperTemplate) {
        const blocks = [];
        do {
          blocks.push(processedBlocks[ii].block);
          ii++;
        } while (
          ii < processedBlocks.length &&
          processedBlocks[ii].wrapperTemplate === info.wrapperTemplate
        );
        const wrapperElement = React.cloneElement(
          info.wrapperTemplate,
          {
            key: info.key + '-wrap',
            'data-offset-key': info.offsetKey,
          },
          blocks,
        );
        outputBlocks.push(wrapperElement);
      } else {
        outputBlocks.push(info.block);
        ii++;
      }
    }

    return <div data-contents="true">{outputBlocks}</div>;
  }
}

module.exports = DraftEditorContents;
