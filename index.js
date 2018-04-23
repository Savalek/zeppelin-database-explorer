import {
    SpellBase,
    SpellResult,
    DefaultDisplayType,
} from 'zeppelin-spell';

import jstree from 'jstree';

let db_explorer;
let jstreeDOM;
let contentDOM;
let currentDatabase = 'greenplum2';
let notebookController = null;

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


function createOnDestroyListener() {
    let target = document.querySelector('html');
    let observer = new MutationObserver(function (mutations) {
        try {
            if (notebookController) {
                return;
            }
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

window.dbExplorerSearch = function () {
    let text = $('#inputJstreeSearch')[0].value;
    jstreeDOM.jstree(true).search(text);
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
            }
        }
    }).on('open_node.jstree', function (event, data) {
        data.node.children.forEach(addCommentBlock);
    }).on('redraw.jstree', function (event, data) {
        data.nodes.forEach(addCommentBlock);
    });
    local$(document).on('dnd_stop.vakata', function (data, element) {
        pasteSelectInElement(element.event.toElement, element.data.nodes, element.event.ctrlKey);
    });

/*    local$(document).on('dnd_move.vakata', function (data, element) {
        debugger;
        let classList = element.helper["0"].childNodes["0"].childNodes["0"].classList;
        if (event.toElement.className === 'ace_content') {
            if (classList.contains('jstree-er')) {
                debugger;
                classList.remove('jstree-er');
                classList.add('jstree-ok');
            }
        } else {
            if (classList.contains('jstree-ok')) {
                debugger;
                classList.remove('jstree-ok');
                classList.add('jstree-er');
            }
        }
    });*/

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

.jstree-er {
    url: none !important;
}

.db-explorer {
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








