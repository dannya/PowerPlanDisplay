var powerplandisplay = {
    config: {
        debug: {
            port:           8080,
            notOnTop:       true,
            windowedWidth:  504,
            windowedHeight: 148,
            showWindow:     true,
            webInspector:   false,
            theme:          'compact',
            updateUrl:      false
        },

        production: {
            port:           80,
            notOnTop:       false,
            windowedWidth:  504,
            windowedHeight: 148,
            showWindow:     true,
            webInspector:   false,
            theme:          'compact',
            updateUrl:      'https://github.com/dannyakakong/powerplandisplay/blob/master/package.json'
        }
    }
};


module.exports = powerplandisplay;