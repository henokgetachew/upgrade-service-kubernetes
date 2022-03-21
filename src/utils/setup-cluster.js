/* eslint-disable @typescript-eslint/no-var-requires */
const {runCommand} = require('./command-exec');

const tempCluster = 'temporary-test-cluster';
const tempNamespace = 'k8s-cht-deployment';

const initialize = async () => {
    await runCommand(`npm run build-docker-image-latest`);
    await runCommand(`k3d image import medicmobile/upgrade-service:latest -c ${tempCluster}`,
        'Importing docker image...');
    await runCommand(
        `k3d cluster create ${tempCluster} --port 5008:30008@loadbalancer`, 'Creating temporary test cluster ...');
    await runCommand(`kubectl create namespace ${tempNamespace}`, 'Creating test namespace k8s-cht-deployment');
    await runCommand(`kubectl -n ${tempNamespace} apply -f kubernetes/`, 'Creating deployments...');
    await runCommand(`kubectl -n ${tempNamespace} apply -f kubernetes/rbac/`, 'Applying role based policies...');
    await runCommand('sleep 5');
};

const initializeAssumeClusterAlreadyExists = async () => {
    await runCommand(`npm run build-docker-image-latest`);
    await runCommand(`k3d image import medicmobile/upgrade-service:latest -c ${tempCluster}`,
        'Importing docker image...');
    await runCommand(`kubectl create namespace ${tempNamespace}`, 'Creating test namespace k8s-cht-deployment');
    await runCommand(`kubectl -n ${tempNamespace} apply -f kubernetes/`, 'Creating deployments...');
    await runCommand(`kubectl -n ${tempNamespace} apply -f kubernetes/rbac/`, 'Applying role based policies...');
};

const destroy = async () => {
    await runCommand('k3d cluster delete temporary-test-cluster', 'Deleting temporary test cluster...');
};

module.exports = {
    initialize,
    destroy,
    initializeAssumeClusterAlreadyExists
};
