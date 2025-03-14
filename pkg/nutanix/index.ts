import { importTypes } from '@rancher/auto-import';
import { IPlugin } from '@shell/core/types';

// Init the package
export default function(plugin: IPlugin) {
  // Auto-import localization file(s)
  importTypes(plugin);

  // Provide plugin metadata from package.json
  plugin.metadata = require('./package.json');
  plugin.register('image', 'providers/nutanix.svg', require('./assets/icon-nutanix.svg'));
}
