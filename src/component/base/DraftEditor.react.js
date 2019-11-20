/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule DraftEditor.react
 * @typechecks
 * @flow
 * @preventMunge
 */

'use strict';

import type {BlockMap} from 'BlockMap';
import type {DraftEditorModes} from 'DraftEditorModes';
import type {DraftEditorDefaultProps, DraftEditorProps} from 'DraftEditorProps';
import type {DraftScrollPosition} from 'DraftScrollPosition';

const DefaultDraftBlockRenderMap = require('DefaultDraftBlockRenderMap');
const DefaultDraftInlineStyle = require('DefaultDraftInlineStyle');
const DraftEditorCompositionHandler = require('DraftEditorCompositionHandler');
const DraftEditorContents = require('DraftEditorContents.react');
const DraftEditorDragHandler = require('DraftEditorDragHandler');
const DraftEditorEditHandler = require('DraftEditorEditHandler');
const DraftEditorEditAndroidHandler = require('DraftEditorEditAndroidHandler');
const DraftEditorCompositionHandlerAndroid = require('DraftEditorCompositionHandlerAndroid');
const DraftEditorPlaceholder = require('DraftEditorPlaceholder.react');
const CompositionContextProvider = require('CompositionContextProvider');
const EditorState = require('EditorState');
const React = require('React');
const ReactDOM = require('ReactDOM');
const Scroll = require('Scroll');
const Style = require('Style');
const UserAgent = require('UserAgent');

const cx = require('cx');
const emptyFunction = require('emptyFunction');
const generateRandomKey = require('generateRandomKey');
const getDefaultKeyBinding = require('getDefaultKeyBinding');
const editOnSelect = require('editOnSelect');

const getScrollPosition = require('getScrollPosition');
const invariant = require('invariant');
const nullthrows = require('nullthrows');
const areLevel2InputEventsSupported = require('areLevel2InputEventsSupported');

const isIE = UserAgent.isBrowser('IE');
const isAndroid = UserAgent.isPlatform('Android');
const isWebKit = UserAgent.isEngine('WebKit');
// IE does not support the `input` event on contentEditable, so we can't
// observe spellcheck behavior.
const allowSpellCheck = !isIE;

// Define a set of handler objects to correspond to each possible `mode`
// of editor behavior.
const handlerMap = {
  'edit': isAndroid ? DraftEditorEditAndroidHandler : DraftEditorEditHandler,
  'composite': isAndroid ? DraftEditorCompositionHandlerAndroid : DraftEditorCompositionHandler,
  'drag': DraftEditorDragHandler,
  'cut': null,
  'copy': null,
  'render': null,
  'paste': null,
};

type State = {
  contentsKey: number,
};

/**
 * `DraftEditor` is the root editor component. It composes a `contentEditable`
 * div, and provides a wide variety of useful function props for managing the
 * state of the editor. See `DraftEditorProps` for details.
 */
class DraftEditor extends React.Component {
  props: DraftEditorProps;
  state: State;

  static defaultProps: DraftEditorDefaultProps = {
    blockRenderMap: DefaultDraftBlockRenderMap,
    blockRendererFn: emptyFunction.thatReturnsNull,
    blockStyleFn: emptyFunction.thatReturns(''),
    keyBindingFn: getDefaultKeyBinding,
    readOnly: false,
    spellCheck: false,
    stripPastedStyles: false,
  };

  _blockSelectEvents: boolean;
  _clipboard: ?BlockMap;
  _handler: ?Object;
  _dragCount: number;
  _internalDrag: boolean;
  _editorKey: string;
  _editor: React.Element<any>;
  _placeholderAccessibilityID: string;
  _latestEditorState: EditorState;
  _renderNativeContent: boolean;
  _updatedNativeInsertionBlock: boolean;
  _latestCommittedEditorState: EditorState;
  _useNativeBeforeInput: boolean;

  /**
   * Define proxies that can route events to the current handler.
   */
  _onBeforeInput: Function;
  _onBlur: Function;
  _onCharacterData: Function;
  _onCompositionEnd: Function;
  _onCompositionUpdate: Function;
  _onCompositionStart: Function;
  _onCopy: Function;
  _onCut: Function;
  _onDragEnd: Function;
  _onDragOver: Function;
  _onDragStart: Function;
  _onDrop: Function;
  _onInput: Function;
  _onFocus: Function;
  _onKeyDown: Function;
  _onKeyPress: Function;
  _onKeyUp: Function;
  _onMouseDown: Function;
  _onMouseUp: Function;
  _onPaste: Function;
  _onSelect: Function;

