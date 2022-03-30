import fs from 'fs';
import path from 'path';
import os from 'os';
import { ILocalConfig } from './local-config';

export default class Environment {

  static localConfig(): ILocalConfig | null {

    try {
      const localConfigPath = path.resolve(__dirname,'../../config.json');
      const config = JSON.parse(fs.readFileSync(localConfigPath).toString());
      return config;
    } catch (err) {
      console.error(`Error when parsing local config file: ${err}`);
      return null;
    }
  }

  static runningWithinCluster(): boolean {
    return fs.existsSync('/var/run/secrets/kubernetes.io/serviceaccount/token');
  }

  static runningWithinTestAutomation(): boolean {
    return (process.env.NODE_ENV === 'test');
  }

  static getNamespace(): string {
    let namespace = process.env.CHT_NAMESPACE || Environment.localConfig()?.CHT_NAMESPACE;
    try {
      if(!namespace && Environment.runningWithinCluster()) {
        namespace = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/namespace').toString();
      }  
    } catch (err) {
      const error = (err as Error);
      throw new Error(`Namespace could not be determined. 
        Error Name: ${error.name} Message: ${error.message}`);
    }

    if (!namespace) {
      throw new Error('Namespace could not be determined.');
    }

    return namespace;
  }

  static getDeploymentName(): string {
    const deploymentName = process.env.CHT_DEPLOYMENT_NAME || Environment.localConfig()?.CHT_DEPLOYMENT_NAME;

    if(!deploymentName) {
      throw new Error('Deployment name could not be determined.');
    }

    return deploymentName;
  }

  static getKubeConfigPath(): string {
    if(Environment.runningWithinCluster()) {
      throw new Error('Runing within cluster. Load config from cluster.');
    }
    if (Environment.runningWithinTestAutomation()) {
      return path.join(os.homedir(), '.kube/config');
    }
    const kubeConfigPath = process.env.KUBECONFIG || Environment.localConfig()?.KUBECONFIG_DEFAULT_PATH;

    if(kubeConfigPath) {
      return kubeConfigPath;
    }
    throw new Error('Could not get kube config path.');
  }

  static getUpgradeServicePort(): string {
    const port = process.env.UPGRADE_SERVICE_PORT || '5008';
    return port;
        
  }
}
