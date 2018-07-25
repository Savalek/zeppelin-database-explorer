
// ---------------------   jsTree - license    ------------------------
//                                                 -------- MIT license
// https://www.jstree.com/
// Copyright (c) 2014 Ivan Bozhanov
//
// Permission is hereby granted, free of charge, to any person
// obtaining a copy of this software and associated documentation
// files (the "Software"), to deal in the Software without
// restriction, including without limitation the rights to use,
//     copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the
// Software is furnished to do so, subject to the following
// conditions:
//
//     The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
//     THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
//     EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
// OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
// HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
//     WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
// OTHER DEALINGS IN THE SOFTWARE.

import {
    SpellBase,
    SpellResult,
    DefaultDisplayType,
} from 'zeppelin-spell';

import jstree from 'jstree';

window.db_explorer = null;
let jstreeDOM;
let contentDOM;
let notebookController = null;
let SEARCH_PARAM = null;

let databases = [];
let currentDatabase = null;
let SERVER_URL = 'http://' + document.location.href.split('/')[2] + '/api/metadatacache/jstree';

export default class DBExplorerSpell extends SpellBase {
    constructor(config) {
        super("%db_explorer");
        injectCSS();
        explorer_init();
    }

    interpret(paragraphText, config) {
        let superConfig = this.getConfig(config);
        return new SpellResult('');
    }
}

function explorer_init() {
    db_explorer = createExplorer();
    angular.element(document.body).append(db_explorer);
    createObserver(db_explorer);
    db_explorer = db_explorer[0];

    databaseServerRequest("/databases_list", function (responseText) {
        let answer = JSON.parse(responseText).body;
        answer.forEach(e => databases.push(e));
        currentDatabase = databases[0];
        explorerTreeInit();
        createOnDestroyListener();
    });

    databaseServerRequest("/get_search_limit", function (responseText) {
        let max_element = parseInt(responseText);
        SEARCH_PARAM = {
            'MAX_DISPLAYED_ELEMENTS': max_element,
            'CURRENT_DISPLAYED': 0
        };
    })
}

function addShowDBExplorerButton() {
    $('#actionbar > headroom > h3 > div:nth-child(2) > span:nth-child(1)').append(`
    <button type="button" class="btn btn-default btn-xs" onclick="dbExplorerToggleDisplay()" title="Show/Hide Database Explorer">
        <i class="icon-layers"></i>
    </button>
    `);
}

function databaseServerRequest(request, callback) {
    let xhr = new XMLHttpRequest();
    xhr.open('GET', SERVER_URL + request, true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState !== XMLHttpRequest.DONE) return;
        callback(xhr.responseText);
    };
    xhr.send();
}

function createOnDestroyListener() {
    let target = document.querySelector('html');
    let observer = new MutationObserver(function (mutations) {
        try {
            if (notebookController) {
                return;
            }
            addShowDBExplorerButton();
            notebookController = angular.element($('.notebookContent')[0]).scope();
            contentDOM = $('#content')[0];
            notebookController.$on('$destroy', () => {
                hideDBExplorer();
                notebookController = null;
                createOnDestroyListener();
            })
        } catch (e) {
        }
        if (notebookController && contentDOM) {
            showDBExplorer();
            this.disconnect();
        }

    });
    observer.observe(target, {childList: true});
}

function showDBExplorer() {
    db_explorer.style.display = 'flex';
    db_explorer.style.width = '300px';
    contentDOM.style.marginLeft = '310px';
}

function hideDBExplorer() {
    db_explorer.style.display = 'none';
    contentDOM.style.marginLeft = "0px";
}

window.dbExplorerToggleDisplay = function () {
    if (db_explorer.style.display === 'none' || db_explorer.style.display === '') {
        showDBExplorer();
    } else {
        hideDBExplorer();
    }
};

