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
      execSync      = require('child_process').execSync,
      execAsync     = Promise.promisify(require('child_process').exec),
      trim          = require('trim-character'),
      electron      = require('electron'),
      traverse      = require('traverse');


// exported functions
var fn = {
    _parsePowerPlan: function (string) {
        var powerplan   = string.split('  '),
            guid        = powerplan[0].split(': ')[1],
            name        = trim.right(powerplan[1], '\r'),
            active      = false,
            hidden      = (powerplandisplay.hiddenPowerPlans.indexOf(guid) === -1);

        // determine if plan is active
        if (name.slice(-1) === '*') {
            active  = true;
            name    = trim.right(name, ' *');
        }

        // return parsed data
        return {
            guid:   guid,
            name:   trim.left(
                trim.right(
                    name,
                    ')'
                ),
                '('
            ),
            active: active,
            hidden: hidden
        };
    },

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
    
                                // add to powerplans data structure
                                powerplans.push(
                                    fn._parsePowerPlan(
                                        tabular[i]
                                    )
                                );
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

    getPowerPlansSync: function () {
        var data = execSync(
            'powercfg /list',
            {
                encoding: 'utf-8'
            }
        );

        // split tabular data into individual power plan items, strip off header
        var tabular = data.split('\n').slice(3);

        // reassemble into string and change elements
        var output = tabular.join('\n').replace(/(\()|(\))/g, '').replace('*', '(Active)');

        return output;
    },

    getActivePowerPlan: function () {
        return new Promise(
            function (resolve, reject) {
                execAsync('powercfg /getactivescheme')
                    .then(
                        function (string) {
                            resolve(
                                fn._parsePowerPlan(
                                    string
                                )
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
        var sizingKey = ((powerplandisplay.config.frame === true) ? 'frame' : 'noframe');

        var win = new electron.BrowserWindow({
            width:          powerplandisplay.themes[powerplandisplay.config.theme][sizingKey].width,
            height:         powerplandisplay.themes[powerplandisplay.config.theme][sizingKey].height,
            minWidth:       200,
            minHeight:      40,
            alwaysOnTop:    ((powerplandisplay.config.notOnTop === false) && (powerplandisplay.config.debug === false)),
            darkTheme:      true,
            fullscreen:     false,
            frame:          (powerplandisplay.config.frame === true),
            titleBarStyle:  'hidden',
            webPreferences: {
                zoomFactor:                 1.0,
                plugins:                    true,
                webSecurity:                false,
                webaudio:                   true,
                experimentalFeatures:       true,
                experimentalCanvasFeatures: true
            },
            title:          powerplandisplay.sys.name + ' v' + powerplandisplay.sys.version
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

        // open external links in browser
        win.webContents.on(
            'new-window',
            function (event, url) {
                event.preventDefault();

                electron.shell.openExternal(url);
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