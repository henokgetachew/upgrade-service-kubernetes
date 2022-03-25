import chai, { expect } from 'chai';
import chaiHttp from 'chai-http';
import sinon from 'sinon';
import { runCommand } from '../utils/command-exec';
import { tempNamespace, k8s_deployment_name } from '../../tests/resources/test-constants';
import { IUpgradeMessage } from '../../src/lib/upgrade-message';

chai.use(chaiHttp);

describe('The API', () => {

  let sandbox: sinon.SinonSandbox;

  before(async () => {
    process.env.CHT_NAMESPACE = tempNamespace;
    process.env.CHT_DEPLOYMENT_NAME = k8s_deployment_name;
    await runCommand(
      `kubectl -n ${tempNamespace} apply -f tests/resources/alpine.yaml`,
      'Creating an alpine deployment');
    await runCommand(`sleep 10`, 'Waiting a few seconds...');
  });

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  after(() => {
    process.env.CHT_NAMESPACE = '';
    process.env.CHT_DEPLOYMENT_NAME = '';
  });

  it('Listens on 5008', () => {
    chai.request('http://localhost:5008')
      .get('/')
      .then((res) => {
        expect(res).to.have.status(200);
      });
  });

  it('Server status endpoint exists', () => {
    chai.request('http://localhost:5008')
      .get('/server-status')
      .then((res) => {
        expect(res).to.have.status(200);
      });
  });

  it('Upgrade endpoint exists', () => {
    chai.request('http://localhost:5008')
      .get('/upgrade')
      .then((res) => {
        expect(res).to.not.have.status(404);
      });
  });

  it('Should upgrade deployment', async () => {
    const upgradeMessageArray: IUpgradeMessage[] = [{ containerName: 'alpine', imageTag: '3.15.0' }];

    chai.request('http://localhost:5008')
      .post('/upgrade')
      .send(upgradeMessageArray)
      .then((res) => {
        expect(res).to.have.status(200);
      });
  });
});
