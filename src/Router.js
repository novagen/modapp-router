import * as obj from 'modapp-utils/obj';

/**
 * Label callback
 * @callback module/Router~labelCallback
 * @param {string} id Id of route
 * @param {object} state State object of set route
 */

/**
 * State callback
 * @callback module/Router~setStateCallback
 * @param {object} params Parameters passed to setRoute.
 * @returns {Promise} Promise to the setting of state. Should reject if the state is invalid.
 */

/**
 * Route definition object
 * @typedef {object} module/Router~routeDefinition
 * @property {string} id Id of the route. Dot separated for sub routes.
 * @property {string|class/LocaleString} name Display name of a route
 * @property {object=} [params.staticRouteParams] Optional params that is ensured to exist when a route is set.
 * 												  Caller may override these parameters by using the same keys.
 * @property {?string} [icon] Optional icon name
 * @property {string} [parentId] Option id of parent route
 * @property {module:modapp~Component} component Main component.
 * @property {?module:modapp~Component} asideComponent Aside component, if null the default component will be shown.
 * @property {?module:modapp~Component} headerComponent Header component, if null the default component will be shown.
 * @property {?module:modapp~Component} footerComponent Footer component, if null the default component will be shown.
 * @property {module/Router~setStateCallback} [setState] Set state callback. Params will be ignored if not set.
 * @property {module/Router~onBeforeUnload} [onBeforeUnload] On before unload callback. Params will be ignored if not set.
 */

/**
 * Set route object
 * @typedef {object} module/Router~setRoute
 * @property {module/Router~routeDefinition} route Route definition object
 * @property {object} params Parameters
 */

/**
 * @typedef {object} module/Router~setEventData
 * @property {?module/Router~setRoute} current Current route that is set. Null means no route is set.
 * @property {?module/Router~setRoute} previous Previous route that was set. Null means no route was set.
 */

/**
 * Route holds the different screen routes
 * @module module/Router
 */
class Router {

	constructor(app, params) {
		this.app = app;
		this.routes = {};
		this.current = null;
		this.default = null;
		this.previous = null;
		this.initialRoute = null;
		this.initialRouteData = null;
		this.initialQuery = typeof (window) !== 'undefined' && window.location ? window.location.search : '';

		this.app.require([], this._init.bind(this));

		this.setRouteCounter = 0;
	}

	_init(module) {
		this.module = module;
		this.setStatePromise = null;

		window.addEventListener('popstate', (e) => {
			this.historyChanged = true;

			let state = e.state,
				routeId = null,
				params = null;

			// Do we have a state
			if (!state) {
				// Parse the url to create a state
				this._setInitialRoute();

				let route = this.routes[this.initialRoute];

				if (route) {
					routeId = route.id;
					if (route.parseUrl) {
						params = route.parseUrl(this.initialRouteData);
					}
					// Replace the state with the correct data
					history.replaceState({
						routeId: route.id,
						params: params
					}, route.name);
				}
			} else {
				routeId = state.routeId || null;
				params = state.params || null;
			}

			// [TODO] Catch errors to continue further back navigation
			this.setRoute(routeId, params, false).catch(
				e => {
					console.error("Failed to navigate back. Resetting to start route");
					history.replaceState(null, null, null);
					this.setRoute(null, null, false);
				}
			);
		});

		// Set default state
		history.replaceState(null, null, null);

		this._setInitialRoute();
	}

	/**
	 * Attach an event handler function for one or more module events.
	 * @param {?string} events One or more space-separated events (eg. 'disconnect'). Null means any event.
	 * @param {Event~eventCallback} handler A function to execute when the event is emitted.
	 */
	on(events, handler) {
		this.app.eventBus.on(this, events, handler, 'module.route');
	}

	/**
	 * Remove an app event handler.
	 * @param {?string} events One or more space-separated events. Null means any event.
	 * @param {function=} handler An optional handler function. The handler will only be remove if it is the same handler.
	 */
	off(events, handler) {
		this.app.eventBus.off(this, events, handler, 'module.route');
	}

