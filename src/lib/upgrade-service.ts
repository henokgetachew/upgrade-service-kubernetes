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

    upgradeSuccess(count: number) {
        return {upgradeResult: UpgradeResult.Success,
            upgradeCount: count,
            message: 'Successfuly upgraded'};
    }

    upgradeFailure(message?: string) {
        return {upgradeResult: UpgradeResult.Failure,
            upgradeCount: 0,
            message: message || 'Upgrade failed.'};
    }

    async upgradeDeployment(): Promise<{
        upgradeResult: UpgradeResult,
        upgradeCount: number,
        message: string
    }> {
        try {
            const deployments: V1Deployment[] = await this.k8sMgr.upgradeDeploymentContainers();
            if (deployments.length > 0 ) {
                return this.upgradeSuccess(deployments.length);
            }
            return this.upgradeFailure();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch(err: any){
            return this.upgradeFailure(err.toString());
        }
    }

    isDeploymentReadyForUpgrades(): Promise<{ready: boolean, imageNotReady?: string, state?: string}> {
        return this.k8sMgr.areAllDeploymentsInReadyState();
    }
}
