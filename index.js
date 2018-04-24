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
        <i class="icon-list"></i>
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
            showDBExplorer();
            this.disconnect();
        }

    });
    observer.observe(target, {childList: true});
}

function showDBExplorer() {
    db_explorer.style.display = 'block';
    db_explorer.style.width = '300px';
    contentDOM.style.marginLeft = '310px';
}

function hideDBExplorer() {
    db_explorer.style.display = 'none';
    contentDOM.style.marginLeft = "0px";
}

window.dbExplorerToggleDisplay = function () {
    if (db_explorer.style.display === 'none' || db_explorer.style.display === ''){
        showDBExplorer();
    } else {
        hideDBExplorer();
    }
};

window.dbExplorerSearch = function () {
    let text = $('#inputJstreeSearch')[0].value;
    jstreeDOM.jstree(true).close_all();
    jstreeDOM.jstree(true).refresh();
    showMaxSearchElementBlock(false);
    if (text !== "") {
        jstreeDOM.jstree(true).search(text);
    }
};

window.dbExplorerChangeHeight = function (px) {
    let currentSize = db_explorer.clientWidth + px;
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
            'animation' : 0,
            'worker': false,
            'force_text' : true,
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

/*    local$(document).on('dnd_move.vakata', function (data, element) {
        let classList = element.helper["0"].childNodes["0"].childNodes["0"].classList;
        if (event.toElement.className === 'ace_content') {
            if (classList.contains('jstree-er')) {
                classList.remove('jstree-er');
                classList.add('jstree-ok');
            }
        } else {
            if (classList.contains('jstree-ok')) {
                classList.remove('jstree-ok');
                classList.add('jstree-er');
            }
        }
    });*/

}

function SearchEngine(jstree) {
    let queue = [];
    this.MAX_NODES_TO_SKIP = 20;
    let MAX_NODES_TO_SHOW = 400;
    this.skip_count = 0;
    let timerId;
    let countShownNode = this.MAX_NODES_TO_SKIP;

    this.runSearch = function run() {
        for (let i = 0; i < 5; i++) {
            if (queue.length === 0) {
                jstreeSearchEngine = null;
                return;
            }
            let node = getNode();
            jstree.show_node(node.id);
            jstree.open_node(node.id/*, function (node) {
                let nodeId = node.id;
                setTimeout(function callback() {
                    let elem = jstreeDOM.jstree(true).get_node(nodeId, true)[0];
                    if (elem && !jstreeSearchEngine) {
                        elem.classList.add("jstree-search");
                        return;
                    }
                    setTimeout(callback, 100)
                }, 100);
            }*/);
            while (node.parent !== '#') {
                node = jstree.get_node(node.parent);
                displayNode(node);
            }
            console.log("q[]: " + queue.length + " countShownNode: " + countShownNode + "/" + MAX_NODES_TO_SHOW);
        }

        if (countShownNode < MAX_NODES_TO_SHOW) {
            timerId = setTimeout(run, 100);
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
        textToPasteInEditor = getNameWithParent(nodesIds[0]);
    }
    if (nodesIds.length > 1 && !ctrlKey) {
        textToPasteInEditor = stringListOfNodes(nodesIds);
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

function stringListOfNodes(nodesIds) {
    let list = [];
    nodesIds.forEach(function (elem) {
        list.push(getNameWithParent(elem));
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

    <h3>Database Explorer</h3>

    <div id="dbExplorerResizeButtons" class="control-buttons btn-group  btn-group-sm resize-button-group">
        <a class="btn btn-info" onclick="dbExplorerChangeHeight(-50)"><i class="glyphicon glyphicon-chevron-left"></i></a>
        <a class="btn btn-info" onclick="dbExplorerChangeHeight(50)"><i class="glyphicon glyphicon-chevron-right"></i></a>
    </div>

    <select class="form-control" id="databaseSelect" onchange="dbExplorerChangeDatabase(this.value)">
        <option>greenplum2</option>
        <option>hive</option>
        <option>sap</option>
    </select>

    <div class="form-group">
        <input id="inputJstreeSearch" type="text" class="form-control">
        <a id="buttonJstreeSearch" class="btn btn-info" onclick="dbExplorerSearch()"><i class="glyphicon glyphicon-search"></i></a>
    </div>

    <div id="jstreeDiv">
        <div id="jstree"></div>
        <div id="jstreeMaxElementDiv"><h4>Too many elements to display</h4></div>
    </div>

</div>
`)
}


function injectCSS() {
    $(`<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/jstree/3.2.1/themes/default/style.min.css"/>`).appendTo('head');
    $(`
<style>
#content {
    transition: all .2s ease-in-out;
}

#jstree {
    padding-left: 10px;
    margin-top: 5px;
}

#dbExplorerResizeButtons {
    float: left;
    margin-right: 10px;
    display: inline-block;
}

#inputJstreeSearch {
    width: 182px;
    display: inline-block;
    float: left;
}

#buttonJstreeSearch {
    display: inline-block;
    float: right;
}

#databaseSelect {
    margin-bottom: 5px;
    margin-right: 5px;
    width: 150px;
    float: left;
    display: inline-block;
}

#jstreeDiv {
    overflow: auto;
    height: 86%;
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
    border: 2px solid #525252;
    border-radius: 15px;
    background: repeating-linear-gradient(
            135deg,
            rgba(255, 205, 0, 0.30),
            rgba(255, 205, 0, 0.30) 10px,
            rgba(255, 0, 6, 0.30) 10px,
            rgba(255, 0, 6, 0.30) 20px
    );
}

#jstreeMaxElementDiv h4 {
    font-size: 25px;
    text-align: center;
    color: white;
    text-shadow: 1px 1px 5px black, -1px -1px 5px black
}

.jstree-er {
    url: none !important;
}

.db-explorer {
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

.db-explorer > h3{
    margin-top: 5px;
}

.db-explorer > select{
    display: inline-block;
    width: 120px;
}

.db-explorer .form-group{
    width: 227px;
    display: inline-block;
}

.resize-button-group {
    margin-right: 5px;
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








