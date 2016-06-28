/*!
 * WARNING:
 * Don't make changes to this file, make any changes to config_editable.js so that they are not overwritten on upgrade!
 */

var powerplandisplay = {
    config: {
        port:           5555,
        notOnTop:       false,
        showWindow:     true,
        webInspector:   false,
        theme:          'full',
        refresh:        5,
        frame:          true,
        updateUrl:      'https://github.com/dannyakakong/powerplandisplay/blob/master/package.json'
    },

    hiddenPowerPlans: [
    ],

    themes: {
        full: {
            name:   'Full',
            frame: {
                width:  654,
                height: 450
            },
            noframe: {
                width:  650,
                height: 412
            }
        },

        compact: {
            name:   'Compact',
            frame: {
                width:  350,
                height: 198
            },
            noframe: {
                width:  346,
                height: 160
            }
        }
    }
};

module.exports = powerplandisplay;