import { isArray } from "lodash";

type Options = {
  value: any;
  api: string;
  field: string;
  mapper?: Function;
  filter?: Function;
  initial?: string;
  name?: string;
}
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

  private $dispatch: any;

  constructor($store: any, obj: any) {
    if (obj.nutanixcredentialConfig) {
      Object.keys(obj.nutanixcredentialConfig).forEach((key) => {
        (this as any)[key] = obj.nutanixcredentialConfig[key];
      });
      this.credentialID = obj.id;
    } else {
      // Copy from options to this
      Object.keys(obj).forEach((key) => {
        (this as any)[key] = obj[key];
      });
    }

    this.$dispatch = $store.dispatch;
  }

  public async testConnection() {
    const baseUrl = `/meta/proxy/${this.endpoint}:${this.port}`;
    const url = `${baseUrl}/api/clustermgmt/v4.0/config/clusters`;
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
    return await this.getOptions({
      value,
      api: "/api/clustermgmt/v4.0/config/clusters",
      field: 'data',
      filter: (cluster: any) => cluster.config.hypervisorTypes.includes("AHV"),
      initial
    });
  }

  public async getImages(value: any, initial?: string) {
    return await this.getOptions({
      value,
      api: '/api/vmm/v4.0/content/images',
      field: 'data',
      initial
    });
  }

  public async getNetwork(value: any, initial?: string) {
    return await this.getOptions({
      value,
      api: '/api/networking/v4.0/config/subnets',
      field: 'data',
      mapper: async (network: any) => {
        const vpc = network.subnetType === "OVERLAY" ? (await this.getVpc(network.vpcReference)).data : undefined;
        return {
          ...network,
          baseName: network.name,
          name: network.subnetType === "OVERLAY" ? `${network.name} (${vpc.name})` : network.name,
        }
      },
      filter: (network: any) => (network.subnetType == "OVERLAY" || network.clusterReference == this.clusterReferenceId) && !network.isExternal,
      initial
    });
  }

  public async getVpc(vpcReference: string) {
    return await this.makeComputeRequest(`/api/networking/v4.0/config/vpcs/${vpcReference}`);
  }

  public async getStorageContainer(value: any, initial?: string) {
    return await this.getOptions({
      value,
      api: '/api/clustermgmt/v4.0/config/storage-containers',
      field: 'data',
      filter: (storage: any) => storage.clusterExtId == this.clusterReferenceId,
      initial
    });
  }

  public async getCategories(value: any, initial?: string) {
    return await this.getOptions({
      value,
      api: '/api/prism/v4.0/config/categories',
      field: 'data',
      mapper: (categorie: any) => { return { ...categorie, name: `${categorie.key}=${categorie.value}` } },
      filter: (categorie: any) => categorie.key !== "Project",
      initial
    });
  }

  public async getProjectsName(value: any, initial?: string) {
    return await this.getOptions({
      value,
      api: '/api/nutanix/v3/projects/list',
      field: 'entities',
      mapper: (project: any) => { return { ...project, name: `${project.spec.name}` } },
      initial
    });
  }

  // public async getNetworkNames(value: any, initial?: string) {
  //   return await this.getOptions(value, '/os-tenant-networks', 'networks', (network: any) => {
  //     return {
  //       ...network,
  //       name: network.label
  //     };
  //   }, initial);
  // }

  private async constructTotalResponse(apiPath: string, initialDataLength: number, total: number) {
    const pageCount = Math.ceil(total / initialDataLength);
    const data = [];
    for (let i = 1; i < pageCount; i++) {
      const nextPageResponse = await this.makeComputeRequest(`${apiPath}?$page=${i}`);
      data.push(...nextPageResponse.data);
    }

    return data;
  }

  private async constructProjectTotalResponse(apiPath: string, initialDataLength: number, total: number) {
    const pageCount = Math.ceil(total / initialDataLength);
    const entities = [];
    for (let i = 1; i < pageCount; i++) {
      const nextPageResponse = await this.makeComputeRequest(`${apiPath}?$page=${i}`, 'POST');
      entities.push(...nextPageResponse.entities);
    }

    return entities;
  }

  public async getOptions(options: Options) {
    const { value, api, mapper, filter, initial, field } = options;
    // We are fetching the data for the options
    value.busy = true;
    value.enabled = true;
    value.selected = isArray(value.selected) ? [] : '';

    let res;

    if (api === '/api/nutanix/v3/projects/list') {
      res = await this.makeComputeRequest(api, 'POST');
      const total = res?.metadata?.total_matches ?? 0;
      const pageCount = res?.entities?.length ?? 0;
      if (pageCount < total) {
        const entities = await this.constructProjectTotalResponse(api, pageCount, total);
        res.entities = [...res.entities, ...entities];
      }
    }
    else {
      res = await this.makeComputeRequest(api);
      const total = res?.metadata?.totalAvailableResults ?? 0;
      const pageCount = res?.data?.length ?? 0;

      if (pageCount < total) {
        const data = await this.constructTotalResponse(api, pageCount, total);
        res.data = [...res.data, ...data];
      }
    }

    if (res && (res as any)[field]) {
      let list = (res as any)[field] || [];

      if (filter) {
        list = list.filter((k: any) => filter(k));
      }

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
