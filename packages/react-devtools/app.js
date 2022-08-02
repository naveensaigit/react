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

     // Function to print debug log statements
     function debugLog(...args) {
      // If debug log env variable is set to true
      if(${process.env.DEVTOOLS_DEBUG === "true"})
         console.log(...args);
     }

     // Promise that resolves after given time
     function delayExec(ms) {
       return new Promise(resolve => setTimeout(resolve, ms));
     }

     // Get source property from one of the parent nodes
     function getParentSource(parents) {
       let promise = new Promise(resolve => {
        // Wait until all parent nodes have been inspected
        Promise.all(parents).then(sources => {
          // Iterate over them
          for(let inspectedParent of sources)
            // If parent has been inspected successfully and has a valid source
            if(inspectedParent[0] && inspectedParent[0].source)
              // Return the source
              resolve(inspectedParent[0].source);
           // No valid source found
           resolve(undefined);
         });
       });
       return promise;
     }

     // Construct promise to inspect element
     function getInspectPromise(element, rendererID) {
      return new Promise(async resolve => {
        try {
          // Try inspecting element
          let inspectedElement = await inspectElement({
            bridge: store._bridge,
            element,
            path: null,
            rendererID
          });
          // Return the inspected element properties
          resolve(inspectedElement);
        }
        catch(err) {
          // React DevTools unable to inspect element
          resolve({});
        }
      });
    }

    // Function to extract the render tree
    async function getTree() {
      debugLog("Starting to extract Render Tree!");

      // Filters to get all types of components
      let allComps = [
        {
          type: 1,
          value: 7,
          isEnabled: true
        }
      ],
      // Filters to get only functional components
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

      // Filter to get only functional components
      debugLog("Filtering Components to get only user-defined components");
      store._bridge.send('updateComponentFilters', onlyFuncComps);
      let delay = await delayExec(${Number(process.env.UPDATE_FILTERS || 1000)});
      // Store all functional components
      let reqTree = new Map(store._idToElement);

      // Reset tree to original state. This is done incase source of
      // node is missing and we need to find it from its parent nodes.
      debugLog("Restoring Original Tree to find parents in case of missing source");
      store._bridge.send('updateComponentFilters', allComps);
      delay = await delayExec(${Number(process.env.UPDATE_FILTERS || 1000)});
      // Store all components
      let fullTree = new Map(store._idToElement);

      let renderTree = {}, promises = [], getSources = [], sourcePromises = [];

      // Inspect each element in render tree to find its source
      debugLog("Inspecting each element in the render tree");
      for(let elm of reqTree.values()) {
        const rendererID = store.getRendererIDForElement(elm.id);
        // Add inspect promise for this component to the list
        promises.push(getInspectPromise(elm, rendererID));
        // Add this component to the render tree object
        renderTree[elm.id] = {
          name: elm.displayName || "root",
          source: undefined,
        }
      }

      // Wait until all nodes have been inspected
      let values = await Promise.all(promises);
      debugLog("Inspected all elements successfully. Finding sources now.");
      for(let value of values) {
        if(!(value && value[0]))
          continue;

        // If valid source found, add it to the render tree and continue
        renderTree[value[0].id].source = value[0]?.source;

        if(renderTree[value[0].id].source)
          continue;

        // Add component id to the list of values whose parents need to be inspected
        getSources.push(value[0].id);
        let parents = [];

        // Loop through all the parent nodes of this component
        for(let owner of value[0].owners || []) {
          let parent = fullTree.get(owner.id);
          const rendererID = store.getRendererIDForElement(owner.id);
          // Add inspect promise for the parent of this component to the list
          parents.push(getInspectPromise(parent, rendererID));
        }

        // getParentSource returns a promise that resolves when atleast one parent
        // node with valid source is found or no parents have a valid source
        sourcePromises.push(getParentSource(parents));
      }

      // Promise that returns the final render tree
      let renderTreePromise = new Promise(resolve => {
        // Wait until all source promises are resolved
        Promise.all(sourcePromises).then(sources => {
          debugLog("Found all sources. Preparing render tree.");
          // For each source found, set it to the corresponding component in the render tree
          for(let i=0; i<sources.length; i++)
            renderTree[getSources[i]].source = sources[i];
          // Return the final render tree
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
