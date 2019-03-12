const fs = require('fs');
const path = require('path');
const sass = require('node-sass');
const shtml2Html = require('shtml2html');
const del = require('del');
const babel = require('babel-core');
const browserSync = require('browser-sync').create();
const readdir   = promisify(fs.readdir);
const stat      = promisify(fs.stat);
const root = 'src'; // 源文件夹
const dist = 'dist';// 目标文件夹
//TODO: 三件事做完后有个Promise回调

// 简单实现一个promisify
function promisify(fn) {
    return (...args) => {
        return new Promise((resolve, reject) => {
            args.push((err, result) => {
                if(err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
            fn.apply(null, args);
        });
    }
}

// 如果没有文件，先创建文件夹
function writeFile(file, data, callback) {
    if (fs.existsSync(file)) {
        fs.writeFile(file, data, callback);
    } else {
        fs.mkdir(path.dirname(file), {recursive: true}, err => {
            if (err) {
                throw err;
            } else {
                fs.writeFile(file, data, callback);
            }
        });
    }
}

// 递归搜索文件
function readFileRecursive(dir, callback) {
    readdir(dir).then(files => {
        const promiseFilesList = files.map(item => {
            const dest = path.join(dir, item);
            return stat(dest).then(stats => {
                if (stats.isDirectory()) {
                    return readFileRecursive(dest, callback);
                }
                callback(dest);
            })
        })
        return Promise.all(promiseFilesList);
    });
}

// 先移除dist文件夹
del('dist/**').then(() => {
    sassReadAll();
    shtmlCompile();
    babelJsCompile();
});

// sass编译
/**
 * sass编译
 * 深度遍历源文件夹，找到所有的scss格式文件，排除前缀是“_”的scss文件，其他的编译。
 */
function sassRender(file) {
    sass.render({file}, (err, result) => {
        if (err) {
            throw err;
        } else {
            let destFile = file
            .replace(root + '/', dist + '/')
            .replace(/.scss$/, '.css');
            writeFile(destFile, result.css, writeErr => {
                if (writeErr) {
                    throw writeErr;
                } else {
                    console.log(destFile + '编译成功');
                }
            });
        }
    });
}
function sassReadAll() {
    const fileList = [];
    return readFileRecursive(root, dest => {
        if (path.extname(dest) === '.scss' && !path.basename(dest).startsWith('_')) {
            fileList.push(dest);
        }
    }).then(function() {
        sassRender(fileList);
    });
}

// shtml编译成html
function shtmlCompile(src = root) {
    const dest = src.replace(root + '/', dist + '/');
    if (src.split('/').slice(-2) === 'include') {
        shtml2Html(root, dist, root, () => {
            console.log('shtml编译成功！');
        });
    } else {
        shtml2Html(src, dest, root, () => {
            console.log('shtml编译成功！');
        });
    }
}

// babel
function babelJsCompile(file) {
    if (!file) {
        readFileRecursive(root, (dir, fileName) => {
            if (path.extname(fileName) === '.js') {
                babelJsEachCompile(path.join(dir, fileName));
            }
        });
    } else {
        babelJsEachCompile(file);
    }
}
function babelJsEachCompile(file) {
    babel.transformFile(file, (err, ret) => {
        if (err) {
            throw err;
        }
        const destFile = file.replace(root + '/', dist + '/');
        writeFile(destFile, ret.code, () => {
            console.log('babel编译成功！');
        });
    })
}

/**
 * 文件变化时浏览器重载
 */
// if (process.env.NODE_ENV === 'development') {
//     browserSync.init({
//         server: './' + dist
//     });
    
//     browserSync.watch(root + '/**', (event, file) => {
//         const extname = path.extname(file);
//         const filename = path.basename(file);
//         const destFile = file.replace(root + '/', dist + '/');
//         if (event === 'change') {
//             if (extname === '.scss') {
//                 if (!filename.startsWith('_')) {
//                     sassRenderEachFile(file);
//                 } else {
//                     sassRender();
//                 }
//             } else if (extname === '.shtml') {
//                 shtmlCompile(file);
//             } else if (extname === '.js') {
//                 babelJsCompile(file);
//             } else {
//                 fs.copyFileSync(file, destFile);
//             }
//         } else if (event === 'add') {
//             // 添加
//             /**
//              * 添加和删除同理，引用类scss不变，非引用类scss编译，引用类shtml不变，非引用类shtml编译，js编译，其他文件复制。
//              */
//             if (extname === '.scss' && !path.basename(file).startsWith('_')) {
//                 sassRenderEachFile(file);
//             } else if (extname === '.shtml' && !file.split('/').slice(-2) === 'include') {
//                 shtml2Html(file);
//             } else if (extname === '.js') {
//                 babelJsCompile(file);
//             } else if (!['.scss', '.js', '.shtml'].includes(extname)) {
//                 fs.copyFileSync(file, destFile);
//             }
//         } else if (event == 'unlink') {
//             // 删除
//             const isUnlinkScss = extname === '.scss' && !path.basename(file).startsWith('_');
//             const isUnlinkShtml = extname === '.shtml' && !file.split('/').slice(-2) === 'include';
//             const isUnlinkJs = extname === 'js';
//             const isUnlinkOtherFile = !['.scss', '.js', '.shtml'].includes(extname);

//             if (isUnlinkScss || isUnlinkShtml || isUnlinkJs || isUnlinkOtherFile) {
//                 fs.unlinkSync(file, err => {
//                     if (err) {
//                         throw err;
//                     }
//                 });
//             }
//         }
    
//         browserSync.reload();
//     });
// }