window.dbExplorerSearch = function (event) {
    if (event) {
        let key = event.which || event.keyCode;
        if (key !== 13) {
            return;
        }
    }
    let text = $('#inputJstreeSearch')[0].value;
    jstreeDOM.jstree(true).clear_search();
    jstreeDOM.jstree(true).close_all();
    jstreeDOM.jstree(true).refresh();
    showMaxSearchElementBlock(false);
    if (text !== "") {
        jstreeDOM.jstree(true).search(text);
    }
};

window.dbExplorerChangeHeight = function (px) {
    let currentSize = px;
    if (currentSize < 257) {
        currentSize = 257;
    }
    if (currentSize > 650) {
        currentSize = 650;
    }
    db_explorer.style.width = currentSize + "px";
    $('#content')[0].style.marginLeft = (currentSize + 10) + "px";
};

window.dbExplorerChangeDatabase = function (name) {
    if (currentDatabase === name) {
        return;
    }
    /*    let newURL = SERVER_URL + 'database=' + name;
        jstreeDOM.jstree(true).settings.core.data.url = newURL;
        jstreeDOM.jstree(true).settings.massload.url = newURL;*/

    showMaxSearchElementBlock(false);

    currentDatabase = name;

    jstreeDOM.jstree(true).settings.search.ajax.url = SERVER_URL + '/search?database=' + currentDatabase;

    jstreeDOM.jstree(true).close_all();
    jstreeDOM.jstree(true).refresh();
};

let dbExplorerResizerMouseDown = false;

window.dbExplorerMouseMove = function (event) {
    if (!dbExplorerResizerMouseDown) {
        return;
    }
    dbExplorerChangeHeight(event.clientX);
};

window.dbExplorerMouseDown = function (event) {
    dbExplorerResizerMouseDown = true;
    db_explorer.style.transition = "none";
};

$(document).mousemove(dbExplorerMouseMove);

$(document).mouseup(function () {
    dbExplorerResizerMouseDown = false;
    db_explorer.style.transition = "all .2s ease-in-out";
});

