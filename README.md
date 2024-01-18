# Nutanix Rancher Extension

https://rancher.github.io/dashboard/extensions/extensions-getting-started

# Requirements

### Nodes

The node version of brew lastest is for me v20 but rancher is compatible up to 17.
So i use the man tested version v16.19.1.

1. install node version manager : `npm install -g n`
2. Install and use : `n 16.19.1`
3. Unlink brew node because he has highter priority: `brew unlink node`
4. Change in your **package.json** the version used
5. To relink brew node use : `brew link node`

### Yarn

Run the command : `npm install -g yarn`

## Creation of the project

```
yarn create @rancher/app my-app
cd my-app
yarn install
API=<Rancher Backend URL> yarn dev
```

## Creating the Extension

```
yarn create @rancher/pkg test [OPTIONS]
```

This will create a new UI Package in the ./pkg/test folder.

### Extension Options

There are two options that can be passed to the @rancher/pkg script:

- -t: Creates additional boilerplate directories for types, including: 'l10n', 'models', 'edit', 'list', and 'detail'
- -w: Creates a workflow file ('build-extension.yml') to be used as a Github action. This will automatically build your extension and release a Helm chart. Warning : rrequire additonal [prequesites](https://rancher.github.io/dashboard/extensions/extensions-getting-started#creating-a-release)

### Building the Extension

```
yarn build-pkg test
```

This will build the extension as a Vue library and the built extension will be placed in the dist-pkg folder.

### Prevent loading your extension in dev mode

To do this, edit the file `vue.config.js` in the root my-app folder, and add the name of the package you want to exclude, such as:

```
const config = require('@rancher/shell/vue.config');

module.exports = config(__dirname, {
  excludes: ['test'],
});
```

Now we need to serve the built package locally by running the following:

```
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

```
yarn create @rancher/pkg test -w
```

### Consuming the Helm chart

After releasing the Helm chart you will be able to consume this from the Rancher UI by adding your Helm repository's URL to the App -> Repository list. If you used the automated workflow to release the Helm chart, you can find the URL within your Github repository under the "github-pages" Environment.

The URL should be listed as: https://<organization>.github.io/<repository>

Once the URL has been added to the repository list, the extension should appear within the Extensions page.

# Congrats !
