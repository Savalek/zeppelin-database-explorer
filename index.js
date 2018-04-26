
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
let currentDatabase = 'greenplum2';
let notebookController = null;
let jstreeSearchEngine = null;

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
    explorerTreeInit();
    db_explorer = db_explorer[0];
    createOnDestroyListener();
}

function addShowDBExplorerButton() {
    $('#actionbar > headroom > h3 > div:nth-child(2) > span:nth-child(1)').append(`
    <button type="button" class="btn btn-default btn-xs" onclick="dbExplorerToggleDisplay()" title="Show/Hide Database Explorer">
        <i class="icon-layers"></i>
    </button>
    `);
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
            //showDBExplorer();
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

    if (jstreeSearchEngine) {
        return;
    }
    let text = $('#inputJstreeSearch')[0].value;
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
    jstreeDOM.jstree(true).settings.core.data.url =
        'http://zeppelin-test.dwh.tinkoff.cloud:8082?file=' + name;
    jstreeDOM.jstree(true).settings.search.ajax.url =
        'http://zeppelin-test.dwh.tinkoff.cloud:8082?file=' + name;
    jstreeDOM.jstree(true).settings.massload.url =
        'http://zeppelin-test.dwh.tinkoff.cloud:8082?file=' + name;
    jstreeDOM.jstree(true).close_all();
    jstreeDOM.jstree(true).refresh();
    currentDatabase = name;
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

    jstreeDOM.jstree({
        'plugins': ['json_data', 'types', 'dnd', 'search', 'massload'],
        'types': {
            'column': {
                'icon': 'glyphicon glyphicon-tag my-glyphicon-color-tag'
            },
            'table': {
                'icon': 'glyphicon glyphicon-list-alt my-glyphicon-color-alt'
            },
            'schema': {
                'icon': 'glyphicon glyphicon-tasks my-glyphicon-color-tasks'
            }
        },
        'massload': {
            'url': 'http://zeppelin-test.dwh.tinkoff.cloud:8082?file=' + currentDatabase,
            'data': function (nodes) {
                return {'ids': nodes.join(',')};
            }
        },
        'core': {
            'animation': 0,
            'worker': false,
            'force_text': true,
            'check_callback': function () {
                return false;
            },
            'data': {
                'url': 'http://zeppelin-test.dwh.tinkoff.cloud:8082?file=' + currentDatabase,
                'data': function (node) {
                    return {'id': node.id};
                }
            }
        },
        'search': {
            'show_only_matches': true,
            'ajax': {
                'url': 'http://zeppelin-test.dwh.tinkoff.cloud:8082?file=' + currentDatabase,
                'data': function (str) {
                    return {"search_str": str};
                },
            },
            'search_callback': function (str, node) {
                if (!jstreeSearchEngine) {
                    jstreeSearchEngine = new SearchEngine(jstreeDOM.jstree(true));
                }
                if (node.text.indexOf(str) === -1) {
                    return false;
                }
                if (jstreeSearchEngine.skip_count < jstreeSearchEngine.MAX_NODES_TO_SKIP) {
                    jstreeSearchEngine.skip_count++;
                    return true;
                } else {
                    jstreeSearchEngine.addNode(node.original);
                    return false;
                }
            }
        }
    }).on('open_node.jstree', function (event, data) {
        data.node.children.forEach(addCommentBlock);
    }).on('redraw.jstree', function (event, data) {
        data.nodes.forEach(addCommentBlock);
    }).on('search.jstree', function (event, data) {
        jstreeSearchEngine.runSearch();
    });
    local$(document).on('dnd_stop.vakata', function (data, element) {
        pasteSelectInElement(element.event.toElement, element.data.nodes, element.event.ctrlKey);
    });
    local$(document).on('dnd_move.vakata', function () {
        $('#jstree-dnd > i').remove();
    });

}

function SearchEngine(jstree) {
    let queue = [];
    this.MAX_NODES_TO_SKIP = 20;
    let MAX_NODES_TO_SHOW = 300;
    this.skip_count = 0;
    let countShownNode = this.MAX_NODES_TO_SKIP;

    this.runSearch = function run() {
        for (let i = 0; i < 5; i++) {
            if (queue.length === 0) {
                jstreeSearchEngine = null;
                return;
            }
            let node = getNode();
            jstree.show_node(node.id);
            jstree.open_node(node.id);
            while (node.parent !== '#') {
                node = jstree.get_node(node.parent);
                displayNode(node);
            }
        }

        if (countShownNode < MAX_NODES_TO_SHOW) {
            setTimeout(run, 100);
        } else {
            jstreeSearchEngine = null;
            showMaxSearchElementBlock(true);
        }
    };

    this.addNode = function (node) {
        queue.push(node);
    };

    function getNode() {
        return queue.pop();
    }

    function displayNode(node) {
        countShownNode++;
        jstree.show_node(node.id);
        jstree.open_node(node.id);
    }
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
    let colomunsIds = new Set();
    nodesIds.forEach(function (id) {
        let node = jstreeDOM.jstree(true).get_node(id);

        switch (node.original.type) {

            case 'table':
                tablesIds.add(id);
                node.children.forEach(childId => colomunsIds.add(childId));
                break;

            case 'column':
                colomunsIds.add(id);
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
                node.children.forEach(childId => colomunsIds.add(childId));
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
        let select = 'SELECT ' + stringListOfNodes(colomunsIds) + '\n';
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
    let commentText = jstreeDOM.jstree(true).get_node(id).original.comment;
    if (!commentText) {
        return;
    }
    let nodeDOM = jstreeDOM.jstree(true).get_node(id, true);
    let info = document.createElement('i');
    info.className = "glyphicon glyphicon-info-sign my-glyphicon-color-comment";
    info.style.paddingLeft = "10px";
    info.setAttribute('title', commentText);
    if (nodeDOM["0"] && nodeDOM["0"].children["1"].children.length === 1) {
        nodeDOM["0"].children["1"].append(info);
    }

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
            <option>greenplum2</option>
            <option>hive</option>
            <option>sap</option>
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
    border-radius: 5px;
    border: 5px ridge;
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
    padding: 2px;
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
    color: #148e00 !important;
}

.my-glyphicon-color-alt {
    color: #ff9452 !important;
}

.my-glyphicon-color-comment {
    color: rgba(0, 0, 0, 0.34) !important;
}
</style>
`).appendTo('head')
}