import chai, { expect } from 'chai';
import chaiHttp from 'chai-http';
import { runCommand } from '../utils/command-exec';
import { tempNamespace, k8s_deployment_name } from '../../tests/resources/test-constants';
import { IUpgradeMessage } from '../../src/lib/upgrade-message';
import UpgradeService from '../../src/lib/upgrade-service';

chai.use(chaiHttp);

describe('The API', () => {

  before(async () => {
    process.env.CHT_NAMESPACE = tempNamespace;
    process.env.CHT_DEPLOYMENT_NAME = k8s_deployment_name;
    await runCommand(
      `kubectl -n ${tempNamespace} apply -f tests/resources/alpine.yaml`,
      'Creating an alpine deployment');
    await runCommand(`sleep 10`, 'Waiting a few seconds...');
  });

  after(() => {
    process.env.CHT_NAMESPACE = '';
    process.env.CHT_DEPLOYMENT_NAME = '';
  });

  it('Listens on 5008', async () => {
    return chai.request('http://localhost:5008').get('/')
      .then(res => {
        expect(res).to.have.status(200);
        expect(res.get('message')).to.be.equal('Upgrade service working.');
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
        expect(res.get('ready')).to.not.be.undefined;
      });
  });

  it('Server status endpoint returns deployment readiness detail message', () => {
    return chai.request('http://localhost:5008')
      .get('/server-status')
      .then(res => {
        expect(res.get('message')).to.not.be.undefined;
      });
  });

  it('Should upgrade deployment', async () => {
    const upgradeMessageArray: IUpgradeMessage[] = [{ containerName: 'alpine', imageTag: '3.15.0' }];

    const upgradeService = new UpgradeService(upgradeMessageArray, tempNamespace, k8s_deployment_name);

    return chai.request('http://localhost:5008')
      .post('/upgrade')
      .send(upgradeMessageArray)
      .then(async res => {
        expect(res).to.have.status(200);
        const result = await upgradeService.getCurrentVersion('alpine');
        console.log(`Is upgrade working? ${result}`);
        expect(result).to.contain('3.13.0');
      });
  });
});
