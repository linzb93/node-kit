const postcss = require('postcss');
const autoprefixer = require('autoprefixer');
const fs = require('fs');

fs.copyFile('src/img/logo3.png', 'dist/img/logo3.png', err => {
    if (err) {
        throw err;
    }
})