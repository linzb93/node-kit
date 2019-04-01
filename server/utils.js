// 简单实现一个promisify
function promisify(fn) {
    return (...args) => (
        new Promise((resolve, reject) => {
            args.push((...cbArgs) => {
                // 做error first兼容处理
                let err, result;
                if (cbArgs.length === 2) {
                    err = cbArgs[0];
                    result = cbArgs[1];
                } else if (cbArgs.length === 1) {
                    result = cbArgs[0];
                }
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
            fn.apply(null, args);
        })
    )
}

exports.promisify = promisify;