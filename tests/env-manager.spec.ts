import Environment from '../src/lib/env-manager';
import fs from 'fs';
import { expect } from 'chai';
import { beforeEach } from 'mocha';
import sinon from 'sinon';

describe('env-manager', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('Default upgrade service port is 5008', () => {
    expect(Environment.getUpgradeServicePort()).to.be.equal('5008');
  });

  it('Default upgrade service port can be overridden', () => {
    process.env.UPGRADE_SERVICE_PORT = '6000';
    expect(Environment.getUpgradeServicePort()).to.be.equal('6000');
  });

  it('Can take namespace from env var', () => {
    process.env.CHT_NAMESPACE = 'test-namespace';
    expect(Environment.getNamespace()).to.be.equal('test-namespace');
  });

  it('Can take namespace from config', () => {
    process.env.CHT_NAMESPACE = '';

    const fsStub = sandbox.stub(fs, 'readFileSync').returns( JSON.stringify({
      KUBECONFIG_DEFAULT_PATH: '/Users/henok/.kube/config',
      CHT_DEPLOYMENT_NAME: 'test',
      CHT_NAMESPACE: 'test'}));

    expect(Environment.getNamespace()).to.be.equal('test');
    expect(fsStub.calledOnce);
  });

  it('Can take namespace from cluster', () => {
    process.env.CHT_NAMESPACE = '';

    sandbox.stub(Environment, 'runningWithinCluster').returns(true);
    sandbox.stub(Environment, 'localConfig').returns({
      'KUBECONFIG_DEFAULT_PATH': '',
      'CHT_DEPLOYMENT_NAME': '',
      'CHT_NAMESPACE': ''
    });

    const spy = sandbox.stub(fs, 'readFileSync').returns('test-cluster-namespace');

    expect(Environment.getNamespace()).to.be.equal('test-cluster-namespace');
    expect(spy.calledOnce);
    expect(spy.calledWith('/var/run/secrets/kubernetes.io/serviceaccount/namespace'));
  });

  it('Throws error when namespace not found', () => {
    sandbox.stub(Environment, 'runningWithinCluster').returns(false);
    process.env.CHT_NAMESPACE = '';

    sandbox.stub(fs, 'readFileSync').returns(JSON.stringify({
      KUBECONFIG_DEFAULT_PATH: '/Users/henok/.kube/config',
      CHT_DEPLOYMENT_NAME: '',
      CHT_NAMESPACE: ''
    }));

    let errMsg = undefined;
    try {
      Environment.getNamespace();
    } catch (err) {
      errMsg = err;
    }

    expect(errMsg).to.not.be.undefined;
  });

  it('Throws error when namespace file missing in cluster', () => {
    sandbox.stub(Environment, 'runningWithinCluster').returns(true);
    process.env.CHT_NAMESPACE = '';

    sandbox.stub(Environment, 'localConfig').returns({
      'KUBECONFIG_DEFAULT_PATH': '',
      'CHT_DEPLOYMENT_NAME': '',
      'CHT_NAMESPACE': ''
    });

    sandbox.stub(fs, 'readFileSync').throwsException('File not found!');

    let errMsg = undefined;
    let namespace = undefined;
    try {
      namespace = Environment.getNamespace();
    } catch (err) {
      errMsg = err;
    }

    expect(namespace).to.be.undefined;
    expect(errMsg).to.not.be.undefined;
  });

  it('Determines if running within a cluster', () => {
    const spyFS = sandbox.stub(fs, 'existsSync').returns(true);
    expect(Environment.runningWithinCluster()).to.be.equal(true);
    expect(spyFS.calledOnce);
    expect(spyFS.calledWith('/var/run/secrets/kubernetes.io/serviceaccount/token'));
  });

  it('Determines if running within test automation', () => {
    expect(Environment.runningWithinTestAutomation()).to.be.equal(true);
  });

  it('Reads CHT Deployment name from env variable', () => {
    process.env.CHT_DEPLOYMENT_NAME = 'TheDeployment';
    expect(Environment.getDeploymentName()).to.be.equal('TheDeployment');
  });

  it('Takes CHT Deployment name from config', () => {
    process.env.CHT_DEPLOYMENT_NAME = '';
    sandbox.stub(Environment, 'localConfig').returns({
      'KUBECONFIG_DEFAULT_PATH': '',
      'CHT_DEPLOYMENT_NAME': 'On-hey-there',
      'CHT_NAMESPACE': ''
    });

    expect(Environment.getDeploymentName()).to.be.equal('On-hey-there');
  });

  it('Throws an error when deployment name not found', () => {
    process.env.CHT_DEPLOYMENT_NAME = '';
    sandbox.stub(Environment, 'localConfig').returns({
      'KUBECONFIG_DEFAULT_PATH': '',
      'CHT_DEPLOYMENT_NAME': '',
      'CHT_NAMESPACE': ''
    });

    let errMsg = undefined;
    let deploymentName = undefined;
    try {
      deploymentName = Environment.getDeploymentName();
    } catch (err) {
      errMsg = err;
    }

    expect(deploymentName).to.be.undefined;
    expect(errMsg).to.not.be.undefined;
  });

  it('Throws an error when looking for path when running within cluster', () => {
    sandbox.stub(Environment, 'runningWithinCluster').returns(true);

    let errMsg = undefined;
    try {
      Environment.getKubeConfigPath();
    } catch (err) {
      errMsg = err;
    }

    expect(errMsg).to.not.be.undefined;
  });

  it('Correctly returns kubeconfig in test automation', () => {
    sandbox.stub(Environment, 'runningWithinCluster').returns(false);
    expect(Environment.getKubeConfigPath()).to.contain('.kube/config');
  });

  it('Correctly obtains kubeconfig from env var', () => {
    sandbox.stub(Environment, 'runningWithinCluster').returns(false);

    sandbox.stub(Environment, 'runningWithinTestAutomation').returns(false);

    process.env.KUBECONFIG = 'a-test-config-path';

    expect(Environment.getKubeConfigPath()).to.be.equal('a-test-config-path');
  });

  it('Throws error when kubeconfig path not found', () => {
    sandbox.stub(Environment, 'runningWithinCluster').returns(false);

    sandbox.stub(Environment, 'runningWithinTestAutomation').returns(false);

    process.env.KUBECONFIG = '';

    sandbox.stub(Environment, 'localConfig').returns({
      'KUBECONFIG_DEFAULT_PATH': '',
      'CHT_DEPLOYMENT_NAME': '',
      'CHT_NAMESPACE': ''
    });

    let errMsg = undefined;
    try {
      Environment.getKubeConfigPath();
    } catch (err) {
      errMsg = err;
    }

    expect(errMsg).to.not.be.undefined;
  });

  it('LocalConfig returns null when there is a JSON parsing issue', () => {
    sandbox.stub(JSON, 'parse').throwsException('JSON Parsing Error');
    expect(Environment.localConfig()).to.be.null;
  });
});
