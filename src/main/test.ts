import K8sManager from '../lib/k8s-manager';

(async () => {
    const mgr = new K8sManager();
    const response = await mgr.k8sCoreV1Api.listPodForAllNamespaces();
    console.log(response);
})();
