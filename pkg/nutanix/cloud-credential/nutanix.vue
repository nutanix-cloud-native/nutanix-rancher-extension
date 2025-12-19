<script>
import { parse as parseUrl } from '@shell/utils/url';
import { _CREATE } from '@shell/config/query-params';
import { _VIEW } from '@shell/config/query-params';

import { Nutanix, NTNX_API_KEY_HEADER } from '../nutanix.ts';

import Banner from '@components/Banner/Banner.vue';
import { LabeledInput } from '@components/Form/LabeledInput';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import Checkbox from '@shell/rancher-components/Form/Checkbox/Checkbox.vue';

export default {
  components: {
    Banner,
    LabeledInput,
    LabeledSelect,
    Checkbox,
  },

  props: {
    mode: {
      type:     String,
      required: true,
    },

    value: {
      type:     Object,
      required: true,
    },
  },

  async fetch() {
    this.driver = await this.$store.dispatch('rancher/find', {
      type: 'nodedriver',
      id:   'nutanix'
    });
  },

  mounted() {
    // Detect auth type from existing credentials
    if (this.value?.decodedData?.username === NTNX_API_KEY_HEADER) {
      this.authType = 'apiKey';
    } else if (this.value?.decodedData?.username) {
      this.authType = 'password';
    }
  },

  data() {
    return {
      step:           1,
      busy:           false,
      errorAllowHost: false,
      allowBusy:      false,
      driver:         {},
      error:          '',
      success:        '',
      authType:       '',
    };
  },

  computed: {
    authTypeOptions() {
      return [
        { label: this.t('driver.nutanix.auth.authTypes.password'), value: 'password' },
        { label: this.t('driver.nutanix.auth.authTypes.apiKey'), value: 'apiKey' },
      ];
    },

    hostname() {
      const u = parseUrl(this.value.decodedData.endpoint);

      return u?.host || '';
    },

    // Function used to verified if we can clic on the Authenticate button
    canAuthenticate() {
      if (!this.authType) {
        return false;
      }
      if (this.authType === 'apiKey') {
        return !!this.value?.decodedData?.endpoint &&
          !!this.value?.decodedData?.password;
      }
      return !!this.value?.decodedData?.endpoint &&
        !!this.value?.decodedData?.username &&
        !!this.value?.decodedData?.password;
    }
  },
  emits: ['validationChanged'],

  watch: {
    authType(newVal) {
      // Reset test status when auth type changes
      this.error = '';
      this.success = '';
      this.errorAllowHost = false;
      this.$emit('validationChanged', false);
      
      if (newVal === 'apiKey') {
        this.value.setData('username', NTNX_API_KEY_HEADER);
        this.value.setData('password', '');
      } else if (newVal === 'password') {
        // Clear username when switching back to password mode
        if (this.value.decodedData.username === NTNX_API_KEY_HEADER) {
          this.value.setData('username', '');
          this.value.setData('password', '');
        }
      }
    }
  },

  methods: {

    test() {
      return true;
    },

    hostInAllowList() {
      if (!this.driver?.whitelistDomains) {
        return false;
      }

      const u = parseUrl(this.value.decodedData.endpoint);

      if (!u.host) {
        return true;
      }

      return (this.driver?.whitelistDomains || []).includes(u.host);
    },

    async addHostToAllowList() {
      this['allowBusy'] = true;
      const u = parseUrl(this.value.decodedData.endpoint);

      this.driver.whitelistDomains = this.driver.whitelistDomains || [];

      if (!this.hostInAllowList()) {
        this.driver.whitelistDomains.push(u.host);
      }

      try {
        await this.driver.save();

        // this.$refs.connect.$el.click();

        this['error'] = "";
        this.connect();


      } catch (e) {
        console.error('Could not update driver', e); // eslint-disable-line no-console
        this['allowBusy'] = false;
      }

    },

    async connect() {
      if (this.disabled) {
        return;
      }

      this['error'] = '';
      this['success'] = '';
      this['errorAllowHost'] = false;

      let okay = false;

      if (!this.value.decodedData.endpoint) {
        this['busy'] = false;
        return;
      }

      if (!this.value.decodedData.port)
        this.value.setData('port', 9440);

      const os = new Nutanix(this.$store, {
        endpoint:   this.value.decodedData.endpoint,
        username:   this.value.decodedData.username,
        password:   this.value.decodedData.password,
        port:       this.value.decodedData.port,
        insecure:   this.value.decodedData.insecure,
      });

      this['allowBusy'] = false;
      this['busy'] = true;

      const res = await os.testConnection();

      if (res.error) {
        okay = false;


        if (res.error._status === 502 && !this.hostInAllowList()) {
          this['errorAllowHost'] = true;
        } else if (res.error._status === 401) {
          this['error'] = "Authentication Failed";
        } else if (res.error._status === 403) {
          this['error'] = "Permission Denied";
        } else if (res.error._status === 404) {
          this['error'] = "API method not found. PC version 2024.3 or higher is required";
        } else {
          this['error'] = res.error.message ? res.error.message : "Something went wrong";
        }
      } else {
        okay = true;
        this['success'] = `Connection to ${this.value.decodedData.endpoint} successful`;
      }

      this['busy'] = false;
      this.$emit('validationChanged', okay);
    }
  }
};
</script>

