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
      http      = require('http'),
      path      = require('path'),
      url       = require('url'),
      fs        = require('fs'),
      os        = require('os'),
      mime      = require('mime'),
      io        = require('socket.io');


// define module shorthand names
const app = electron.app;


// keep a global reference of certain objects to stop them getting garbage collected
let win, powersave;


// load package and config
const pkg = require('./package.json');
const powerplandisplay = require('./config');


// make powerplandisplay framework available globally
global.powerplandisplay = powerplandisplay;


// initialise framework variables
powerplandisplay.sys = {
    rootDir:    __dirname,
    name:       pkg.name,
    version:    pkg.version
};

powerplandisplay.moduleInstances = {};


// define command line arguments
const staticConfigOptions = {
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
    version: {
        abbr:       'v',
        flag:       true,
        help:       'Print version and exit',
        callback: function () {
            return powerplandisplay.sys.name + ' ' + powerplandisplay.sys.version;
        }
    },
    showWindow: {
        abbr:       's',
        default:    true,
        help:       'Show the app GUI in a window (if disabled, this will only be accessible via a web browser)'
    },
    port: {
        abbr:       'p',
        default:    80,
        help:       'Local port number that interface is served from'
    },
    theme: {
        abbr:       't',
        default:    'full',
        help:       'Display theme'
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


// check for split debug / production config
if ((typeof staticConfig.debug === 'object') && (typeof staticConfig.production === 'object')) {
    if (isDebug) {
        powerplandisplay.config = staticConfig.debug;
        powerplandisplay.config.debug = true;

    } else {
        powerplandisplay.config = staticConfig.production;
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


// define function to get full / minified file based on debug flag
powerplandisplay.path = function (pathItems, injectMin) {
    pathItems.unshift(
        powerplandisplay.sys.rootDir, 'app'
    );

    // inject '.min' into filename?
    if (!powerplandisplay.config.debug && (injectMin !== false)) {
        pathItems[pathItems.length - 1] = pathItems[pathItems.length - 1].replace('.', '.min.');
    }

    return path.join.apply(this, pathItems);
};


// load utility functions
powerplandisplay.fn = require(
    powerplandisplay.path(
        [
            'js', 'powerplandisplay', 'fn.js'
        ]
    )
);


// initialise data storage
powerplandisplay.data = {
    powerplans: []
};




// start serving interface via URL's
var server = http
    .createServer(
        function (request, response) {
            // get the file
            var filepath = unescape(url.parse(request.url).pathname);

            if (filepath === '/') {
                filepath = '/index.html';
            }

            filepath = './app' + filepath;

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

                case '.json':
                    contentType = 'application/json';
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
                // request powerplans, and send to browser when received
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