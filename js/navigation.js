"use strict";

function FIREBASEarraysToObjects(obj, undo) {
	if (obj !== null && obj !== undefined) var keys = Object.keys(obj)
	else return obj
	var keys = Object.keys(obj)
	keys.forEach(key => {
		var val = obj[key]
		var oldKey = key
		if (undo) {
			key = key.replaceAll('<&period&>', '.')
			key = key.replaceAll('<&dollarsign&>', '$')
			key = key.replaceAll('<&leftbracket&>', '[')
			key = key.replaceAll('<&rightbracket&>', ']')
			key = key.replaceAll('<&backslash&>', '/')
			if (key !== oldKey) {
				delete obj[oldKey]
			}
		} else {
			key = key.replaceAll('.', '<&period&>')
			key = key.replaceAll('$', '<&dollarsign&>')
			key = key.replaceAll('[', '<&leftbracket&>')
			key = key.replaceAll(']', '<&rightbracket&>')
			key = key.replaceAll('/', '<&backslash&>')
			if (key !== oldKey) {
				delete obj[oldKey]
			}
		}

		if (Array.isArray(val) && undo !== true) {
			val = arrayToObject(val)
		} else if (typeof val === 'object' && val?.isArray === true) {
			val = objectToArray(val)
		} 

		if (typeof val === 'object') {
			val = FIREBASEarraysToObjects(val, undo)
		}

		obj[key] = val
	})

	// console.log(obj)
	return obj
}

function objectToArray(obj) {
	var newArray = [];
	delete obj.isArray
	var keys = Object.keys(obj);
	// alert(keys)
	for (let i = 0; i < keys.length; i++) {
		let key = keys[i];
		if (key.substring(0, 6) == 'index-') {
			var index = key.substring(6, key.length)
			newArray[Number(index)] = obj[key]
		} else {
			newArray[key] = obj[key]
		}
	}
	// console.log(newArray)
	return newArray
}

function arrayToObject(array) {
	var newObj = {isArray: true}
	for (let i = 0; i < array.length; i++) {
		newObj['index-' + i] = array[i];
	}
	return newObj
}

function addElement(type, params) {
	var newElement = document.createElement(type)
	var keys = Object.keys(params)
	keys.forEach(key => {
		newElement.setAttribute(key, params[key])
	});
	return document.body.appendChild(newElement)
}

class NavBar {
	static init () {
		this._initInstallPrompt();
		// render the visible elements ASAP
		window.addEventListener("DOMContentLoaded", NavBar._onDomContentLoaded);
		window.addEventListener("load", NavBar._onLoad);
	}

	static _onDomContentLoaded () {
		if (Date.now() > Number(localStorage.UIDtimestamp) + 3600000) localStorage.userUID = 'loggedOut';
		addElement('script', {
			src: "https://www.gstatic.com/firebasejs/8.2.4/firebase.js"
		}).onload = function() {
			import("../env/env.js").then((env) => {
				var vals = env.environment.apiKey.split(',')
				var keys = ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
				var firebaseConfig = {};
				for (let i = 0; i < keys.length; i++) {
					firebaseConfig[keys[i]] = vals[i]
				} 
				firebase.initializeApp(firebaseConfig);
				NavBar.firebaseDatabase = firebase.database();
				NavBar.usersRef = NavBar.firebaseDatabase.ref('users');
				NavBar.userDataRef = NavBar.firebaseDatabase.ref('userData');
			})
		};
		addElement('link', {
			rel: "stylesheet",
			href: "css/navSignIn.css"
		});
		NavBar._initElements();
		NavBar.highlightCurrentPage();
	}

	static _onLoad () {
		NavBar._dropdowns = [...NavBar._navbar.querySelectorAll(`li.dropdown--navbar`)];
		document.addEventListener("click", () => NavBar._closeAllDropdowns());

		NavBar._clearAllTimers();

		NavBar._initAdventureBookElements().then(null);
	}

	static _initInstallPrompt () {
		NavBar._cachedInstallEvent = null;
		window.addEventListener("beforeinstallprompt", e => NavBar._cachedInstallEvent = e);
	}

