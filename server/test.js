const shell = require('shelljs');

const fs = require('fs');
let count = 0;
fs.watch('src',{recursive: true}, (...args) => {
    console.log(args);
    console.log(count++)
})