  focus: () => void;
  blur: () => void;
  setMode: (mode: DraftEditorModes) => void;
  exitCurrentMode: () => void;
  restoreEditorDOM: (scrollPosition?: DraftScrollPosition) => void;
  setClipboard: (clipboard: ?BlockMap) => void;
  getClipboard: () => ?BlockMap;
  getEditorKey: () => string;
  update: (editorState: EditorState) => void;
  onDragEnter: () => void;
  onDragLeave: () => void;

  constructor(props: DraftEditorProps) {
    super(props);

    this._useNativeBeforeInput = isAndroid || (props.useNativeBeforeInputIfAble && areLevel2InputEventsSupported());

    this._blockSelectEvents = false;
    this._clipboard = null;
    this._handler = null;
    this._dragCount = 0;
    this._editorKey = props.editorKey || generateRandomKey();
    this._placeholderAccessibilityID = 'placeholder-' + this._editorKey;
    this._latestEditorState = props.editorState;
    this._latestCommittedEditorState = props.editorState;

    this._onBeforeInput = this._buildHandler('onBeforeInput');
    this._onBlur = this._buildHandler('onBlur');
    this._onCharacterData = this._buildHandler('onCharacterData');
    this._onCompositionEnd = this._buildHandler('onCompositionEnd');
    this._onCompositionStart = this._buildHandler('onCompositionStart');
    this._onCompositionUpdate = this._buildHandler('onCompositionUpdate');
    this._onCopy = this._buildHandler('onCopy');
    this._onCut = this._buildHandler('onCut');
    this._onDragEnd = this._buildHandler('onDragEnd');
    this._onDragOver = this._buildHandler('onDragOver');
    this._onDragStart = this._buildHandler('onDragStart');
    this._onDrop = this._buildHandler('onDrop');
    this._onInput = this._buildHandler('onInput');
    this._onFocus = this._buildHandler('onFocus');
    this._onKeyDown = this._buildHandler('onKeyDown');
    this._onKeyPress = this._buildHandler('onKeyPress');
    this._onKeyUp = this._buildHandler('onKeyUp');
    this._onMouseDown = this._buildHandler('onMouseDown');
    this._onMouseUp = this._buildHandler('onMouseUp');
    this._onPaste = this._buildHandler('onPaste');
    this._onSelect = this._buildHandler('onSelect');

    this._setEditorRef = this._setEditorRef.bind(this);

    // Manual binding for public and internal methods.
    this.focus = this._focus.bind(this);
    this.blur = this._blur.bind(this);
    this.setMode = this._setMode.bind(this);
    this.exitCurrentMode = this._exitCurrentMode.bind(this);
    this.restoreEditorDOM = this._restoreEditorDOM.bind(this);
    this.setClipboard = this._setClipboard.bind(this);
    this.getClipboard = this._getClipboard.bind(this);
    this.getEditorKey = () => this._editorKey;
    this.update = this._update.bind(this);
    this.silentlyUpdate = this._silentlyUpdate.bind(this);
    this.onDragEnter = this._onDragEnter.bind(this);
    this.onDragLeave = this._onDragLeave.bind(this);

    // See `_restoreEditorDOM()`.
    this.state = {contentsKey: 0};
  }

  /**
   * Build a method that will pass the event to the specified handler method.
   * This allows us to look up the correct handler function for the current
   * editor mode, if any has been specified.
   */
  _buildHandler(eventName: string): Function {
    return (e) => {
      if (!this.props.readOnly) {
        const method = this._handler && this._handler[eventName];
        method && method(this, e);
      } else if (eventName === 'onCopy') {
        // React does not fire onSelect for readonly divs (aka non-content-editable divs). If a user
        // selects some text and hits 'copy' nothing will be copied because the selectState contains
        // nothing :( Call editOnSelect to force the actual DOM selection onto the editor and then
        // allow the normal copy method to do its thing.
        editOnSelect(this);
        const method = this._handler && this._handler[eventName];
        method && method(this, e);
      }
    };
  }

