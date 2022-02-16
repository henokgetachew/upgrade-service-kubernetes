/* eslint-disable @typescript-eslint/no-explicit-any */
import { V1Container, V1Deployment } from '@kubernetes/client-node';
import K8sManager from '../lib/k8s-manager';
import { IUpgradeMessage } from '../lib/upgrade-message';
import { runCommand } from '../utils/command-exec';
import { k8s_deployment_name, tempNamespace } from './resources/test-constants';


describe('k8s-manager', () => {

    beforeAll(async () => {
        await runCommand(
            `kubectl apply -f src/__tests__/resources/nginx.default.yaml`,
            'Creating an nginx deployment in the default namespace');
        await runCommand(
            `kubectl -n ${tempNamespace} apply -f src/__tests__/resources/nginx.yaml`, 'Creating an nginx deployment');
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

        k8sMgr.areAllDeploymentsInReadyState = jest.fn(() => new Promise(
            (resolve) => resolve({ready: true, podsNotReady: undefined})
        ));

        await k8sMgr.upgradeDeploymentContainers();
        const version = await k8sMgr.getCurrentVersion('nginx');

        expect(version).toContain('1.19');
    });

    it('Can pull deployment object', async () => {
        const upgradeMessageArray: IUpgradeMessage[] = [{containerName: 'nginx', imageTag: '1.19'}];
        const k8sMgr = new K8sManager(tempNamespace, k8s_deployment_name, upgradeMessageArray);

        const deployment = await k8sMgr.pullDeploymentObject();

        expect(deployment).toBeInstanceOf(V1Deployment);
    });

    it('Can pull container in namespace', async () => {
        const upgradeMessageArray: IUpgradeMessage[] = [
            {containerName: 'upgrade-service', imageTag: 'some-tag-doesnt-matter-here'}
        ];
        const k8sMgr = new K8sManager(tempNamespace, k8s_deployment_name, upgradeMessageArray);

        const response = await k8sMgr.getContainerInNamespace('upgrade-service');

        expect(response.container).toBeInstanceOf(V1Container);
        expect(response.deployment).toBeInstanceOf(V1Deployment);
    });


});