	static _initElements () {
		NavBar._navbar = document.getElementById("navbar");
		NavBar._tree = new NavBar.Node({
			body: NavBar._navbar,
		});

		// create mobile "Menu" button
		const btnShowHide = document.createElement("button");
		btnShowHide.className = "ve-btn ve-btn-default page__btn-toggle-nav";
		btnShowHide.innerHTML = "Menu";
		btnShowHide.onclick = () => {
			$(btnShowHide).toggleClass("active");
			$(`.page__nav-hidden-mobile`).toggleClass("block", $(btnShowHide).hasClass("active"));
		};
		document.getElementById("navigation").prepend(btnShowHide);
		const signInPopup = document.createElement("div")
		signInPopup.id = "navPopup"
		signInPopup.className = "nav-popup sign-in-menu"
		document.getElementById("navigation").append(signInPopup);

		this._addElement_li(null, "index.html", "Home", {isRoot: true});

		this._addElement_dropdown(null, NavBar._CAT_RULES);
		this._addElement_li(NavBar._CAT_RULES, "variantrules.html", "Rules Glossary");
		this._addElement_li(NavBar._CAT_RULES, "tables.html", "Tables");
		this._addElement_divider(NavBar._CAT_RULES);
		this._addElement_dropdown(NavBar._CAT_RULES, NavBar._CAT_BOOKS, {isSide: true, page: "books.html"});
		this._addElement_li(NavBar._CAT_BOOKS, "books.html", "View All/Homebrew");
		this._addElement_divider(NavBar._CAT_RULES);
		this._addElement_li(NavBar._CAT_RULES, "quickreference.html", "Quick Reference (2014)");

		this._addElement_dropdown(null, NavBar._CAT_PLAYER);
		this._addElement_li(NavBar._CAT_PLAYER, "classes.html", "Classes");
		this._addElement_li(NavBar._CAT_PLAYER, "backgrounds.html", "Backgrounds");
		this._addElement_li(NavBar._CAT_PLAYER, "feats.html", "Feats");
		this._addElement_li(NavBar._CAT_PLAYER, "races.html", "Species");
		this._addElement_li(NavBar._CAT_PLAYER, "charcreationoptions.html", "Other Character Creation Options");
		this._addElement_li(NavBar._CAT_PLAYER, "optionalfeatures.html", "Other Options & Features");
		this._addElement_divider(NavBar._CAT_PLAYER);
		this._addElement_li(NavBar._CAT_PLAYER, "statgen.html", "Stat Generator");
		this._addElement_divider(NavBar._CAT_PLAYER);
		this._addElement_li(NavBar._CAT_PLAYER, "lifegen.html", "This Is Your Life");
		this._addElement_li(NavBar._CAT_PLAYER, "names.html", "Names");

		this._addElement_dropdown(null, NavBar._CAT_DUNGEON_MASTER);
		this._addElement_li(NavBar._CAT_DUNGEON_MASTER, "dmscreen.html", "DM Screen");
		this._addElement_divider(NavBar._CAT_DUNGEON_MASTER);
		this._addElement_dropdown(NavBar._CAT_DUNGEON_MASTER, NavBar._CAT_ADVENTURES, {isSide: true, page: "adventures.html"});
		this._addElement_li(NavBar._CAT_ADVENTURES, "adventures.html", "View All/Homebrew");
		this._addElement_li(NavBar._CAT_DUNGEON_MASTER, "cultsboons.html", "Cults & Supernatural Boons");
		this._addElement_li(NavBar._CAT_DUNGEON_MASTER, "objects.html", "Objects");
		this._addElement_li(NavBar._CAT_DUNGEON_MASTER, "trapshazards.html", "Traps & Hazards");
		this._addElement_divider(NavBar._CAT_DUNGEON_MASTER);
		this._addElement_li(NavBar._CAT_DUNGEON_MASTER, "crcalculator.html", "CR Calculator");
		this._addElement_li(NavBar._CAT_DUNGEON_MASTER, "encountergen.html", "Encounter Generator");
		this._addElement_li(NavBar._CAT_DUNGEON_MASTER, "lootgen.html", "Loot Generator");
		this._addElement_divider(NavBar._CAT_DUNGEON_MASTER);
		this._addElement_li(NavBar._CAT_DUNGEON_MASTER, "maps.html", "Maps");

		this._addElement_dropdown(null, NavBar._CAT_REFERENCES);
		this._addElement_li(NavBar._CAT_REFERENCES, "actions.html", "Actions");
		this._addElement_li(NavBar._CAT_REFERENCES, "bestiary.html", "Bestiary");
		this._addElement_li(NavBar._CAT_REFERENCES, "conditionsdiseases.html", "Conditions & Diseases");
		this._addElement_li(NavBar._CAT_REFERENCES, "decks.html", "Decks");
		this._addElement_li(NavBar._CAT_REFERENCES, "deities.html", "Deities");
		this._addElement_li(NavBar._CAT_REFERENCES, "items.html", "Items");
		this._addElement_li(NavBar._CAT_REFERENCES, "languages.html", "Languages");
		this._addElement_li(NavBar._CAT_REFERENCES, "rewards.html", "Supernatural Gifts & Rewards");
		this._addElement_li(NavBar._CAT_REFERENCES, "psionics.html", "Psionics");
		this._addElement_li(NavBar._CAT_REFERENCES, "spells.html", "Spells");
		this._addElement_li(NavBar._CAT_REFERENCES, "vehicles.html", "Vehicles");
		this._addElement_divider(NavBar._CAT_REFERENCES);
		this._addElement_li(NavBar._CAT_REFERENCES, "recipes.html", "Recipes");

		this._addElement_dropdown(null, NavBar._CAT_UTILITIES);
		this._addElement_li(NavBar._CAT_UTILITIES, "search.html", "Search");
		this._addElement_divider(NavBar._CAT_UTILITIES);
		this._addElement_li(NavBar._CAT_UTILITIES, "blocklist.html", "Content Blocklist");
		this._addElement_li(NavBar._CAT_UTILITIES, "manageprerelease.html", "Prerelease Content Manager");
		this._addElement_li(NavBar._CAT_UTILITIES, "managebrew.html", "Homebrew Manager");
		this._addElement_buttonSplit(
			NavBar._CAT_UTILITIES,
			{
				metas: [
					{
						html: "Load All Partnered Content",
						click: async evt => {
							evt.stopPropagation();
							evt.preventDefault();
							const {ManageBrewUi} = await import("./utils-brew/utils-brew-ui-manage.js");
							await ManageBrewUi.pOnClickBtnLoadAllPartnered();
						},
					},
					{
						html: `<span class="glyphicon glyphicon-link"></span>`,
						title: `Export Prerelease Content/Homebrew List as URL`,
						click: async evt => {
							evt.stopPropagation();
							evt.preventDefault();
							const ele = evt.currentTarget;
							const {ManageBrewUi} = await import("./utils-brew/utils-brew-ui-manage.js");
							await ManageBrewUi.pOnClickBtnExportListAsUrl({ele});
						},
					},
				],
			},
		);
		this._addElement_divider(NavBar._CAT_UTILITIES);
		this._addElement_li(NavBar._CAT_UTILITIES, "inittrackerplayerview.html", "Initiative Tracker Player View");
		this._addElement_divider(NavBar._CAT_UTILITIES);
		this._addElement_li(NavBar._CAT_UTILITIES, "renderdemo.html", "Renderer Demo");
		this._addElement_li(NavBar._CAT_UTILITIES, "makebrew.html", "Homebrew Builder");
		this._addElement_li(NavBar._CAT_UTILITIES, "makecards.html", "RPG Cards JSON Builder");
		this._addElement_li(NavBar._CAT_UTILITIES, "converter.html", "Text Converter");
		this._addElement_divider(NavBar._CAT_UTILITIES);
		this._addElement_li(NavBar._CAT_UTILITIES, "plutonium.html", "Plutonium (Foundry Module) Features");
		this._addElement_divider(NavBar._CAT_UTILITIES);
		this._addElement_li(NavBar._CAT_UTILITIES, "https://wiki.tercept.net/en/betteR20", "Roll20 Script Help", {isExternal: true});
		this._addElement_divider(NavBar._CAT_UTILITIES);
		this._addElement_li(NavBar._CAT_UTILITIES, "changelog.html", "Changelog");
		this._addElement_li(NavBar._CAT_UTILITIES, NavBar._getCurrentWikiHelpPage(), "Help", {isExternal: true});
		this._addElement_divider(NavBar._CAT_UTILITIES);
		this._addElement_li(NavBar._CAT_UTILITIES, "privacy-policy.html", "Privacy Policy");

		this._addElement_dropdown(null, NavBar._CAT_SETTINGS);
		this._addElement_button(
			NavBar._CAT_SETTINGS,
			{
				html: "Preferences",
				click: () => {
					ConfigUi.show();
					NavBar._closeAllDropdowns();
				},
			},
		);
		this._addElement_divider(NavBar._CAT_SETTINGS);
		this._addElement_dropdown(NavBar._CAT_SETTINGS, NavBar._CAT_ACCOUNT, {isSide: true});
		this._addElement_label(NavBar._CAT_ACCOUNT, `<p>WARNING: Account System is under development. Expect bugs. <b>Keep a backup of your saved state.</b></p><p>Contact asdfgn2399 on discord for support.</p>`);
		this._addElement_button(
			NavBar._CAT_ACCOUNT,
			{
				html: localStorage.userUID !== 'loggedOut' ? 'Log Out' : 'Sign In',
				id: "signInButton",
				click: async () => {
					if (localStorage.userUID == 'loggedOut') {
						document.getElementById('navPopup').innerHTML = NavBar.initPopup('signIn');
						document.getElementById('navPopup').style.top = '175%'
						document.getElementById('navPopup').click();
					} else {
						if (localStorage.userUID) {
							var data = ""
							NavBar.usersRef.child(localStorage.userUID).once('value', (snap) => {
								data = snap.val()
							});
						};
						firebase.auth().signOut().then(() => {
							document.getElementById("signInButton").innerHTML = 'Sign In';
							document.getElementById("signInButton").title = 'Sign in to your account';
							localStorage.userUID = 'loggedOut';
							NavBar._closeAllDropdowns();
							if (data != "") {
								JqueryUtil.doToast({
									content: `Successfully signed out '${data.email}'`,
									type: 'success'
								})
							}
						}).catch((error) => {
							console.error(error)
							JqueryUtil.doToast({
								content: `An error has occured! Check the console (Ctrl + Shift + J) for more information`,
								type: "danger",
								autoHideTime: 5_000 /* 5 seconds */,
							})
						})
					}
				},
				title: localStorage.userUID !== 'loggedOut' ? "Log out of your account" : "Sign in to your account",
			}
		);
		this._addElement_button(
			NavBar._CAT_ACCOUNT,
			{
				html: "Create Account",
				click: async () => {
					document.getElementById('navPopup').innerHTML = NavBar.initPopup('create');
					document.getElementById('navPopup').style.top = '175%'
					document.getElementById('navPopup').click();
				},
				title: "Create an account",
			}
		);
		this._addElement_divider(NavBar._CAT_ACCOUNT);
		this._addElement_button(
			NavBar._CAT_ACCOUNT,
			{
				html: "Save State to Account",
				click: async (evt) => {
					if (localStorage.userUID !== 'loggedOut') {
						NavBar.InteractionManager._pOnClick_button_saveStateFile(evt, true)
					} else {
						JqueryUtil.doToast({
							content: `You are not signed in! Please sign in and try again`,
							type: "warning",
						})
					}
				},
				title: "Save any locally-stored data (loaded homebrew, active blocklists, DM Screen configuration,...) to your account",
			},
		);
		this._addElement_button(
			NavBar._CAT_ACCOUNT,
			{
				html: "Load Saved State from Account",
				click: async (evt) => {
					if (localStorage.userUID !== 'loggedOut') {
						NavBar.InteractionManager._pOnClick_button_loadStateFile(evt, true)
					} else {
						JqueryUtil.doToast({
							content: `You are not signed in! Please sign in and try again`,
							type: "warning",
						})
					}
				},
				title: "Load previously-saved data (loaded homebrew, active blocklists, DM Screen configuration,...) from your account",
			},
		);
		this._addElement_divider(NavBar._CAT_SETTINGS);
		this._addElement_button(
			NavBar._CAT_SETTINGS,
			{
				html: "Save State to File",
				click: async (evt) => NavBar.InteractionManager._pOnClick_button_saveStateFile(evt),
				title: "Save any locally-stored data (loaded homebrew, active blocklists, DM Screen configuration,...) to a file.",
			},
		);
		this._addElement_button(
			NavBar._CAT_SETTINGS,
			{
				html: "Load State from File",
				click: async (evt) => NavBar.InteractionManager._pOnClick_button_loadStateFile(evt),
				title: "Load previously-saved data (loaded homebrew, active blocklists, DM Screen configuration,...) from a file.",
			},
		);
		this._addElement_divider(NavBar._CAT_SETTINGS);
		this._addElement_button(
			NavBar._CAT_SETTINGS,
			{
				html: "Add as App",
				click: async (evt) => NavBar.InteractionManager._pOnClick_button_addApp(evt),
				title: "Add the site to your home screen. When used in conjunction with the Preload Offline Data option, this can create a functional offline copy of the site.",
			},
		);
		this._addElement_dropdown(NavBar._CAT_SETTINGS, NavBar._CAT_CACHE, {isSide: true});
		this._addElement_label(NavBar._CAT_CACHE, `<p>Preload data for offline use.</p><p>Note that visiting a page will automatically preload data for that page.</p><p>Note that data which is already preloaded will not be overwritten, unless it is out of date.</p>`);
		this._addElement_button(
			NavBar._CAT_CACHE,
			{
				html: "Preload Adventure Text <small>(50MB+)</small>",
				click: (evt) => NavBar.InteractionManager._pOnClick_button_preloadOffline(evt, {route: /data\/adventure/}),
				title: "Preload adventure text for offline use.",
			},
		);
		this._addElement_button(
			NavBar._CAT_CACHE,
			{
				html: "Preload Book Images <small>(1GB+)</small>",
				click: (evt) => NavBar.InteractionManager._pOnClick_button_preloadOffline(evt, {route: /img\/book/, isRequireImages: true}),
				title: "Preload book images offline use. Note that book text is preloaded automatically.",
			},
		);
		this._addElement_button(
			NavBar._CAT_CACHE,
			{
				html: "Preload Adventure Text and Images <small>(2GB+)</small>",
				click: (evt) => NavBar.InteractionManager._pOnClick_button_preloadOffline(evt, {route: /(?:data|img)\/adventure/, isRequireImages: true}),
				title: "Preload adventure text and images for offline use.",
			},
		);
		this._addElement_button(
			NavBar._CAT_CACHE,
			{
				html: "Preload All Images <small>(4GB+)</small>",
				click: (evt) => NavBar.InteractionManager._pOnClick_button_preloadOffline(evt, {route: /img/, isRequireImages: true}),
				title: "Preload all images for offline use.",
			},
		);
		this._addElement_button(
			NavBar._CAT_CACHE,
			{
				html: "Preload All <small>(5GB+)</small>",
				click: (evt) => NavBar.InteractionManager._pOnClick_button_preloadOffline(evt, {route: /./, isRequireImages: true}),
				title: "Preload everything for offline use.",
			},
		);
		this._addElement_divider(NavBar._CAT_CACHE);
		this._addElement_button(
			NavBar._CAT_CACHE,
			{
				html: "Reset Preloaded Data",
				click: (evt) => NavBar.InteractionManager._pOnClick_button_clearOffline(evt),
				title: "Remove all preloaded data, and clear away any caches.",
			},
		);
	}

