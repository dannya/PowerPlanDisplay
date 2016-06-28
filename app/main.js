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
const electron  = require('electron'),
      nomnom    = require('nomnom'),
      repeat    = require('repeat'),
      http      = require('http'),
      path      = require('path'),
      url       = require('url'),
      fs        = require('fs'),
      os        = require('os'),
      mime      = require('mime'),
      spawn     = require('child_process').spawn,
      io        = require('socket.io');


// define module shorthand names
const app = electron.app;


// determine if running in Squirrel or Electron context
const context = ((process.execPath.indexOf('electron')) === -1) ? 'squirrel' : 'electron';


// process squirrel events?
if (context === 'squirrel') {
    var runSquirrelCmd = function(args, done) {
        spawn(
            path.resolve(
                path.dirname(process.execPath), '..', 'Update.exe'
            ),
            args,
            {
                detached: true
            }

        ).on('close', done);
    };

    var handleStartupEvent = function() {
        if (process.platform !== 'win32') {
            return false;
        }

        var target = path.basename(process.execPath);
        var squirrelCommand = process.argv[1];

        switch (squirrelCommand) {
            case '--squirrel-install':
            case '--squirrel-updated':
                // install desktop / start menu shortcuts
                runSquirrelCmd(
                    ['--createShortcut=' + target + ''],
                    app.quit
                );

                return true;

            case '--squirrel-uninstall':
                // undo anything done in --squirrel-install and --squirrel-updated handlers
                runSquirrelCmd(
                    ['--removeShortcut=' + target + ''],
                    app.quit
                );

                return true;

            case '--squirrel-obsolete':
                app.quit();

                return true;
        }
    };

    if (handleStartupEvent()) {
        return;
    }
}


// keep a global reference of certain objects to stop them getting garbage collected
let win, powersave;


// load package information
const pkg = require('./package.json');


// load config
var powerplandisplay;

try {
    // load custom config if available
    powerplandisplay = require('./config_editable');

} catch (e) {
    // ...otherwise load standard shipped config
    powerplandisplay = require('./config');
}


// make powerplandisplay framework available globally
global.powerplandisplay = powerplandisplay;


// initialise framework variables
powerplandisplay.sys = {
    rootDir:    __dirname,
    name:       pkg.name,
    version:    pkg.version,
    homepage:   pkg.homepage
};


// define function to get full / minified file based on debug flag
powerplandisplay.path = function (pathItems, injectMin, alwaysInjectMin) {
    pathItems.unshift(
        powerplandisplay.sys.rootDir
    );

    // inject '.min' into filename?
    if (alwaysInjectMin || (!powerplandisplay.config.debug && (injectMin !== false))) {
        pathItems[pathItems.length - 1] = pathItems[pathItems.length - 1].replace('.', '.min.');
    }

    return path.join.apply(this, pathItems);
};


// load utility functions
powerplandisplay.fn = require(
    powerplandisplay.path(
        [
            'js', 'powerplandisplay', 'fn.js'
        ],
        true,
        true
    )
);


// define command line arguments
const staticConfigOptions = {
    // configuration
    debug: {
        abbr:       'd',
        flag:       true,
        default:    false,
        help:       'Enable debugging / development mode'
    },
    webInspector: {
        abbr:       'wi',
        flag:       true,
        default:    false,
        help:       'Show web inspector'
    },
    notOnTop: {
        abbr:       'n',
        flag:       true,
        default:    false,
        help:       'Do not force the window to be on top of other windows'
    },
    showWindow: {
        abbr:       's',
        default:    true,
        help:       'Show the app GUI in a window (if disabled, this will only be accessible via a web browser)'
    },
    frame: {
        abbr:       'f',
        flag:       true,
        default:    true,
        help:       'Whether to show the frame containing the window controls'
    },
    port: {
        default:    80,
        help:       'Local port number that interface is served from'
    },
    refresh: {
        abbr:       'r',
        default:    5,
        help:       'Number of seconds to recheck for external powerplan changes'
    },
    theme: {
        abbr:       't',
        default:    'full',
        choices:    [
            'full', 'compact'
        ],
        help:       'Display theme'
    },
    version: {
        abbr:       'v',
        flag:       true,
        help:       'Print version and exit',
        callback: function () {
            return powerplandisplay.sys.name + ' v' + powerplandisplay.sys.version;
        }
    },
    
    // functionality
    powerplans: {
        abbr:       'p',
        flag:       true,
        help:       'List available powerplans',
        callback: function () {
            return powerplandisplay.fn.getPowerPlansSync();
        }
    }
};


// parse command line options
var configCommandLine = nomnom
    .options(
        staticConfigOptions
    )
    .parse(
        process.argv.slice(1)
    );


// make copy of static config and clear variable for overwriting with merged config
var staticConfig = powerplandisplay.config;
powerplandisplay.config = {};


// check for debug mode
var isDebug = configCommandLine['debug'] ? configCommandLine['debug'] : staticConfigOptions['debug'].default;


// enhance system data
powerplandisplay.sys.minified = (powerplandisplay.config.debug === false) ? '.min' : '';


