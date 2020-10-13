const fs = require('fs');
const path = require('path');
const del = require('del');
const browserSync = require('browser-sync').create();
const open = require('open');
const postcss = require('postcss');
const autoprefixer = require('autoprefixer');

const utils = require('./utils');

const cssPrefixer = postcss([autoprefixer]);
const promisify = utils.promisify;

const root = 'src'; // 源文件夹
const dist = 'dist';// 目标文件夹

// 函数promise化
const shtml2Html = promisify(require('shtml2html'));
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const pSassRender = promisify(require('node-sass').render);
const pWriteFile = promisify(fs.writeFile);
const pCopyFile = promisify(fs.copyFile);
const mkdir = promisify(require('mkdirp'));
const babelTransform = promisify(require('babel-core').transformFile);

// 检查有未捕捉的promise error
process.on('unhandledRejection', (reason, p) => {
	console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

// 如果没有文件，先创建文件夹，下同
function writeFile(file, data, callback) {
	if (fs.existsSync(file)) {
		return pWriteFile(file, data, callback)
			.catch(err => {
				console.log(err);
			});
	}
	return mkdir(path.dirname(file))
		.then(() => {
			return pWriteFile(file, data, callback);
		}).catch(err => {
			console.log(err);
		});
}

function copyFile(origin, dest, callback) {
	if (fs.existsSync(dest)) {
		return pCopyFile(origin, dest, callback)
			.catch(err => {
				console.log(err);
			});
	}
	return mkdir(path.dirname(dest))
		.then(() => {
			return pCopyFile(origin, dest, callback)
		}).catch(err => {
			console.log(err);
		});
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
						console.log(err);
					});
			})
			return Promise.all(promiseFilesList);
		})
		.catch(err => {
			console.log(err);
		});
}

// sass
function sassRender(files) {
	const fileRet = Array.isArray(files) ? files : [files];
	const pMap = fileRet.map(file => {
		pSassRender({ file })
			.then(ret => {
				const env = process.env.NODE_ENV;
				if (env === 'production') {
					return cssPrefixer.process(ret.css, { from: undefined });
				} else if (env === 'development') {
					return Promise.resolve(ret);
				}
			})
			.catch(err => {
				console.log(err);
			})
			.then(ret => {
				let destFile = file
					.replace(new RegExp(`^${root}`), dist)
					.replace(/.scss$/, '.css');
				return writeFile(destFile, ret.css);
			})
			.catch(err => {
				console.log(err);
			});
	});
	return Promise.all(pMap).catch(err => {
		console.log(err);
	});
}

// shtml编译成html
function shtmlCompile(files) {
	const fileRet = Array.isArray(files) ? files : [files];
	let pMap = fileRet.map(file => {
		return shtml2Html(file, file.replace(new RegExp(`^${root}`), dist), root)
			.catch(err => {
				console.log(err);
			});
	})
	return Promise.all(pMap);
}

// babel
function babelCompile(files) {
	const fileRet = Array.isArray(files) ? files : [files];
	let pMap = fileRet.map(file => {
		return babelTransform(file)
			.then(ret => {
				const destFile = file.replace(new RegExp(`^${root}`), dist);
				return writeFile(destFile, ret.code);
			}).catch(err => {
				console.log(err);
			});
	})
	return Promise.all(pMap);
}

// 复制其他类型的文件
function copyOtherFiles(files) {
	const fileRet = Array.isArray(files) ? files : [files];
	let pMap = fileRet.map(file => {
		const destFile = file.replace(new RegExp(`^${root}`), dist);
		return copyFile(file, destFile);
	})
	return Promise.all(pMap);
}

/**
* 文件变化时浏览器重载
*/
function startServer() {
	browserSync.init({
		server: `./${dist}`
	});

	browserSync.watch(`${root}/**`, { ignoreInitial: true }, (event, file) => {
		/**
		 * Windows下，监听文件发生变化时，VSCode会锁死文件一段时间，
		 * 此时使用sass编译会提示无法访问该文件
		 * 目前只能通过延时100ms来解决
		 * Mac OS没有这个问题
		 */
		setTimeout(() => {
			const extname = path.extname(file);
			const filename = path.basename(file);
			const destFile = file.replace(new RegExp(`^${root}`), dist);;
			if (event === 'change') {
				if (extname === '.scss') {
					if (!filename.startsWith('_')) {
						sassRender(file).then(() => { browserSync.reload(); });
					} else {
						build(extname).then(() => { browserSync.reload(); });
					}
				} else if (extname === '.shtml') {
					if (!filename.startsWith('_')) {
						shtmlCompile(file).then(() => { browserSync.reload(); });
					} else {
						build(extname).then(() => { browserSync.reload(); });
					}
				} else if (extname === '.js') {
					babelCompile(file).then(() => { browserSync.reload(); });
				} else {
					copyFile(file, destFile);
				}
			} else if (event === 'add') {
				if (extname === '.scss' && !path.basename(file).startsWith('_')) {
					sassRender(file);
				} else if (extname === '.shtml' && !file.split('/').slice(-2) === 'include') {
					shtml2Html(file);
				} else if (extname === '.js') {
					babelCompile(file);
				} else if (!['.scss', '.js', '.shtml'].includes(extname)) {
					copyFile(file, destFile);
				}
			} else if (event == 'unlink') {
				// 删除文件
				const isUnlinkScss = extname === '.scss' && !path.basename(file).startsWith('_');
				const isUnlinkShtml = extname === '.shtml' && !file.split('/').slice(-2) === 'include';
				const isUnlinkJs = extname === 'js';
				const isUnlinkOtherFile = !['.scss', '.js', '.shtml'].includes(extname);

				if (isUnlinkScss || isUnlinkShtml || isUnlinkJs || isUnlinkOtherFile) {
					fs.unlink(file, err => {
						if (err) {
							console.log(err);
						}
					});
				}
			} else if (event === 'unlinkDir') {
				// 删除文件夹
				fs.rmdir(file, err => {
					if (err) {
						console.log(err);
					}
				});
			}
		}, 100);
	});
}

function build(ext) {
	const cssList = [];
	const jsList = [];
	const htmlList = [];
	const sourceList = [];
	return readFileRecursive(root, dest => {
		const destExtname = path.extname(dest);
		const basename = path.basename(dest);
		if (destExtname === '.scss') {
			if (!basename.startsWith('_')) {
				cssList.push(dest);
			}
		} else if (destExtname === '.js') {
			jsList.push(dest);
		} else if (destExtname === '.shtml') {
			if (!basename.startsWith('_')) {
				htmlList.push(dest);
			}
		} else {
			sourceList.push(dest);
		}
	})
		.then(() => {
			let pList = [];
			if (ext === '.scss') {
				pList.push(sassRender(cssList));
			} else if (ext === '.js') {
				pList.push(babelCompile(jsList));
			} else if (ext === '.shtml') {
				pList.push(shtmlCompile(htmlList));
			} else if (ext) {
				pList.push(copyOtherFiles(sourceList));
			} else {
				pList = [
					sassRender(cssList),
					shtmlCompile(htmlList),
					babelCompile(jsList),
					copyOtherFiles(sourceList)
				];
			}
			return Promise.all(pList);
		})
		.catch(err => {
			console.log(err);
		});
}

// main
del('dist/**')
	.then(() => {
		return build();
	})
	.then(() => {
		const env = process.env.NODE_ENV;
		if (env === 'development') {
			startServer();
		} else if (env === 'production') {
			// 打包完成后打开项目根目录
			console.log('打包完成！');
			open('./dist');
		}
	})
	.catch(err => {
		console.log(err);
	});;