	static _getNode (category) {
		if (category == null) return NavBar._tree;

		const _getNodeInner = (level) => {
			for (const [k, v] of Object.entries(level)) {
				if (k === category) return v;

				const subNode = _getNodeInner(v.children);
				if (subNode) return subNode;
			}
		};

		return _getNodeInner(NavBar._tree.children);
	}

	/**
	 * Adventure/book elements are added as a second, asynchronous, step, as they require loading of:
	 * - An index JSON file.
	 * - The user's Blocklist.
	 */
	static async _initAdventureBookElements () {
		await Promise.all([
			PrereleaseUtil.pInit(),
			BrewUtil2.pInit(),
		]);
		const [adventureBookIndex] = await Promise.all([
			DataUtil.loadJSON(`${Renderer.get().baseUrl}data/generated/gendata-nav-adventure-book-index.json`),
			ExcludeUtil.pInitialise(),
		]);
		const [prerelease, brew] = await Promise.all([
			PrereleaseUtil.pGetBrewProcessed(),
			BrewUtil2.pGetBrewProcessed(),
		]);

		[
			{
				prop: "book",
				parentCategory: NavBar._CAT_BOOKS,
				page: "book.html",
				fnSort: SortUtil.ascSortBook.bind(SortUtil),
			},
			{
				prop: "adventure",
				page: "adventure.html",
				parentCategory: NavBar._CAT_ADVENTURES,
				fnSort: SortUtil.ascSortAdventure.bind(SortUtil),
			},
		].forEach(({prop, parentCategory, page, fnSort}) => {
			const fromPrerelease = MiscUtil.copyFast(prerelease?.[prop] || []);
			const fromBrew = MiscUtil.copyFast(brew?.[prop] || []);

			const mutParentName = (it) => {
				if (it.parentSource) it.parentName = Parser.sourceJsonToFull(it.parentSource);
			};

			fromPrerelease.forEach(mutParentName);
			fromBrew.forEach(mutParentName);

			const metas = [...adventureBookIndex[prop], ...fromPrerelease, ...fromBrew]
				.filter(it => !ExcludeUtil.isExcluded(UrlUtil.encodeForHash(it.id), prop, it.source, {isNoCount: true}));

			if (!metas.length) return;

			SourceUtil.ADV_BOOK_GROUPS
				.forEach(({group, displayName}) => {
					const inGroup = metas.filter(it => (it.group || "other") === group);
					if (!inGroup.length) return;

					this._addElement_divider(parentCategory);
					this._addElement_label(parentCategory, displayName, {isAddDateSpacer: true});

					const seenYears = new Set();

					inGroup
						.sort(fnSort)
						.forEach(indexMeta => {
							const year = indexMeta.published ? (new Date(indexMeta.published).getFullYear()) : null;
							const isNewYear = year != null && !seenYears.has(year);
							if (year != null) seenYears.add(year);

							if (indexMeta.parentSource) {
								if (!this._getNode(indexMeta.parentName)) {
									this._addElement_accordion(
										parentCategory,
										indexMeta.parentName,
										{
											date: isNewYear ? year : null,
											source: indexMeta.parentSource,
											isAddDateSpacer: !isNewYear,
										},
									);
								}

								let cleanName = indexMeta.name.startsWith(indexMeta.parentName)
									? indexMeta.name.slice(indexMeta.parentName.length).replace(/^:\s+/, "")
									: indexMeta.name;
								this._addElement_li(
									indexMeta.parentName,
									page,
									cleanName,
									{
										aHash: indexMeta.id,
										isAddDateSpacer: true,
										isSide: true,
										isInAccordion: true,
									},
								);

								return;
							}

							this._addElement_li(
								parentCategory,
								page,
								indexMeta.name,
								{
									aHash: indexMeta.id,
									date: isNewYear ? year : null,
									isAddDateSpacer: !isNewYear,
									source: indexMeta.source,
									isSide: true,
								},
							);
						});
				});
		});

		NavBar.highlightCurrentPage();
	}

