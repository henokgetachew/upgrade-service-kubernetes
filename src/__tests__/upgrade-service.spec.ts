import { IUpgradeMessage } from '../lib/upgrade-message';
import { runCommand } from '../utils/command-exec';
import UpgradeService from '../lib/upgrade-service';
import { k8s_deployment_name, tempNamespace } from './resources/test-constants';
import { UpgradeResult } from '../lib/upgrade-result';
import { before } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import Sinon from 'sinon';

describe('Upgrade Service', () => {
    let sandbox: Sinon.SinonSandbox;

    before(async () => {
        await runCommand(
            `kubectl -n ${tempNamespace} apply -f src/__tests__/resources/busybox.yaml`,
            'Creating a busybox deployment');
        await runCommand(`sleep 2`, 'Waiting a few seconds...');
    });

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('Constructs members correctly', ()=> {
        const upgradeMessageArray: IUpgradeMessage[] = [{ containerName: 'busybox', imageTag: '1.35' }];

        const upgradeService = new UpgradeService(upgradeMessageArray, tempNamespace, k8s_deployment_name);
        expect(upgradeService.k8sMgr).to.not.be.undefined;
        expect(upgradeService.upgradeArray).to.not.be.undefined;
    });

    it('Should upgrade deployment', async () => {
        const upgradeMessageArray: IUpgradeMessage[] = [{ containerName: 'busybox', imageTag: '1.35' }];

        const upgradeService = new UpgradeService(upgradeMessageArray, tempNamespace, k8s_deployment_name);

        upgradeService.k8sMgr.areAllDeploymentsInReadyState = sandbox.stub().resolves({ 
            ready: true, podsNotReady: undefined 
        });
        const resultBefore = await upgradeService.getCurrentVersion('busybox');
        await upgradeService.upgradeDeployment();
        const resultAfter = await upgradeService.getCurrentVersion('busybox');

        expect(resultBefore).to.contain('1.34');
        expect(resultAfter).to.contain('1.35');
    });

    it('Should not proceed if all pods are not in a ready state', async () => {
        await runCommand(
            `kubectl -n ${tempNamespace} run non-working-container --image=busybox:1.xx`,
            'Creating a non working image...');
        await runCommand(`sleep 5`, 'Lets wait for 5 seconds');
        const upgradeMessageArray: IUpgradeMessage[] = [{ containerName: 'nonNginx', imageTag: '1.20' }];

        const upgradeService = new UpgradeService(upgradeMessageArray, tempNamespace, k8s_deployment_name);
        const result = await upgradeService.isDeploymentReadyForUpgrades();

        expect(result.ready).to.be.false;
    });

    it('Handles errors correctly', async () => {
        const upgradeMessageArray: IUpgradeMessage[] = [{ containerName: 'busybox', imageTag: '1.35' }];

        const upgradeService = new UpgradeService(upgradeMessageArray, tempNamespace, k8s_deployment_name);

        upgradeService.k8sMgr.upgradeDeploymentContainers = sandbox.stub().throwsException('Error yada yada');
        const response = await upgradeService.upgradeDeployment();

        expect(response.upgradeCount).to.be.equal(0);
        expect(response.upgradeResult).to.be.equal(UpgradeResult.Failure);
        expect(response.message).not.to.be.undefined;
    });

    it('Correctly lets us know when no containers upgraded', async () => {
        const upgradeMessageArray: IUpgradeMessage[] = [{ containerName: 'busybox', imageTag: '1.35' }];

        const upgradeService = new UpgradeService(upgradeMessageArray, tempNamespace, k8s_deployment_name);

        upgradeService.k8sMgr.upgradeDeploymentContainers = sandbox.stub().resolves([]);
        const response = await upgradeService.upgradeDeployment();

        expect(response.message).to.be.equal('Upgrade failed.');
        expect(response.upgradeCount).to.be.equal(0);
        expect(response.upgradeResult).to.be.equal(UpgradeResult.Failure);
    });
});