function explorerTreeInit() {
    let local$ = require('jquery');
    jstreeDOM = local$('#jstree');

    let databaseSelect = document.getElementById("databaseSelect");
    databases.forEach(function (databaseName) {
        let option = document.createElement("option");
        option.text = databaseName;
        databaseSelect.add(option);
    });

    let initServerURL = SERVER_URL + 'database=' + currentDatabase;
    jstreeDOM.jstree({
        'plugins': ['json_data', 'types', 'dnd', 'search', 'massload', 'contextmenu', 'sort'],
        'types': {
            'column': {
                'icon': 'glyphicon glyphicon-tag my-glyphicon-color-tag',
                'a_attr': { 'style': 'font-family: monospace' }
            },
            'table': {
                'icon': 'glyphicon glyphicon-list-alt my-glyphicon-color-alt'
            },
            'schema': {
                'icon': 'glyphicon glyphicon-tasks my-glyphicon-color-tasks'
            }
        },
        'sort': function (nodeId1, nodeId2) {
            let jsTree = jstreeDOM.jstree(true);
            let node1 = jsTree.get_node(nodeId1).original;
            let node2 = jsTree.get_node(nodeId2).original;
            if (node1.type === 'schema' && node2.type === 'schema') {
                return new Intl.Collator().compare(node1.text, node2.text);
            }
        },
        'massload': {
            'url': SERVER_URL + '/massload',
            'data': function (nodes) {
                return {
                    'ids': nodes.join(','),
                    'database': currentDatabase
                };
            }
        },
        'core': {
            'animation': 0,
            'worker': false,
            // 'force_text': true,
            'check_callback': function () {
                return false;
            },
            'data': {
                'url': SERVER_URL + '/get_children',
                'data': function (node) {
                    let req = {
                        'id': node.id,
                        'type': node.type,
                        'database': currentDatabase
                    };
                    if (node.type === "table") {
                        req['schemaId'] = node.parent;
                    }
                    return req;
                }
            }
        },
        'search': {
            'show_only_matches': true,
            'ajax': {
                'url': SERVER_URL + '/search?database=' + currentDatabase
            },
            'search_callback': function (str, node) {
                if (SEARCH_PARAM.CURRENT_DISPLAYED <= SEARCH_PARAM.MAX_DISPLAYED_ELEMENTS) {
                    if (node.text.split(' ')[0].indexOf(str) !== -1) {
                        SEARCH_PARAM.CURRENT_DISPLAYED++;
                        return true;
                    }
                }
                return false;
            }
        },
        'contextmenu': {
            'items': {
                'reload': {
                    'label': () => jstreeDOM.jstree("get_selected").length === 1 ? 'Reload element' : 'Reload selected elements',
                    'action': function (obj) {
                        let selectedIds = jstreeDOM.jstree("get_selected");
                        selectedIds.forEach(function (id) {
                            let elem = jstreeDOM.jstree(true).get_node(id);
                            if (elem.type === 'column') {
                                return;
                            }
                            let request = "/refresh_element?database=" + currentDatabase;
                            request += "&id=" + elem.id;
                            if (elem.type === 'table') {
                                request += "&schemaId=" + elem.parent;
                            }
                            databaseServerRequest(request, function () {
                                jstreeDOM.jstree(true).refresh_node(elem);
                            });
                        });

                    },
                    '_disabled': function (obj) {
                        let elem = jstreeDOM.jstree(true).get_node(obj.reference[0]);
                        if (elem.type === 'column') {
                            return true;
                        }
                    }
                },
                'reload_rec': {
                    'label': 'Reload recursively',
                    'action': function (obj) {
                        let elem = jstreeDOM.jstree(true).get_node(obj.reference[0]);
                        let request = "/refresh_element?database=" + currentDatabase;
                        request += "&id=" + elem.id;
                        request += "&recursively=" + true;
                        databaseServerRequest(request, function () {
                            jstreeDOM.jstree(true).refresh_node(elem);
                        });
                    },
                    '_disabled': function (obj) {
                        if (jstreeDOM.jstree("get_selected").length !== 1) {
                            return true;
                        }
                        let elem = jstreeDOM.jstree(true).get_node(obj.reference[0]);
                        if (elem.type !== 'schema') {
                            return true;
                        }
                    }
                }
            }
        }
    }).on('open_node.jstree', function (event, data) {
        data.node.children.forEach(addCommentBlock);
    }).on('redraw.jstree', function (event, data) {
        data.nodes.forEach(addCommentBlock);
    }).on('search.jstree', function (event, data) {
        let limitExceeded = SEARCH_PARAM.CURRENT_DISPLAYED >= SEARCH_PARAM.MAX_DISPLAYED_ELEMENTS;
        showMaxSearchElementBlock(limitExceeded);
        SEARCH_PARAM.CURRENT_DISPLAYED = 0;
    }).on('load_node.jstree', function (event, data) {

        if (data.node.original && data.node.original.type === 'table') {
            let nodes = data.node.children.map(id => jstreeDOM.jstree(true).get_node(id));
            let maxLength = Math.max.apply(null, nodes.map(node => node.text.length)) + 3;
            nodes.forEach(function (node) {
                let spaces = ' '.repeat(maxLength - node.original.text.length);
                node.text = node.original.text + spaces + '<span class = "column-type-span">' + node.original.value_type + '</span>';
            });
        }
    });
    local$(document).on('dnd_stop.vakata', function (data, element) {
        pasteSelectInElement(element.event.target, element.data.nodes, element.event.ctrlKey);
    });
    local$(document).on('dnd_move.vakata', function () {
        $('#jstree-dnd > i').remove();
    });
}

function showMaxSearchElementBlock(show) {
    if (show) {
        $("#jstreeMaxElementDiv")[0].style.visibility = "visible";
    } else {
        $("#jstreeMaxElementDiv")[0].style.visibility = "collapse";
    }
}

