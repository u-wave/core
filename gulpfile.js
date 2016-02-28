const gulp = require('gulp');
const babel = require('gulp-babel');
const newer = require('gulp-newer');
const through = require('through2');
const log = require('gulp-util').log;
const colors = require('gulp-util').colors;
const relative = require('path').relative;

const src = 'src/**/*.js';
const dest = 'lib/';

gulp.task('default', ['build']);

gulp.task('build', () => {
  return gulp.src(src)
    .pipe(newer(dest))
    .pipe(through.obj((file, enc, cb) => {
      const path = relative(__dirname, file.path);
      log(`Compiling '${colors.cyan(path)}'...`);
      cb(null, file);
    }))
    .pipe(babel())
    .pipe(gulp.dest(dest));
});

gulp.task('watch', ['build'], () => {
  gulp.watch(src, ['build']);
});