	/**
	 * Adds a new item to the navigation bar. Can be used either in root, or in a different UL.
	 * @param parentCategory - Element to append this link to.
	 * @param page - Where does this link to.
	 * @param aText - What text does this link have.
	 * @param [opts] - Options object.
	 * @param [opts.isSide] - True if this item is part of a side menu.
	 * @param [opts.aHash] - Optional hash to be appended to the base href
	 * @param [opts.isRoot] - If the item is a root navbar element.
	 * @param [opts.isExternal] - If the item is an external link.
	 * @param [opts.date] - A date to prefix the list item with.
	 * @param [opts.isAddDateSpacer] - True if this item has no date, but is in a list of items with dates.
	 * @param [opts.source] - A source associated with this item, which should be displayed as a colored marker.
	 * @param [opts.isInAccordion] - True if this item is inside an accordion.
	 *        FIXME(Future) this is a bodge; refactor the navbar CSS to avoid using Bootstrap.
	 */
	static _addElement_li (parentCategory, page, aText, opts) {
		opts = opts || {};

		const parentNode = this._getNode(parentCategory);

		const hashPart = opts.aHash ? `#${opts.aHash}`.toLowerCase() : "";
		const href = `${page}${hashPart}`;

		const li = document.createElement("li");
		li.setAttribute("role", "presentation");
		li.setAttribute("data-page", href);
		if (opts.isRoot) {
			li.classList.add("page__nav-hidden-mobile");
			li.classList.add("page__btn-nav-root");
		}
		if (opts.isSide) {
			li.onmouseenter = function () { NavBar._handleSideItemMouseEnter(this); };
		} else {
			li.onmouseenter = function () { NavBar._handleItemMouseEnter(this); };
			li.onclick = function () { NavBar._dropdowns.forEach(ele => ele.classList.remove("open")); };
		}

		const a = document.createElement("a");
		a.href = href;
		a.innerHTML = `${this._addElement_getDatePrefix({date: opts.date, isAddDateSpacer: opts.isAddDateSpacer})}${this._addElement_getSourcePrefix({source: opts.source})}${aText}${this._addElement_getSourceSuffix({source: opts.source})}`;
		a.classList.add("nav__link");
		if (opts.isInAccordion) a.classList.add(`nav2-accord__lnk-item`, `inline-block`, `w-100`);

		if (opts.isExternal) {
			a.setAttribute("target", "_blank");
			a.classList.add("inline-split-v-center");
			a.classList.add("w-100");
			a.innerHTML = `<span>${aText}</span><span class="glyphicon glyphicon-new-window"></span>`;
		}

		li.appendChild(a);
		parentNode.body.appendChild(li);

		parentNode.children[href] = new NavBar.NodeLink({
			parent: parentNode,
			head: li,
			isInAccordion: opts.isInAccordion,
			lnk: a,
		});
	}