// check for split debug / production config...
if ((typeof staticConfig.debug === 'object') && (typeof staticConfig.production === 'object')) {
    // choose config based on specified flag
    if (isDebug) {
        powerplandisplay.config = staticConfig.debug;
        powerplandisplay.config.debug = true;

    } else {
        powerplandisplay.config = staticConfig.production;
        powerplandisplay.config.debug = false;
    }

} else {
    // single config
    powerplandisplay.config = staticConfig;

    // set debug flag if it doesn't exist
    if (powerplandisplay.config.debug === undefined) {
        powerplandisplay.config.debug = false;
    }
}


// merge static and command line config values
for (var key in configCommandLine) {
    if (['0', '_'].indexOf(key) === -1) {
        if (typeof staticConfigOptions[key] === 'undefined') {
            // command line value doesn't exist in static config, insert it
            powerplandisplay.config[key] = configCommandLine[key];

        } else if (configCommandLine[key] !== staticConfigOptions[key].default) {
            // overwrite static value
            powerplandisplay.config[key] = configCommandLine[key];
        }
    }
}


// start serving interface via URL's
var server = http
    .createServer(
        function (request, response) {
            // get the file
            var filepath = unescape(url.parse(request.url).pathname);

            if (filepath === '/') {
                filepath = '/index.html';
            }

            if (context === 'squirrel') {
                filepath = './resources/app' + filepath;
            } else {
                filepath = './app' + filepath;
            }

            console.log(filepath);

            var extname     = path.extname(filepath),
                contentType = 'text/html';

            switch (extname) {
                case '.js':
                    contentType = 'text/javascript';

                    if (!powerplandisplay.config.debug) {
                        filepath = filepath.replace('.js', '.min.js');
                    }

                    break;
                case '.css':
                    contentType = 'text/css';

                    if (!powerplandisplay.config.debug) {
                        filepath = filepath.replace('.css', '.min.css');
                    }

                    break;

                case '.svg':
                    contentType = 'image/svg+xml';
                    break;
                case '.png':
                    contentType = 'image/png';
                    break;
                case '.ico':
                    contentType = 'image/x-icon';
                    break;
            }

            fs.readFile(filepath, function (error, content) {
                if (error) {
                    console.error(error);
                }

                if (error) {
                    if (error.code == 'ENOENT') {
                        response.writeHead(404, { 'Content-Type': contentType });
                        response.end('404', 'utf-8');

                    }  else {
                        response.writeHead(500);
                        response.end('Sorry, check with the site admin for error: ' + error.code + '\n');
                        response.end();
                    }

                } else {
                    response.writeHead(200, { 'Content-Type': contentType });
                    response.end(content, 'utf-8');
                }
            });

        }
    )
    .listen(
        powerplandisplay.config.port
    );


// make web contents available globally (for IPC)
global.ipc = io(
    server,
    {
        transports: ['websocket', 'polling']
    }
);


// set up IPC connection with the browser...
ipc.on(
    'connection',
    function (socket) {

        // on initialise signal from browser, initialise backend elements
        socket.on(
            'initialise',
            function (context) {
                // add context powerplandisplay into object
                powerplandisplay.context = context;


                // send data to the web page context
                socket.emit(
                    'setData',
                    {
                        keyPath:    ['powerplandisplay'],
                        data:       powerplandisplay
                    }
                );


                // request powerplans (every n seconds to catch external powerplan changes), and send to web page context when received
                repeat(
                    function () {
                        powerplandisplay.fn.getPowerPlans()
                            .then(
                                function (powerplans) {
                                    // send powerplan data to browser
                                    socket.emit(
                                        'setData',
                                        {
                                            keyPath:    ['powerplans'],
                                            data:       powerplans
                                        }
                                    );
                                }
                            );
                    }

                ).every(powerplandisplay.config.refresh, 's').start.now();
            }
        );


        // set up actions forwarder
        socket.on(
            'action',
            function (data) {
                if ((typeof data.fn === 'object') && (data.fn.length > 0)) {
                    // attempt to call function in base environment
                    var fn = powerplandisplay;

                    for (var f in data.fn) {
                        fn = fn[data.fn[f]];
                    }

                    if (typeof fn === 'function') {
                        fn.apply(
                            powerplandisplay,
                            data.params
                        );
                    }
                }
            }
        );
    }
);


// show welcome message
console.info(
    '\n' + powerplandisplay.sys.name + ' (v' + powerplandisplay.sys.version + ')' +
    (
        powerplandisplay.config.debug ?
            ' (debug enabled)':
            ''
    ) +
    '\n'
);


// create and show app window?
if (powerplandisplay.config.showWindow) {
    // observe app ready event
    app.on(
        'ready',
        function () {
            var obj = powerplandisplay.fn.createWindow();

            // set created objects into global scope
            win = obj.win;
            powersave = obj.powersave;
        }
    );


    // observe app all windows closed event
    app.on(
        'window-all-closed',
        function () {
            // on OS X, keep application active until the user quits explicitly with Cmd + Q
            if (process.platform !== 'darwin') {
                app.quit();
            }
        }
    );
}