function pasteSelectInElement(element, nodesIds, ctrlKey) {
    let paragraphScope = angular.element(element.closest(".paragraph")).scope();
    if (!paragraphScope) {
        return;
    }
    let aceEditor = paragraphScope.editor;
    if (!aceEditor) {
        return;
    }
    if (element.className !== 'ace_content') {
        return;
    }
    let textToPasteInEditor;

    if (nodesIds.length === 1 && !ctrlKey) {
        let node = jstreeDOM.jstree(true).get_node(nodesIds[0]);
        if (node.type === "column") {
            textToPasteInEditor = node.text.split(' ')[0];
        } else {
            textToPasteInEditor = getNameWithParent(nodesIds[0]);
        }
    }
    if (nodesIds.length > 1 && !ctrlKey) {
        textToPasteInEditor = stringListOfNodes(nodesIds, true);
    }
    if (nodesIds.length >= 1 && ctrlKey) {
        textToPasteInEditor = generateAndPasteSQLSelect(aceEditor, nodesIds);
        return;
    }

    if (!textToPasteInEditor) {
        return;
    }
    aceEditor.session.insert(aceEditor.getCursorPosition(), textToPasteInEditor);
}

function generateAndPasteSQLSelect(aceEditor, nodesIds) {
    let tablesIds = new Set();
    let columnsIds = new Set();
    nodesIds.forEach(function (id) {
        let node = jstreeDOM.jstree(true).get_node(id);

        switch (node.original.type) {

            case 'table':
                tablesIds.add(id);
                node.children.forEach(childId => columnsIds.add(childId));
                break;

            case 'column':
                columnsIds.add(id);
                let nodeParent = jstreeDOM.jstree(true).get_node(node.parent);
                tablesIds.add(nodeParent.id);
                break;
        }
    });
    tablesIds = Array.from(tablesIds);
    let needToLoadChildren = false;

    tablesIds.forEach(function loadChildren(id) {
        if (!jstreeDOM.jstree(true).is_loaded(id)) {
            needToLoadChildren = true;
            jstreeDOM.jstree(true).load_node(id, function callback(node) {
                node.children.forEach(childId => columnsIds.add(childId));
                let allLoaded = true;
                for (let i = 0; i < tablesIds.length && allLoaded; i++) {
                    allLoaded = jstreeDOM.jstree(true).is_loaded(tablesIds[i]);
                }
                if (!allLoaded) {
                    return;
                }
                pasteSelect();
            });
        }
    });

    if (!needToLoadChildren) {
        pasteSelect();
    }

    function pasteSelect() {
        let select = 'SELECT ' + stringListOfNodes(columnsIds) + '\n';
        select += 'FROM ' + stringListOfNodes(tablesIds);
        aceEditor.session.insert(aceEditor.getCursorPosition(), select);
    }
}

function stringListOfNodes(nodesIds, columnsWithoutTable) {
    let list = [];
    nodesIds.forEach(function (id) {
        if (columnsWithoutTable) {
            let node = jstreeDOM.jstree(true).get_node(id);
            if (node.type === "column") {
                list.push(node.text.split(' ')[0]);
                return;
            }
        }

        list.push(getNameWithParent(id));
    });
    return list.join(", ");
}

function getNameWithParent(nodeId) {
    let node = jstreeDOM.jstree(true).get_node(nodeId);
    let nodeParent = jstreeDOM.jstree(true).get_node(node.parent);
    let result;

    switch (node.original.type) {

        case 'schema':
            result = node.text;
            break;

        case 'table':
            result = nodeParent.text + '.' + node.text;
            break;

        case 'column':
            result = nodeParent.text + '.' + node.text.split(' ')[0];
            break;
    }

    return result;
}

function addCommentBlock(id) {
    if (!jstreeDOM.jstree(true).get_node(id).original) {
        return;
    }
    let commentText = jstreeDOM.jstree(true).get_node(id).original.description;
    if (!commentText) {
        return;
    }
    let nodeDOM = jstreeDOM.jstree(true).get_node(id, true);
    if (nodeDOM.length === 0) {
        return;
    }
    let info = document.createElement('i');
    info.className = "glyphicon glyphicon-info-sign my-glyphicon-color-comment";
    info.style.paddingLeft = "10px";
    info.setAttribute('title', commentText);
    nodeDOM["0"].children["1"].append(info);

    let node = jstreeDOM.jstree(true).get_node(id);
    if (node.children.length !== 0) {
        node.children.forEach(id => addCommentBlock(id));
    }
}