	static _addElement_accordion (
		parentCategory,
		category,
		{
			date = null,
			isAddDateSpacer = false,
			source = null,
		} = {},
	) {
		const parentNode = this._getNode(parentCategory);

		const li = document.createElement("li");
		li.className = "nav2-accord__wrp";
		li.onmouseenter = function () { NavBar._handleItemMouseEnter(this); };

		// region Header button
		const wrpHead = document.createElement("div");
		wrpHead.className = "nav2-accord__head split-v-center clickable";
		wrpHead.onclick = evt => {
			evt.stopPropagation();
			evt.preventDefault();
			node.isExpanded = !node.isExpanded;
		};

		const dispText = document.createElement("div");
		dispText.innerHTML = `${this._addElement_getDatePrefix({date, isAddDateSpacer})}${this._addElement_getSourcePrefix({source})}${category}`;

		const dispToggle = document.createElement("div");
		dispToggle.textContent = NavBar.NodeAccordion.getDispToggleDisplayHtml(false);

		wrpHead.appendChild(dispText);
		wrpHead.appendChild(dispToggle);
		// endregion

		// region Body list
		const wrpBody = document.createElement("div");
		wrpBody.className = `nav2-accord__body ve-hidden`;
		wrpBody.onclick = function (event) { event.stopPropagation(); };
		// endregion

		li.appendChild(wrpHead);
		li.appendChild(wrpBody);
		parentNode.body.appendChild(li);

		const node = new NavBar.NodeAccordion({
			parent: parentNode,
			head: wrpHead,
			body: wrpBody,
			dispToggle,
		});
		parentNode.children[category] = node;
	}

	static _addElement_getDatePrefix ({date, isAddDateSpacer}) { return `${(date != null || isAddDateSpacer) ? `<div class="ve-small mr-2 page__nav-date inline-block ve-text-right inline-block">${date || ""}</div>` : ""}`; }
	static _addElement_getSourcePrefix ({source}) { return `${source != null ? `<div class="nav2-list__disp-source ${Parser.sourceJsonToSourceClassname(source)}" ${Parser.sourceJsonToStyle(source)}></div>` : ""}`; }

	static _addElement_getSourceSuffix ({source}) {
		if (source == null) return "";
		return Parser.sourceJsonToMarkerHtml(source, {isList: false, additionalStyles: "ml-1 nav2-list__disp-legacy-marker"});
	}

	static _addElement_divider (parentCategory) {
		const parentNode = this._getNode(parentCategory);

		const li = document.createElement("li");
		li.setAttribute("role", "presentation");
		li.className = "ve-dropdown-divider";

		parentNode.body.appendChild(li);
	}

	static _addElement_label (parentCategory, html, {date, isAddDateSpacer} = {}) {
		const parentNode = this._getNode(parentCategory);

		const li = document.createElement("li");
		li.setAttribute("role", "presentation");
		li.className = "italic ve-muted ve-small nav2-list__label";
		li.innerHTML = `${this._addElement_getDatePrefix({date, isAddDateSpacer})}${html}`;

		parentNode.body.appendChild(li);
	}

	/**
	 * Adds a new dropdown starting list to the navigation bar
	 * @param {String} parentCategory - Element to append this link to.
	 * @param {String} category - Dropdown text.
	 * @param {boolean} [isSide=false] - If this is a sideways dropdown.
	 * @param {String} [page=null] - The page this dropdown is associated with.
	 */
	static _addElement_dropdown (parentCategory, category, {isSide = false, page = null} = {}) {
		const parentNode = this._getNode(parentCategory);

		const li = document.createElement("li");
		li.setAttribute("role", "presentation");
		li.className = `dropdown dropdown--navbar page__nav-hidden-mobile ${isSide ? "" : "page__btn-nav-root"}`;
		if (isSide) {
			li.onmouseenter = function () { NavBar._handleSideItemMouseEnter(this); };
		} else {
			li.onmouseenter = function () { NavBar._handleItemMouseEnter(this); };
		}

		const a = document.createElement("a");
		a.className = "ve-dropdown-toggle";
		a.href = "#";
		a.setAttribute("role", "button");
		a.onclick = function (event) { NavBar._handleDropdownClick(this, event, isSide); };
		if (isSide) {
			a.onmouseenter = function () { NavBar._handleSideDropdownMouseEnter(this); };
			a.onmouseleave = function () { NavBar._handleSideDropdownMouseLeave(this); };
		}
		a.innerHTML = `${category} <span class="caret ${isSide ? "caret--right" : ""}"></span>`;

		const ul = document.createElement("ul");
		ul.className = `ve-dropdown-menu ${isSide ? "ve-dropdown-menu--side" : "ve-dropdown-menu--top"}`;
		ul.onclick = function (event) { event.stopPropagation(); };

		li.appendChild(a);
		li.appendChild(ul);
		parentNode.body.appendChild(li);

		parentNode.children[category] = new NavBar.Node({
			parent: parentNode,
			head: li,
			body: ul,
		});
	}

