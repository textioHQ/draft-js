/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule Draft
 */

'use strict';

var React = require('react');
var ReactDom = require('react-dom');

var SimpleEditor = require('./editor.js').SimpleEditor;

ReactDom.render(<SimpleEditor />, document.getElementById('react-content'));