  _showPlaceholder(): boolean {
    return (
      !!this.props.placeholder &&
      !this.props.editorState.isInCompositionMode() &&
      !this.props.editorState.getCurrentContent().hasText()
    );
  }

  _renderPlaceholder(): ?React.Element<any> {
    if (this._showPlaceholder()) {
      return (
        <DraftEditorPlaceholder
          text={nullthrows(this.props.placeholder)}
          editorState={this.props.editorState}
          textAlignment={this.props.textAlignment}
          accessibilityID={this._placeholderAccessibilityID}
        />
      );
    }
    return null;
  }

  _setEditorRef(ref: React.Element<any>): void {
    // Unfortunately, due to https://github.com/facebook/react/issues/8909
    // it is not possible to set up an onPaste handler through react.
    // Manually use addEventListener and removeEventListener below.
    // See the comments in editOnPaste for why this is needed.
    //
    // We also provide an option to manually manage our own onBeforeInput handler
    // without going through React. React polyfills this event using `textInput`/`keypress`,
    // but doesn't use the natively-available event when it can (see https://github.com/facebook/react/issues/11211)
    // In rare circumstances, we want to provide the option to force the use of the native
    // `beforeinput`, event. Slate does something similar https://github.com/ianstormtaylor/slate/commit/f812816b7dcb2d4b2efa0d4ba12d4feac31850c9
    if (this._editor) {
      const editorNode = ReactDOM.findDOMNode(this._editor);
      editorNode.removeEventListener('paste', this._onPaste);
      if (this._useNativeBeforeInput) {
        editorNode.removeEventListener('beforeinput', this._onBeforeInput);
      }
    }

    this._editor = ref;
    if (this._editor) {
      const editorNode = ReactDOM.findDOMNode(this._editor);

      editorNode.addEventListener('paste', this._onPaste);
      if (this._useNativeBeforeInput) {
        editorNode.addEventListener('beforeinput', this._onBeforeInput);
      }

      // Add ignore attribute for an IESpell, an obscure plugin that doesn't respect spellcheck="false" on a
      // contenteditable div
      editorNode.setAttribute('ieSpell_ignored', 'true');
    }
  }

