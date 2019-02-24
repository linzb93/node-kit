const sass = require('node-sass');
const shtml2Html = require('shtml2html');
const fs = require('fs');
const del = require('del');
const babel = require('babel-core');

const root = 'src';

// 如果没有文件，先创建文件夹
function writeFile(path, data, callback) {
    if (fs.existsSync(path)) {
        fs.writeFile(path, data, callback);
    } else {
        let dir = path.split('/').slice(0, -1).join('/');
        fs.mkdir(dir, {recursive: true}, err => {
            if (err) {
                throw err;
            } else {
                fs.writeFile(path, data, callback);
            }
        });
    }
}

// 递归搜索文件
function readFileRecursive(dir, callback) {
    fs.readdir(dir, {withFileTypes: true}, (err, files) => {
        if (err) {
            throw err;
        } else {
            files.forEach(file => {
                if (file.isDirectory()) {
                    readFileRecursive(dir + '/' + file.name, callback);
                } else {
                    callback(dir, file);
                }
            });
        }
    });
}

// 先移除dist文件夹
del('dist/**').then(() => {
    sassRender();
    shtmlCompile();
    babelJsCompile();
}).catch(err => {
    throw err;
});

// sass编译
/**
 * sass编译
 * 深度遍历源文件夹，找到所有的scss格式文件，排除前缀是“_”的scss文件，其他的编译。
 */
function sassRenderEachFile(file) {
    sass.render({file}, (err, result) => {
        if (err) {
            throw err;
        } else {
            let destFile = file
            .replace(root + '/', 'dist/')
            .replace(/.scss$/, '.css');
            writeFile(destFile, result.css, writeErr => {
                    if (writeErr) {
                        throw writeErr;
                    } else {
                        console.log(destFile + '编译成功');
                    }
                }
            );
        }
    });
}
function sassRender() {
    readFileRecursive(root, (dir, file) => {
        if (file.name.endsWith('.scss') && !file.name.startsWith('_')) {
            sassRenderEachFile(dir + '/' + file.name);
        }
    });
}

// shtml编译成html
function shtmlCompile() {
    shtml2Html(root, 'dist', root, err => {
        console.log('shtml编译成功！');
    });
}

// babel
function babelJsCompile() {
    readFileRecursive(root, (dir, file) => {
        if (file.name.endsWith('.js')) {
            babel.transformFile(dir + '/' + file.name, (err, ret) => {
                var destFile = (dir + '/' + file.name).replace(root + '/', 'dist/');
                writeFile(destFile, ret.code, () => {
                    console.log('babel编译成功！');
                });
            })
        }
    });
}