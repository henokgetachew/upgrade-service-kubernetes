import fs from 'fs';
import path from 'path';
import os from 'os';

export default class Environment {

    static localConfig(): {'KUBECONFIG_DEFAULT_PATH': string, 'CHT_DEPLOYMENT_NAME': string, 'CHT_NAMESPACE': string} {
        let config = {
            'KUBECONFIG_DEFAULT_PATH': '',
            'CHT_DEPLOYMENT_NAME': '',
            'CHT_NAMESPACE': ''
        };

        const localConfigPath = '../../config.json';
        if(fs.existsSync(localConfigPath)) {
            config = JSON.parse(fs.readFileSync(localConfigPath).toString());
        }
        return config;
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
        let namespace = '';
        namespace = process.env.CHT_NAMESPACE || Environment.localConfig().CHT_NAMESPACE;
        if(namespace === '' && Environment.runningWithinCluster()) {
            namespace = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/namespace').toString();
        }
        return namespace;
    }

    static getDeploymentName(): string {
        return process.env.CHT_DEPLOYMENT_NAME || Environment.localConfig().CHT_DEPLOYMENT_NAME;
    }

    static getKubeConfigPath(): string {
        if(Environment.runningWithinCluster()) {
            throw new Error('Runing within cluster. Load config from cluster.');
        } else if (Environment.runningWithinTestAutomation()) { 
            return path.join(os.homedir(), '.kube/config');
        } else {
            return process.env.KUBECONFIG || Environment.localConfig().KUBECONFIG_DEFAULT_PATH;
        }
    }

    static getUpgradeServicePort(): string {
        const port = process.env.UPGRADE_SERVICE_PORT || '5008';
        return port;
        
    }
}
