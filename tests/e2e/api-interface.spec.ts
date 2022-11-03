import chai, { expect } from 'chai';
import chaiHttp from 'chai-http';
import { runCommand } from '../utils/command-exec';
import { tempNamespace, k8s_deployment_name } from '../../tests/resources/test-constants';
import { IUpgradeJSONPayload } from '../../src/lib/upgrade-message';
import UpgradeService from '../../src/lib/upgrade-service';

const SERVICE_URL = 'http://localhost:5008';

chai.use(chaiHttp);

const getStatus = () => chai.request(SERVICE_URL).get('/server-status');
const waitForDeploymentReady = async () => {
  let ready = false;
  do {
    const statusRes = await getStatus();
    ready = statusRes.body.ready;
  } while (!ready);
};

describe('The API', () => {

  before(async () => {
    process.env.CHT_NAMESPACE = tempNamespace;
    process.env.CHT_DEPLOYMENT_NAME = k8s_deployment_name;
    await runCommand(
      `kubectl -n ${tempNamespace} apply -f tests/resources/busybox.yaml`,
      'Creating a busybox deployment');

    // wait for the upgrade service to be online
    do {
      try {
        return await chai.request(SERVICE_URL).get('/');
      } catch (err) {};
    } while (true);
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

  it('Server status endpoint returns deployment readiness when not ready', async () => {
    const res = await getStatus();
    expect(res.body.ready).to.equal(false);
    expect(res.body.message).to.match(/Deployment is not ready for upgrades/);
  });

  it('Reports error when deployment not ready for upgrades', async () => {
    const statusRes = await getStatus();
    expect(statusRes.body.ready).to.equal(false);
    const upgradeMessagePayload = {
      containers: [{ container_name: 'busybox', image_tag: 'busybox:1.35' }]
    };

    const res = await chai.request(SERVICE_URL)
      .post('/upgrade')
      .send(upgradeMessagePayload);
    expect(res).to.have.status(500);
    expect(res.body.message).to.contain('Error');
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
    const res = await chai.request(SERVICE_URL).get('/')
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

    let currentTag;
    do {
      currentTag = await upgradeService.getCurrentVersion(upgradeMessagePayload.containers[0].container_name);
    } while (currentTag !== upgradeMessagePayload.containers[0].image_tag);
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
      busybox: { ok: true },
      yyy: { ok: false },
    });

    let currentTag;
    do {
      currentTag = await upgradeService.getCurrentVersion(upgradeMessagePayload.containers[0].container_name);
    } while (currentTag !== upgradeMessagePayload.containers[0].image_tag);
  });
});