  render(): React.Element<any> {
    const {readOnly, textAlignment} = this.props;
    const rootClass = cx({
      'DraftEditor/root': true,
      'DraftEditor/alignLeft': textAlignment === 'left',
      'DraftEditor/alignRight': textAlignment === 'right',
      'DraftEditor/alignCenter': textAlignment === 'center',
    });

    const contentStyle = {
      outline: 'none',
      whiteSpace: 'pre-wrap',
      wordWrap: 'break-word',
      // Ensures that the native iOS text editing tooltip doesn't show up inside the contenteditable
      ...(isWebKit && !readOnly && {
        WebkitUserModify: 'read-write-plaintext-only',
      }),
    };

    const trapDivStyle = {
      maxWidth: '1px',
      maxHeight: '1px',
      overflow: 'hidden',
      position: 'fixed',
      opacity: '0.01',
      left: '-999px',
      top: '0px',
    };

    return (
      <div className={rootClass}>
        {this._renderPlaceholder()}
        <div
          className={cx('DraftEditor/editorContainer')}
          ref="editorContainer">
          <div
            aria-activedescendant={
              readOnly ? null : this.props.ariaActiveDescendantID
            }
            aria-autocomplete={readOnly ? null : this.props.ariaAutoComplete}
            aria-describedby={
              this._showPlaceholder() ? this._placeholderAccessibilityID : null
            }
            aria-expanded={readOnly ? null : this.props.ariaExpanded}
            aria-haspopup={readOnly ? null : this.props.ariaHasPopup}
            aria-label={this.props.ariaLabel}
            aria-owns={readOnly ? null : this.props.ariaOwneeID}
            autoCapitalize={this.props.autoCapitalize}
            autoComplete={this.props.autoComplete}
            autoCorrect={this.props.autoCorrect}
            className={cx({
              // Chrome's built-in translation feature mutates the DOM in ways
              // that Draft doesn't expect (ex: adding <font> tags inside
              // DraftEditorLeaf spans) and causes problems. We add notranslate
              // here which makes its autotranslation skip over this subtree.
              'notranslate': !readOnly,
              'public/DraftEditor/content': true,
            })}
            contentEditable={!readOnly}
            data-testid={this.props.webDriverTestID}
            onBeforeInput={this._useNativeBeforeInput ? undefined : this._onBeforeInput}
            onBlur={this._onBlur}
            onCompositionEnd={this._onCompositionEnd}
            onCompositionStart={this._onCompositionStart}
            onCompositionUpdate={this._onCompositionUpdate}
            onCopy={this._onCopy}
            onCut={this._onCut}
            onDragEnd={this._onDragEnd}
            onDragEnter={this.onDragEnter}
            onDragLeave={this.onDragLeave}
            onDragOver={this._onDragOver}
            onDragStart={this._onDragStart}
            onDrop={this._onDrop}
            onFocus={this._onFocus}
            onInput={this._onInput}
            onKeyDown={this._onKeyDown}
            onKeyPress={this._onKeyPress}
            onKeyUp={this._onKeyUp}
            onMouseUp={this._onMouseUp}
            onSelect={this._onSelect}
            ref={this._setEditorRef}
            role={readOnly ? null : (this.props.role || 'textbox')}
            spellCheck={allowSpellCheck && this.props.spellCheck}
            style={contentStyle}
            suppressContentEditableWarning
            tabIndex={this.props.tabIndex}>
            <CompositionContextProvider editorState={this.props.editorState}>
              <DraftEditorContents
                blockRenderMap={this.props.blockRenderMap}
                blockRendererFn={this.props.blockRendererFn}
                blockStyleFn={this.props.blockStyleFn}
                customStyleMap={
                  {...DefaultDraftInlineStyle, ...this.props.customStyleMap}
                }
                customStyleFn={this.props.customStyleFn}
                editorKey={this._editorKey}
                editorState={this.props.editorState}
                key={'contents' + this.state.contentsKey}
                textDirectionality={this.props.textDirectionality}
              />
            </CompositionContextProvider>
          </div>
        </div>
        <div
          contentEditable={true}
          style={trapDivStyle}
          ref={ref => this._pasteTrap = ref }
          suppressContentEditableWarning>
        </div>
        <div
          contentEditable={true}
          style={trapDivStyle}
          ref={ref => this._copyTrap = ref }
          suppressContentEditableWarning>
        </div>
      </div>
    );
  }

  componentDidMount(): void {
    this.setMode('edit');

    /**
     * IE has a hardcoded "feature" that attempts to convert link text into
     * anchors in contentEditable DOM. This breaks the editor's expectations of
     * the DOM, and control is lost. Disable it to make IE behave.
     * See: http://blogs.msdn.com/b/ieinternals/archive/2010/09/15/
     * ie9-beta-minor-change-list.aspx
     */
    if (isIE) {
      document.execCommand('AutoUrlDetect', false, false);
    }
  }

  /**
   * Prevent selection events from affecting the current editor state. This
   * is mostly intended to defend against IE, which fires off `selectionchange`
   * events regardless of whether the selection is set via the browser or
   * programmatically. We only care about selection events that occur because
   * of browser interaction, not re-renders and forced selections.
   */
  componentWillUpdate(nextProps: DraftEditorProps): void {
    this._blockSelectEvents = true;
    this._latestEditorState = nextProps.editorState;
  }

  componentDidUpdate(): void {
    this._blockSelectEvents = false;
    this._latestCommittedEditorState = this.props.editorState;
  }

