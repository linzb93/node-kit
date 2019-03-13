const fs = require('fs');
const path = require('path');
const del = require('del');
const browserSync = require('browser-sync').create();
const s2h = require('shtml2html');
const root = 'src'; // 源文件夹
const dist = 'dist';// 目标文件夹

// 检查有未捕捉的promise error
process.on('unhandledRejection', (reason, p) => {
    console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

// 简单实现一个promisify
function promisify(fn) {
    return (...args) => (
        new Promise((resolve, reject) => {
            args.push((err,result) => {
                if(err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
            fn.apply(null, args);
        })
    )
}

// shtml2html做error first兼容处理
function newS2h(from, to, wwwroot, callback) {
    return s2h(from, to, wwwroot, callback.bind(this, null));
}
const shtml2Html = promisify(newS2h);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const pSassRender = promisify(require('node-sass').render);
const pWriteFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const babelTransform = promisify(require('babel-core').transformFile);

// 如果没有文件，先创建文件夹
function writeFile(file, data, callback) {
    if (fs.existsSync(file)) {
        return pWriteFile(file, data, callback).catch(err => {
            throw err;
        });
    } else {
        return mkdir(path.dirname(file), {recursive: true})
        .then(() => {
            return pWriteFile(file, data, callback);
        }).catch(err => {
            throw err;
        });
    }
}

// 递归搜索文件
function readFileRecursive(dir, callback) {
    return readdir(dir)
    .then(files => {
        const promiseFilesList = files.map(item => {
            const dest = path.join(dir, item);
            return stat(dest)
            .then(stats => {
                if (stats.isDirectory()) {
                    return readFileRecursive(dest, callback);
                }
                callback(dest);
            }).catch(err => {
                throw err;
            });
        })
        return Promise.all(promiseFilesList);
    })
    .catch(err => {
        throw err;
    });
}

// 先移除dist文件夹
del('dist/**').then(() => {
    Promise.all([
        sassReadAll(),
        shtmlCompile(),
        babelHandler()
    ]).then(() => {
        console.log('编译成功');
    }).catch(err => {
        throw err;
    })
});

// sass编译
/**
 * sass编译
 * 深度遍历源文件夹，找到所有的scss格式文件，排除前缀是“_”的scss文件，其他的编译。
 */
function sassRender(files) {
    const pMap = files.map(file => {
        pSassRender({file})
        .then(ret => {
            let destFile = file
            .replace(new RegExp(`^${root}`), dist)
            .replace(/.scss$/, '.css');
            return writeFile(destFile, ret.css);
        }).catch(err => {
            throw err;
        });
    });
    return Promise.all(pMap).catch(err => {
        throw err;
    });
}
function sassReadAll() {
    const fileList = [];
    return readFileRecursive(root, dest => {
        if (path.extname(dest) === '.scss' && !path.basename(dest).startsWith('_')) {
            fileList.push(dest);
        }
    }).then(() => {
        return sassRender(fileList);
    }).catch(err => {
        throw err;
    });
}

// shtml编译成html
function shtmlCompile(src = root) {
    const dest = src.replace(new RegExp(`^${root}`), dist);
    if (src.split('/').slice(-2) === 'include') {
        return shtml2Html(root, dist, root).catch(err => {
            throw err;
        })
    }
    return shtml2Html(src, dest, root).catch(err => {
        throw err;
    })
}

// babel
function babelHandler(file) {
    const fileList = [];
    if (!file) {
        return readFileRecursive(root, dest => {
            if (path.extname(dest) === '.js') {
                fileList.push(dest);
            }
        }).then(() => {
            return babelCompile(fileList);
        }).catch(err => {
            throw err;
        })
    } else {
        fileList.push(file);
        return babelCompile(fileList).catch(err => {
            throw err;
        });
    }
}
function babelCompile(files) {
    let pMap = files.map(file => {
        return babelTransform(file)
        .then(ret => {
            const destFile = file.replace(new RegExp(`^${root}`), dist);
            return writeFile(destFile, ret.code);
        }).catch(err => {
            throw err;
        });
    })
    return Promise.all(pMap);
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