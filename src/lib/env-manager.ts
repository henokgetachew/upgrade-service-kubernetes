import config from '../../config.json';
import fs from 'fs';

export default class Environment {
    constructor() {

    }

    static runningWithinCluster(): boolean {
        if(fs.existsSync('/var/run/secrets/kubernetes.io/serviceaccount/token')) {
            return true;
        } else {
            return false;
        }
    }

    static getNamespace(): string {
        let namespace: string = "";
        namespace = process.env.CHT_NAMESPACE || config.CHT_NAMESPACE;
        if(namespace == "" && Environment.runningWithinCluster()) {
            namespace = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/namespace').toString();
        }
        return namespace;
    }

    static getDeploymentName(): string {
        return process.env.CHT_DEPLOYMENT_NAME || config.CHT_DEPLOYMENT_NAME;
    }

    static getKubeConfigPath(): string {
        if(Environment.runningWithinCluster()) {
            throw new Error('Runing within cluster. Load config from cluster.');
        } else {
            return process.env.KUBECONFIG || config.KUBECONFIG_DEFAULT_PATH;
        }
    }

    static getUpgradeServicePort(): any {
        const port = process.env.UPGRADE_SERVICE_PORT || 5008;
        console.log(port);
        return port;
        
    }
}
