# Nutanix Rancher Extension

#### Requirements

- Nutanix Prism Central 2024.1
- Nutanix Rancher Node Driver v3.6.0

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

# Congrats !