	/**
	 * Special LI for button
	 * @param parentCategory The element to append to.
	 * @param options Options.
	 * @param options.html Button text.
	 * @param options.click Button click handler.
	 * @param [options.context] Button context menu handler.
	 * @param options.title Button title.
	 * @param options.className Additional button classes.
	 */
	static _addElement_button (parentCategory, options) {
		const parentNode = this._getNode(parentCategory);

		const li = document.createElement("li");
		li.setAttribute("role", "presentation");

		const eleSpan = document.createElement("span");
		if (options.className) eleSpan.className = options.className;
		eleSpan.onclick = options.click;
		eleSpan.innerHTML = options.html;

		if (options.context) eleSpan.oncontextmenu = options.context;

		if (options.id && !document.getElementById(options.id)) eleSpan.setAttribute("id", options.id);

		if (options.title) li.setAttribute("title", options.title);

		li.appendChild(eleSpan);
		parentNode.body.appendChild(li);
	}

	/**
	 * Special LI for button
	 * @param parentCategory The element to append to.
	 * @param options Options.
	 * @param options.html
	 * @param options.metas
	 */
	static _addElement_buttonSplit (parentCategory, options) {
		const parentNode = this._getNode(parentCategory);

		const li = document.createElement("li");
		li.setAttribute("role", "presentation");
		li.className = "ve-flex-v-center";

		options.metas
			.forEach(({className, click, html, title}, i) => {
				const eleSpan = document.createElement("span");

				eleSpan.className = [
					className,
					"inline-block",
					i ? null : "w-100 min-w-0",
				]
					.filter(Boolean)
					.join(" ");

				eleSpan.onclick = click;
				eleSpan.innerHTML = html;

				if (title) eleSpan.setAttribute("title", title);

				li.appendChild(eleSpan);
			});

		parentNode.body.appendChild(li);
	}

	static _getCurrentPage () {
		let currentPage = window.location.pathname;
		currentPage = currentPage.substr(currentPage.lastIndexOf("/") + 1);

		if (!currentPage) currentPage = "index.html";
		return currentPage.trim();
	}

	static _getCurrentWikiHelpPage () {
		const slug = NavBar._getCurrentPage().replace(/.html$/i, "");
		return `https://wiki.tercept.net/en/5eTools/HelpPages/${slug === "index" ? "" : slug}`;
	}

	static highlightCurrentPage () {
		let currentPage = NavBar._getCurrentPage();
		let hash = "";

		if (typeof _SEO_PAGE !== "undefined") currentPage = `${_SEO_PAGE}.html`;
		else if (currentPage.toLowerCase() === "book.html" || currentPage.toLowerCase() === "adventure.html") {
			hash = window.location.hash.split(",")[0].toLowerCase();
		}

		const href = `${currentPage}${hash}`;

		this._doRemoveAllPageHighlights();
		const node = this._getNode(href);
		if (!node) {
			if (NavBar._ALT_CHILD_PAGES[currentPage]) {
				const nodeFallback = this._getNode(NavBar._ALT_CHILD_PAGES[currentPage]);
				nodeFallback.isActive = true;
			}
			return;
		}

		node.isActive = true;
	}

	static _doRemoveAllPageHighlights () {
		const _doRemoveAllPageHighlightsInner = (level) => {
			for (const node of Object.values(level)) {
				node.isActive = false;
				if (node.children) _doRemoveAllPageHighlightsInner(node.children);
			}
		};

		_doRemoveAllPageHighlightsInner(NavBar._tree.children);
	}

	static _handleDropdownClick (ele, event, isSide) {
		event.preventDefault();
		event.stopPropagation();
		if (isSide) return;
		const isOpen = ele.parentNode.classList.contains("open");
		if (isOpen) NavBar._dropdowns.forEach(ele => ele.classList.remove("open"));
		else NavBar._openDropdown(ele);
	}

	static _closeAllDropdowns () {
		NavBar._dropdowns.forEach(ele => ele.classList.remove("open"));
	}

	static _openDropdown (ele) {
		const lisOpen = [];

		let parent = ele.parentNode;
		parent.classList.add("open");
		lisOpen.push(parent);

		do {
			parent = parent.parentNode;
			if (parent.nodeName === "LI") {
				parent.classList.add("open");
				lisOpen.push(parent);
			}
		} while (parent.nodeName !== "NAV");

		NavBar._dropdowns.filter(ele => !lisOpen.includes(ele)).forEach(ele => ele.classList.remove("open"));

		this._openDropdown_mutAlignment({liNavbar: lisOpen.slice(-1)[0]});
	}

	/**
	 * If a dropdown
	 * @param liNavbar
	 * @private
	 */
	static _openDropdown_mutAlignment ({liNavbar}) {
		const uls = [...liNavbar.querySelectorAll("ul.ve-dropdown-menu")];
		const widthRequired = window.innerWidth < 1200
			? Math.max(...uls.map(ul => ul.getBoundingClientRect().width))
			: uls.map(ul => ul.getBoundingClientRect().width).reduce((a, b) => a + b, 0);

		const isForceRightAlign = liNavbar.getBoundingClientRect().left >= (window.innerWidth - widthRequired);

		uls.forEach(ul => {
			ul.style.left = isForceRightAlign ? `${-Math.round(ul.getBoundingClientRect().width) + ul.parentNode.getBoundingClientRect().width}px` : "";
		});
	}

	static _handleItemMouseEnter (ele) {
		const $ele = $(ele);
		const timerIds = $ele.siblings("[data-timer-id]").map((i, e) => ({$ele: $(e), timerId: $(e).data("timer-id")})).get();
		timerIds.forEach(({$ele, timerId}) => {
			if (NavBar._timersOpen[timerId]) {
				clearTimeout(NavBar._timersOpen[timerId]);
				delete NavBar._timersOpen[timerId];
			}

			if (!NavBar._timersClose[timerId] && $ele.hasClass("open")) {
				const getTimeoutFn = () => {
					if (NavBar._timerMousePos[timerId]) {
						const [xStart, yStart] = NavBar._timerMousePos[timerId];
						// for generalised use, this should be made check against the bounding box for the side menu
						// and possibly also check Y pos; e.g.
						// || EventUtil._mouseY > yStart + NavBar._MIN_MOVE_PX
						if (EventUtil._mouseX > xStart + NavBar._MIN_MOVE_PX) {
							NavBar._timerMousePos[timerId] = [EventUtil._mouseX, EventUtil._mouseY];
							NavBar._timersClose[timerId] = setTimeout(() => getTimeoutFn(), NavBar._DROP_TIME / 2);
						} else {
							$ele.removeClass("open");
							delete NavBar._timersClose[timerId];
						}
					} else {
						$ele.removeClass("open");
						delete NavBar._timersClose[timerId];
					}
				};

				NavBar._timersClose[timerId] = setTimeout(() => getTimeoutFn(), NavBar._DROP_TIME);
			}
		});
	}

