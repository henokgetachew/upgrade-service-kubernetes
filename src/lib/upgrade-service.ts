import Environment from "./env-manager";
import { IUpgradeMessage } from "./upgrade-message";
import K8sManager from "./k8s-manager";
import { V1Deployment } from "@kubernetes/client-node";

const k8sMgr = new K8sManager();

export default class UpgradeService {

    upgradeArray: Array<IUpgradeMessage>;

    constructor(upgradeArray: Array<IUpgradeMessage>) {
        this.upgradeArray = upgradeArray;
    }

    getCurrentVersion(container: string): string {
        throw new Error('Not yet implemented');
    }

    upgradeDeployment(): Promise<V1Deployment> {
        return k8sMgr.upgradeDeploymentContainers(Environment.getDeploymentName(), Environment.getNamespace(), this.upgradeArray);
    }

    isValidUpgrade(container: string, newVersion: string): string {
        throw new Error('Not yet implemented');
    }

    restartServices(): void {
        throw new Error('Not yet implemented');
    }

    wasUpgradeSuccessful(container: string): string {
        throw new Error('Not yet implemented');
    }

    commitNewYAMLConfigToGitHub(): boolean {
        throw new Error('Not yet implemented');
    }
}
