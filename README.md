[![view on npm](http://img.shields.io/npm/v/modapp-router.svg)](https://www.npmjs.org/package/modapp-router)

# modapp-router
A router module to use in modapp based web applications

### Usage
Include the module in your `main.js`.

```javascript
import Router from 'modapp-router/Router';
```
Then add it to your modules.

```javascript
modules.router = Router;

window.app.loadBundle(modules)
	.then(result => {
		console.info("[Main] Loaded modules: ", result);
		window.app.render(document.body);
	});
```

Load the router in your module constructor

```javascript
this.app.require([ 'router' ], this._init.bind(this));
```

And register a new route to the module when initializing

```javascript
this.module.router.addRoute({
	id: routeId,
	name: l10n.t('module.example', `Example`),
	parentId: null,
	order: 20,
	setState: this._setState, // method to set values passed from parseUrl
	component: new ExampleComponent(this.app, this.module), // component to load
	getUrl: (params) => { // method that builds the URL from parameters
		return;
	},
	parseUrl: (data) => { // method that parses the parameters from the URL
		return {};
	}
});
```