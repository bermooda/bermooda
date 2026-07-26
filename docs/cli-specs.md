# CLI Specs

## I want to create a CLI that can be used to setup a new ecommerce shop based on this repository.

### Features

- [x] Download the repository in the latest version
- [x] Install dependencies
- [x] Setup the database (SQLite for local development, PostgreSQL for production, ask which one to use)
- [x] Setup the environment variables (ask which one to use and generate a .env file)
- [x] Setup the admin user (ask for the email and password)
- [x] Setup the store (ask for the store name)

> Implementation: global package [`@bermooda/cli`](https://github.com/bermooda/cli) (`bermooda` binary). See that repo’s README and DESIGN.md.

### Install the CLI

```bash
npm i -g @bermooda/cli@latest
```

### Use the CLI

```bash
bermooda <command...> <options...>
```

### Commands

#### `install`

Ask for local or server installation, download the repository in the latest version and install the dependencies.

```bash
bermooda install [--local|--server]
```

#### `update`

Update the ecommerce shop to the latest version, this will download the latest version of the repository and install the dependencies.

```bash
bermooda update
```

#### `plugin add`

Install a plugin for the ecommerce shop, this will download the plugin from the plugin repository and install the dependencies.

```bash
bermooda plugin add <plugin-name> [version]
```

If no version is provided, the latest version will be used.

#### `plugin update`

Update a plugin for the ecommerce shop, this will download the latest version of the plugin from the plugin repository and install the dependencies.

```bash
bermooda plugin update <plugin-name> [version]
```

If no version is provided, the latest version will be used.

#### `plugin remove`

Uninstall a plugin for the ecommerce shop, this will remove the plugin from the ecommerce shop and remove the dependencies.

```bash
bermooda plugin remove <plugin-name>
```

#### `plugin list`

List all installed plugins for the ecommerce shop.

```bash
bermooda plugin list
```

#### `plugin help`

Show help for a plugin command.

```bash
bermooda plugin help
```

#### `theme add`

Install a theme for the ecommerce shop, this will download the theme from the theme repository and install the dependencies.

```bash
bermooda theme add <theme-name> [version]
```

If no version is provided, the latest version will be used.

#### `theme update`

Update a theme for the ecommerce shop, this will download the latest version of the theme from the theme repository and install the dependencies.

```bash
bermooda theme update <theme-name> [version]
```

If no version is provided, the latest version will be used.

#### `theme remove`

Uninstall a theme for the ecommerce shop, this will remove the theme from the ecommerce shop and remove the dependencies.

```bash
bermooda theme remove <theme-name>
```

#### `theme list`

List all installed themes for the ecommerce shop.

```bash
bermooda theme list
```

#### `theme help`

Show help for a theme command.

```bash
bermooda theme help
```

#### `help`

Show help for a command.

```bash
bermooda help <command>
```

#### `version`

Show the version of the CLI and the ecommerce shop, if no option is provided, both will be shown.

```bash
bermooda version [--cli|--shop]
```

#### `upgrade`

Upgrade the CLI to the latest version.

```bash
bermooda upgrade
```

#### `start`

Start the ecommerce shop, same as `npm start`.

```bash
bermooda start
```

#### `dev`

Start the ecommerce shop in development mode, same as `npm run dev`.

```bash
bermooda dev
```
