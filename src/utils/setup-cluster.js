const {runCommand} = require("./command-exec");

const tempCluster = 'temporary-test-cluster';
const tempNamespace = 'k8s-cht-deployment';
const k8s_deployment_name = 'archv3-deployment';

const initialize = async () => {
    await runCommand(`k3d cluster create ${tempCluster} --port 5008:30008@loadbalancer`, 'Creating temporary test cluster ...');
    await runCommand(`kubectl create namespace ${tempNamespace}`, 'Creating test namespace k8s-cht-deployment');
    await runCommand(`kubectl -n ${tempNamespace} apply -f kubernetes/`, 'Creating deployments...');
    await runCommand(`kubectl -n ${tempNamespace} apply -f kubernetes/rbac/`, 'Applying role based policies...');
}

const destroy = async () => {
    await runCommand('k3d cluster delete temporary-test-cluster', 'Deleting temporary test cluster...');
}

module.exports = {
    initialize,
    destroy
}
