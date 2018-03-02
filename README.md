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
