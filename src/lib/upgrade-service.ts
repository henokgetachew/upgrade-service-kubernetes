import Environment from "./env-manager";
import { IUpgradeMessage } from "./upgrade-message";
import K8sManager from "./k8s-manager";
import { V1Deployment } from "@kubernetes/client-node";
import { V1ContainerState } from '@kubernetes/client-node';

// please add one or two empty spaces between import statements and class declarations
export default class UpgradeService {

    upgradeArray: Array<IUpgradeMessage>;
    k8sMgr: K8sManager;

    constructor(upgradeArray?: Array<IUpgradeMessage>, namespace?: string, deploymentName?: string) {
        this.upgradeArray = upgradeArray || [];
        // this is a very long line, please consider saving all parameters in variables or making a multiline call
        this.k8sMgr = new K8sManager(namespace || Environment.getNamespace(), deploymentName || Environment.getDeploymentName(), this.upgradeArray);
    }

    async getCurrentVersion(container: string): Promise<string> {
        return this.k8sMgr.getCurrentVersion(container);
    }

    async upgradeDeployment(): Promise<{
        upgradeResult: UpgradeResult,
        upgradeCount: number,
        message: any
    }> {
        try {
            const deployments: V1Deployment[] = await this.k8sMgr.upgradeDeploymentContainers();
            if (deployments.length > 0 ) {
                // can we make UpgradeSuccess a function, like:
                // const upgradeSuccess = (count) => ({ ok: true, upgradeCount: count });
                // and change the return to `return upgradeSuccess(deployments.length)`;
                return {upgradeResult: UpgradeResult.Success, upgradeCount: deployments.length, message: 'Successfuly upgraded'};
            } else {
                // the block above is a terminating block, so the else is not required.

                // can we make UpgradeFailure a function, like:
                // const UpgradeFailure = (error) => ({ error: error || 'Upgrade failed.' });
                // and change the return to `return UpgradeFailure()`;
                return {upgradeResult: UpgradeResult.Failure, upgradeCount: 0, message: 'Upgrade failed.'};
            }
        } catch(err){
            // Please add some context to this error
            // console.error('Error while upgrading deployment containers', err);
            console.error(err);
            // with the UpgradeFailure function from above: `return UpgradeFailure(err)`;
            return {upgradeResult: UpgradeResult.Failure, upgradeCount: 0, message: err};
        }
    }

    isDeploymentReadyForUpgrades(): Promise<{ready: boolean, imageNotReady?: string, state?: string}> {
        return this.k8sMgr.areAllDeploymentsInReadyState();
    }
}
