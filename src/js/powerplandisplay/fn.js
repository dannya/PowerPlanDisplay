'use strict';

/*!
 * PowerPlanDisplay
 * https://github.com/dannyakakong/powerplandisplay
 *
 * (c) 2016 Danny Allen / Wonderscore Ltd
 * http://dannya.com
 *
 * License: GPL-v3
 */


// imports
const Promise       = require('bluebird'),
      execAsync     = Promise.promisify(require('child_process').exec),
      trim          = require('trim-character'),
      electron      = require('electron'),
      traverse      = require('traverse');


// exported functions
var fn = {
    getPowerPlans: function () {
        return new Promise(
            function (resolve, reject) {
                execAsync('powercfg /list')
                    .then(
                        function (data) {
                            // split tabular data into individual power plan items
                            var powerplans  = [],
                                tabular     = data.split('\n').slice(3);
    
                            for (var i in tabular) {
                                if (tabular[i] === '') {
                                    continue;
                                }
    
                                var powerplan   = tabular[i].split('  '),
                                    guid        = powerplan[0].split(': ')[1],
                                    name        = trim.right(powerplan[1], '\r'),
                                    active      = false;
    
                                // determine if plan is active
                                if (name.slice(-1) === '*') {
                                    active  = true;
                                    name    = trim.right(name, ' *');
                                }
    
                                // add to powerplans data structure
                                powerplans.push({
                                    guid:   guid,
                                    name:   trim.left(
                                        trim.right(
                                            name,
                                            ')'
                                        ),
                                        '('
                                    ),
                                    active: active
                                });
                            }
    
                            // send powerplans
                            resolve(
                                powerplans
                            );
                        }
                    )
                    .catch(
                        reject
                    );
            }
        );
    },

    changeActivePowerplan: function (guid) {
        return new Promise(
            function (resolve, reject) {
                execAsync('powercfg /setactive ' + guid)
                    .then(
                        resolve
                    )
                    .catch(
                        reject
                    );
            }
        );
    },
    
    createWindow: function () {
        // create the browser window
        var win = new electron.BrowserWindow({
            width:          powerplandisplay.config.windowedWidth,
            height:         powerplandisplay.config.windowedHeight,
            minWidth:       300,
            minHeight:      100,
            alwaysOnTop:    (powerplandisplay.config.notOnTop === false) && (powerplandisplay.config.debug === false),
            darkTheme:      true,
            fullscreen:     false,
            titleBarStyle:  'hidden',
            webPreferences: {
                zoomFactor:                 1.0,
                plugins:                    true,
                webSecurity:                false,
                webaudio:                   true,
                experimentalFeatures:       true,
                experimentalCanvasFeatures: true
            },
            title:          powerplandisplay.sys.name + ' ' + powerplandisplay.sys.version
        });

        // load the specified URL, otherwise the local mirror / config HTML file
        win.loadURL(
            'http://localhost:' + powerplandisplay.config.port + '/' + 'index.html?context=electron'
        );

        // hide menu bar
        win.setAutoHideMenuBar(true);
        win.setMenuBarVisibility(false);

        // open the devtools?
        if (powerplandisplay.config.webInspector === true) {
            win.webContents.openDevTools();
        }

        // keep app window title (block page override)
        win.on(
            'page-title-updated',
            function (event) {
                event.preventDefault();
            }
        );

        // observe window close event
        win.on(
            'closed',
            function () {
                win = null;
            }
        );

        // stop display from sleeping
        var powersave = electron.powerSaveBlocker.start('prevent-display-sleep');

        return {
            win:        win,
            powersave:  powersave
        };
    },

    update: function (keyPath, data) {
        // update backend datastore
        traverse(powerplandisplay).set(keyPath, data);

        // explicitly add 'powerplandisplay' to keyPath
        keyPath.unshift('powerplandisplay');

        // update frontend datastore
        ipc.emit(
            'setData',
            {
                keyPath:    keyPath,
                data:       data
            }
        );
    }
};


module.exports = fn;