import chai, { expect } from 'chai';
import chaiHttp from 'chai-http';
import { runCommand } from '../utils/command-exec';
import { tempNamespace, k8s_deployment_name } from '../../tests/resources/test-constants';
import { IUpgradeJSONPayload } from '../../src/lib/upgrade-message';
import UpgradeService from '../../src/lib/upgrade-service';
import { setTimeout } from 'timers/promises';

chai.use(chaiHttp);

describe('The API', () => {

  before(async () => {
    process.env.CHT_NAMESPACE = tempNamespace;
    process.env.CHT_DEPLOYMENT_NAME = k8s_deployment_name;
    await runCommand(
      `kubectl -n ${tempNamespace} apply -f tests/resources/busybox.yaml`,
      'Creating a busybox deployment');
    console.log('Waiting for ~ 3 minutes - until pods finish creation.');
    await setTimeout(220000);
  });

  after(() => {
    process.env.CHT_NAMESPACE = '';
    process.env.CHT_DEPLOYMENT_NAME = '';
  });

  it('Listens on 5008', async () => {
    return chai.request('http://localhost:5008').get('/')
      .then(res => {
        expect(res).to.have.status(200);
        expect(res.body.message).to.be.equal('Upgrade service working.');
      });
  });

  it('Server status endpoint exists', () => {
    return chai.request('http://localhost:5008')
      .get('/server-status')
      .then(res => {
        expect(res).to.have.status(200);
      });
  });

  it('Server status endpoint returns deployment readiness', () => {
    return chai.request('http://localhost:5008')
      .get('/server-status')
      .then(res => {
        expect(res.body).to.be.deep.equal({
          ready: true,
          message: `Deployment is ready for upgrades`
        });
      });
  });

  it('Should upgrade deployment', async () => {
    const upgradeMessagePayload: IUpgradeJSONPayload = {
      containers: [{ containerName: 'busybox', imageTag: 'busybox:1.35' }],
      dockerCompose: JSON.parse('[]')
    };
    const upgradeMessageArray = upgradeMessagePayload.containers;
    const upgradeService = new UpgradeService(upgradeMessageArray, tempNamespace, k8s_deployment_name);
    const res = await chai.request('http://localhost:5008')
      .post('/upgrade')
      .send(upgradeMessagePayload);
    expect(res).to.have.status(200);
    console.log('Waiting for 30 seconds while pods update...');
    await setTimeout(30000);
    const result = await upgradeService.getCurrentVersion('busybox');
    expect(result).to.contain('1.35');
  });

  it('Doesnt error if JSON format is missing non-required fields', async () => {
    const upgradeMessagePayload = {
      containers: [{ containerName: 'busybox', imageTag: 'busybox:1.33' }]
    };
    console.log('Waiting for 30 seconds for pods to get ready...');
    await setTimeout(30000);
    const upgradeMessageArray = upgradeMessagePayload.containers;
    const upgradeService = new UpgradeService(upgradeMessageArray, tempNamespace, k8s_deployment_name);
    const res = await chai.request('http://localhost:5008')
      .post('/upgrade')
      .send(upgradeMessagePayload);
    expect(res).to.have.status(200);
    expect(res.body).to.be.deep.equal({message: 'Successfuly upgraded 1 containers'});
    console.log('Waiting for 30 seconds while pods update...');
    await setTimeout(30000);
    const result = await upgradeService.getCurrentVersion('busybox');
    expect(result).to.contain('1.33');
  });

  it('Reports error when upgrade fails', async () => {
    const upgradeMessagePayload = {
      containers: [{ containerName: 'busybox', imageTag: 'busybox:1.uxyz' }]
    };
    const upgradeMessageArray = upgradeMessagePayload.containers;
    const upgradeService = new UpgradeService(upgradeMessageArray, tempNamespace, k8s_deployment_name);
    const resultBefore = await upgradeService.getCurrentVersion('busybox');
    const res = await chai.request('http://localhost:5008')
      .post('/upgrade')
      .send(upgradeMessagePayload);
    expect(res).to.have.status(500);
    expect(res.body.message).to.contain('Error');
    console.log('Waiting for 30 seconds while pods update...');
    await setTimeout(30000);
    const result = await upgradeService.getCurrentVersion('busybox');
    expect(result).to.be.equal(resultBefore);
  });
});