<template>
    <div class="row">
      <div class="col span-6"> <!-- Endpoint -->
        <LabeledInput
          :value="value.decodedData.endpoint"
          :disabled="step !== 1"
          label-key="driver.nutanix.auth.fields.endpoint"
          placeholder-key="driver.nutanix.auth.placeholders.endpoint"
          type="text"
          :mode="mode"
          @update:value="value.setData('endpoint', $event);"
        />
      </div>
      <div class="col span-6"> <!-- Port -->
        <LabeledInput
          :value="value.decodedData.port"
          :disabled="step !== 1"
          label-key="driver.nutanix.auth.fields.port"
          placeholder-key="driver.nutanix.auth.placeholders.port"
          type="text"
          :mode="mode"
          @update:value="value.setData('port', $event);"
        />
      </div>
    </div>

    <div class="row mt-20">
      <div class="col span-12">
        <LabeledSelect
          :value="authType"
          :options="authTypeOptions"
          label-key="driver.nutanix.auth.fields.authType"
          :mode="mode"
          :disabled="step !== 1"
          @update:value="authType = $event"
        />
      </div>
    </div>

    <!-- Password Authentication -->
    <div v-if="authType === 'password'" class="row">
      <div class="col span-6"> <!-- Username -->
        <LabeledInput
          :value="value.decodedData.username"
          :disabled="step !== 1"
          class="mt-20"
          label-key="driver.nutanix.auth.fields.username"
          placeholder-key="driver.nutanix.auth.placeholders.username"
          type="text"
          :mode="mode"
          @update:value="value.setData('username', $event);"
        />
      </div>
      <div class="col span-6"> <!-- Password -->
        <LabeledInput
          :value="value.decodedData.password"
          :disabled="step !== 1"
          class="mt-20"
          label-key="driver.nutanix.auth.fields.password"
          placeholder-key="driver.nutanix.auth.placeholders.password"
          type="password"
          :mode="mode"
          @update:value="value.setData('password', $event);"
        />
      </div>
    </div>

    <!-- API Key Authentication -->
    <div v-if="authType === 'apiKey'" class="row">
      <div class="col span-12"> <!-- API Key -->
        <LabeledInput
          :value="value.decodedData.password"
          :disabled="step !== 1"
          class="mt-20"
          label-key="driver.nutanix.auth.fields.apiKey"
          placeholder-key="driver.nutanix.auth.placeholders.apiKey"
          type="password"
          :mode="mode"
          @update:value="value.setData('password', $event);"
        />
      </div>
    </div>

    <div class="row">
      <div class="col span-6">
        <Checkbox
          class="mt-20"
          :value="value.decodedData.insecure"
          :valueWhenTrue="true"
          label-key="driver.nutanix.auth.fields.insecure"
          @update:value="value.setData('insecure', $event);"
          :disabled="true"
        />
      </div>
    </div>

    <!-- Test Authentication -->
    <button
      ref="connect"
      class="btn role-primary mt-20 align-start"
      :disabled="step !== 1 || !canAuthenticate"
      :loading="step !== 1 || !canAuthenticate"
      @click="connect($event)"
    >
      <i
        v-if="busy"
        class="icon icon-lg icon-spinner icon-spin"
      />
      <span
        v-else
        class="icon-spacer"
      />
      <span>{{ t('driver.nutanix.auth.actions.authenticate') }}</span>
      <span class="icon-spacer" />
    </button>

    <Banner v-if="success"
      color="success"
      :closable="false"
    >
      {{ success }}
    </Banner>

    <Banner
      v-if="error"
      class="mt-20"
      color="error"
    >
      {{ error }}
    </Banner>

    <Banner
      v-if="errorAllowHost"
      color="error"
      class="allow-list-error"
    >
      <div>
        {{ t('driver.nutanix.auth.errors.notAllowed', { hostname }) }}
      </div>
      <button
        :disabled="allowBusy"
        class="btn ml-10 role-primary"
        @click="addHostToAllowList"
      >
        {{ t('driver.nutanix.auth.actions.addToAllowList') }}
      </button>
    </Banner>
</template>
<style lang="scss" scoped>
  .allow-list-error {
    display: flex;

    > :first-child {
      flex: 1;
    }
  }
  .icon-spacer {
    width: 24px;
  }

  .align-start {
    align-self: flex-start;
  }
</style>