	/**
	 * Adds a route
	 * @param {module/Router~routeDefinition} route Route definition object to add
	 * @fires module/Router#add
	 */
	addRoute(route) {
		if (this.routes[route.id]) {
			throw "A route with id '" + route.id + "' already exists";
		}

		this.routes[route.id] = route;

		/**
		 * Route add event.
		 * @event module/Router#add
		 * @type {module/Router~routeDefinition} Route that is added
		 */
		this.app.eventBus.emit(this, 'module.route.add', route);

		if (this.initialRoute && this.initialRoute === route.id) {
			let routeData = null;
			if (route.parseUrl) {
				routeData = route.parseUrl(this.initialRouteData);
			}

			this.setRoute(route.id, routeData || {});
		}
	}

	/**
	 * Removes a route
	 * @param {string} routeId Id of route
	 * @fires module/Router#remove
	 */
	removeRoute(routeId) {
		let route = this.routes[routeId];
		if (!route) {
			return;
		}

		/**
		 * Route remove event.
		 * @event module/Router#remove
		 * @type {module/Router~routeDefinition} Route that is removed
		 */
		this.app.eventBus.emit(this, 'module.route.remove', route);
		delete this.routes[routeId];
	}

	/**
	 * Gets a route by id
	 * @param {string} routeId Id of route
	 * @returns {object} Route object. Null if route is not found
	 */
	getRoute(routeId) {
		return this.routes[routeId] || null;
	}

	/**
	 * Gets all routes
	 * @returns {object}
	 */
	getRoutes() {
		return this.routes;
	}

	/**
	 * Gets the current route object, or null if no route is set
	 * @returns {module/Router~setRoute} Current route object
	 */
	getCurrent() {
		return this.current;
	}

	getDefaultRoute() {
		return this.default;
	}

	goBack() {
		history.back();
	}

	reload() {
		if (this.current) {
			return Promise.resolve(this.current.route.setState ? this.current.route.setState(this.current.params) : null).then(() => true);
		}
	}

	/**
	 * Sets a route by id and optional params.
	 * @param {string} routeId Id of route
	 * @param {object=} params Optional params object
	 * @param {boolean=} pushHistoryState Optional flag if history params should be pushed. Default is true.
	 * @param {boolean=} force Force the route even if onBeforeUnload says otherwise
	 * @returns {Promise.<module/Router~setRoute>} Promise to the set route.
	 */
	setRoute(routeId, params = {}, pushHistoryState = true, force = false) {
		// this.initialRoute = null;
		// this.initialRouteData = null;

		if (!routeId) {
			if (this.default) {
				routeId = this.default.routeId;
				params = this.default.params;
			} else {
				params = null;
			}
		} else if (params === null || typeof params !== 'object') {
			throw "Route params must be an object";
		}

		// If the route is currently set, don't do anything
		if (this._isCurrent(routeId, params)) {
			return Promise.resolve(this.current);
		}

		let route = null;
		if (!routeId) {
			// Quickly finish on empty route
			return Promise.resolve(this._setRoute(null, pushHistoryState));
		}

		route = this.getRoute(routeId);

		if (!route) {
			Promise.reject(new Error("Route Id '" + routeId + "' not found"));
		}

		if (this.current && this.current.route && this.current.route.onBeforeUnload && !force && !params.ignoreOnBeforeUnload) {
			this.setStatePromise = this.current.route.onBeforeUnload(this).then(result => {
				if (result) {
					return this._performSetRoute(route, params, pushHistoryState);
				} else {
					if (this.historyChanged) {
						this._setRoute(this.current, true);
					}
				}

				this.historyChanged = false;
			});

			return this.setStatePromise;
		} else {
			return this._performSetRoute(route, params, pushHistoryState);
		}
	}

	_performSetRoute(route, params, pushHistoryState) {
		// merge defaults if any
		if (route.staticRouteParams) {
			params = Object.assign(route.staticRouteParams, params);
		}

		this.setStatePromise = null;

		return Promise.resolve(route.setState ? route.setState(params) : null).then(
			() => this._setRoute({
				route,
				params
			}, pushHistoryState)
		);
	}

