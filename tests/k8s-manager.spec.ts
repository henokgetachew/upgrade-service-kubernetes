/* eslint-disable @typescript-eslint/no-explicit-any */
import Environment from '../src/lib/env-manager';
import K8sManager from '../src/lib/k8s-manager';
import { IUpgradeMessage } from '../src/lib/upgrade-message';
import { runCommand } from './utils/command-exec';
import { k8s_deployment_name, tempNamespace } from './resources/test-constants';
import { expect } from 'chai';
import { before } from 'mocha';
import sinon from 'sinon';
import { V1Deployment } from '@kubernetes/client-node';

describe('k8s-manager', () => {

  before(async () => {
    await runCommand(
      `kubectl apply -f tests/resources/nginx.default.yaml`,
      'Creating an nginx deployment in the default namespace');
    await runCommand(
      `kubectl -n ${tempNamespace} apply -f tests/resources/nginx.yaml`, 'Creating an nginx deployment');
    await runCommand(`sleep 2`, 'Waiting a few seconds...');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('Role Based Access Policy Works', async () => {
    /*
        We shouldn't be able to upgrade deployments in different namespaces.
        */

    const upgradeMessageArray: IUpgradeMessage[] = [{container_name: 'nginx-default', image_tag: 'nginx:1.20'}];
    const k8sMgr = new K8sManager(tempNamespace, k8s_deployment_name, upgradeMessageArray);
    let errMessage: any = undefined;

    try {
      await k8sMgr.upgradeDeploymentContainers();
    } catch (err) {
      errMessage = err;
    }

    expect((errMessage as Error).message).to.contain(`Can't upgrade right now.`);
  });

  it('upgradeDeploymentContainers works as intended', async () => {
    const upgradeMessageArray: IUpgradeMessage[] = [{container_name: 'nginx', image_tag: 'nginx:1.19'}];
    const k8sMgr = new K8sManager(tempNamespace, k8s_deployment_name, upgradeMessageArray);

    sinon.stub(k8sMgr, 'areAllDeploymentsInReadyState').resolves({ready: true, podsNotReady: undefined});

    const versionBefore = await k8sMgr.getCurrentVersion('nginx');
    await k8sMgr.upgradeDeploymentContainers();
    const versionAfter = await k8sMgr.getCurrentVersion('nginx');

    expect(versionBefore).to.contain('1.20');
    expect(versionAfter).to.contain('1.19');
  });

  it('Can pull deployment object', async () => {
    const upgradeMessageArray: IUpgradeMessage[] = [{container_name: 'nginx', image_tag: 'nginx:1.19'}];
    const k8sMgr = new K8sManager(tempNamespace, k8s_deployment_name, upgradeMessageArray);

    const deployment = await k8sMgr.pullDeploymentObject();
    expect(deployment).to.be.an.instanceof(V1Deployment);
  });

  it('Upgrade doesnt throw error when image not found', async () => {
    const upgradeMessageArray: IUpgradeMessage[] = [{container_name: 'wacko-image', image_tag: 'wacko-image:1.19'}];
    const k8sMgr = new K8sManager(tempNamespace, k8s_deployment_name, upgradeMessageArray);

    sinon.stub(k8sMgr, 'areAllDeploymentsInReadyState').resolves({ready: true, podsNotReady: undefined});

    let errMessage: any;
    try {
      await k8sMgr.upgradeDeploymentContainers();
    } catch (err: any) {
      errMessage = err;
    }

    expect(errMessage).to.be.undefined;
  });

  it('Shouldnt proceed with upgrade if all containers not ready', async () => {
    await runCommand(
      `kubectl -n ${tempNamespace} run container-zoro --image=busybox:1.xx`,
      'Creating a non working image...');
    const upgradeMessageArray: IUpgradeMessage[] = [
      { container_name: 'container-zoro', image_tag: 'container-zoro:1.20' }];
    const k8sMgr = new K8sManager(tempNamespace, k8s_deployment_name, upgradeMessageArray);
    let errMessage = undefined;
    try {
      await k8sMgr.upgradeDeploymentContainers();
    } catch (err) {
      errMessage = err;
    }

    expect((errMessage as Error).message).to.contain(`Can't upgrade right now.`);
  });

  it('Throws an error when pulling a deployment object from non-existent namespace', async () => {
    const upgradeMessageArray: IUpgradeMessage[] = [{container_name: 'nginx', image_tag: 'nginx:1.19'}];
    const k8sMgr = new K8sManager('what-namespace', k8s_deployment_name, upgradeMessageArray);

    let errMessage = undefined;
    try {
      await k8sMgr.pullDeploymentObject();
    } catch (err) {
      errMessage = err;
    }
    expect((errMessage as Error).message).to.contain('HTTP request failed');
  });

  it('Throws an error when pulling a deployment object from non-existent deployment', async () => {
    const upgradeMessageArray: IUpgradeMessage[] = [{ container_name: 'nginx', image_tag: 'nginx:1.19'}];
    const k8sMgr = new K8sManager(tempNamespace, 'what-deployment', upgradeMessageArray);

    let errMessage = undefined;
    try {
      await k8sMgr.pullDeploymentObject();
    } catch (err) {
      errMessage = err;
    }
    expect((errMessage as Error).message).to.contain('HTTP request failed');
  });

  it('Throws error when upgrade message invalid', () => {
    const upgradeMessageArray: IUpgradeMessage[] = [{container_name: '', image_tag: '1.19'}];

    let errMessage = undefined;
    try {
      new K8sManager(tempNamespace, k8s_deployment_name, upgradeMessageArray);
    } catch (err) {
      errMessage = err;
    }

    expect((errMessage as Error).message).to.contain('Upgrade message invalid.');
  });

  it('Can load config from cluster', () => {
    const upgradeMessageArray: IUpgradeMessage[] = [{ container_name: 'nginx', image_tag: '1.20' }];
    const k8sMgr = new K8sManager(tempNamespace, k8s_deployment_name, upgradeMessageArray);

    sinon.stub(Environment, 'runningWithinCluster').returns(true);

    const kcStub = sinon.stub(k8sMgr.kc, 'loadFromCluster').returns();

    k8sMgr.setupKCWithKCPath();
    expect(kcStub.callCount).to.be.equal(1);
  });

  it('Can pull container in namespace', async () => {
    const upgradeMessageArray: IUpgradeMessage[] = [
      {container_name: 'upgrade-service', image_tag: 'some-tag-doesnt-matter-here'}
    ];
    const k8sMgr = new K8sManager(tempNamespace, k8s_deployment_name, upgradeMessageArray);

    const response = await k8sMgr.getContainersInNamespace('upgrade-service');

    expect(response?.length).to.equal(1);
    expect(response?.[0].container.name).to.equal('upgrade-service');
    expect(response?.[0].deployment.metadata?.name).to.equal(k8s_deployment_name);
  });

  it('Doesnt error when pulling missing container in namespace', async () => {
    const upgradeMessageArray: IUpgradeMessage[] = [
      {container_name: 'missing-container', image_tag: 'some-tag-doesnt-matter-here'}
    ];

    let errMessage = undefined;
    try {
      const k8sMgr = new K8sManager(tempNamespace, k8s_deployment_name, upgradeMessageArray);
      await k8sMgr.getContainersInNamespace('missing-container');
    } catch (err) {
      errMessage = err;
    }

    expect(errMessage).to.be.undefined;
  });

});
