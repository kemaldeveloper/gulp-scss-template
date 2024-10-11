import path from 'path';
import gulp from 'gulp';
import browsersync from 'browser-sync';
import bssi from 'browsersync-ssi';
import ssi from 'ssi';
import babel from 'gulp-babel';
import cleancss from 'gulp-clean-css';
import rename from 'gulp-rename';
import autoPrefixer from 'gulp-autoprefixer';
import notify from 'gulp-notify';
import sourcemaps from 'gulp-sourcemaps';
import uglify from 'gulp-uglify';
import concat from 'gulp-concat';
import nodeSass from 'node-sass';
import { deleteAsync } from 'del';
import gulpSass from 'gulp-sass';
// SVG sprite
import svgStore from 'gulp-svgstore';
import svgMin from 'gulp-svgmin';
import cheerio from 'gulp-cheerio';

const { src, dest, parallel, series, watch } = gulp;
const sass = gulpSass(nodeSass);

const app = {
  src: 'src',
  build: 'dist',
};

const watchFileTypes = 'html,json,woff,woff2';

const cssLibsPaths = ['node_modules/magnific-popup/dist/magnific-popup.css'];
const jsLibsPaths = ['node_modules/jquery/dist/jquery.min.js', 'node_modules/magnific-popup/dist/jquery.magnific-popup.min.js'];

const jsLibs = () => {
  return src(jsLibsPaths).pipe(concat('libs.min.js')).pipe(uglify()).pipe(dest('src/js')).pipe(browsersync.stream());
};

const js = () => {
  return src(`${app.src}/js/main.js`)
    .pipe(babel({ presets: ['@babel/env'] }))
    .pipe(uglify())
    .pipe(rename({ extname: '.min.js' }))
    .pipe(dest(`${app.src}/js`))
    .pipe(browsersync.stream());
};

const cssLibs = () => {
  return src(cssLibsPaths)
    .pipe(concat('libs.min.css'))
    .pipe(autoPrefixer(['last 10 versions']))
    .pipe(cleancss({ level: { 1: { specialComments: 0 } } }))
    .pipe(dest(`${app.src}/css`))
    .pipe(browsersync.stream());
};

const css = () => {
  return src(`${app.src}/scss/main.scss`)
    .pipe(sourcemaps.init())
    .pipe(sass({ outputStyle: 'expanded' }).on('error', notify.onError()))
    .pipe(autoPrefixer(['last 10 versions']))
    .pipe(cleancss({ level: { 1: { specialComments: 0 } } }))
    .pipe(rename({ extname: '.min.css' }))
    .pipe(sourcemaps.write('.'))
    .pipe(dest(`${app.src}/css`))
    .pipe(browsersync.stream());
};

const svgSprite = () => {
  return src(`${app.src}/assets/svg-sprite/*.svg`)
    .pipe(
      svgMin(function (file) {
        var prefix = path.basename(file.relative, path.extname(file.relative));
        return {
          plugins: [
            {
              cleanupIDs: {
                prefix: prefix + '-',
                minify: true,
              },
            },
          ],
        };
      }),
    )
    .pipe(
      cheerio({
        run: function ($) {
          $('[fill]').removeAttr('fill');
          $('[fill-opacity]').removeAttr('fill-opacity');
          $('[stroke]').removeAttr('stroke');
          $('[style]').removeAttr('style');
          $('[data-name]').removeAttr('data-name');
        },
        parserOptions: { xmlMode: true },
      }),
    )
    .pipe(svgStore())
    .pipe(dest(`${app.src}/assets/`));
};

const browserSync = () => {
  browsersync.init({
    server: {
      baseDir: app.src,
      middleware: bssi({ baseDir: `${app.src}/`, ext: '.html' }),
    },
    ghostMode: { clicks: false },
    notify: false,
    open: false,
  });
};

const buildCopy = () => {
  return src([`{${app.src}/js,src/css}/*.min.*`, `${app.src}/assets/**/*`, `${app.src}/*.html`], {
    base: `${app.src}/`,
  }).pipe(dest(`${app.build}`));
};

const buildHtml = async () => {
  const includes = new ssi(`${app.src}/`, `${app.build}/`, '/**/*.html');

  includes.compile();
  await deleteAsync(`${app.build}/parts`, { force: true });
};

const cleanDist = async () => {
  await deleteAsync(`${app.build}/**/*`, { force: true });
};

const startWatch = () => {
  watch(`${app.src}/scss/**/*.scss`, { usePolling: true }, css);
  watch([`${app.src}/js/**/*.js`, `!${app.src}/js/**/*.min.js`], { usePolling: true }, js);
  watch(`${app.src}/assets/svg-sprite/*.svg`, { usePolling: true }, svgSprite);
  watch(`${app.src}/**/*.{${watchFileTypes}}`, { usePolling: true }).on('change', browsersync.reload);
};

// Export
export const build = series(cleanDist, jsLibs, js, cssLibs, css, buildCopy, buildHtml, svgSprite);
export default series(jsLibs, js, cssLibs, css, svgSprite, parallel(browserSync, startWatch));
