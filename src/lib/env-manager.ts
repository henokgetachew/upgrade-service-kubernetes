import config from '../../config.json';
// will this be mounted to the volume? How do we deal with this if it isn't? Do we mount the file on top of the one we have?
// what happens when the mounted file is malformed?
import fs from 'fs';
import path from 'path';
import os from 'os';

export default class Environment {
    constructor() {

    }

    static runningWithinCluster(): boolean {
        // you can change this to :
        // return fs.existsSync('/var/run/secrets/kubernetes.io/serviceaccount/token');
        // What is '/var/run/secrets/kubernetes.io/serviceaccount/token'? How does this get mounted to the container?
        // As far as I can tell, we never use this token? We use the namespace file though?
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
        // you can change this to
        // let namespace = process.env.CHT_NAMESPACE || config.CHT_NAMESPACE;
        let namespace: string = "";
        namespace = process.env.CHT_NAMESPACE || config.CHT_NAMESPACE;
        if(namespace == "" && Environment.runningWithinCluster()) {
            // please always use strict equality
            namespace = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/namespace').toString();
            // what happens if this file doesn't exist? we've checked if a different file exists.
        }
        return namespace;
    }

    static getDeploymentName(): string {
        return process.env.CHT_DEPLOYMENT_NAME || config.CHT_DEPLOYMENT_NAME;
    }

    static getKubeConfigPath(): string {
        // we don't need all these cascading conditions, since every branch terminates the function
        // if (Environment.runningWithinCluster()) {
        //   throw new Error('Running within cluster. Load config from cluster.');
        // }
        // if (Environment.runningWithinTestAutomation()) {
        //   return path.join(os.homedir(), '.kube/config');
        // }
        // return process.env.KUBECONFIG || config.KUBECONFIG_DEFAULT_PATH;

        if (Environment.runningWithinCluster()) {
            throw new Error('Runing within cluster. Load config from cluster.');
        } else if (Environment.runningWithinTestAutomation()) {
            return path.join(os.homedir(), '.kube/config');
            // how does this path get mounted when this runs in a container?
        } else {
            return process.env.KUBECONFIG || config.KUBECONFIG_DEFAULT_PATH;
        }
    }

    static getUpgradeServicePort(): any {
        const port = process.env.UPGRADE_SERVICE_PORT || 5008;
        console.log(port);
        // please remove debug logs.
        return port;

    }
}
