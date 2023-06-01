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
    await runCommand(
      `kubectl -n ${tempNamespace} apply -f tests/resources/busybox-1.yaml`,
      'Creating a busybox-1 deployment');
    await runCommand(`sleep 2`, 'Waiting a few seconds...');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('Constructs members correctly', ()=> {
    const upgradeMessageArray: IUpgradeMessage[] = [{ container_name: 'busybox', image_tag: 'busybox:1.35' }];

    const upgradeService = new UpgradeService(upgradeMessageArray, tempNamespace, k8s_deployment_name);
    expect(upgradeService.k8sMgr).to.not.be.undefined;
    expect(upgradeService.upgradeArray).to.not.be.undefined;
  });

  it('Should upgrade deployment', async () => {
    const upgradeMessageArray: IUpgradeMessage[] = [{ container_name: 'busybox', image_tag: 'busybox:1.35' }];

    const upgradeService = new UpgradeService(upgradeMessageArray, tempNamespace, k8s_deployment_name);

    sinon.stub(upgradeService.k8sMgr, 'areAllDeploymentsInReadyState').resolves({
      ready: true, podsNotReady: undefined
    });
    const resultBefore = await upgradeService.getCurrentVersion('busybox');
    const result = await upgradeService.upgradeDeployment();
    const resultAfter = await upgradeService.getCurrentVersion('busybox');

    expect(resultBefore).to.contain('1.34');
    expect(resultAfter).to.contain('1.35');

    expect(result).to.deep.equal({
      upgradeResult: 1,
      upgradedContainers: { busybox: { ok: true } },
    });
  });

  it('Should upgrade deployment if container is named with a suffix', async () => {
    const upgradeMessageArray: IUpgradeMessage[] = [{ container_name: 'busybox', image_tag: 'busybox:1.35' }];

    const upgradeService = new UpgradeService(upgradeMessageArray, tempNamespace, k8s_deployment_name);

    sinon.stub(upgradeService.k8sMgr, 'areAllDeploymentsInReadyState').resolves({
      ready: true, podsNotReady: undefined
    });
    const resultBefore = await upgradeService.getCurrentVersion('busybox-1');
    await upgradeService.upgradeDeployment();
    const resultAfter = await upgradeService.getCurrentVersion('busybox-1');

    expect(resultBefore).to.contain('1.34');
    expect(resultAfter).to.contain('1.35');
  });

  it('Should not proceed if all pods are not in a ready state', async () => {
    await runCommand(
      `kubectl -n ${tempNamespace} run non-working-container --image=busybox:1.xx`,
      'Creating a non working image...');
    await runCommand(`sleep 5`, 'Lets wait for 5 seconds');
    const upgradeMessageArray: IUpgradeMessage[] = [{ container_name: 'nonNginx', image_tag: 'nonNginx:1.20' }];

    const upgradeService = new UpgradeService(upgradeMessageArray, tempNamespace, k8s_deployment_name);
    const result = await upgradeService.isDeploymentReadyForUpgrades();

    expect(result.ready).to.be.false;
  });

  it('Handles errors correctly', async () => {
    const upgradeMessageArray: IUpgradeMessage[] = [{ container_name: 'busybox', image_tag: 'busybox:1.35' }];

    const upgradeService = new UpgradeService(upgradeMessageArray, tempNamespace, k8s_deployment_name);

    sinon.stub(upgradeService.k8sMgr, 'upgradeDeploymentContainers').throwsException('Error yada yada');
    const response = await upgradeService.upgradeDeployment();

    expect(response.upgradeResult).to.be.equal(UpgradeResult.Failure);
    expect(response.message).to.be.equal('Error yada yada');
  });

  it('lets us know when no containers upgraded', async () => {
    const upgradeMessageArray: IUpgradeMessage[] = [{ container_name: 'not_busybox', image_tag: 'not_busybox:1.36' }];

    const upgradeService = new UpgradeService(upgradeMessageArray, tempNamespace, k8s_deployment_name);

    sinon.stub(upgradeService.k8sMgr, 'areAllDeploymentsInReadyState').resolves({
      ready: true, podsNotReady: undefined
    });
    const tagBefore = await upgradeService.getCurrentVersion('busybox');
    const result = await upgradeService.upgradeDeployment();
    const tagAfter = await upgradeService.getCurrentVersion('busybox');

    expect(tagBefore).to.contain('1.35');
    expect(tagAfter).to.contain('1.35');

    expect(result.upgradedContainers).to.deep.equal({ not_busybox: { ok: false } });
  });

  it('lets us know when some containers upgraded', async () => {
    const upgradeMessageArray: IUpgradeMessage[] = [
      { container_name: 'not_busybox', image_tag: 'not_busybox:1.36' },
      { container_name: 'busybox', image_tag: 'busybox:1.36' }
    ];

    const upgradeService = new UpgradeService(upgradeMessageArray, tempNamespace, k8s_deployment_name);

    sinon.stub(upgradeService.k8sMgr, 'areAllDeploymentsInReadyState').resolves({
      ready: true, podsNotReady: undefined
    });
    const tagBefore = await upgradeService.getCurrentVersion('busybox');
    const result = await upgradeService.upgradeDeployment();
    const tagAfter = await upgradeService.getCurrentVersion('busybox');

    expect(tagBefore).to.contain('1.35');
    expect(tagAfter).to.contain('1.36');

    expect(result.upgradedContainers).to.deep.equal({
      not_busybox: { ok: false },
      busybox: { ok: true }
    });
  });
});
