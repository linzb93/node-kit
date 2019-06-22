const pEach = require('p-each-series');
const chalk = require('chalk');
(async () => {
    const arr = [1,2,4,7];
    
    function timeout(data) {
        return new Promise((res, rej) => {
            setTimeout(function() {
                res(data);
            }, 1000)
        })
    }

    await pEach(arr, async item => {
        let data = await timeout(item);
        if (data < 4) {
            console.log(chalk.red(data));
        } else {
            console.log(chalk.green(data));
        }
    });
})()