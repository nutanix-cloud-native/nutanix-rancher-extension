<script>
import { parse as parseUrl } from '@shell/utils/url';
import { _CREATE } from '@shell/config/query-params';
import { _VIEW } from '@shell/config/query-params';

import { Nutanix } from '../nutanix.ts';

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

  data() {
    return {
      step:           1,
      busy:           false,
      errorAllowHost: false,
      allowBusy:      false,
      driver:         {},
      error:          '',
      success:        '',
    };
  },

  computed: {

    hostname() {
      const u = parseUrl(this.value.decodedData.endpoint);

      return u?.host || '';
    },

    // Function used to verified if we can clic on the Authenticate button
    canAuthenticate() {
      return !!this.value?.decodedData?.endpoint &&
        !!this.value?.decodedData?.username &&
        !!this.value?.decodedData?.password;
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
      this.$set(this, 'allowBusy', true);
      const u = parseUrl(this.value.decodedData.endpoint);

      this.driver.whitelistDomains = this.driver.whitelistDomains || [];

      if (!this.hostInAllowList()) {
        this.driver.whitelistDomains.push(u.host);
      }

      try {
        await this.driver.save();

        // this.$refs.connect.$el.click();

        this.$set(this, 'error', ""); // TODO:
        this.connect();


      } catch (e) {
        console.error('Could not update driver', e); // eslint-disable-line no-console
        this.$set(this, 'allowBusy', false);
      }

    },

    async connect() {
      if (this.disabled) {
        return;
      }

      this.$set(this, 'error', '');
      this.$set(this, 'success', '');
      this.$set(this, 'errorAllowHost', false);

      let okay = false;

      if (!this.value.decodedData.endpoint) {
        this.$set(this, 'busy', false);
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

      this.$set(this, 'allowBusy', false);
      this.$set(this, 'busy', true);

      const res = await os.testConnection();
      console.log(res)

      if (res.error) {
        console.error(res.error); // eslint-disable-line no-console
        okay = false;


        if (res.error._status === 502 && !this.hostInAllowList()) {
          this.$set(this, 'errorAllowHost', true);
        } else if (res.error._status === 401) {
          this.$set(this, 'error', "Authentification Failed");
        }else {
          this.$set(this, 'error', res.error.message ? res.error.message : "Something Went wrong");
        }
      } else {
        okay = true;
        this.$set(this, 'success', `Welcome ${this.value.decodedData.username}, connected to ${this.value.decodedData.endpoint}`);
      }

      this.$set(this, 'busy', false);
      this.$emit('validationChanged', okay);
    }
  }
};
</script>

<template>
  <div>
    <div class="row">
      <div class="col span-6"> <!-- Endpoint -->
        <LabeledInput
          :value="value.decodedData.endpoint"
          :disabled="step !== 1"
          label-key="driver.nutanix.auth.fields.endpoint"
          placeholder-key="driver.nutanix.auth.placeholders.endpoint"
          type="text"
          :mode="mode"
          @input="value.setData('endpoint', $event);"
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
          @input="value.setData('port', $event);"
        />
      </div>
    </div>
    <div class="row">
      <div class="col span-6"> <!-- Username -->
        <LabeledInput
          :value="value.decodedData.username"
          :disabled="step !== 1"
          class="mt-20"
          label-key="driver.nutanix.auth.fields.username"
          placeholder-key="driver.nutanix.auth.placeholders.username"
          type="text"
          :mode="mode"
          @input="value.setData('username', $event);"
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
          @input="value.setData('password', $event);"
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
          @input="value.setData('insecure', $event);"
          :disabled="true"
        />
      </div>
    </div>

    <!-- Test Authentication -->
    <button
      ref="connect"
      class="btn role-primary mt-20"
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
  </div>
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
</style>
