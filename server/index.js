const fs = require('fs');
const path = require('path');
const sass = require('node-sass');
const shtml2Html = require('shtml2html');
const del = require('del');
const babel = require('babel-core');
// const MemoryFileSystem = require("memory-fs");
// const mfs = new MemoryFileSystem();
const browserSync = require('browser-sync').create();

const root = 'src';

// 如果没有文件，先创建文件夹
function writeFile(path, data, callback) {
    if (fs.existsSync(path)) {
        fs.writeFile(path, data, callback);
    } else {
        const dir = path.split('/').slice(0, -1).join('/');
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
    fs.readdir(dir, (err, targets) => {
        if (err) {
            throw err;
        } else {
            targets.forEach(target => {
                const dest = dir + '/' + target;
                if (fs.statSync(dest).isDirectory()) {
                    readFileRecursive(dest , callback);
                } else {
                    callback(dir, target);
                }
            })
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
        if (path.extname(file) === '.scss' && !file.startsWith('_')) {
            sassRenderEachFile(dir + '/' + file);
        }
    });
}

// shtml编译成html
function shtmlCompile(src = root, dest = 'dist') {
    if (src.split('/').slice(-2) === 'include') {
        shtmlCompile();
        shtml2Html(root, 'dist', root, () => {
            console.log('shtml编译成功！');
        });
    } else {
        shtml2Html(src, dest, root, () => {
            console.log('shtml编译成功！');
        });
    }
}

// babel
function babelJsCompile(orginFile) {
    if (!orginFile) {
        readFileRecursive(root, (dir, file) => {
            if (path.extname(file) === '.js') {
                babelJsEachCompile(dir + '/' + file);
            }
        });
    } else {
        babelJsEachCompile(orginFile);
    }
}
function babelJsEachCompile(file) {
    babel.transformFile(file, (err, ret) => {
        const destFile = file.replace(root + '/', 'dist/');
        writeFile(destFile, ret.code, () => {
            console.log('babel编译成功！');
        });
    })
}

/**
 * 文件变化时浏览器重载
 * 后面尽量把shtml的include依赖串起来，include文件夹里的文件有修改时，不要所有文件都编译。
 * 其他文件有改动时都编译
 */
browserSync.init({
    server: './dist'
});

browserSync.watch('./src/**', (event, fileName) => {
    if (event === 'change') {
        if (path.extname(fileName) === '.scss') {
            if (fileName.split('/').slice(-1).indexOf('_') !== 0) {
                sassRenderEachFile(fileName);
            } else {
                sassRender();
            }
        } else if (path.extname(fileName) === '.shtml') {
            shtmlCompile();
        } else if (path.extname(fileName) === '.js') {
            babelJsCompile(fileName);
        }
    } else if (event === 'add') {
        // 添加
    } else if (event == 'unlink') {
        // 删除
    }

    browserSync.reload();
});