function createObserver(explorer) {
    const navBar = document.querySelector('headroom[class^="navbar"]');
    let observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            const isUnpinned = mutation.target.classList.contains('headroom--unpinned');
            if (isUnpinned) {
                explorer.addClass('db-explorer-full-size');
            } else {
                explorer.removeClass('db-explorer-full-size');
            }
        });
    });
    observer.observe(navBar, {attributes: true});
}


function createExplorer() {
    return $(`
<div class="db-explorer box">



    <div class="form-group">
        <select class="form-control" id="databaseSelect" onchange="dbExplorerChangeDatabase(this.value)">
        </select>
    <div class="btn-group cool-border">
        <input id="inputJstreeSearch" type="text" onkeypress="dbExplorerSearch(event)" class="form-control">
        <a id="buttonJstreeSearch" class="btn btn-info" onclick="dbExplorerSearch()"><i class="glyphicon glyphicon-search"></i></a>
    </div>
    </div>

    <div id="jstreeDiv">
        <div id="jstree"></div>
        <div id="jstreeMaxElementDiv"><h4>Too many elements to display</h4></div>
    </div>
    
    <div id="dbExplorerResizer" onmousedown="dbExplorerMouseDown(event)"></div>
</div>
`)
}

function injectCSS() {
    $(`<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/jstree/3.2.1/themes/default/style.min.css"/>`).appendTo('head');
    $(`
<style>
#dbExplorerResizer {
    width: 15px;
    height: 100%;
    position: absolute;
    right: 1px;
    top: 0px;
    cursor: col-resize;

}

#jstree {
    padding-left: 10px;
    margin-top: 5px;
}

#jstree a {
    user-select: none;
    white-space: pre;
}

#inputJstreeSearch {
    width: 182px;
    display: inline-block;
}

#buttonJstreeSearch {
    display: inline-block;
    float: right;
}

#databaseSelect {
    margin-bottom: 5px;
    margin-right: 5px;
    width: 226px;
    float: left;
    border: 2px solid #5bc0de;
    height: 38px;
}

#jstreeDiv {
    flex-grow: 1;
    overflow: auto;
    background-color: white;
    border-radius: 4px;
    border-style: solid;
    border-width: 2px;
    border-color: #5bc0de;on
}

#jstreeMaxElementDiv {
    visibility: collapse;
    vertical-align:middle;
    display: table-cell;
    padding: 15px;
    width: 1000px;
    height: 100px;
    background: repeating-linear-gradient(
            135deg,
            rgba(0,32,255,0.15),
            rgba(0,32,255,0.15) 10px,
            rgba(255,114,0,0.15) 10px,
            rgba(255,114,0,0.15) 20px
    );
}


#jstreeMaxElementDiv h4 {
    user-select: none;
    font-size: 25px;
    text-align: center;
    color: white;
    text-shadow: 1px 1px 5px black, -1px -1px 5px black
}

.db-explorer .form-group {
    margin-bottom: 5px;
}

.cool-border {
    background-color: #5bc0de;
    border-radius: 5px;
    padding: 2px 2px 1px 2px;;
}

.db-explorer {
    flex-direction: column;
    display: none;
    width: 300px;
    position: fixed;
    left: 10px;
    bottom: -10px;
    top: 116px;
    background-color: rgb(229, 243, 255);
    padding: 12px 12px 10px 10px;
    transition: all .2s ease-in-out;
}


.db-explorer-full-size {
    top: 10px;
}

.my-glyphicon-color-tasks {
    color: #4f84ec !important;
}

.my-glyphicon-color-tag {
    color: #007a90a3 !important;
}

.my-glyphicon-color-alt {
    color: #d370e2 !important;
}

.my-glyphicon-color-comment {
    color: rgba(0, 0, 0, 0.34) !important;
}

.column-type-span {
    color: #2400d473;
    font-weight: bold;
}
</style>
`).appendTo('head')
}