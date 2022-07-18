/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

const {app, BrowserWindow} = require('electron'); // Module to create native browser window.
const {join} = require('path');
const os = require('os');

const argv = require('minimist')(process.argv.slice(2));
const projectRoots = argv._;

let mainWindow = null;

app.on('window-all-closed', function() {
  app.quit();
});

app.on('ready', function() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    icon: join(__dirname, 'icons/icon128.png'),
    frame: false,
    //titleBarStyle: 'customButtonsOnHover',
    webPreferences: {
      nodeIntegration: true,
      nodeIntegrationInWorker: true,
    },
  });

  // set dock icon for macos
  if (os.platform() === 'darwin') {
    app.dock.setIcon(join(__dirname, 'icons/icon128.png'));
  }

  // https://stackoverflow.com/questions/32402327/
  mainWindow.webContents.on('new-window', function(event, url) {
    event.preventDefault();
    require('electron').shell.openExternal(url);
  });

  // and load the index.html of the app.
  mainWindow.loadURL('file://' + __dirname + '/app.html'); // eslint-disable-line no-path-concat
  mainWindow.webContents.executeJavaScript(
    // We use this so that RN can keep relative JSX __source filenames
    // but "click to open in editor" still works. js1 passes project roots
    // as the argument to DevTools.
    `window.devtools.setProjectRoots(' + JSON.stringify(projectRoots) + ')

    function matchingComponents(store, revision) {
      const promise = new Promise((resolve, _) => {
        if(store.revision > revision)
          resolve(new Map(store._idToElement));
        else
          return setTimeout(() => resolve(matchingComponents(store, revision)), 50);
      });
      return promise;
    }

    function getParentSource(parents) {
      let promise = new Promise((resolve, _) => {
        Promise.all(parents).then(sources => {
          for(let inspectedParent of sources)
            if(inspectedParent[0].source)
              resolve(inspectedParent[0].source);
          resolve(undefined);
        });
      });
      return promise;
    }

    async function getTree() {
      let allComps = [
        {
          type: 1,
          value: 7,
          isEnabled: true
        }
      ],
      onlyFuncComps = [
        {
          type: 1,
          value: 1,
          isEnabled: true,
        },
        {
          type: 1,
          value: 2,
          isEnabled: true,
        },
        {
          type: 1,
          value: 6,
          isEnabled: true,
        },
        {
          type: 1,
          value: 7,
          isEnabled: true,
        },
        {
          type: 1,
          value: 8,
          isEnabled: true,
        },
        {
          type: 1,
          value: 9,
          isEnabled: true,
        },
        {
          type: 1,
          value: 10,
          isEnabled: true,
        },
        {
          type: 1,
          value: 11,
          isEnabled: true,
        },
        {
          type: 1,
          value: 12,
          isEnabled: true,
        },
        {
          type: 1,
          value: 13,
          isEnabled: true,
        },
        {
          type: 1,
          value: 14,
          isEnabled: true,
        }
      ];

      let rev = store.revision;
      bridge.send('updateComponentFilters', onlyFuncComps);
      let reqTree = await matchingComponents(store, rev);

      rev = store.revision;
      bridge.send('updateComponentFilters', allComps);
      let fullTree = await matchingComponents(store, rev);

      let renderTree = {}, promises = [], getSources = [], sourcePromises = [];

      for(let elm of reqTree.values()) {
        const rendererID = store.getRendererIDForElement(elm.id);
        promises.push(inspectElement({bridge: store._bridge, element: elm, path: null, rendererID}));
        renderTree[elm.id] = {
          name: elm.displayName || "root",
          source: undefined,
        }
      }

      let values = await Promise.all(promises);
      for(let value of values) {
        if(!(value && value[0]))
          continue;

        renderTree[value[0].id].source = value[0].source;

        if(renderTree[value[0].id].source)
          continue;

        getSources.push(value[0].id);
        let parents = [];

        for(let owner of value[0].owners || []) {
          let parent = fullTree.get(owner.id);
          const rendererID = store.getRendererIDForElement(owner.id);
          parents.push(inspectElement({bridge: store._bridge, element: parent, path: null, rendererID}));
        }

        sourcePromises.push(getParentSource(parents));
      }

      let renderTreePromise = new Promise((resolve, _) => {
        Promise.all(sourcePromises).then(sources => {
          for(let i=0; i<sources.length; i++)
            renderTree[getSources[i]].source = sources[i];
          resolve(renderTree);
        });
      });

      return renderTreePromise;
    }`,
  );

  // Emitted when the window is closed.
  mainWindow.on('closed', function() {
    mainWindow = null;
  });
});
