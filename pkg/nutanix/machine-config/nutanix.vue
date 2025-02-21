<script>
import Loading from '@shell/components/Loading';
import { Banner } from '@components/Banner';
import CreateEditView from '@shell/mixins/create-edit-view';
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';
import KeyValue from '@shell/components/form/KeyValue';
import CodeMirror from '@shell/components/CodeMirror.vue';
import Collapse from '@shell/components/Collapse.vue';
import Checkbox from '@shell/rancher-components/Form/Checkbox/Checkbox.vue';
import RadioGroup from "@components/Form/Radio/RadioGroup";

import { NORMAN, SECRET } from '@shell/config/types';
import { stringify } from '@shell/utils/error';
import { _CREATE, _EDIT, _VIEW } from '@shell/config/query-params';

import { Nutanix } from '../nutanix.ts';
import UnitInput from '../components/UnitInput.vue';

// this function is used to setup all Select input option
function initOptions(enabled = false, init = null, options = []) {
  return {
    options:  options,
    selected: init,
    busy:     false,
    enabled:  enabled,
    baseOption: null,
  };
}

// this function is used to setup all Select input option
function initUnitOptions(enabled = false, init = null, _min = null, _max = null) {
  return {
    options: [],
    selected: init,
    min: _min,
    max: _max,
    busy: false,
    enabled: enabled,
    status: "",
    tooltip: "",
  };
}

