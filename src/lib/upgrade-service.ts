import Environment from './env-manager';
import { IUpgradeMessage } from './upgrade-message';
import K8sManager from './k8s-manager';
import { V1Deployment } from '@kubernetes/client-node';
import { UpgradeResult } from './upgrade-result';
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

    async upgradeDeployment(): Promise<{
        upgradeResult: UpgradeResult,
        upgradeCount: number,
        message: string
    }> {
        try {
            const deployments: V1Deployment[] = await this.k8sMgr.upgradeDeploymentContainers();
            if (deployments.length > 0 ) {
                return {upgradeResult: UpgradeResult.Success,
                    upgradeCount: deployments.length,
                    message: 'Successfuly upgraded'};
            } else {
                return {upgradeResult: UpgradeResult.Failure, upgradeCount: 0, message: 'Upgrade failed.'};
            }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch(err: any){
            return {upgradeResult: UpgradeResult.Failure, upgradeCount: 0, message: err.toString()};
        }
    }

    isDeploymentReadyForUpgrades(): Promise<{ready: boolean, imageNotReady?: string, state?: string}> {
        return this.k8sMgr.areAllDeploymentsInReadyState();
    }
}
