import { IUpgradeMessage } from '../src/lib/upgrade-message';
import { runCommand } from './utils/command-exec';
import UpgradeService from '../src/lib/upgrade-service';
import { k8s_deployment_name, tempNamespace } from './resources/test-constants';
import { UpgradeResult } from '../src/lib/upgrade-result';
import { before } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';

describe('Upgrade Service', () => {

  before(async () => {
    await runCommand(
      `kubectl -n ${tempNamespace} apply -f tests/resources/busybox.yaml`,
      'Creating a busybox deployment');
    await runCommand(`sleep 2`, 'Waiting a few seconds...');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('Constructs members correctly', ()=> {
    const upgradeMessageArray: IUpgradeMessage[] = [{ containerName: 'busybox', imageTag: 'busybox:1.35' }];

    const upgradeService = new UpgradeService(upgradeMessageArray, tempNamespace, k8s_deployment_name);
    expect(upgradeService.k8sMgr).to.not.be.undefined;
    expect(upgradeService.upgradeArray).to.not.be.undefined;
  });

  it('Should upgrade deployment', async () => {
    const upgradeMessageArray: IUpgradeMessage[] = [{ containerName: 'busybox', imageTag: 'busybox:1.35' }];

    const upgradeService = new UpgradeService(upgradeMessageArray, tempNamespace, k8s_deployment_name);

    sinon.stub(upgradeService.k8sMgr, 'areAllDeploymentsInReadyState').resolves({
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
    const upgradeMessageArray: IUpgradeMessage[] = [{ containerName: 'nonNginx', imageTag: 'nonNginx:1.20' }];

    const upgradeService = new UpgradeService(upgradeMessageArray, tempNamespace, k8s_deployment_name);
    const result = await upgradeService.isDeploymentReadyForUpgrades();

    expect(result.ready).to.be.false;
  });

  it('Handles errors correctly', async () => {
    const upgradeMessageArray: IUpgradeMessage[] = [{ containerName: 'busybox', imageTag: 'busybox:1.35' }];

    const upgradeService = new UpgradeService(upgradeMessageArray, tempNamespace, k8s_deployment_name);

    sinon.stub(upgradeService.k8sMgr, 'upgradeDeploymentContainers').throwsException('Error yada yada');
    const response = await upgradeService.upgradeDeployment();

    expect(response.upgradeCount).to.be.equal(0);
    expect(response.upgradeResult).to.be.equal(UpgradeResult.Failure);
    expect(response.message).not.to.be.undefined;
  });

  it('Correctly lets us know when no containers upgraded', async () => {
    const upgradeMessageArray: IUpgradeMessage[] = [{ containerName: 'busybox', imageTag: 'busybox:1.35' }];

    const upgradeService = new UpgradeService(upgradeMessageArray, tempNamespace, k8s_deployment_name);

    sinon.stub(upgradeService.k8sMgr, 'upgradeDeploymentContainers').resolves([]);
    const response = await upgradeService.upgradeDeployment();

    expect(response.message).to.be.equal('Upgrade failed.');
    expect(response.upgradeCount).to.be.equal(0);
    expect(response.upgradeResult).to.be.equal(UpgradeResult.Failure);
  });
});
