const {exec} = require('child_process');

const runCommand = async function (command, statusUpdate) {
    return new Promise((resolve, reject) => {
        console.log(`${statusUpdate}`);
        exec(command, (err, stdout, stderr) => {
            if(err || stderr) {
                let errCombined = [err, stderr].join('');
                console.log(errCombined);
                reject(errCombined);
            } else {
                console.log(stdout);
                resolve(stdout);
            }
        });
    });
};

module.exports = {
    runCommand
};