	static _handleSideItemMouseEnter (ele) {
		const timerId = $(ele).closest(`li.dropdown`).data("timer-id");
		if (NavBar._timersClose[timerId]) {
			clearTimeout(NavBar._timersClose[timerId]);
			delete NavBar._timersClose[timerId];
			delete NavBar._timerMousePos[timerId];
		}
	}

	static _handleSideDropdownMouseEnter (ele) {
		const $ele = $(ele);
		const timerId = $ele.parent().data("timer-id") || NavBar._timerId++;
		$ele.parent().attr("data-timer-id", timerId);

		if (NavBar._timersClose[timerId]) {
			clearTimeout(NavBar._timersClose[timerId]);
			delete NavBar._timersClose[timerId];
		}

		if (!NavBar._timersOpen[timerId]) {
			NavBar._timersOpen[timerId] = setTimeout(() => {
				NavBar._openDropdown(ele);
				delete NavBar._timersOpen[timerId];
				NavBar._timerMousePos[timerId] = [EventUtil._mouseX, EventUtil._mouseY];
			}, NavBar._DROP_TIME);
		}
	}

	static _handleSideDropdownMouseLeave (ele) {
		const $ele = $(ele);
		if (!$ele.parent().data("timer-id")) return;
		const timerId = $ele.parent().data("timer-id");
		clearTimeout(NavBar._timersOpen[timerId]);
		delete NavBar._timersOpen[timerId];
	}

	static _clearAllTimers () {
		Object.entries(NavBar._timersOpen).forEach(([k, v]) => {
			clearTimeout(v);
			delete NavBar._timersOpen[k];
		});
	}
	
	static initPopup (type) {
		const isCreating = type == "create"
		const title = isCreating ? 'Create a 5etools account' : 'Sign In to your 5etools account';
		const btnTxt = isCreating ? 'Create account' : 'Sign In'
		return `<h3>${title}</h3>
    <button onclick="document.getElementById('navPopup').style.top = '-500px';" class="btn close-menu-button">X</button>
		<label for="popupEmail">Email Address:</label><br>
    <input id="popupEmail" type="text" placeholder="e.g. yourname@example.com"><br>
		<label for="popupPassword">Password:</label><br>
    <input id="popupPassword" type="text" placeholder="e.g. h$kd9I8K4nb-D6r"><br>
		<button onclick="NavBar.firebaseSignIn(popupEmail.value, popupPassword.value, ${isCreating})" class="btn bottom-right-button">${btnTxt}</button>`

	}

	static async firebaseSignIn (email, password, creating) {
		if (!creating) {
			firebase.auth().signInWithEmailAndPassword(email, password).then((userObj) => {
				if (userObj) {
					document.getElementById("signInButton").innerHTML = 'Log Out';
					document.getElementById("signInButton").title = 'Log out of your account';
					document.getElementById('navPopup').style.top = '-500px';
					localStorage.userUID = userObj.user.uid
					localStorage.UIDtimestamp = Date.now()
					JqueryUtil.doToast({
						content: `Successfully logged in as '${email}'!`,
						type: "success",
					})
				}
			}).catch((error) => {
				if (error.code == "auth/user-not-found") {
					JqueryUtil.doToast({
						content: `No user found with this email! Please check your spelling and try again.`,
						type: "danger",
						autoHideTime: 5_000 /* 5 seconds */,
					})
				} else if (error.code == "auth/wrong-password") {
					JqueryUtil.doToast({
						content: `Incorrect password for '${email}'! Please check your spelling and try again.`,
						type: "danger",
						autoHideTime: 5_000 /* 5 seconds */,
					})
				} else if (error.code == "auth/invalid-email") {
					JqueryUtil.doToast({
						content: `Please enter a valid email address and try again.`,
						type: "danger",
						autoHideTime: 5_000 /* 5 seconds */,
					})
				} else {
					console.error(error)
					JqueryUtil.doToast({
						content: `An error has occured! Check the console (Ctrl + Shift + J) for more information`,
						type: "danger",
						autoHideTime: 5_000 /* 5 seconds */,
					})
				}
			})
		} else {
			firebase.auth().createUserWithEmailAndPassword(email, password).then((userObj) => {
				if (userObj) {
					document.getElementById("signInButton").innerHTML = 'Log Out';
					document.getElementById("signInButton").title = 'Log out of your account';
					document.getElementById('navPopup').style.top = '-500px';
					localStorage.userUID = userObj.user.uid
					localStorage.UIDtimestamp = Date.now()
					var newUserData = {}; 
					newUserData['5etools'] = {siteVersion: VERSION_NUMBER, timestamp: Date.now()}
					NavBar.userDataRef.child(localStorage.userUID).set(newUserData)
					NavBar.usersRef.child(localStorage.userUID).set({email: email, signUpDate: Date.now()})
					// console.log(localStorage.userUID)
					JqueryUtil.doToast({
						content: `Successfully created account with '${email}'!`,
						type: "success",
					})
				}
			})
		}
	}
}
NavBar._DROP_TIME = 250;
NavBar._MIN_MOVE_PX = 3;
NavBar._ALT_CHILD_PAGES = {
	"book.html": "books.html",
	"adventure.html": "adventures.html",
};
NavBar._CAT_RULES = "Rules";
NavBar._CAT_BOOKS = "Books";
NavBar._CAT_PLAYER = "Player";
NavBar._CAT_DUNGEON_MASTER = "Dungeon Master";
NavBar._CAT_ADVENTURES = "Adventures";
NavBar._CAT_REFERENCES = "References";
NavBar._CAT_UTILITIES = "Utilities";
NavBar._CAT_SETTINGS = "Settings";
NavBar._CAT_ACCOUNT = "Account";
NavBar._CAT_CACHE = "Preload Data";

