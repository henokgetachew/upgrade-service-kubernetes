import { V1Container, V1Deployment } from '@kubernetes/client-node';
import K8sManager from '../lib/k8s-manager';
import { IUpgradeMessage } from '../lib/upgrade-message';
import { runCommand } from '../utils/command-exec';
import { k8s_deployment_name, tempNamespace } from '../resources/test-constants';


describe('k8s-manager', () => {

    beforeAll(async () => {
        await runCommand(`kubectl apply -f src/resources/nginx.default.yaml`, 'Creating an nginx deployment in the default namespace');
        await runCommand(`kubectl -n ${tempNamespace} apply -f src/resources/nginx.yaml`, 'Creating an nginx deployment');
        await runCommand(`sleep 2`, 'Waiting a few seconds...');
    });

    it('Role Based Access Policy Works', async () => {
        /*
        We shouldn't be able to upgrade deployments in different namespaces.
        */

        const upgradeMessageArray: IUpgradeMessage[] = [{containerName: 'nginx-default', imageTag: '1.20'}];
        const k8sMgr = new K8sManager(tempNamespace, k8s_deployment_name, upgradeMessageArray);
        let errMessage: any = undefined;

        try {
            await k8sMgr.upgradeDeploymentContainers();
        } catch (err) {
            errMessage = err;
        }

        expect(errMessage).toBeDefined();

    }, 50000);

    it('Version upgrades work as intended', async () => {
        const upgradeMessageArray: IUpgradeMessage[] = [{containerName: 'nginx', imageTag: '1.19'}];
        const k8sMgr = new K8sManager(tempNamespace, k8s_deployment_name, upgradeMessageArray);

        // if this is an integration test, we should not be mocking helper methods
        k8sMgr.areAllDeploymentsInReadyState = jest.fn(() => new Promise((resolve) => resolve({ready: true, imageNotReady: undefined, state: undefined})));

        await k8sMgr.upgradeDeploymentContainers();
        // to make this test complete, can we assert the version before and after the upgrade?
        const version = await k8sMgr.getCurrentVersion('nginx');

        expect(version).toContain('1.19');
    });

    // please add a test where the passed image tag doesn't exist nginx:5.0.0
    // please add a test where the containerName is not found
    // please add a test where a container is not ready
    //

    it('Can pull deployment object', async () => {
        const upgradeMessageArray: IUpgradeMessage[] = [{containerName: 'nginx', imageTag: '1.19'}];
        const k8sMgr = new K8sManager(tempNamespace, k8s_deployment_name, upgradeMessageArray);

        const deployment = await k8sMgr.pullDeploymentObject();

        expect(deployment).toBeInstanceOf(V1Deployment);
        // please add a test where you are pulling the deployment object for a missing namespace / deployment name
    });

    it('Can pull container in namespace', async () => {
        const upgradeMessageArray: IUpgradeMessage[] = [{containerName: 'upgrade-service', imageTag: 'some-tag-doesnt-matter-here'}];
        const k8sMgr = new K8sManager(tempNamespace, k8s_deployment_name, upgradeMessageArray);

        const response = await k8sMgr.getContainerInNamespace('upgrade-service');

        expect(response.container).toBeInstanceOf(V1Container);
        expect(response.deployment).toBeInstanceOf(V1Deployment);

        // please add tests for when the container is not found
    });
});
