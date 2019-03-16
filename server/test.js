const postcss = require('postcss');
const autoprefixer = require('autoprefixer');
const fs = require('fs');

fs.readFile('dist/css/style.css', (err, css) => {
    postcss([autoprefixer]).process(css)
    .then(ret => {
        fs.writeFile('dist/css/style2.css', ret.css, () => {});
    })
})