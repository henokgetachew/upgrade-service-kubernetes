import chai, { expect } from 'chai';
import chaiHttp from 'chai-http';
import { runCommand } from '../utils/command-exec';
import { tempNamespace, k8s_deployment_name } from '../resources/test-constants';
import { IUpgradeJSONPayload } from '../../src/lib/upgrade-message';
import UpgradeService from '../../src/lib/upgrade-service';

const SERVICE_URL = 'http://localhost:5008';

chai.use(chaiHttp);

const getStatus = () => chai.request(SERVICE_URL).get('/server-status');
const waitForDeploymentReady = async () => {
  let ready = false;
  do {
    await new Promise(r => setTimeout(r, 1000));
    const statusRes = await getStatus();
    ready = statusRes.body.ready;
  } while (!ready);
};

const testContainerTag = async (upgradeService:UpgradeService, containerName:string, imageTag:string) => {
  let currentTag;
  for (let i = 5; i > 0; i--) {
    currentTag = await upgradeService.getCurrentVersion(containerName);
    if (currentTag === imageTag) {
      return;
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  expect.fail(`Container ${containerName} not upgraded in 20 seconds. Current tag is ${currentTag}`);
};

describe('The API', () => {

  before(async () => {
    process.env.CHT_NAMESPACE = tempNamespace;
    process.env.CHT_DEPLOYMENT_NAME = k8s_deployment_name;
    await runCommand(
      `kubectl -n ${tempNamespace} apply -f tests/resources/busybox.yaml `,
      'Creating a busybox deployment');

    await runCommand(
      `kubectl -n ${tempNamespace} apply -f tests/resources/busybox-1.yaml`,
      'Creating a busybox-1 deployment');

    await runCommand(
      `kubectl -n ${tempNamespace} apply -f tests/resources/busybox-2.yaml`,
      'Creating a busybox-1 deployment');
    // wait for the upgrade service to be online
    let ready;
    do {
      try {
        ready = await chai.request(SERVICE_URL).get('/');
      } catch (err) {
        // ignore socket timeout errors
      }
    } while (!ready);
  });

  after(() => {
    process.env.CHT_NAMESPACE = '';
    process.env.CHT_DEPLOYMENT_NAME = '';
  });

  it('Listens on 5008', async () => {
    const res = await chai.request(SERVICE_URL).get('/');
    expect(res).to.have.status(200);
    expect(res.body.message).to.be.equal('Upgrade service working.');
  });

  it('Server status endpoint returns deployment readiness when ready', async () => {
    await waitForDeploymentReady();

    const res = await getStatus();
    expect(res.body).to.be.deep.equal({
      ready: true,
      message: `Deployment is ready for upgrades`
    });
  });

  it('Listens on 5008', async () => {
    const res = await chai.request(SERVICE_URL).get('/');
    expect(res).to.have.status(200);
    expect(res.body.message).to.be.equal('Upgrade service working.');
  });

  it('Should upgrade deployment', async () => {
    await waitForDeploymentReady();

    const upgradeMessagePayload: IUpgradeJSONPayload = {
      containers: [{ container_name: 'busybox', image_tag: 'busybox:1.35' }]
    };
    const upgradeMessageArray = upgradeMessagePayload.containers;
    const upgradeService = new UpgradeService(upgradeMessageArray, tempNamespace, k8s_deployment_name);
    const res = await chai
      .request(SERVICE_URL)
      .post('/upgrade')
      .send(upgradeMessagePayload);
    expect(res).to.have.status(200);

    const imageTag = upgradeMessagePayload.containers[0].image_tag;
    const containerPrefix = upgradeMessagePayload.containers[0].container_name;

    await testContainerTag(upgradeService, `${containerPrefix}`, imageTag);
    await testContainerTag(upgradeService, `${containerPrefix}-1`, imageTag);
    await testContainerTag(upgradeService, `${containerPrefix}-2`, imageTag);
  });

  it('Doesnt error if JSON format and container field has additional fields', async () => {
    await waitForDeploymentReady();

    const upgradeMessagePayload = {
      containers: [
        { container_name: 'busybox', image_tag: 'busybox:1.33' },
        { container_name: 'yyy', image_tag: 'yyy:1.33'}
      ],
      docker_compose: [],
      someOtherFutureContent: []
    };

    const upgradeMessageArray = upgradeMessagePayload.containers;
    const upgradeService = new UpgradeService(upgradeMessageArray, tempNamespace, k8s_deployment_name);
    const res = await chai.request(SERVICE_URL)
      .post('/upgrade')
      .send(upgradeMessagePayload);

    expect(res).to.have.status(200);
    expect(res.body).to.be.deep.equal({
      'busybox': { ok: true },
      'busybox-1': { ok: true },
      'busybox-2': { ok: true },
    });

    const imageTag = upgradeMessagePayload.containers[0].image_tag;
    const containerPrefix = upgradeMessagePayload.containers[0].container_name;

    await testContainerTag(upgradeService, `${containerPrefix}`, imageTag);
    await testContainerTag(upgradeService, `${containerPrefix}-1`, imageTag);
    await testContainerTag(upgradeService, `${containerPrefix}-2`, imageTag);
  });

  it('Reports error when deployment not ready for upgrades', async () => {
    const upgradeMessagePayload: IUpgradeJSONPayload = {
      containers: [{ container_name: 'busybox', image_tag: 'busybox:1.36' }]
    };
    await chai.request(SERVICE_URL)
      .post('/upgrade')
      .send(upgradeMessagePayload);

    const res = await chai.request(SERVICE_URL)
      .post('/upgrade')
      .send(upgradeMessagePayload);
    expect(res).to.have.status(500);
    expect(res.body.message).to.contain('Error');
  });

});
