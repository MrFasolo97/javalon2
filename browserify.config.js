const browserify = require('browserify');
const fs = require('fs');

browserify({
    entries: ['./index.mjs'],
    extensions: ['.mjs', '.js'],
    debug: true // generates sourcemaps
})
.transform('babelify', {
    extensions: ['.mjs', '.js'],
    sourceMaps: true
})
.transform('uglifyify', { global: true })
.bundle()
.on('error', err => {
    console.error(err.toString());
})
.pipe(fs.createWriteStream('bundle.js'));
