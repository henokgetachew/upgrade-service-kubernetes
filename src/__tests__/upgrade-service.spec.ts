import { IUpgradeMessage } from "../lib/upgrade-message";
import { runCommand } from "../utils/command-exec";
import UpgradeService from '../lib/upgrade-service';
import { k8s_deployment_name, tempNamespace } from "../resources/test-constants";
import { V1DeploymentList } from "@kubernetes/client-node";


beforeAll(async () => {
    await runCommand(`kubectl -n ${tempNamespace} apply -f src/resources/busybox.yaml`, 'Creating a busybox deployment');
    await runCommand(`sleep 2`, 'Waiting a few seconds...');
});

describe('Upgrade Service', () => {
    it('Constructs members correctly', ()=> {
        const upgradeMessageArray: IUpgradeMessage[] = [{ containerName: 'busybox', imageTag: '1.35' }];

        const upgradeService = new UpgradeService(upgradeMessageArray, tempNamespace, k8s_deployment_name);
        expect(upgradeService.k8sMgr).toBeDefined();
        expect(upgradeService.upgradeArray).toBeDefined();
    });

    it('Should upgrade deployment', async () => {
        const upgradeMessageArray: IUpgradeMessage[] = [{ containerName: 'busybox', imageTag: '1.35' }];

        const upgradeService = new UpgradeService(upgradeMessageArray, tempNamespace, k8s_deployment_name);

        upgradeService.k8sMgr.areAllDeploymentsInReadyState = jest.fn(() => new Promise((resolve) => resolve({ ready: true, imageNotReady: undefined, state: undefined })));
        await upgradeService.upgradeDeployment();

        const result = await upgradeService.getCurrentVersion('busybox');

        expect(result).toContain('1.35');

    });

    it('Should not proceed if all pods are not in a ready state', async () => {
        await runCommand(`kubectl -n ${tempNamespace} run non-working-container --image=busybox:1.xx`, 'Creating a non working image...');
        await runCommand(`sleep 5`, 'Lets wait for 5 seconds');
        const upgradeMessageArray: IUpgradeMessage[] = [{ containerName: 'nonNginx', imageTag: '1.20' }];

        const upgradeService = new UpgradeService(upgradeMessageArray, tempNamespace, k8s_deployment_name);
        const result = await upgradeService.isDeploymentReadyForUpgrades();

        expect(result.ready).toBe(false);
    }, 50000);

    it('Handles errors correctly', async () => {
        const upgradeMessageArray: IUpgradeMessage[] = [{ containerName: 'busybox', imageTag: '1.35' }];

        const upgradeService = new UpgradeService(upgradeMessageArray, tempNamespace, k8s_deployment_name);

        upgradeService.k8sMgr.upgradeDeploymentContainers = jest.fn(() => { throw new Error('Error yada yada') });
        const response = await upgradeService.upgradeDeployment();

        expect(response.upgradeCount).toBe(0);
        expect(response.upgradeResult).toBe(UpgradeResult.Failure);
        expect(response.message).toBeDefined();
    });

    it('Correctly lets us know when no containers upgraded', async () => {
        const upgradeMessageArray: IUpgradeMessage[] = [{ containerName: 'busybox', imageTag: '1.35' }];

        const upgradeService = new UpgradeService(upgradeMessageArray, tempNamespace, k8s_deployment_name);

        upgradeService.k8sMgr.upgradeDeploymentContainers = jest.fn(() => { return new Promise((resolve) => resolve([])) });
        const response = await upgradeService.upgradeDeployment();

        expect(response).toEqual({upgradeResult: UpgradeResult.Failure, upgradeCount: 0, message: 'Upgrade failed.'});
    });
});
