import { V1Container, V1Deployment } from '@kubernetes/client-node';
import k8sManager from '../lib/k8s-manager';
import K8sManager from '../lib/k8s-manager';
import { IUpgradeMessage } from '../lib/upgrade-message';
import { runCommand } from '../utils/command-exec';

const tempCluster = 'temporary-test-cluster';
const tempNamespace = 'k8s-cht-deployment';
const k8s_deployment_name = 'archv3-deployment';


describe('k8s-manager', () => {

    it('Role Based Access Policy Works', async () => {
        /*
        We use different namespaces to confirm. We deploy the next deployment without specifying
        the namespace. That should mean upgrades targeting it should fail.
        */
        await runCommand(`kubectl create deployment nginx --image=nginx`, 'Creating an nginx deployment');
        const upgradeMessageArray: IUpgradeMessage[] = [{containerName: 'nginx', imageTag: '1.20'}];
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
        await runCommand(`kubectl create deployment -n ${tempNamespace} nginx --image=nginx:1.21`, 'Creating an nginx deployment');
        const upgradeMessageArray: IUpgradeMessage[] = [{containerName: 'nginx', imageTag: '1.19'}];
        const k8sMgr = new K8sManager(tempNamespace, k8s_deployment_name, upgradeMessageArray);

        await k8sMgr.upgradeDeploymentContainers();
        const response = await k8sMgr.getContainerInNamespace('nginx');

        expect(response.container.image).toContain('1.19');
    });

    it('Can pull deployment object', async () => {
        const upgradeMessageArray: IUpgradeMessage[] = [{containerName: 'nginx', imageTag: '1.19'}];
        const k8sMgr = new K8sManager(tempNamespace, k8s_deployment_name, upgradeMessageArray);

        const deployment = await k8sMgr.pullDeploymentObject();

        expect(deployment).toBeInstanceOf(V1Deployment);
    });

    it('Can pull container in namespace', async () => {
        const upgradeMessageArray: IUpgradeMessage[] = [{containerName: 'upgrade-service', imageTag: 'some-tag-doesnt-matter-here'}];
        const k8sMgr = new K8sManager(tempNamespace, k8s_deployment_name, upgradeMessageArray);

        const response = await k8sMgr.getContainerInNamespace('upgrade-service');

        expect(response.container).toBeInstanceOf(V1Container);
        expect(response.deployment).toBeInstanceOf(V1Deployment);
    });


});
