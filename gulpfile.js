var fs = require('fs');
var argv = require('yargs').argv;
var runSequence = require('run-sequence');
var gulp = require('gulp');
var gulpif = require('gulp-if');
var strip = require('gulp-strip-comments');
var clean = require('gulp-clean');
var replace = require('gulp-replace');
var stylus = require('gulp-stylus');
var jeet = require('jeet');
var autoprefixer = require('gulp-autoprefixer');
var csso = require('gulp-csso');
var rename = require('gulp-rename');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var newer = require('gulp-newer');
var imagemin = require('gulp-imagemin');


// determine if in development mode
var isDevelopment = argv.development;

if (isDevelopment) {
    console.log(
        '---- Development mode ----'
    );
}


gulp.task('styles', function () {
    gulp
        .src('src/css/index.styl')
        .pipe(
            stylus(
                {
                    use: [
                        jeet()
                    ]
                }
            )
        )
        .pipe(autoprefixer())
        .pipe(
            gulpif(
                isDevelopment, gulp.dest('app/css')
            )
        )
        .pipe(
            rename('index.min.css')
        )
        .pipe(csso())
        .pipe(gulp.dest('app/css'));
});


gulp.task('scripts_main', function () {
    gulp
        .src([
            'src/js/index.js'
        ])
        .pipe(concat('index.js'))
        .pipe(
            gulpif(
                isDevelopment, gulp.dest('app/js')
            )
        )
        .pipe(
            rename('index.min.js')
        )
        .pipe(uglify())
        .pipe(gulp.dest('app/js'));
});

gulp.task('scripts_ondemand', function () {
    gulp
        .src([
            'src/js/lib_ondemand/*.js'
        ])
        .pipe(
            gulpif(
                isDevelopment, gulp.dest('app/js')
            )
        )
        .pipe(
            rename({
                suffix: '.min'
            })
        )
        .pipe(uglify())
        .pipe(gulp.dest('app/js'));
});

gulp.task('scripts_powerplandisplay', function () {
    gulp
        .src([
            'src/js/powerplandisplay/*.js'
        ])
        .pipe(
            gulpif(
                isDevelopment, gulp.dest('app/js/powerplandisplay')
            )
        )
        .pipe(
            rename({
                suffix: '.min'
            })
        )
        .pipe(uglify())
        .pipe(gulp.dest('app/js/powerplandisplay'));
});


gulp.task('transfer_pages', function () {
    // copy HTML pages
    gulp
        .src('src/*.html')
        .pipe(gulp.dest('app'));
});

gulp.task('transfer_config', function () {
    // create editable config (if doesn't already exist)
    if (!fs.existsSync('config_editable.js')) {
        gulp
            .src('app/config.js')
            .pipe(strip())
            .pipe(
                rename('app/config_editable.js')
            )
            .pipe(gulp.dest('.'));
    }
});


gulp.task('images', function () {
    // optimise images
    gulp
        .src('src/img/**')
        .pipe(newer('app/img'))
        .pipe(imagemin({ progressive: true }))
        .pipe(gulp.dest('app/img'));

    // copy favicon
    gulp
        .src('src/favicon.ico')
        .pipe(gulp.dest('app'));
});





// define workflow tasks
gulp.task(
    'default',
    [
        'styles',
        'scripts_main',
        'scripts_ondemand',
        'scripts_powerplandisplay',
        'transfer_pages',
        'images'
    ]
);

gulp.task(
    'scripts',
    [
        'scripts_main',
        'scripts_ondemand',
        'scripts_powerplandisplay'
    ]
);

gulp.task(
    'clean',
    function () {
        return gulp
            .src(
                [
                    'app/css',
                    'app/img',
                    'app/js',
                    'app/favicon.ico',
                    'app/index.html'
                ],
                {
                    read: false
                }
            )
            .pipe(clean());
    }
);

gulp.task(
    'release',
    function (callback) {
        runSequence(
            'clean',
            'default',
            'transfer_config',
            callback
        );
    }
);




// set up file watcher
gulp.task('watch', function () {
    gulp.watch(['gulpfile.js'], ['default']);

    gulp.watch(['src/css/*.styl'], ['styles']);

    gulp.watch(['src/js/*'], ['scripts_main']);
    gulp.watch(['src/js/lib_ondemand/**'], ['scripts_ondemand']);
    gulp.watch(['src/js/powerplandisplay/**'], ['scripts_powerplandisplay']);

    gulp.watch(['src/*.html'], ['transfer_pages']);

    gulp.watch(['src/img/**'], ['images']);
});