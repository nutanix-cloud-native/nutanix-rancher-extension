# Nutanix Rancher Extension

#### Requirements

- Nutanix Prism Central 2024.3
- Nutanix Rancher Node Driver v3.6.0
- Rancher 2.10.x 

for old Rancher version please check branch [release-2.9.x](https://github.com/nutanix-cloud-native/nutanix-rancher-extension/tree/release-2.9.x)

## Installation

- In the Rancher UI, Go to the `Configuration` / `Extensions page`  
![image](https://github.com/user-attachments/assets/f1453121-59bd-4654-8f36-83d3348e4048)


- Click on the three points top right and select `Manage Extension Catalogs`  
![image](https://github.com/user-attachments/assets/54804ba4-cae9-431e-8231-321e94479652)

- Click on the `Import Extension Catalog` button  
  ![image](https://github.com/user-attachments/assets/f2fa3734-eb34-4ecf-9c5c-e2613db49cb0)

- In the `Catalog Image Reference` add the following URL => `ghcr.io/nutanix-cloud-native/ui-extension-nutanix` and click on `Load`  
  ![image](https://github.com/user-attachments/assets/f9ab7eb1-2377-4fb8-8ed9-05f3f39b9ba9)

- Click on `Reload`  
  ![image](https://github.com/user-attachments/assets/37209f6a-241e-4ec3-9f1c-cba8b0297fc0)

- From the `Extensions` / `Available` page, install the Nutanix extension
  ![image](https://github.com/user-attachments/assets/df785168-bae3-43c4-9620-63ffaab3bd7f)



## Development

https://rancher.github.io/dashboard/extensions/extensions-getting-started

### Building the Extension

```shell
yarn build-pkg nutanix
```

This will build the extension as a Vue library and the built extension will be placed in the dist-pkg folder.

### Prevent loading your extension in dev mode

To do this, edit the file `vue.config.js` in the root my-app folder, and add the name of the package you want to exclude, such as:

```js
const config = require('@rancher/shell/vue.config');

module.exports = config(__dirname, {
  excludes: ['test'],
});
```

Now we need to serve the built package locally by running the following:

```shell
yarn serve-pkgs
```

Next import the extension with the given link.

## Creating a Release

### Release Prerequisites

In order to have a Helm repository you will need to enable Github Pages on your Github repository. Just follow these steps:

1. Create a branch called `gh-pages` on your Github repository for the extension
2. Go to the repository of the extension and click the `Settings` tab in the top navigation bar.
3. Then on the left navigation bar of the settings page click the `Pages` tab.
   4.Lastly, select `GitHub Actions` from the `Source` dropdown.

### Adding the Release Workflow

If not done before use this command to add the workflow :

```shell
yarn create @rancher/pkg test -w
```

### Consuming the Helm chart

After releasing the Helm chart you will be able to consume this from the Rancher UI by adding your Helm repository's URL to the App -> Repository list. If you used the automated workflow to release the Helm chart, you can find the URL within your Github repository under the "github-pages" Environment.

The URL should be listed as: https://<organization>.github.io/<repository>

Once the URL has been added to the repository list, the extension should appear within the Extensions page.