	/**
	 * Sets current to the parent of current route using the same params.
	 * @param {boolean} [pushHistoryState] Optional flag if history params should be pushed. Default is true.
	 * @returns {Promise.<module/Router~setRoute>} Promise to the set route.
	 * @fires module/Router#set
	 */
	setParent(pushHistoryState = true) {
		if (!this.current || !this.current.route.parentId) {
			return Promise.resolve(this.current);
		}

		return this.setRoute(this.current.route.parentId, this.current.params, pushHistoryState);
	}

	/**
	 * Helper function to create the url returned by setState.
	 * It will properly url encode all the parts and concatenate them with slash (/).
	 * @param {Array.<string>} parts Array of path part strings
	 * @returns {string} Url string to be returned from setState callback.
	 */
	createUrl(parts) {
		return parts.map(part => encodeURIComponent(String(part))).join('/');
	}

	/**
	 * Sets current to the given setRoute
	 * @param {object} setRoute route object
	 * @param {boolean} pushHistoryState enable/disable push history state
	 * @returns {module/Router~setRoute} Returns the same setRoute
	 * @private
	 */
	_setRoute(setRoute, pushHistoryState) {
		let prev = this.current;
		this.previous = prev;
		this.current = setRoute;

		if (pushHistoryState) {
			let state = setRoute ? {
				routeId: setRoute.route.id,
				params: setRoute.params
			} : null;

			let title = setRoute.route.name;
			let url = window.location.pathname + this.initialQuery + '#' + state.routeId;

			if (this.current.route.getUrl) {
				let routeUrl = setRoute.route.getUrl(state.params);
				url += routeUrl ? '/' + routeUrl : '';
			}

			history.pushState(state, title, url);
		}

		/**
		 * Route set event.
		 * @event module/Router#set
		 * @type {module/Router~setEventData} An object with two properties, current and previous.
		 */
		this.app.eventBus.emit(this, 'module.route.set', {
			current: setRoute,
			previous: prev
		});
		return setRoute;
	}

	_setInitialRoute() {
		if (window.location.hash) {
			let currentPage = window.location.hash;
			let currentPageParts = currentPage.split('/').map(s => decodeURIComponent(s));

			this.initialRoute = currentPageParts[0].replace('#', '');
			this.initialRouteData = currentPageParts;
		} else {
			this.initialRoute = null;
			this.initialRouteData = null;
		}
	}

	resetRoute() {
		this._setInitialRoute();

		if (!this.initialRoute) {
			return;
		}

		let route = this.routes[this.initialRoute];
		if (!route) {
			return;
		}

		let routeData = null;
		if (route.parseUrl) {
			routeData = route.parseUrl(this.initialRouteData);
		}

		this.setRoute(route.id, routeData || {});
	}

	/**
	 * Sets the default route to be used on null.
	 * @param {string} routeId Id of the route to use as default
	 * @param {object} params Parameters
	 */
	setDefault(routeId, params) {
		if (!this.getRoute(routeId)) {
			throw "No route with id " + route.id + " exists";
		}

		this.default = {
			routeId,
			params
		};

		if (!this.current && !this.initialRoute) {
			this.setRoute(routeId, params, false);
		}
	}

	/**
	 * Tests if a route is a descendant of another route
	 * @param {?string} descendantId Id of the descendant route. Null (root) will always return false.
	 * @param {?string} ancestorId Id of the ancestor route. Null (root) will always return true as.
	 * @returns {boolean}
	 */
	isDescendant(descendantId, ancestorId) {
		if (!ancestorId) {
			return true;
		}
		if (!descendantId) {
			return false;
		}

		let d = this.getRoute(descendantId);

		while (d && d.parentId) {
			if (ancestorId === d.parentId) {
				return true;
			}

			d = this.getRoute(d.parentId);
		}

		return false;
	}

	_isCurrent(routeId, params) {
		// Check if both are not set
		if (!routeId && !this.current) {
			return true;
		}

		// Check if one is set and the other isn't
		if (!routeId !== !this.current) {
			return false;
		}

		// Check if routeId is different
		if (routeId !== this.current.route.id) {
			return false;
		}

		// Make shallow compare of params objects
		return obj.equal(params, this.current.params);
	}
}

export default Router;