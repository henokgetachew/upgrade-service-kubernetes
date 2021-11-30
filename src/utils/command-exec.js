const {exec} = require('child_process');

const runCommand = async function (command, statusUpdate) {
    return new Promise((resolve, reject) => {
        // if this is a debug log, please remove
        // if this is something that should be logged, please add some context
        console.log(`${statusUpdate}`);
        exec(command, (err, stdout, stderr) => {
            if(err || stderr) {
                // please use const over let
                let errCombined = [err, stderr].join('');
                // this should be console.error('Error while running command', command, errCombined);
                console.log(errCombined);
                // please return here and remove this else block
                reject(errCombined);
            } else {
                // please add some context around this log
                // console.log('command ran successfully', command, stdout);
                console.log(stdout);
                resolve(stdout);
            }
        });
    });
};

module.exports = {
    runCommand
};