  /**
   * Used via `this.focus()`.
   *
   * Force focus back onto the editor node.
   *
   * Forcing focus causes the browser to scroll to the top of the editor, which
   * may be undesirable when the editor is taller than the viewport. To solve
   * this, either use a specified scroll position (in cases like `cut` behavior
   * where it should be restored to a known position) or store the current
   * scroll state and put it back in place after focus has been forced.
   */
  _focus(scrollPosition?: DraftScrollPosition): void {
    const editorState = this._latestEditorState;
    const alreadyHasFocus = editorState.getSelection().getHasFocus();
    const editorNode = ReactDOM.findDOMNode(this._editor);

    const scrollParent = Style.getScrollParent(editorNode);
    const originalScrollPosition = getScrollPosition(scrollParent);
    const originalMarginTop = Style.get(editorNode, 'marginTop');
    const {x, y} = scrollPosition || originalScrollPosition;

    if (isIE) {
      // IE will briefly scroll a content editable element to the top and back
      // when it is given focus programmatically. To account for this we must
      // first scroll it to the top but pretend that it hasn't using the margin.
      editorNode.style.marginTop = `${-originalScrollPosition.y}px`;
      Scroll.setTop(scrollParent, 0);
    }

    invariant(
      editorNode instanceof HTMLElement,
      'editorNode is not an HTMLElement',
    );
    editorNode.focus();

    if (isIE) {
      // Reset the margin
      editorNode.style.marginTop = originalMarginTop;
    }

    if (scrollParent === window) {
      window.scrollTo(x, y);
    } else {
      Scroll.setTop(scrollParent, y);
    }

    // On Chrome and Safari, calling focus on contenteditable focuses the
    // cursor at the first character. This is something you don't expect when
    // you're clicking on an input element but not directly on a character.
    // Put the cursor back where it was before the blur.
    if (!alreadyHasFocus) {
      this.update(
        EditorState.forceSelection(
          editorState,
          editorState.getSelection(),
        ),
      );
    }
  }

  _blur(): void {
    const editorNode = ReactDOM.findDOMNode(this.refs.editor);
    invariant(
      editorNode instanceof HTMLElement,
      'editorNode is not an HTMLElement',
    );
    editorNode.blur();
  }

  /**
   * Used via `this.setMode(...)`.
   *
   * Set the behavior mode for the editor component. This switches the current
   * handler module to ensure that DOM events are managed appropriately for
   * the active mode.
   */
  _setMode(mode: DraftEditorModes): void {
    this._handler = handlerMap[mode];
  }

  _exitCurrentMode(): void {
    this.setMode('edit');
  }

  /**
   * Used via `this.restoreEditorDOM()`.
   *
   * Force a complete re-render of the DraftEditorContents based on the current
   * EditorState. This is useful when we know we are going to lose control of
   * the DOM state (cut command, IME) and we want to make sure that
   * reconciliation occurs on a version of the DOM that is synchronized with
   * our EditorState.
   */
  _restoreEditorDOM(scrollPosition?: DraftScrollPosition): void {
    this.setState({contentsKey: this.state.contentsKey + 1}, () => {
      this._focus(scrollPosition);
    });
  }

  /**
   * Used via `this.setClipboard(...)`.
   *
   * Set the clipboard state for a cut/copy event.
   */
  _setClipboard(clipboard: ?BlockMap): void {
    this._clipboard = clipboard;
  }

  /**
   * Used via `this.getClipboard()`.
   *
   * Retrieve the clipboard state for a cut/copy event.
   */
  _getClipboard(): ?BlockMap {
    return this._clipboard;
  }

  /**
   * Used via `this.update(...)`.
   *
   * Propagate a new `EditorState` object to higher-level components. This is
   * the method by which event handlers inform the `DraftEditor` component of
   * state changes. A component that composes a `DraftEditor` **must** provide
   * an `onChange` prop to receive state updates passed along from this
   * function.
   */
  _update(editorState: EditorState, renderNativeContent: boolean = false): void {
    this._renderNativeContent = renderNativeContent;
    this._latestEditorState = editorState;
    this.props.onChange(editorState);
  }

  /**
   * If changes to upstream editor state are triggered by Draft *plugins*, they
   * bypass `this.update` (which updates `this._latestEditorState`). However,
   * `@textio/editor` treats `this._latestEditorState` as a source of truth. To
   * avoid getting out of sync, plugins/editor can call `this._silentlyUpdate`
   * after updating state.
   */
  _silentlyUpdate(editorState: EditorState): void {
    this._latestEditorState = editorState;
  }

  /**
   * Used in conjunction with `_onDragLeave()`, by counting the number of times
   * a dragged element enters and leaves the editor (or any of its children),
   * to determine when the dragged element absolutely leaves the editor.
   */
  _onDragEnter(): void {
    this._dragCount++;
  }

  /**
   * See `_onDragEnter()`.
   */
  _onDragLeave(): void {
    this._dragCount--;
    if (this._dragCount === 0) {
      this.exitCurrentMode();
    }
  }
}

module.exports = DraftEditor;
