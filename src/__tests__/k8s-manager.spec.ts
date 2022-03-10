/* eslint-disable @typescript-eslint/no-explicit-any */
import { V1Container, V1Deployment } from '@kubernetes/client-node';
import * as k8s from '@kubernetes/client-node';
import Environment from '../lib/env-manager';
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

    it('upgradeDeploymentContainers works as intended', async () => {
        const upgradeMessageArray: IUpgradeMessage[] = [{containerName: 'nginx', imageTag: '1.19'}];
        const k8sMgr = new K8sManager(tempNamespace, k8s_deployment_name, upgradeMessageArray);

        k8sMgr.areAllDeploymentsInReadyState = jest.fn(() => new Promise(
            (resolve) => resolve({ready: true, podsNotReady: undefined})
        ));

        const versionBefore = await k8sMgr.getCurrentVersion('nginx');
        await k8sMgr.upgradeDeploymentContainers();
        const versionAfter = await k8sMgr.getCurrentVersion('nginx');

        expect(versionBefore).toContain('1.20');
        expect(versionAfter).toContain('1.19');
    });

    it('Can pull deployment object', async () => {
        const upgradeMessageArray: IUpgradeMessage[] = [{containerName: 'nginx', imageTag: '1.19'}];
        const k8sMgr = new K8sManager(tempNamespace, k8s_deployment_name, upgradeMessageArray);

        const deployment = await k8sMgr.pullDeploymentObject();

        expect(deployment).toBeInstanceOf(V1Deployment);
    });

    it('Upgrade throws error when image not found', async () => {
        const upgradeMessageArray: IUpgradeMessage[] = [{containerName: 'wacko-image', imageTag: '1.19'}];
        const k8sMgr = new K8sManager(tempNamespace, k8s_deployment_name, upgradeMessageArray);

        k8sMgr.areAllDeploymentsInReadyState = jest.fn(() => new Promise(
            (resolve) => resolve({ready: true, podsNotReady: undefined})
        ));

        let errMessage = undefined;
        try {
            await k8sMgr.upgradeDeploymentContainers();
        } catch (err) {
            errMessage = err;
        }

        expect(errMessage).toBeDefined();
    });

    it('Shouldnt proceed with upgrade if all containers not ready', async () => {
        await runCommand(
            `kubectl -n ${tempNamespace} run container-zoro --image=busybox:1.xx`,
            'Creating a non working image...');
        const upgradeMessageArray: IUpgradeMessage[] = [{ containerName: 'container-zoro', imageTag: '1.20' }];
        const k8sMgr = new K8sManager(tempNamespace, k8s_deployment_name, upgradeMessageArray);
        let errMessage = undefined;
        try {
            await k8sMgr.upgradeDeploymentContainers();
        } catch (err) {
            errMessage = err;
        }

        expect(errMessage).toBeDefined();
    });

    it('Throws an error when pulling a deployment object from non-existent namespace', async () => {
        const upgradeMessageArray: IUpgradeMessage[] = [{containerName: 'nginx', imageTag: '1.19'}];
        const k8sMgr = new K8sManager('what-namespace', k8s_deployment_name, upgradeMessageArray);

        let errMessage = undefined;
        try {
            await k8sMgr.pullDeploymentObject();
        } catch (err) {
            errMessage = err;
        }

        expect(errMessage).toBeDefined();
    });

    it('Throws an error when pulling a deployment object from non-existent deployment', async () => {
        const upgradeMessageArray: IUpgradeMessage[] = [{containerName: 'nginx', imageTag: '1.19'}];
        const k8sMgr = new K8sManager(tempNamespace, 'what-deployment', upgradeMessageArray);

        let errMessage = undefined;
        try {
            await k8sMgr.pullDeploymentObject();
        } catch (err) {
            errMessage = err;
        }

        expect(errMessage).toBeDefined();
    });

    it('Throws error when upgrade message invalid', () => {
        const upgradeMessageArray: IUpgradeMessage[] = [{containerName: '', imageTag: '1.19'}];

        let errMessage = undefined;
        try {
            const k8sMgr = new K8sManager(tempNamespace, k8s_deployment_name, upgradeMessageArray);
        } catch (err) {
            errMessage = err;
        }

        expect(errMessage).toBeDefined();
    });

    it('Can load config from cluster', () => {
        const upgradeMessageArray: IUpgradeMessage[] = [{ containerName: 'nginx', imageTag: '1.20' }];
        const k8sMgr = new K8sManager(tempNamespace, k8s_deployment_name, upgradeMessageArray);

        const spy = jest.spyOn(Environment, 'runningWithinCluster').mockImplementation((): boolean => {
            return true;
        });

        const spyKC = jest.spyOn(k8sMgr.kc, 'loadFromCluster').mockImplementation((): boolean => {
            return true;
        });

        k8sMgr.setupKCWithKCPath();

        expect(spyKC).toHaveBeenCalledTimes(1);
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
