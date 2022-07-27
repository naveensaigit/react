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
    show: process.env.DEVTOOLS_HEADLESS !== "true",
    icon: join(__dirname, 'icons/icon128.png'),
    frame: false,
    //titleBarStyle: 'customButtonsOnHover',
    webPreferences: {
      nodeIntegration: true,
      nodeIntegrationInWorker: true,
      enableRemoteModule: true,
    },
  });
  mainWindow.webContents.openDevTools();

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
    `window.devtools.setProjectRoots(' + JSON.stringify(projectRoots) + ');

    function debugLog(...args) {
      if(${process.env.DEVTOOLS_DEBUG === "true"})
        console.log(...args);
    }

    function delayExec(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    function getParentSource(parents) {
      let promise = new Promise(resolve => {
        Promise.all(parents).then(sources => {
          for(let inspectedParent of sources)
            if(inspectedParent[0] && inspectedParent[0].source)
              resolve(inspectedParent[0].source);
          resolve(undefined);
        });
      });
      return promise;
    }

    function getInspectPromise(inspectElementPromise) {
      return new Promise(async resolve => {
        try {
          let inspectedElement = await inspectElementPromise;
          resolve(inspectedElement);
        }
        catch(err) {
          resolve({});
        }
      });
    }

    async function getTree() {
      debugLog("Starting to extract Render Tree!");
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

      debugLog("Filtering Components to get only user-defined components");
      store._bridge.send('updateComponentFilters', onlyFuncComps);
      let delay = await delayExec(${Number(process.env.UPDATE_FILTERS || 1000)});
      let reqTree = new Map(store._idToElement);

      debugLog("Restoring Original Tree to find parents in case of missing source");
      store._bridge.send('updateComponentFilters', allComps);
      delay = await delayExec(${Number(process.env.UPDATE_FILTERS || 1000)});
      let fullTree = new Map(store._idToElement);

      let renderTree = {}, promises = [], getSources = [], sourcePromises = [];

      debugLog("Inspecting each element in the render tree");
      for(let elm of reqTree.values()) {
        const rendererID = store.getRendererIDForElement(elm.id);
        const inspectElementPromise = inspectElement({
          bridge: store._bridge,
          element: elm,
          path: null,
          rendererID
        });
        promises.push(getInspectPromise(inspectElementPromise));
        renderTree[elm.id] = {
          name: elm.displayName || "root",
          source: undefined,
        }
      }

      let values = await Promise.all(promises);
      debugLog("Inspected all elements successfully. Finding sources now.");
      for(let value of values) {
        if(!(value && value[0]))
          continue;

        renderTree[value[0].id].source = value[0]?.source;

        if(renderTree[value[0].id].source)
          continue;

        getSources.push(value[0].id);
        let parents = [];

        for(let owner of value[0].owners || []) {
          let parent = fullTree.get(owner.id);
          const rendererID = store.getRendererIDForElement(owner.id);
          const inspectElementPromise = inspectElement({
            bridge: store._bridge,
            element: parent,
            path: null,
            rendererID
          });
          parents.push(getInspectPromise(inspectElementPromise));
        }

        sourcePromises.push(getParentSource(parents));
      }

      let renderTreePromise = new Promise(resolve => {
        Promise.all(sourcePromises).then(sources => {
          debugLog("Found all sources. Preparing render tree.");
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