NavBar._navbar = null;

NavBar._tree = {};

NavBar._timerId = 1;
NavBar._timersOpen = {};
NavBar._timersClose = {};
NavBar._timerMousePos = {};
NavBar._cachedInstallEvent = null;

NavBar.InteractionManager = class {
	static _onClick_button_dayNight (evt) {
		evt.preventDefault();
		styleSwitcher.cycleDayNightMode();
	}

	static _onContext_button_dayNight (evt) {
		evt.preventDefault();
		styleSwitcher.cycleDayNightMode(-1);
	}

	static _onClick_button_wideMode (evt) {
		evt.preventDefault();
		styleSwitcher.toggleWide();
	}

	static async _pOnClick_button_saveStateFile (evt, toFirebase) {
		evt.preventDefault();
		const sync = StorageUtil.syncGetDump();
		const async = await StorageUtil.pGetDump();
		const dump = {sync, async};
		if (toFirebase) {
			var asyncData = JSON.parse(JSON.stringify(FIREBASEarraysToObjects(async, false)))
			NavBar.userDataRef.child(localStorage.userUID + '/5etools').set({sync: FIREBASEarraysToObjects(sync, false), async: asyncData, siteVersion: VERSION_NUMBER, timestamp: Date.now()})
			document.getElementById('navPopup').click();
			JqueryUtil.doToast({
				content: `Successfully saved state!`,
				type: "success",
			})
		} else {
			DataUtil.userDownload("5etools", dump, {fileType: "5etools"});
		}
	}

	static async _pOnClick_button_loadStateFile (evt, isLoadedFromFirebase) {
		evt.preventDefault();
		
		if (isLoadedFromFirebase) {
			await NavBar.userDataRef.child(localStorage.userUID + '/5etools').once('value', function (snapshot) {
				NavBar.currentFirebaseData = snapshot.val()
				NavBar.currentAsyncStateData = FIREBASEarraysToObjects(NavBar.currentFirebaseData.async, true)
				NavBar.currentSyncStateData = FIREBASEarraysToObjects(NavBar.currentFirebaseData.sync, true)
			})
			var jsons = [{sync: NavBar.currentSyncStateData, async: NavBar.currentAsyncStateData}]
			// let printWindow = window.open();
			// printWindow.document.write('<html><meta charset="utf-8"/><title>Test</title><div>' + JSON.stringify(jsons) + '</div>');
		} else {
			var {jsons, errors} = await DataUtil.pUserUpload({expectedFileTypes: ["5etools"]});
			DataUtil.doHandleFileLoadErrorsGeneric(errors);
		}

		if (!jsons?.length) return;
		const dump = jsons[0];

		try {
			StorageUtil.syncSetFromDump(dump.sync);
			await StorageUtil.pSetFromDump(dump.async);
			location.reload();
		} catch (e) {
			JqueryUtil.doToast({type: "danger", content: `Failed to load state! ${VeCt.STR_SEE_CONSOLE}`});
			throw e;
		}
	}

	static async _pOnClick_button_addApp (evt) {
		evt.preventDefault();
		try {
			NavBar._cachedInstallEvent.prompt();
		} catch (e) {
			// Ignore errors
		}
	}

	static async _pOnClick_button_preloadOffline (evt, {route, isRequireImages = false}) {
		evt.preventDefault();

		if (globalThis.swCacheRoutes === undefined) {
			JqueryUtil.doToast(`The loader was not yet available! Reload the page and try again. If this problem persists, your browser may not support preloading.`);
			return;
		}

		if (isRequireImages && globalThis.DEPLOYED_IMG_ROOT) {
			JqueryUtil.doToast({
				type: "danger",
				content: `The "${evt.currentTarget.innerText.split("(")[0].trim()}" option is not currently supported on this site version. Try again some other time!`,
			});
			return;
		}

		globalThis.swCacheRoutes(route);
	}

	static async _pOnClick_button_clearOffline (evt) {
		evt.preventDefault();

		if (globalThis.swResetAll === undefined) {
			JqueryUtil.doToast(`The loader was not yet available! Reload the page and try again. If this problem persists, your browser may not support preloading.`);
			return;
		}

		globalThis.swResetAll();
	}
};

NavBar.Node = class {
	constructor ({parent, head, body}) {
		this.parent = parent;
		this.head = head;
		this.body = body;
		this.children = {};

		this._isActive = false;
	}

	set isActive (val) {
		this._isActive = !!val;
		this?.head?.classList?.toggle("active", this._isActive);
		if (this.parent) this.parent.isActive = this._isActive;
	}

	get isActive () {
		return this._isActive;
	}
};

NavBar.NodeLink = class extends NavBar.Node {
	constructor ({isInAccordion, lnk, ...rest}) {
		super(rest);
		this._isInAccordion = !!isInAccordion;
		this._lnk = lnk;
	}

	set isActive (val) {
		if (!this._isInAccordion) {
			super.isActive = val;
			return;
		}

		this._isActive = !!val;
		this._lnk.classList.toggle("nav2-accord__lnk-item--active", this._isActive);
		if (this.parent) this.parent.isActive = this._isActive;
	}

	get isActive () { // Overriding the setter clobbers the getter, so, re-make it
		return super.isActive;
	}
};

NavBar.NodeAccordion = class extends NavBar.Node {
	static getDispToggleDisplayHtml (val) { return val ? `[\u2212]` : `[+]`; }

	constructor ({dispToggle, ...rest}) {
		super(rest);
		this._dispToggle = dispToggle;
		this._isExpanded = false;
	}

	set isActive (val) {
		this._isActive = !!val;
		this?.head?.classList?.toggle("nav2-accord__head--active", this._isActive);
		if (val && !this._isExpanded) this.isExpanded = true;
		if (this.parent) this.parent.isActive = this._isActive;
	}

	get isActive () { // Overriding the setter clobbers the getter, so, re-make it
		return super.isActive;
	}

	set isExpanded (val) {
		this._isExpanded = val;
		this?.body?.classList?.toggle("ve-hidden", !val);
		this._dispToggle.textContent = NavBar.NodeAccordion.getDispToggleDisplayHtml(val);
	}

	get isExpanded () {
		return this._isExpanded;
	}
};

NavBar.init();
