import { isArray } from "lodash";

/**
 * Helper class for dealing with the nutanix API
 */
export class Nutanix {
  public endpoint: string = '';
  public username: string = '';
  public password: string = '';
  public port: string = '';
  public insecure: boolean = false;
  public clusterReferenceId: string = '';
  private credentialID: string = '';
  private endpoints: any;

  // private region: string = '';

  private $dispatch: any;

  constructor($store: any, obj: any) {
    // console.log("constructor: obj:");
    // console.log(obj);

    if (obj.nutanixcredentialConfig) {
      Object.keys(obj.nutanixcredentialConfig).forEach((key) => {
        // console.log(`${key} : ${obj.nutanixcredentialConfig[key]}`);
        (this as any)[key] = obj.nutanixcredentialConfig[key];
      });
      this.credentialID = obj.id;
    } else {
      // Copy from options to this
      Object.keys(obj).forEach((key) => {
        // console.log(`${key} : ${obj[key]}`);
        (this as any)[key] = obj[key];
      });
    }

    this.$dispatch = $store.dispatch;
  }

  public async testConnection() {
    const baseUrl = `/meta/proxy/${this.endpoint}:${this.port}`;
    const url = `${baseUrl}/api/clustermgmt/v4.0.b1/config/clusters`;
    const headers = {
      Accept: 'application/json',
      "X-API-Auth-Header": 'Basic ' + btoa(this.username + ':' + this.password)
    };

    try {
      const res = await this.$dispatch('management/request', {
        url,
        headers,
        method: 'GET',
        redirectUnauthorized: false,
      }, { root: true });

      if (res._status === 502) {
        return { error: 'Could not proxy request - URL may not be in Rancher\'s allow list' };
      }

      return res;

    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      return { error: e };
    }
  }

  public async getClusterList(value: any, initial?: string) {
    return await this.getOptions(value, "/api/clustermgmt/v4.0.b1/config/clusters", 'data', undefined,
      (cluster: any) => cluster.config.hypervisorTypes.includes("AHV"), initial);
  }

  public async getImages(value: any, initial?: string) {
    return await this.getOptions(value, '/api/vmm/v4.0.a1/content/images', 'data', undefined, undefined, initial);
  }

  public async getNetwork(value: any, initial?: string) {
    return await this.getOptions(value, '/api/networking/v4.0.b1/config/subnets', 'data',
      async (network: any) => {
        const vpc = network.subnetType === "OVERLAY" ? (await this.getVpc(network.vpcReference)).data : undefined;
        // console.log("getNetwork: vpc: ", vpc);
        return {
          ...network,
          baseName: network.name,
          name: network.subnetType === "OVERLAY" ? `${network.name} (${vpc.name})` : network.name,
        }
      },
      (network: any) => (network.subnetType == "OVERLAY" || network.clusterReference == this.clusterReferenceId) && !network.isExternal, initial);
  }

  public async getVpc(vpcReference: string) {
    return await this.makeComputeRequest(`/api/networking/v4.0.b1/config/vpcs/${vpcReference}`);
  }

  public async getStorageContainer(value: any, initial?: string) {
    return await this.getOptions(value, '/api/storage/v4.0.a3/config/storage-containers', 'data', undefined,
      (storage: any) => storage.clusterExtId == this.clusterReferenceId, initial);
  }

  public async getCategories(value: any, initial?: string) {
    return await this.getOptions(value, '/api/prism/v4.0.a2/config/categories', 'data',
      (categorie: any) => { return { ...categorie, name: `${categorie.key}=${categorie.value}` } },
      (categorie: any) => categorie.key !== "Project", initial);
  }

  public async getProjectsName(value: any, initial?: string) {
    return await this.getOptions(value, '/api/nutanix/v3/projects/list', 'entities',
      (project: any) => { return { ...project, name: `${project.spec.name}` } }, undefined, initial);
  }

  // public async getNetworkNames(value: any, initial?: string) {
  //   return await this.getOptions(value, '/os-tenant-networks', 'networks', (network: any) => {
  //     return {
  //       ...network,
  //       name: network.label
  //     };
  //   }, initial);
  // }


  public async getOptions(value: any, api: string, field: string, mapper?: Function, filter?: Function, initial?: string) {
    // We are fetching the data for the options
    value.busy = true;
    value.enabled = true;
    value.selected = isArray(value.selected) ? [] : '';

    let res;

    if (api === '/api/nutanix/v3/projects/list') {
      console.log("getOptions: api: /api/nutanix/v3/projects/list")
      res = await this.makeComputeRequest(api, 'POST');
    }
    else {
      res = await this.makeComputeRequest(api);
    }

    // console.log("getOptions: api:" + api)
    // console.log(res)

    if (res && (res as any)[field]) {
      let list = (res as any)[field] || [];

      if (filter) {
        list = list.filter((k: any) => filter(k));
      }

      // console.log("getOptions: api: filter: " + api);
      // console.log(list);

      if (mapper) {
        list = await Promise.all(list.map(async (k: any) => await mapper(k)));
      }

      value.options.forEach((selected: any) => { list.push(selected) });

      value.options = this.convertToOptions(list);
      value.busy = false;

      if (value.options.length < list.length) {
        const unique = list.filter((obj: any, index: any) => {
          return index !== list.findIndex((o: any) => obj.name === o.name);
        });
        value.duplicates = unique;
      }

      // console.log("getOptions: api: options: " + api);
      // console.log(value.options);

      if (initial) {
        const found = value.options.find((option: any) => option.value.name === initial);

        if (found) {
          value.selected = found.value;
        }
      }

    } else {
      value.options = [];
      value.selected = isArray(value.selected) ? [] : null;
      value.busy = false;
      value.enabled = false;
    }
  }

  public async makeComputeRequest(api: string, method: string = 'GET') {
    // console.log("makeComputeRequest:")
    // console.log(this)
    const baseUrl = `/meta/proxy/${this.endpoint}:${this.port}`;
    const url = `${baseUrl}${api}`;

    const headers = {
      Accept: 'application/json',
      "Content-Type": 'application/json',
      "X-API-Auth-Header": 'Basic ' + btoa(this.username + ':' + this.password),
      // "X-Api-CattleAuth-Header": `Basic credId=${this.credentialID} usernameField=${this.username} passwordField=${this.password}`
      // TODO: TRY those exemples
      // headers['X-API-CattleAuth-Header'] = `Bearer credID=${ credentialId } passwordField=token`;
      // set(headers, 'x-api-cattleauth-header', `Bearer credID=${ token } passwordField=privateKeyPassphrase`);
      // headers['x-api-cattleauth-header'] = `Bearer credID=${ credentialId } passwordField=accessToken`;
    };

    try {
      const res = await this.$dispatch('management/request', {
        url,
        headers,
        method: method,
        data: JSON.stringify({}),
        redirectUnauthorized: false,
      }, { root: true });

      return res;
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
    }
  }


  private convertToOptions(list: any) {
    const unique = list.filter((obj: any, index: any) => {
      return index === list.findIndex((o: any) => obj.name === o.name);
    });

    const sorted = (unique || []).sort((a: any, b: any) => a.name.localeCompare(b.name));

    return sorted.map((p: any) => {
      return {
        label: p.name,
        value: p
      };
    });
  }
}
