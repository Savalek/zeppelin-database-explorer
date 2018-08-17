# Zeppelin database explorer
This is Apache Zeppelin helium spell for to display the structure of the database.  
Works together with [Database metadata server](https://github.com/Savalek/Metadata-server)   
More info about `zeppelin spell`:  [writing_spell](https://zeppelin.apache.org/docs/0.8.0/development/helium/writing_spell.html)

## Install
1. Clone repository in `{Zeppelin Folder}/zeppelin-examples`  
2. Clone file `zeppelin-database-explorer.json` in `{Zeppelin Folder}/helium`
3. Enable and configure in  
<p align="center">
  <img src="https://github.com/Savalek/zeppelin-database-explorer/blob/master/img/spell_settings.png">
</p>
4. Open note and click button
<p align="center">
  <img src="https://github.com/Savalek/zeppelin-database-explorer/blob/master/img/dbEx_button.png">
</p>

## Problem solving
If database explorer button not displayed in zeppelin actionBar try change artifact path to project folder from relative on full in `zeppelin-database-explorer.json`
```json
{
  "type": "SPELL",
  "name": "zeppelin-database-explorer",
  "version": "0.2.0",
  "description": "Display a database structure",
  "artifact": "/home/savalek/IdeaProjects/zeppelin/zeppelin-examples/zeppelin-database-explorer",
  "license": "ICS",
  "icon": "<i class='fa fa-folder-open'></i>",
  "config": {
    "metaserver_port": {
      "type": "number",
      "description": "Port for connection to metadata server",
      "defaultValue": 8090
    },
    "metaserver_url": {
      "type": "string",
      "description": "URL for connection to metadata server",
      "defaultValue": "localhost"
    }
  }
}
```