export default {
  components: {
    Banner, Loading, KeyValue,
    LabeledSelect, UnitInput, CodeMirror,  Collapse, Checkbox, RadioGroup, UnitInput
},

  mixins: [CreateEditView],

  props: {
    uuid: {
      type:     String,
      required: true,
    },

    cluster: {
      type:    Object,
      default: () => ({})
    },

    credentialId: {
      type:     String,
      required: true,
    },

    disabled: {
      type:    Boolean,
      default: false
    },

    busy: {
      type:    Boolean,
      default: false
    },

    provider: {
      type:     String,
      required: true,
    }
  },
  emits: ['validationChanged'],

  async fetch() {
    if ( !this.credentialId ) {
      return;
    }

    this.$emit('validationChanged', false);

    if (this.mode == _CREATE) {
      this.initAuthentification();
      return
    }

    await this.initAuthentification();

    this.clusters.selected = this.clusters.baseOption.filter(e => e.label == this.value.cluster)[0];

    if (this.clusters.selected === undefined) {
      return;
    }

    await this.setClusterReferenceId(this.clusters.selected.value);

    this.projectName.selected = this.projectName.options.find((o) => o.value.name === this.value.project)?.value;
    this.vmCpus.selected = this.value.vmCpus;
    this.vmCpuPassthrough = this.value.vmCpuPassthrough;
    this.vmCores.selected = this.value.vmCores;
    this.vmMem.selected = this.value.vmMem / 1024;

    this.vmImage.selected = this.vmImage.options.find((o) => o.value.name === this.value.vmImage)?.value;
    this.vmImageSize.selected = this.value.vmImageSize;

    this.networks.selected = this.value.vmNetwork.map(e => this.networks.baseOption.find((o) => o.value.extId === e || o.extId === e));
    this.filterNetworks();
    this.bootType = this.value.bootType === "legacy" ? "Legacy" : "UEFI";
    this.vmCategories.selected = this.value.vmCategories.map(e => this.vmCategories.options.find((o) => o.name === e || o.value?.name === e));

    this.vmSerialPort = this.value.vmSerialPort;

    this.additionalDiskSize.selected = this.value.diskSize;

    if (this.additionalDiskSize.selected !== 0 && this.additionalDiskSize.selected !== null)
      this.storageContainer.selected = this.storageContainer.options.find((o) => o.value.containerExtId === this.value.storageContainer);

    this.cloudInit = this.value.cloudInit;

    this.$emit('validationChanged', true);

    if (this.mode == _VIEW) {
      this.mybusy = true;
    }
  },

  data() {
    return this.InitData();
  },

  // This wath the credentialId selector input to call the fetch above function
  watch: {
    'credentialId'() {
      this.$fetch();
    },
    'value'(newVal, oldVal) {
      const oldCat = oldVal.vmCategories;
      const oldNetworks = oldVal.vmNetwork;

      if (this.vmCategories.selected.length) {
        this.value.vmCategories = this.vmCategories.selected[0]?.label === undefined ?
          this.vmCategories.selected.map(c => c.name) : this.vmCategories.selected.map(c => c.value.name);
      } else {
        this.value.vmCategories = [];
      }
      const uniqueNetworks =  _.uniq(this.value.vmNetwork);
      this.value.vmNetwork = [...uniqueNetworks];
    }
  },
  computed: {
    value() {
      return this.value;
    }
  },

  methods: {
    stringify,

    async initAuthentification() {
      let obj = this.InitData();
      Object.keys(obj).forEach((key) => {
        (this)[key] = obj[key];
      });

      try {
        this.credential = await this.$store.dispatch('rancher/find', { type: NORMAN.CLOUD_CREDENTIAL, id: this.credentialId });
      } catch (e) {
        this.credential = null;
      }

      // Try and get the secret for the Cloud Credential as we need the plain-text password
      try {
        const id = this.credentialId.replace(':', '/');
        const secret = await this.$store.dispatch('management/find', { type: SECRET, id });
        const data = secret.data['nutanixcredentialConfig-password'];
        const password = atob(data);

        this.password = password;
        this.havePassword = true;
        this.ready = true;

      } catch (e) {
        this.password = '';
        this.havePassword = false;
        console.error(e);
      }

      this['authenticating'] = true;

      // Create a Nutanix object to do the API calls
      const os = new Nutanix(this.$store, this.credential);
      os.password = this.password;
      this.os = os;

      await this.setConfiguration();
    },

    InitData() {
      return {
        authenticating: false,
        ready: false,
        os: null,
        password: null,
        havePassword: false,
        clusters: initOptions(),
        clusterReferenceId: '',

        // Machine pool configuration
        projectName: initOptions(true, null, [{ name: "-- NO PROJECT --" }]),
        vmCpus: initUnitOptions(true, "2", 2, 128),
        vmCpuPassthrough: false,
        vmCores: initUnitOptions(true, "1", 1, 128),
        vmMem: initUnitOptions(true, "4", 4, 512),
        vmImage: initOptions(),
        vmImageSize: initUnitOptions(true, "0", 0, 10000),
        networks: initOptions(false, []),
        additionalDiskSize: initOptions(false, 0),
        storageContainer: initOptions(),
        is_SC_colapse: false,
        cloudInit: "#cloud-config\n\n",
        vmCategories: initOptions(false, []),
        vmSerialPort: false,
        bootType: "Legacy",

        // other
        t: this.$store.getters['i18n/t'],
        mybusy: false,
        errors: [],
      };
    },

    async setConfiguration() {
      // Fetch a token - if this succeeds, kick off async fetching the lists we need
      await this.os.getProjectsName(this.projectName, this.value?.projectName);

      if (!this.projectName.enabled) {
        this['authenticating'] = false;
        this.errors.push('Unable to get Nutanix Projects Name');
        return;
      }

      await this.os.getClusterList(this.clusters, this.value?.clusterName).then(() => {
        if (!this.clusters.enabled) {
          this.errors.push('Unable to get Nutanix cluster');
        }
        this.clusters.baseOption = this.clusters.options;
        this.networks.enabled = false;
      });

      await this.os.getImages(this.vmImage, this.value?.imageName).then(() => {
        if (!this.vmImage.enabled) {
          this.errors.push('Unable to get Nutanix Images');
        }
      });

      await this.os.getCategories(this.vmCategories, this.value?.vmCategories).then(() => {
        if (!this.vmCategories.enabled) {
          this.errors.push('Unable to get Nutanix vmCategories');
        }
      });
    },

    // This function is call when the cluster selector input change
    // this allow to dynamically change the network available for this cluster
    async setClusterReferenceId(e) {
      this.os.clusterReferenceId = e.extId;
      this.networks.options = [];
      this.storageContainer.options = [];

      await this.os.getNetwork(this.networks, this.value?.vmNetwork).then(() => {
        if (!this.networks.enabled) {
          this.errors.push('Unable to get Nutanix Network');
        }

        this.networks.baseOption = this.networks.options;

        if (this.projectName.selected) {
          let networkIdList = this.projectName.selected.status.resources.subnet_reference_list.map(c => c.uuid);
          this.networks.options = this.networks.baseOption.filter(network => networkIdList.includes(network.extId)); //  || vpcIdList.includes(network.value.extId)
          this.networks.baseOption = this.networks.options;
        }

        if (this.networks.options.length === 0) {
          this.networks.enabled = false;
        }
        else {
          this.networks.enabled = true;
        }
      });

      await this.os.getStorageContainer(this.storageContainer, this.value?.storageContainer).then(() => {
        if (!this.storageContainer.enabled) {
          this.errors.push('Unable to get Nutanix storageContainer');
        }

        this.additionalDiskSize.enabled = true;
      });
    },

    dynamicProjectName(e) {
      if (this.projectName.selected?.name == "-- NO PROJECT --") {
        this.projectName.selected = null;
        this.clusters.options = this.clusters.baseOption;
      }
      else {
        let clusterReferenceIdList = e.status.resources.cluster_reference_list.map(c => c.uuid);

        this.clusters.options = this.clusters.baseOption.filter(c =>
          clusterReferenceIdList.includes(c.extId)
        );
      }

      this.clusters.selected = null;
      this.networks.selected = [];
      this.networks.enabled = false;
      this.additionalDiskSize.selected = 0;
      this.additionalDiskSize.enabled = false;
      this.storageContainer.selected = null;

      if (this.clusters.options.length === 0) {
        this.clusters.enabled = false;
      }
      else {
        this.clusters.enabled = true;
      }
    },

    // This function is call when the image selector input change
    dynamicVmImageSize(object) {
      this.vmImageSize.min = 10.0 + Math.ceil(object.sizeBytes / 1073741824);
      // if (this.vmImageSize.selected < this.vmImageSize.min)
      this.vmImageSize.selected = 10.0 + Math.ceil(object.sizeBytes / 1073741824);

      if (this.vmImage?.duplicates?.find(e => e.name === object.name) !== undefined) {
        this.vmImage.status = "warning"
        this.vmImage.tooltip = this.t('driver.nutanix.config.component.vmImage.duplicates')
      }
      else {
        this.vmImage.status = ""
        this.vmImage.tooltip = ""
      }
    },

    filterNetworks() {
      if (this.networks.selected.length !== 0) {
        if (this.networks.selected[0]?.subnetType)
          this.networks.options = this.networks.baseOption.filter(
          (network) =>  {
            const selectedNetwork = this.networks.selected[0];
            return (
              selectedNetwork.subnetType === network.value.subnetType && 
              selectedNetwork.vpcReference === network.value.vpcReference && 
              selectedNetwork.isAdvancedNetworking === network.value.isAdvancedNetworking
            );
          }
        );
        else {
          this.networks.selected = this.networks.selected.filter(network => network.value);
          this.networks.options = this.networks.baseOption.filter(
            (network) => {
              const selectedNetwork = this.networks.selected[0];
              return (
                selectedNetwork.value.subnetType === network.value.subnetType && 
                selectedNetwork.value.vpcReference == network.value.vpcReference &&
                selectedNetwork.value.isAdvancedNetworking === network.value.isAdvancedNetworking
              );
            }
          );
        }
      } else {
        this.networks.options = this.networks.baseOption;
      }
    },

    // This function is call when the additional disk size input change
    dynamicStorageContainer(e) {
      this.additionalDiskSize.selected = e;

      if (this.additionalDiskSize.selected !== 0 && this.additionalDiskSize.selected !== null)
        this.storageContainer.enabled = true;
      else
        this.storageContainer.enabled = false;
    },

    // This function is call when the user add a wrong tag on a select input multiple
    labelSelectAddWrongTag(object, component) {
      component.selected = object.filter(network => network);
    },

    // Save all input data is the VUE values
    syncValue() {
      // Note: We don't need to provide password as this is picked up via the credential

      // Copy the values from the form to the correct places on the value
      this.value.cluster = this.clusters.selected?.value?.name ?? this.clusters.selected.name;

      this.value.project = this.projectName.selected?.name == "-- NO PROJECT --" ? null : this.projectName.selected?.name;
      this.value.vmCpus = this.vmCpus.selected.toString();
      this.value.vmCpuPassthrough = this.vmCpuPassthrough;
      this.value.vmCores = this.vmCores.selected.toString();
      this.value.vmMem = (this.vmMem.selected * 1024).toString();
      // this.value.vmMem = []; // Uncomment to test the value by generate an error with the driver
      this.value.vmImage = this.vmImage.selected?.name;
      this.value.vmImageSize = this.vmImageSize.selected.toString();
      const networks = _.uniq(this.networks.selected.map(e => e.extId));
      this.value.vmNetwork = networks;
      this.value.bootType = this.bootType.toLowerCase();

      if (this.vmCategories.selected.length) {
        this.value.vmCategories = this.vmCategories.selected[0]?.label === undefined ?
          this.vmCategories.selected.map(c => c.name) : this.vmCategories.selected.map(c => c.value.name);
      } else {
        this.value.vmCategories = [];
      }
      this.value.vmSerialPort = this.vmSerialPort;

      if (this.additionalDiskSize.selected !== null)
        this.value.diskSize = this.additionalDiskSize.selected.toString();
      else
        this.value.diskSize = this.additionalDiskSize.selected;

      if (this.additionalDiskSize.selected !== 0 && this.additionalDiskSize.selected !== null)
        this.value.storageContainer = this.storageContainer.selected?.containerExtId;

      this.value.cloudInit = this.cloudInit;
    },

    // This function is call when the user change the input value
    // To check if the value is between the min and max
    validInput(e, value) {
      value.selected = e;

      if (value.selected < value.min || value.selected > value.max) {
        value.status = "error"
        value.tooltip = this.t(`driver.nutanix.config.component.vmCpus.tooltip`) + ` (${value.min} - ${value.max})`
      }
      else {
        value.status = ""
        value.tooltip = ""
      }
    },

    // This function is call every time the user change a value
    // To check if all the input are valid to activate the "CREATE" button
    canAuthenticate() {
      if (this.additionalDiskSize.selected !== 0 &&
        this.additionalDiskSize.selected !== null &&
        this.storageContainer.selected === "") {
        this.$emit('validationChanged', false);
        return
      }


      if (!!this.clusters.selected &&
        !!this.vmCpus.selected &&
        !!this.vmCores.selected &&
        !!this.vmMem.selected &&
        !!this.vmImage.selected &&
        !!this.vmImageSize.selected &&
        this.networks.selected.length > 0) {
        this.$emit('validationChanged', true);
        return
      }

      this.$emit('validationChanged', false);
    },

    // This fonction is call when the user click on the "CREATE" and "Save" Button
    test() {
      this.syncValue();
    }
  }
};
</script>

