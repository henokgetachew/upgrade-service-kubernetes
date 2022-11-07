import Environment from './env-manager';
import { IUpgradedContainers, IUpgradeMessage } from './upgrade-message';
import K8sManager from './k8s-manager';
import { IUpgradeContainersResult, UpgradeResult } from './upgrade-result';
import { IDeploymentReadiness } from './deployment-readiness';

export default class UpgradeService {

  upgradeArray: Array<IUpgradeMessage>;
  k8sMgr: K8sManager;

  constructor(upgradeArray?: Array<IUpgradeMessage>, namespace?: string, deploymentName?: string) {
    this.upgradeArray = upgradeArray || [];
    this.k8sMgr = new K8sManager(namespace ||
      Environment.getNamespace(), deploymentName ||
    Environment.getDeploymentName(), this.upgradeArray);
  }

  async getCurrentVersion(container: string): Promise<string> {
    return this.k8sMgr.getCurrentVersion(container);
  }

  upgradeSuccess(upgradedContainers: IUpgradedContainers) {
    const upgradeContainersResult:IUpgradeContainersResult = {};
    Object.keys(upgradedContainers).forEach((containerName:string) => {
      upgradeContainersResult[containerName] = { ok: upgradedContainers[containerName].ok };
    });
    return {
      upgradeResult: UpgradeResult.Success,
      upgradedContainers: upgradeContainersResult,
    };
  }

  upgradeFailure(message?: string) {
    return {
      upgradeResult: UpgradeResult.Failure,
      message: message || 'Upgrade failed.'
    };
  }

  async upgradeDeployment(): Promise<{
    upgradeResult: UpgradeResult,
    upgradedContainers?: IUpgradeContainersResult,
    message?: string
  }> {
    try {
      const upgradedContainers: IUpgradedContainers = await this.k8sMgr.upgradeDeploymentContainers();
      return this.upgradeSuccess(upgradedContainers);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error('Error while upgrading deployment containers', err);
      return this.upgradeFailure(err.toString());
    }
  }

  isDeploymentReadyForUpgrades(): Promise<IDeploymentReadiness> {
    return this.k8sMgr.areAllDeploymentsInReadyState();
  }
}
