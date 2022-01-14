import config from '../../config.json';
import fs from 'fs';
import path from 'path';
import os from 'os';

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

    static runningWithinTestAutomation(): boolean {
        return (process.env.NODE_ENV === 'test');
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
        } else if (Environment.runningWithinTestAutomation()) { 
            return path.join(os.homedir(), '.kube/config');
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