<template>
  <div>
    <Loading
      v-if="$fetchState.pending"
      :delayed="true"
    />
    <div>
      <div class="nutanix-config"> <!-- Nutanix loggin status -->
        <div class="title">
          {{ t('driver.nutanix.config.title.main') }}
        </div>
        <div
          v-if="authenticating && !ready"
          class="loading"
        >
          <i class="icon-spinner icon-spin icon-lg" />
          <span>
            {{ t('driver.nutanix.config.loggin.loading') }}
          </span>
        </div> <!-- Loading loggin -->
        <div
          v-else-if="authenticating && ready"
          class="loading"
        >
          <i class="icon-checkmark icon-lg" style="color: green;"/>
          <span>
            {{ t('driver.nutanix.config.loggin.success') }}
          </span>
        </div> <!-- Success loggin -->
        <div
          v-else
          class="loading"
        >
          <i class="icon-close icon-lg" style="color: red;"/>
          <span>
            {{ t('driver.nutanix.config.loggin.failed') }}
          </span>
        </div> <!-- Failed loggin -->
      </div>
      <div class="row mt-10"> <!-- Project Name / Cluster -->
        <div class="col span-6"> <!-- Project Name -->
          <LabeledSelect
            v-model:value="projectName.selected"
            labelKey="driver.nutanix.config.component.projectName.label"
            :placeholder="t(`driver.nutanix.config.component.projectName.placeholder`)"
            :options="projectName.options"
            :disabled="!projectName.enabled || mybusy"
            :loading="projectName.busy"
            :searchable="false"
            @update:value="dynamicProjectName($event); canAuthenticate()"
          />
        </div>
        <div class="col span-6"> <!-- Cluster input -->
          <LabeledSelect
            v-model:value="clusters.selected"
            labelKey="driver.nutanix.config.component.cluster.label"
            :placeholder="t(`driver.nutanix.config.component.cluster.placeholder`)"
            :options="clusters.options"
            :disabled="!clusters.enabled || mybusy"
            :loading="clusters.busy"
            :searchable="false"
            :required="true"
            @update:value="setClusterReferenceId($event); canAuthenticate()"
          />
        </div>
      </div>
      <hr class="mt-10">
      <div class="nutanix-config"> <!-- VM Properties title -->
        <div class="title">
          {{ t('driver.nutanix.config.title.properties') }}
        </div>
      </div>
      <div class="row mt-10"> <!-- vmCpus  /  Cores  / vmMem  -->
        <div class="col span-4"> <!-- vmCpus -->
          <UnitInput
            :value="vmCpus.selected"
            labelKey="driver.nutanix.config.component.vmCpus.label"
            :suffix="t(`driver.nutanix.config.component.vmCpus.suffix`)"
            type="number"
            :disabled="!vmCpus.enabled || mybusy"
            :loading="vmCpus.busy"
            :required="true"
            :min="vmCpus.min"
            :max="vmCpus.max"
            @update:value="validInput($event, vmCpus); canAuthenticate()"
            :status="vmCpus.status"
            :tooltip="vmCpus.tooltip"
          />
          <Checkbox
            :value="vmCpuPassthrough"
            :valueWhenTrue="true"
            labelKey="driver.nutanix.config.component.vmCpuPassthrough.label"
            style="margin-top: 5px;"
            @update:value="vmCpuPassthrough = !vmCpuPassthrough;"
            :disabled="mybusy"
          />
        </div>
        <div class="col span-4"> <!-- Cores -->
          <UnitInput
            :value="vmCores.selected"
            labelKey="driver.nutanix.config.component.vmCores.label"
            :suffix="t(`driver.nutanix.config.component.vmCores.suffix`)"
            type="number"
            :disabled="!vmCores.enabled || mybusy"
            :loading="vmCores.busy"
            :required="true"
            :min="vmCores.min"
            :max="vmCores.max"
            @keyup="validInput($event, vmCores); canAuthenticate()"
            @update:value="validInput($event, vmCores); canAuthenticate()"
            :status="vmCores.status"
            :tooltip="vmCores.tooltip"
          />
        </div>
        <div class="col span-4"> <!-- vmMem -->
          <UnitInput
            :value="vmMem.selected"
            labelKey="driver.nutanix.config.component.vmMem.label"
            :suffix="t(`driver.nutanix.config.component.vmMem.suffix`)"
            type="number"
            :disabled="!vmMem.enabled || mybusy"
            :loading="vmMem.busy"
            :required="true"
            :min="vmMem.min"
            :max="vmMem.max"
            @update:value="validInput($event, vmMem); canAuthenticate()"
            :status="vmMem.status"
            :tooltip="vmMem.tooltip"
          />
        </div>
      </div>
      <div class="row mt-10"> <!-- Image  /  VM Disk Size -->
        <div class="col span-6"> <!-- Image input -->
          <LabeledSelect
            v-model:value="vmImage.selected"
            labelKey="driver.nutanix.config.component.vmImage.label"
            :placeholder="t(`driver.nutanix.config.component.vmImage.placeholder`)"
            :options="vmImage.options"
            :disabled="!vmImage.enabled || mybusy"
            :loading="vmImage.busy"
            :searchable="false"
            :required="true"
            :status="vmImage.status"
            :tooltip="vmImage.tooltip"
            @update:value="dynamicVmImageSize($event); canAuthenticate()"
          />
        </div>
        <div class="col span-6"> <!-- VM Disk Size input -->
          <UnitInput
            :value="vmImageSize.selected"
            labelKey="driver.nutanix.config.component.vmImageSize.label"
            :suffix="t(`driver.nutanix.config.component.vmImageSize.suffix`)"
            :min="vmImageSize.min"
            :max="vmImageSize.max"
            :disabled="!vmImageSize.enabled || mybusy"
            :loading="vmImageSize.busy"
            :required="true"
            type="number"
            @update:value="validInput($event, vmImageSize); canAuthenticate()"
            :status="vmImageSize.status"
            :tooltip="vmImageSize.tooltip"
          />
        </div>
      </div>
      <div class="row mt-10" style="align-items: center;"> <!-- Network Select / Boot Configuration -->
        <div class="col span-6"> <!-- Network Select -->
          <LabeledSelect
            v-model:value="networks.selected"
            labelKey="driver.nutanix.config.component.vmNetwork.label"
            :placeholder="t(`driver.nutanix.config.component.vmNetwork.placeholder`)"
            :taggable="true"
            :multiple="true"
            :options="networks.options"
            :disabled="!networks.enabled || mybusy"
            :loading="networks.busy"
            :searchable="true"
            :required="true"
            @update:value="labelSelectAddWrongTag($event, networks); filterNetworks(); canAuthenticate()"
          />
        </div>
        <div class="col span-6" style="padding-left: 10px;"> <!-- Boot Configuration -->
          <div class="nutanix-config"> <!-- Boot Configuration title -->
            <div class="title">
              {{ t('driver.nutanix.config.title.bootType') }}
            </div>
          </div>
          <RadioGroup
            name="bootConfiguration"
            :options='["Legacy", "UEFI"]'
            :row="true"
            :value="bootType"
            @update:value="bootType = $event"
            :disabled="mybusy"
          />
        </div>
      </div>
      <div class="row mt-10"> <!-- VM Categories -->
        <div class="col span-12">
          <LabeledSelect
            v-model:value="vmCategories.selected"
            labelKey="driver.nutanix.config.component.vmCategories.label"
            :placeholder="t(`driver.nutanix.config.component.vmCategories.placeholder`)"
            :taggable="true"
            :multiple="true"
            :options="vmCategories.options"
            :disabled="!vmCategories.enabled || mybusy"
            :loading="vmCategories.busy"
            @selecting="labelSelectAddWrongTag($event, vmCategories)"
          />
        </div>
      </div>
      <!-- vmSerialPort -->
      <Checkbox
        val
        :value="vmSerialPort"
        :valueWhenTrue="true"
        labelKey="driver.nutanix.config.component.vmSerialPort.label"
        style="margin-top: 5px;"
        @update:value="vmSerialPort = !vmSerialPort;"
        :disabled="mybusy"
      />
      <!-- Collapse Additional Disk Size  /  Storage Container -->
      <Collapse
        :open="is_SC_colapse"
        :title="t(`driver.nutanix.config.title.collapseAdditionalDisk`)"
        @update:open="is_SC_colapse = !is_SC_colapse"
      >
      <div>
        <div class="row"> <!-- Additional Disk Size  /  Storage Container -->
          <div class="col span-6">
            <UnitInput
              :value="additionalDiskSize.selected"
              labelKey="driver.nutanix.config.component.diskSize.label"
              :suffix="t(`driver.nutanix.config.component.diskSize.suffix`)"
              type="number"
              :disabled="!additionalDiskSize.enabled || mybusy"
              :loading="additionalDiskSize.busy"
              @update:value="dynamicStorageContainer($event); canAuthenticate()"
            />
          </div>
          <div class="col span-6">
            <LabeledSelect
              v-model:value="storageContainer.selected"
              labelKey="driver.nutanix.config.component.storageContainer.label"
              :placeholder="t(`driver.nutanix.config.component.storageContainer.placeholder`)"
              :options="storageContainer.options"
              :disabled="!additionalDiskSize.selected || !storageContainer.enabled || mybusy"
              :loading="storageContainer.busy"
              :searchable="false"
              @update:value="canAuthenticate()"
            />
          </div>
        </div>
      </div>
      </Collapse>
      <hr class="mt-10">
      <div class="nutanix-config"> <!-- Cloud-init title -->
        <div class="title">
          {{ t('driver.nutanix.config.title.cloudInit') }}
        </div>
      </div>
      <div class="row mt-10"> <!-- Cloud Init Config YAML -->
        <div class="col span-12">
        <CodeMirror
          style="background: #f5f5f5;"
          mode="edit"
          minHeight=5
          :value=cloudInit
          :options="mybusy ? {readOnly:true, cursorBlinkRate:-1} : {readOnly: false}"
          :asTextArea="false"
          @onInput="cloudInit = $event"
        />
        </div>
      </div>
    </div>
    <div v-if="errors.length">
        <div
          v-for="(err, idx) in errors"
          :key="idx"
        >
          <Banner
            color="error"
            :label="stringify(err)"
          />
        </div>
    </div>
  </div>
</template>
<style scoped lang="scss">
  .file-button {
    align-items: center;
    position: absolute;
    top: 0;
    right: 0;
    height: 100%;
    display: flex;

    > .file-selector {
      height: calc($input-height - 2px);
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
    }
  }

  .nutanix-config {
    display: flex;
    align-items: center;

    > .title {
      font-weight: bold;
      padding: 4px 0;
    }

    > .loading {
      margin-left: 20px;
      display: flex;
      align-items: center;

      > i {
        margin-right: 4px;;
      }
    }
  }
</style>


