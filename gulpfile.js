const gulp = require('gulp');
const sourcemaps = require('gulp-sourcemaps');
const babel = require('gulp-babel');
const newer = require('gulp-newer');
const plumber = require('gulp-plumber');
const watch = require('gulp-watch');
const through = require('through2');
const { log, colors } = require('gulp-util');
const { relative } = require('path');

const src = 'src/**/*.js';
const dest = 'lib/';

gulp.task('default', ['build']);

gulp.task('build', () =>
  gulp.src(src)
    .pipe(plumber())
    .pipe(newer(dest))
    .pipe(through.obj((file, enc, cb) => {
      const path = relative(__dirname, file.path);
      log(`Compiling '${colors.cyan(path)}'...`);
      cb(null, file);
    }))
    .pipe(sourcemaps.init())
    .pipe(babel())
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(dest)));

gulp.task('watch', ['build'], () => {
  watch(src, () => {
    gulp.start('build');
  });
});
