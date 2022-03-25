/* eslint-disable @typescript-eslint/no-var-requires */
const {runCommand} = require('./command-exec');

const tempCluster = 'temporary-test-cluster';
const tempNamespace = 'k8s-cht-deployment';

async function configureRBAC() {
    await runCommand(`kubectl -n ${tempNamespace} apply -f kubernetes/rbac/`, 'Applying role based policies...');
}

async function createDeployment() {
    await runCommand(`kubectl -n ${tempNamespace} apply -f kubernetes/`, 'Creating deployments...');
}

async function createNamespace() {
    await runCommand(`kubectl create namespace ${tempNamespace}`, 'Creating test namespace k8s-cht-deployment');
}

async function importImage() {
    await runCommand(`k3d image import medicmobile/upgrade-service:latest -c ${tempCluster}`,
        'Importing docker image...');
}

async function createCluster() {
    await runCommand(
        `k3d cluster create ${tempCluster} --port 5008:30008@loadbalancer`, 'Creating temporary test cluster ...');
}

async function buildLatestImage() {
    try {
        await runCommand(`docker build . -t medicmobile/upgrade-service`, 'Building latest image.');
    } catch(err) {
        console.error('Error thrown', err);
    }
}

const initialize = async () => {
    await buildLatestImage();
    await createCluster();
    await importImage();
    await createNamespace();
    await createDeployment();
    await configureRBAC();
    await runCommand('sleep 5');
};

const initializeAssumeClusterAlreadyExists = async () => {
    await buildLatestImage();
    await importImage();
    await createNamespace();
    await createDeployment();
    await configureRBAC();
};

const destroy = async () => {
    await runCommand('k3d cluster delete temporary-test-cluster', 'Deleting temporary test cluster...');
};

module.exports = {
    initialize,
    destroy,
    initializeAssumeClusterAlreadyExists
};
