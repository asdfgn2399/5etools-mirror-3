import {ModalFilterClasses} from "./filter-classes-raw.js";

"use strict";
/* ============================================================
   D&D 5e Character Creator — vanilla JS port for 5etools mirror
   Ported from a React prototype. Styled with the site's own
   ve-btn / ve-form-control / form-group classes plus a small
   cb__ namespaced stylesheet (css/charactercreator.css).
   ============================================================ */

// ─── DATA ────────────────────────────────────────────────────────────────────

const ABILITY_LABELS = Parser.ATB_ABV_TO_FULL; // {str:"Strength", dex:"Dexterity", ...} — from parser.js

// Standard PHB language list — unlike skills/tools, languages aren't derived from any loaded
// catalog (there's no "language" entity type in the site's data), so this is a small, genuinely
// fixed enumeration, same justification as ABILITY_LABELS being effectively hardcoded via Parser.
const LANGUAGE_OPTIONS = ["Common", "Dwarvish", "Elvish", "Giant", "Gnomish", "Goblin", "Halfling", "Orc", "Abyssal", "Celestial", "Draconic", "Deep Speech", "Infernal", "Primordial", "Sylvan", "Undercommon"]
	.map(l => ({key: `languageProf.${l.toLowerCase()}`, label: l}));

/** Every real tool/gaming-set/instrument/misc-kit item in the loaded catalog (type codes AT/INS/
 * GS/T — confirmed against the real data: Artisan's Tools, Instruments, Gaming Sets, and the
 * catch-all "T" bucket that covers Thieves' Tools, Herbalism Kit, Navigator's Tools, etc.), deduped
 * by name. Populated by buildToolOptions() once ITEMS finishes loading — used for any feat/item/
 * feature's tool-proficiency choose-block (see featChoiceRequirements()). */
let TOOL_OPTIONS = [];
function buildToolOptions() {
	const types = new Set(["AT", "INS", "GS", "T"]);
	const seen = new Set();
	TOOL_OPTIONS = [];
	ITEMS.forEach(it => {
		if (!types.has((it.type || "").split("|")[0])) return;
		const key = it.name.toLowerCase().replace(/[^a-z0-9]+/g, "");
		if (seen.has(key)) return;
		seen.add(key);
		TOOL_OPTIONS.push({key: `toolProf.${key}`, label: it.name});
	});
	TOOL_OPTIONS.sort((a, b) => a.label.localeCompare(b.label));
}
const ABILITIES = Parser.ABIL_ABVS; // ["str","dex","con","int","wis","cha"] — from parser.js
const STANDARD_ARRAY = [15,14,13,12,10,8];
const STEPS = ["Name","Race","Class","Subclass","Background","Abilities","Skills","Equipment","Feats","Spells","Sheet"];

// Populated at startup by loadRuleData() from the site's own races.json (+ prerelease/brew),
// via DataLoader.pCacheAndGetAllSite/pCacheAndGetAllPrerelease/pCacheAndGetAllBrew — see below.
let RACES = [];

// Populated at startup by loadRuleData() from the site's own class/subclass data
// (+ prerelease/brew), merged via ModalFilterClasses.pPostLoad() so each class carries
// its subclasses embedded as cls.subclasses[] — see loadRuleData() below.
let CLASSES = [];

// Populated at startup by loadRuleData() from the site's own class/subclass *feature* data
// (data/class/class-*.json's classFeature[]/subclassFeature[] arrays, + prerelease/brew) — the
// full feature entities (name/level/entries), as opposed to the uid refs embedded in
// cls.classFeatures/sc.subclassFeatures. Indexed into classFeatureLookup/subclassFeatureLookup
// (keyed by a normalized name|class|level|source string) so a ref from classFeatureRefs()/
// subclassFeatureRefs() can be resolved to its full entries — see resolveClassFeature() below.
let CLASS_FEATURES = [];
let SUBCLASS_FEATURES = [];
let classFeatureLookup = new Map();
let subclassFeatureLookup = new Map();

// Populated at startup by loadRuleData() from the site's own backgrounds.json (+ prerelease/brew).
let BACKGROUNDS = [];

// Derived from Parser.SKILL_TO_ATB_ABV (parser.js) rather than a separately hardcoded name/ability list.
const ALL_SKILLS = Object.entries(Parser.SKILL_TO_ATB_ABV)
	.map(([name, ability]) => ({name: name.toTitleCase(), ability}))
	.sort((a, b) => a.name.localeCompare(b.name));

// Populated at startup by loadRuleData() from the site's own feats.json (+ prerelease/brew).
let FEATS = [];

// Populated at startup by loadRuleData() from the site's own spells.json (+ prerelease/brew).
// Each spell is mutated by the framework's own DataUtil.spell loading pipeline (js/utils.js,
// backed by data/generated/gendata-spell-source-lookup.json) to carry `sp.classes.fromClassList`
// (spells on a class's own list) and `sp.classes.fromSubclass` (subclass-granted spells, e.g.
// Cleric domain spells or Eldritch Knight's borrowed Wizard list) — see spellsAvailable() below.
let SPELLS = [];

// Populated at startup by loadRuleData() from the site's own items.json/items-base.json/
// magicvariants.json (+ prerelease/brew) via DataLoader's registered item page loader, which
// handles base-item/generic-variant merging and _fullEntries population the same way the site's
// own Items browse page does — see pLoadAllItems(). Indexed by buildItemLookup() into
// itemLookupExact/itemLookupByName so an equipment entry's {name, source} ref (see equipItemRef())
// can be resolved back to a real item — see resolveItemRef().
let ITEMS = [];
let itemLookupExact = new Map();
let itemLookupByName = new Map();

// Populated at startup by loadFoundryEffectData() from the repo's Foundry-VTT "Active Effect"
// overlay files (data/foundry-items.json, data/foundry-feats.json, data/class/foundry.json) —
// see the EFFECTS ENGINE section below. These are Tier 2 for the live-stat pass: real structured
// data, just sparser than items/feats' own native fields and absent entirely from the main
// class/*.json (class/subclass features carry zero native mechanical fields — see
// classFeatureEntryData()/foundryEffectsFor() below). Keyed the same way the matching native
// lookup is keyed (buildItemLookup()/classFeatureKey()/subclassFeatureKey()) so a resolved
// item/feat/feature can look its Tier 2 record straight up.
let FOUNDRY_ITEMS = new Map();
let FOUNDRY_FEATS = new Map();
let FOUNDRY_CLASS_FEATURES = new Map();
let FOUNDRY_SUBCLASS_FEATURES = new Map();

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function scoreMod(s) { return Math.floor((s - 10) / 2); }
function fmtMod(m) { return (m >= 0 ? "+" : "") + m; }
function profBonus(lvl) { return Math.ceil(lvl / 4) + 1; }
function getHP(cls, conScore, lvl) { const faces = cls.hd?.faces || 8; return faces + scoreMod(conScore) + (lvl - 1) * (Math.floor(faces / 2) + 1 + scoreMod(conScore)); }
function pbCost(s) { return s <= 13 ? s - 8 : (s - 8) + (s - 13); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

// ─── PLAY-MODE / SESSION TRACKING ──────────────────────────────────────────
// Everything below supports the Sheet step's "Play" tracker (HP, spell slots, hit dice, rests,
// class resources) — see renderPlayCard() further down. All of it reads real class/subclass data
// rather than hardcoded tables, same policy as the rest of this file.

/**
 * Which ruleset (2014 "classic" vs 2024 "one") governs rest recovery for this character. Per-
 * character override (char.play.rulesOverride) wins if set; otherwise this follows the site's own
 * global Classic/Modern style switcher (the same settings menu that controls day/night mode —
 * VetoolsConfig.get("styleSwitcher", "style"), values "classic"/"one", set in js/utils-config.js).
 * Defaults to "one" (2024) if that global pref isn't available for some reason.
 */
function activeRulesEdition(char) {
	if (char.play?.rulesOverride === "classic" || char.play?.rulesOverride === "one") return char.play.rulesOverride;
	try {
		const style = typeof VetoolsConfig !== "undefined" ? VetoolsConfig.get("styleSwitcher", "style") : null;
		if (style === "classic" || style === "one") return style;
	} catch (err) { /* VetoolsConfig not ready — fall through to default */ }
	return "one";
}

/**
 * Real per-character-level spell slot data for a caster, read directly from classTableGroups —
 * the same tables maxSpellLevel() already parses — rather than a hardcoded slot table. Full/half/
 * third casters carry a rowsSpellProgression array (one row per level, one column per spell level
 * 1-9); Warlock's Pact Magic instead has plain "Spell Slots"/"Slot Level" columns. Returns null for
 * non-casters.
 */
function spellSlotInfo(src, level) {
	if (!src) return null;
	const groups = src.classTableGroups || src.subclassTableGroups || [];
	const progGroup = groups.find(g => g.rowsSpellProgression?.length);
	if (progGroup) {
		const row = progGroup.rowsSpellProgression[Math.min(level, progGroup.rowsSpellProgression.length) - 1] || [];
		const slots = row.map(n => n || 0);
		return slots.some(n => n > 0) ? {type: "slots", slots} : null;
	}
	const slotGroup = groups.find(g => (g.colLabels || []).some(l => /spell slots/i.test(l)) && (g.colLabels || []).some(l => /slot level/i.test(l)));
	if (slotGroup) {
		const slotsIdx = slotGroup.colLabels.findIndex(l => /spell slots/i.test(l));
		const lvlIdx = slotGroup.colLabels.findIndex(l => /slot level/i.test(l));
		const row = slotGroup.rows[Math.min(level, slotGroup.rows.length) - 1];
		const count = Number(row?.[slotsIdx]) || 0;
		// The "Slot Level" cell is a filter-tag string like "{@filter 3rd|spells|level=3|...}",
		// not a plain number (same shape maxSpellLevel() already unpacks via this same regex) —
		// a bare Number() on it silently fails to NaN/0, so extract the level= tag instead.
		const lvlCell = row?.[lvlIdx];
		const lvlMatch = typeof lvlCell === "string" && lvlCell.match(/level=(\d+)/);
		const slotLevel = lvlMatch ? Number(lvlMatch[1]) : (Number(lvlCell) || 1);
		if (count > 0) return {type: "pact", count, slotLevel};
	}
	return null;
}

// Curated allowlist of classTableGroups column labels that represent an actual per-day/per-rest
// spendable resource (checked against real data — see the class-resource pass in project notes).
// Deliberately narrower than "any numeric/dice column", since those same tables also carry
// non-resource columns that look similar (Martial Arts/Sneak Attack damage dice, Rage Damage
// bonus, Weapon Mastery count) — matching by label keeps those out.
const RESOURCE_COL_LABELS = new Set(["rages", "channel divinity", "wild shape", "second wind", "focus points", "ki points", "sorcery points", "psi points", "superiority dice"]);
// Of those, which recharge on a short rest (rather than only a long rest) — Ki/Focus Points,
// Second Wind, Channel Divinity, Wild Shape, and Superiority Dice all do in both editions; Rages,
// Sorcery Points, and Psi Points only recover on a long rest.
const SHORT_REST_RESOURCE_LABELS = new Set(["channel divinity", "wild shape", "second wind", "focus points", "ki points", "superiority dice"]);

/**
 * Auto-detects trackable class resources for the current level from char.cls/char.subclass's
 * classTableGroups. A cell can be a plain number, a numeric string, the literal "Unlimited"
 * (Barbarian Rages at level 20 — tracked as max: Infinity, no pips), or a {type:"dice",
 * toRoll:[...]} cell (e.g. Superiority Dice's "4d8" — the die *count* is the trackable max, faces
 * kept only for display). Returns [] before a resource is actually available (cell is 0/blank).
 */
function classResourceDefs(char) {
	const level = char.level;
	const defs = [];
	const scan = (entity, source) => {
		(entity?.classTableGroups || []).forEach(tg => {
			(tg.colLabels || []).forEach((rawLabel, i) => {
				const label = String(rawLabel || "").replace(/\{@filter ([^|]+)\|.*?\}/, "$1").trim();
				if (!RESOURCE_COL_LABELS.has(label.toLowerCase())) return;
				const row = tg.rows?.[Math.min(level, tg.rows.length) - 1];
				const cell = row?.[i];
				let max = null, dieFaces = null;
				if (cell && typeof cell === "object" && cell.type === "dice") {
					max = cell.toRoll?.[0]?.number ?? null;
					dieFaces = cell.toRoll?.[0]?.faces ?? null;
				} else if (typeof cell === "string" && /unlimited/i.test(cell)) {
					max = Infinity;
				} else if (cell != null && cell !== "") {
					const n = Number(cell);
					if (!Number.isNaN(n)) max = n;
				}
				if (max === null || max === 0) return;
				defs.push({key: `${source}:${label}`, label, max, dieFaces, shortRest: SHORT_REST_RESOURCE_LABELS.has(label.toLowerCase())});
			});
		});
	};
	scan(char.cls, "class");
	scan(char.subclass, "subclass");
	return defs;
}
/** Normalized lookup key shared by classFeatureLookup's keys and resolveClassFeature()'s queries —
 * name/className/level identify a feature, source disambiguates same-named features across books
 * (e.g. a feature reprinted/errata'd in a later source keeps the same name+level). */
function classFeatureKey(name, className, level, source) {
	return `${name}|${className}|${level}|${source}`.toLowerCase();
}
function subclassFeatureKey(name, className, subclassShortName, level, source) {
	return `${name}|${className}|${subclassShortName}|${level}|${source}`.toLowerCase();
}

/** Rebuilds classFeatureLookup/subclassFeatureLookup from CLASS_FEATURES/SUBCLASS_FEATURES —
 * called once after loadRuleData() populates those arrays. */
function buildFeatureLookups() {
	classFeatureLookup = new Map();
	CLASS_FEATURES.forEach(f => classFeatureLookup.set(classFeatureKey(f.name, f.className, f.level, f.source || f.classSource), f));
	subclassFeatureLookup = new Map();
	SUBCLASS_FEATURES.forEach(f => subclassFeatureLookup.set(subclassFeatureKey(f.name, f.className, f.subclassShortName, f.level, f.source || f.subclassSource), f));
}

/** ref is an unpacked classFeatureRefs() entry: {name, className, classSource, level, source}. */
function resolveClassFeature(ref) {
	if (!ref) return null;
	return classFeatureLookup.get(classFeatureKey(ref.name, ref.className, ref.level, ref.source || ref.classSource)) || null;
}
/** ref is an unpacked subclassFeatureRefs() entry: {name, className, subclassShortName, level, source, ...}. */
function resolveSubclassFeature(ref) {
	if (!ref) return null;
	return subclassFeatureLookup.get(subclassFeatureKey(ref.name, ref.className, ref.subclassShortName, ref.level, ref.source || ref.subclassSource)) || null;
}

/**
 * Plain-text hover description for one equipment entry ({label, parts} — see
 * equipmentChoiceSets()), used by the Equipment step's chip/skill-row `title` attributes, which
 * can only show plain text (unlike the Sheet step's expandable pills, which get real rendered
 * HTML via equipItemBodyHtml()). A bundle describes each of its parts on its own line; a part
 * with no matching catalog item (a generic type choice, gold, flavor-only `special` text) says so
 * plainly rather than a "coming soon" stub.
 */
function equipmentDesc(entry) {
	if (!entry?.parts?.length) return "";
	return entry.parts.map(part => {
		const item = part.ref ? resolveItemRef(part.ref) : null;
		if (!item) return `${part.label}: not a single catalog item — no description available.`;
		return `${part.label}: ${entriesToPlainText(item._fullEntries || item.entries) || "No description available."}`;
	}).join("\n\n");
}

/** Rendered HTML description for one real item, used by the Sheet step's expandable equipment
 * pills (see pillListHtml() call in renderSheet()) — Renderer.item.getRenderedEntries() handles
 * items' own entry templating (e.g. `{{item.dmgType}}`) and merged generic-variant entries, which
 * a plain entriesToHtml(item.entries) call wouldn't. */
function equipItemBodyHtml(item) {
	if (!item) return null;
	try { return Renderer.item.getRenderedEntries(item, {isCompact: true}) || null; } catch (err) { return null; }
}

function spellDesc(sp) { return sp ? entriesToPlainText(sp.entries) : ""; }

// ─── REAL-DATA RENDERING HELPERS ──────────────────────────────────────────────
// These lean on the site's own Renderer/Parser (loaded via the <script> chain in
// charactercreator.html) instead of hand-parsing the 5etools JSON schema ourselves.

/** Rich HTML for a detail panel — full 5etools rendering (tags, dice, cross-refs, etc). */
function entriesToHtml(entries) {
	if (!entries || !entries.length) return "";
	try {
		return Renderer.get().render({type: "entries", entries});
	} catch (err) {
		console.error("[charactercreator] Failed to render entries", err, entries);
		return "";
	}
}

/** Plain text (5etools {@tag ...} markup stripped) for use in a native title="" tooltip. */
function entriesToPlainText(entries) {
	if (!entries || !entries.length) return "";
	const chunks = [];
	const walk = (entry) => {
		if (entry == null) return;
		if (typeof entry === "string") { chunks.push(entry); return; }
		if (Array.isArray(entry)) { entry.forEach(walk); return; }
		if (entry.entries) walk(entry.entries);
		if (entry.items) walk(entry.items);
		if (entry.entry) walk(entry.entry);
	};
	walk(entries);
	try {
		return Renderer.stripTags(chunks.join(" ")).trim();
	} catch (err) {
		return chunks.join(" ").trim();
	}
}

/** Named sub-entries of a race/feat/background's `entries` array (i.e. the individual traits/benefits). */
function namedSubEntries(entries) {
	return (entries || []).filter(e => e && typeof e === "object" && e.name);
}

/**
 * Click-to-expand list of class/subclass features. Unlike races/feats (short traits, fine as a
 * hover tooltip) a class can have dozens of features across 20 levels, so each renders collapsed
 * as a pill and expands its full native-rendered entries (Renderer.get().render(), same engine as
 * entriesToHtml()) inline underneath on click, rather than dumping everything in the DOM at once.
 * `entries` is an array of {ref, feature} — `ref` from classFeatureRefs()/subclassFeatureRefs(),
 * `feature` the resolved full entity (or null if not found in CLASS_FEATURES/SUBCLASS_FEATURES).
 * `idPrefix` must be unique per call site (e.g. "cls", "sc", "sheet-cls") so toggle ids don't
 * collide when this is rendered more than once on the same page (e.g. Class + Sheet steps).
 */
function featureListHtml(entries, {idPrefix, showLevel = true, colorClass = "cb__pill--purple", noneLabel = "None"} = {}) {
	if (!entries.length) return `<span class="cb__placeholder">${esc(noneLabel)}</span>`;
	return entries.map(({ref, feature}, i) => {
		const key = `${idPrefix}-${i}`;
		const label = `${esc(ref.name)}${showLevel ? ` <em>(Lv ${ref.level})</em>` : ""}`;
		const body = feature ? entriesToHtml(feature.entries) : `<p class="cb__placeholder">No description available.</p>`;
		return `
			<div class="cb__feature">
				<button type="button" class="cb__pill ${colorClass} cb__feature-toggle" data-feature-toggle="${key}" title="Click to view full description">${label}</button>
				<div class="cb__feature-body" id="cb-feature-body-${key}" hidden>${body}</div>
			</div>
		`;
	}).join("");
}

/**
 * Click-to-expand pill list for simple name+description items (racial traits, feats, equipment,
 * spells) — same markup/mechanism as featureListHtml() above, just for plain {name, body} pairs
 * instead of the {ref, feature, level} shape class/subclass features use. `items` is an array of
 * {name, body, isStatic}: `body` is already-rendered HTML (entriesToHtml() output, typically) or
 * null/empty if nothing to show; `isStatic` (equipment pills only, so far — see renderSheet())
 * renders a plain non-interactive pill instead, for entries with no real single description to
 * expand at all (a generic equipment-type choice, a gold value, flavor-only text) rather than a
 * pill that looks clickable but opens onto "No description available." `idPrefix` must be unique
 * per call site so toggle ids don't collide when the same kind of list renders on more than one
 * step (e.g. Racial Traits shows on both the Race step and the Sheet step).
 */
function pillListHtml(items, {idPrefix, colorClass = "cb__pill--teal", noneLabel = "None"} = {}) {
	if (!items.length) return `<span class="cb__placeholder">${esc(noneLabel)}</span>`;
	return items.map((item, i) => {
		if (item.isStatic) return `<span class="cb__pill ${colorClass} cb__pill--static">${esc(item.name)}</span>`;
		const key = `${idPrefix}-${i}`;
		const body = item.body || `<p class="cb__placeholder">No description available.</p>`;
		return `
			<div class="cb__feature">
				<button type="button" class="cb__pill ${colorClass} cb__feature-toggle" data-feature-toggle="${key}" title="Click to expand">${esc(item.name)}</button>
				<div class="cb__feature-body" id="cb-feature-body-${key}" hidden>${body}</div>
			</div>
		`;
	}).join("");
}

/** Wires click-to-expand for every featureListHtml()/pillListHtml() pill currently in the DOM.
 * Safe to call after every render() — addEventListener on freshly-created elements only, no
 * duplicate binding. */
function wireFeatureToggles() {
	document.querySelectorAll("[data-feature-toggle]").forEach(btn => {
		btn.addEventListener("click", () => {
			const body = document.getElementById(`cb-feature-body-${btn.dataset.featureToggle}`);
			if (!body) return;
			const isHidden = body.hasAttribute("hidden");
			if (isHidden) body.removeAttribute("hidden"); else body.setAttribute("hidden", "");
			btn.classList.toggle("cb__feature-toggle--open", isHidden);
		});
	});
}

/**
 * A row of clickable pips for a used/max resource (hit dice, spell slots, class resources, death
 * saves) — used throughout renderPlayCard(). Click behavior mirrors the common spell-slot-tracker
 * convention: clicking pip i sets the used-count boundary at that pip (fills it and everything
 * before it if it was empty, empties it and everything after if it was already used), so both
 * "spend one more" and "give one back" are a single click on the relevant pip. `max === Infinity`
 * (Barbarian's unlimited Rages at level 20) renders as plain text instead of pips, since there's
 * nothing to track. kind/key are stamped onto data attributes for the generic click handler in
 * CB.wirePlayCard() to read.
 */
function pipRowHtml(kind, key, max, used) {
	if (max === Infinity) return `<span class="cb__pip-unlimited">Unlimited</span>`;
	if (!max || max <= 0) return "";
	let pips = "";
	for (let i = 0; i < max; i++) {
		const isUsed = i < used;
		pips += `<button type="button" class="cb__pip ${isUsed ? "cb__pip--used" : ""}" data-pip-kind="${esc(kind)}" data-pip-key="${esc(key)}" data-pip-idx="${i}" title="${isUsed ? "Click to restore" : "Click to spend"}"></button>`;
	}
	return `<div class="cb__pip-row">${pips}</div>`;
}

/**
 * Races tagged lineage:"VRGR" (Aasimar MPMM, Aarakocra MPMM, etc.) or lineage:"UA1" carry no
 * `ability` field of their own in the raw data — but the site's own loading pipeline
 * (Renderer.race.mergeSubraces, run automatically by DataUtil.race.loadJSON for every race we
 * load) injects the real "flexible ability scores" rule onto `race.ability` for these lineages:
 * a `choose.weighted` entry with weights [2,1] (+2/+1 to two different abilities) and a second
 * with weights [1,1,1] (+1 to three different abilities). So by the time we see these races,
 * `race.ability` IS populated — just with a `choose.weighted` block rather than a plain
 * `choose.from` one, which is why raceAbilityChoice below explicitly ignores it.
 */
function isFlexibleLineageRace(race) { return race?.lineage === "VRGR" || race?.lineage === "UA1"; }

/**
 * A race's plain player-choice ability bonus, e.g. {from: ["str","dex",...], count: 1, amount: 1},
 * or null if there isn't one. Explicitly skips `choose.weighted` entries — those are the flexible
 * lineage rule (see isFlexibleLineageRace above), handled separately by its own UI, not this
 * simple "pick N abilities for +amount each" picker.
 */
function raceAbilityChoice(race) {
	const entry = (race?.ability || []).find(e => e?.choose && !e.choose.weighted);
	if (!entry) return null;
	const {from, count = 1, amount = 1} = entry.choose;
	return {from: from && from.length ? from : ABILITIES, count, amount};
}

/**
 * True if the race itself grants an ability score bonus (fixed values and/or a `choose` block,
 * and/or the flexible-lineage rule). True for every classic (PHB'14-style) race. 2024/XPHB
 * races carry no `ability` field at all — that edition moved ability score increases onto the
 * background instead — so this is false for them, which is what gates whether a background's own
 * ability bonus (see bgAbilityChoice below) is actually usable.
 */
function raceGrantsAbilityBonus(race) { return !!(race?.ability?.length) || isFlexibleLineageRace(race); }

/**
 * Real 2024/XPHB background data grants an "Origin" ability score bonus via two alternative
 * `choose.weighted` blocks over the same restricted trio of abilities: a 2-weight entry (+2 to one
 * ability, +1 to a different one) and a 3-weight entry (+1 to three different abilities) — same
 * shape as the flexible-lineage rule above, just scoped to a background-specific ability trio
 * instead of any of the six. Classic (PHB'14) backgrounds have no `ability` field at all. Only ONE
 * of a race's or a background's ability bonus is meant to apply on a given character — see
 * raceGrantsAbilityBonus, which callers should check before using this.
 */
function bgAbilityChoice(bg) {
	const entries = (bg?.ability || []).filter(e => e?.choose?.weighted?.from?.length);
	if (!entries.length) return null;
	return {from: entries[0].choose.weighted.from};
}

function raceWalkSpeed(r) {
	if (!r) return 30;
	return (typeof r.speed === "number" ? r.speed : r.speed?.walk) ?? 30;
}

/** "Speed 30ft · Fly 30ft · Medium" style summary line from real race.speed/race.size. */
function raceSpeedSizeSummary(r) {
	if (!r) return "";
	const bits = [];
	if (r.speed != null) bits.push(`Speed ${Parser.getSpeedString(r).trim()}`);
	const sizes = (r.size || []).map(s => { try { return Parser.sizeAbvToFull(s); } catch (err) { return s; } });
	if (sizes.length) bits.push(sizes.join("/"));
	return bits.join(" · ");
}

/** Ability score pills from real race.ability (fixed bonuses and/or a `choose` block). */
function raceAbilityPills(r) {
	const out = [];
	(r?.ability || []).forEach(entry => {
		if (!entry) return;
		if (entry.choose) {
			const text = Renderer.getAbilityData([entry]).asText;
			out.push(`<span class="cb__asi">${esc(text)}</span>`);
			return;
		}
		Object.entries(entry).forEach(([k, v]) => {
			if (typeof v !== "number") return;
			out.push(`<span class="cb__asi">${ABILITY_LABELS[k] || k.toUpperCase()} <strong>+${v}</strong></span>`);
		});
	});
	return out.join("") || `<span class="cb__asi">—</span>`;
}

/** Fixed (non-choice) skill names granted by a real background's skillProficiencies. */
function backgroundSkillNames(bg) {
	const out = new Set();
	(bg?.skillProficiencies || []).forEach(entry => {
		if (!entry) return;
		Object.keys(entry).forEach(k => {
			if (entry[k] !== true) return; // skip `choose`/count-style entries — not auto-resolved yet
			const skill = ALL_SKILLS.find(s => s.name.toLowerCase() === k.toLowerCase());
			if (skill) out.add(skill.name);
		});
	});
	return [...out];
}

/**
 * 2024/XPHB classes carry a real `primaryAbility` field (e.g. Fighter XPHB: [{str:true},{dex:true}]);
 * classic (PHB'14) classes don't, so for those we approximate it from the multiclassing prerequisite
 * abilities (e.g. Fighter PHB's str-or-dex requirement doubles as its two primary abilities), falling
 * back to spellcastingAbility, then nothing.
 */
function classPrimaryAbilities(cls) {
	if (cls?.primaryAbility?.length) {
		const keys = new Set();
		cls.primaryAbility.forEach(group => Object.entries(group || {}).forEach(([k, v]) => v && ABILITIES.includes(k) && keys.add(k)));
		if (keys.size) return [...keys];
	}
	const req = cls?.multiclassing?.requirements;
	if (req) {
		const groups = req.or || [req];
		const keys = new Set();
		groups.forEach(g => Object.keys(g).forEach(k => ABILITIES.includes(k) && keys.add(k)));
		if (keys.size) return [...keys];
	}
	return cls?.spellcastingAbility ? [cls.spellcastingAbility] : [];
}

/** Real classFeatures entries come in two shapes depending on whether the framework's own
 * class-loading pipeline (_pGetDereferencedClassData in utils-dataloader-dataloader.js) managed
 * to dereference them in place:
 *  (a) flat array of uid ref strings ("Name|Class||Level|Source") or {classFeature: uid, ...} —
 *      not dereferenced (e.g. brew/prerelease that skips the framework's own postCache step, or
 *      any case where a referenced classFeature entity couldn't be found).
 *  (b) array grouped by level, each element itself an array of already-dereferenced feature
 *      objects (cls.classFeatures[0] = level-1 features, [1] = level-2, etc.) — this is what the
 *      framework produces once classFeature data is actually loadable (see the classFeature/
 *      subclassFeature cases added to MultiSourceUtil.getIndexKey()). These objects already carry
 *      `entries`, so no CLASS_FEATURES lookup is needed for them.
 * Returns a flat list of {ref, feature} — feature is null only for shape (a) refs that don't
 * resolve against CLASS_FEATURES (see resolveClassFeature()).
 */
function classFeatureRefs(cls) {
	const raw = cls?.classFeatures || [];
	if (raw.some(it => Array.isArray(it))) {
		return raw.flat().filter(Boolean).map(feature => ({
			ref: {name: feature.name, className: feature.className, classSource: feature.classSource, level: feature.level, source: feature.source},
			feature,
		}));
	}
	return raw.map(ref => {
		const uid = typeof ref === "string" ? ref : ref?.classFeature;
		if (!uid) return null;
		const unpacked = DataUtil.class.unpackUidClassFeature(uid);
		if (!unpacked.name) return null;
		return {ref: unpacked, feature: resolveClassFeature(unpacked)};
	}).filter(Boolean);
}

/** Levels at which a class grants an Ability Score Improvement (or feat, at the player's choice) —
 * derived from the real classFeature data instead of the standard-array assumption of 4/8/12/16/19,
 * so a class with bonus ASIs (Fighter: extra at 6 and 14; Rogue: extra at 10) picks those up for
 * free. Sorted ascending, deduped. */
function classAsiLevels(cls) {
	if (!cls) return [];
	const levels = classFeatureRefs(cls)
		.filter(({ref}) => ref?.name && /^ability score improvement/i.test(ref.name))
		.map(({ref}) => ref.level)
		.filter(lvl => typeof lvl === "number");
	return [...new Set(levels)].sort((a, b) => a - b);
}

/** The feats actually granted so far, derived from char.levelAsi slots set to type "feat" —
 * levelAsi (keyed by class level) is the single source of truth; nothing else stores feats
 * separately anymore. */
function chosenFeats(char) {
	return Object.values(char.levelAsi || {})
		.filter(slot => slot && slot.type === "feat" && slot.feat)
		.map(slot => slot.feat);
}

/** Sums the ability bonuses from every levelAsi slot set to type "asi". Per the actual level-up
 * ASI rule (distinct from the species/background +2/+1-or-+1/+1/+1 shape): either +2 to one
 * ability, or +1 each to two different abilities — never both a +2 and a +1 in the same slot.
 * Pass excludeLevel to omit one slot's own contribution — used to figure out whether picking a
 * bonus for that slot would push an ability past 20. */
function levelAsiBonus(char, excludeLevel = null) {
	const r = {};
	Object.entries(char.levelAsi || {}).forEach(([lvl, slot]) => {
		if (excludeLevel != null && String(lvl) === String(excludeLevel)) return;
		if (!slot || slot.type !== "asi" || !slot.asi) return;
		const v = slot.asi;
		if (v.mode === "plus1x2") {
			new Set((v.abilities || []).slice(0, 2)).forEach(a => { r[a] = (r[a] || 0) + 1; });
		} else if (v.ability) {
			r[v.ability] = (r[v.ability] || 0) + 2;
		}
	});
	return r;
}

/** Same idea as classFeatureRefs, for a subclass's subclassFeatures array. Shape (b) here is a
 * compact list (only levels with features present, ascending) rather than a level-indexed slot
 * array, but is still "elements are arrays of feature objects" — same detection applies. */
function subclassFeatureRefs(sc) {
	const raw = sc?.subclassFeatures || [];
	if (raw.some(it => Array.isArray(it))) {
		return raw.flat().filter(Boolean).map(feature => ({
			ref: {name: feature.name, className: feature.className, classSource: feature.classSource, subclassShortName: feature.subclassShortName, subclassSource: feature.subclassSource, level: feature.level, source: feature.source},
			feature,
		}));
	}
	return raw.map(ref => {
		const uid = typeof ref === "string" ? ref : ref?.subclassFeature;
		if (!uid) return null;
		const unpacked = DataUtil.class.unpackUidSubclassFeature(uid);
		if (!unpacked.name) return null;
		return {ref: unpacked, feature: resolveSubclassFeature(unpacked)};
	}).filter(Boolean);
}

/** A real class's skill-choice block — startingProficiencies.skills[0] is either {any: N} (e.g. Bard)
 * or {choose: {from: [...lowercase skill keys], count: N}}. Resolves to display-cased skill names. */
function classSkillChoice(cls) {
	const entry = (cls?.startingProficiencies?.skills || [])[0];
	if (!entry) return {count: 0, names: []};
	if (entry.any != null) return {count: entry.any, names: ALL_SKILLS.map(s => s.name)};
	if (entry.choose) {
		const names = (entry.choose.from || []).map(k => ALL_SKILLS.find(s => s.name.toLowerCase() === k.toLowerCase())?.name || k);
		return {count: entry.choose.count || 1, names};
	}
	return {count: 0, names: []};
}

/**
 * The entity that actually grants spellcasting for the current build: the class itself if it has
 * its own `spellcastingAbility` (Bard/Cleric/.../Wizard), otherwise the chosen subclass if *it*
 * grants spellcasting to an otherwise non-caster class (Fighter's Eldritch Knight, Rogue's Arcane
 * Trickster, etc. — these carry their own spellcastingAbility/casterProgression/cantripProgression/
 * spellsKnownProgression fields, same shape as a class). Multiclassing isn't modeled — a subclass
 * only ever contributes spellcasting on top of its own already-non-caster parent class.
 */
function spellcastingSource(cls, subclass) {
	if (cls?.spellcastingAbility) return cls;
	if (subclass?.spellcastingAbility) return subclass;
	return null;
}

/** Cantrips known at a given character level, from the real per-level cantripProgression array. */
function cantripsKnownCount(src, level) {
	if (!src?.cantripProgression?.length) return 0;
	return src.cantripProgression[Math.min(level, src.cantripProgression.length) - 1] || 0;
}

/**
 * Evaluates a 5etools prepared-spells formula string (e.g. "<$level$> + <$int_mod$>") against a
 * character level + spellcasting ability modifier. Used by PHB'14-style prepared casters
 * (Cleric/Druid/Paladin/Wizard); 2024 (XPHB) classes give this as a flat preparedSpellsProgression
 * array instead (handled directly in spellsKnownOrPreparedCount below).
 */
function evalPreparedFormula(formula, level, mod) {
	if (!formula) return null;
	const expr = formula.replace(/<\$level\$>/g, level).replace(/<\$[a-z]+_mod\$>/g, mod);
	try {
		// eslint-disable-next-line no-new-func
		return Math.max(1, Math.floor(Function(`"use strict";return (${expr});`)()));
	} catch (err) {
		return null;
	}
}

/** How many non-cantrip spells this character can know/prepare at once, from real class data. */
function spellsKnownOrPreparedCount(src, level, mod) {
	if (!src) return 0;
	if (src.preparedSpellsProgression?.length) return src.preparedSpellsProgression[Math.min(level, src.preparedSpellsProgression.length) - 1] || 0;
	if (src.spellsKnownProgression?.length) return src.spellsKnownProgression[Math.min(level, src.spellsKnownProgression.length) - 1] || 0;
	if (src.preparedSpells) {
		const val = evalPreparedFormula(src.preparedSpells, level, mod);
		if (val != null) return val;
	}
	if (src.spellsKnownProgressionFixed?.length) return src.spellsKnownProgressionFixed[Math.min(level, src.spellsKnownProgressionFixed.length) - 1] || 0;
	return 0;
}

/**
 * Highest spell level castable at a given character level, read from the real "Spell Slots per
 * Spell Level" table (classTableGroups/subclassTableGroups → rowsSpellProgression). Warlock's
 * Pact Magic uses a different table shape (a single "Slot Level" column instead of a per-level
 * array) — handled as a fallback by parsing the `level=N` filter tag out of that column's cell.
 */
function maxSpellLevel(src, level) {
	const groups = src?.classTableGroups || src?.subclassTableGroups || [];
	const progGroup = groups.find(g => g.rowsSpellProgression?.length);
	if (progGroup) {
		const row = progGroup.rowsSpellProgression[Math.min(level, progGroup.rowsSpellProgression.length) - 1] || [];
		for (let i = row.length - 1; i >= 0; i--) if (row[i] > 0) return i + 1;
		return 0;
	}
	const slotLevelGroup = groups.find(g => (g.colLabels || []).some(l => /slot level/i.test(l)));
	if (slotLevelGroup) {
		const colIdx = slotLevelGroup.colLabels.findIndex(l => /slot level/i.test(l));
		const row = slotLevelGroup.rows[Math.min(level, slotLevelGroup.rows.length) - 1];
		const m = typeof row?.[colIdx] === "string" && row[colIdx].match(/level=(\d+)/);
		if (m) return Number(m[1]);
	}
	return src?.spellcastingAbility ? 1 : 0;
}

/**
 * Spells available to pick from for this class/subclass combo — the class's own list
 * (`sp.classes.fromClassList`) plus, if a subclass is chosen, anything it grants
 * (`sp.classes.fromSubclass`, which covers both "always prepared" domain/circle/oath-style bonus
 * spells and full borrowed-list access like Eldritch Knight/Arcane Trickster). Domain-style spells
 * are surfaced as pickable rather than auto-granted-and-free, matching this builder's existing
 * simplified pick-from-a-list approach elsewhere (e.g. class features are listed, not mechanically
 * enforced).
 */
function spellsAvailable(cls, subclass) {
	if (!cls) return [];
	return SPELLS.filter(sp => {
		if ((sp.classes?.fromClassList || []).some(c => c.name === cls.name && c.source === cls.source)) return true;
		if (!subclass) return false;
		return (sp.classes?.fromSubclass || []).some(fs => fs.class.name === cls.name && fs.class.source === cls.source && fs.subclass.name === subclass.name && fs.subclass.source === subclass.source);
	});
}

function findSpell(name, source) { return SPELLS.find(sp => sp.name === name && sp.source === source); }

/** Groups a character's chosen spells (stored as {name, source}) into cantrips vs. leveled spells,
 * resolving each back to its real spell object via findSpell() for display (name, level, entries). */
function chosenSpellsByTier(char) {
	const resolved = char.spells.map(cs => findSpell(cs.name, cs.source)).filter(Boolean);
	return {
		cantrips: resolved.filter(sp => sp.level === 0),
		leveled: resolved.filter(sp => sp.level >= 1).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)),
	};
}

/**
 * Open ModalFilterClasses restricted to picking a class only. isSubclassDisabled prevents
 * *selecting* a subclass row, but the modal always renders subclass rows in its list (there's
 * no constructor/call option to omit them) — so we also hide them via the same list.setFnSearch()
 * hook the modal uses internally when scoping to one class. That has to happen *after*
 * pGetUserSelection()'s own setup finishes (it unconditionally resets fnSearch to null when no
 * selectedClass is given), hence the deferred call.
 */
function pGetClassOnlySelection() {
	const promise = modalFilterClasses.pGetUserSelection({isSubclassDisabled: true});
	setTimeout(() => {
		const list = modalFilterClasses._filterCache?.list;
		if (!list) return;
		list.setFnSearch((li, searchTerm) => li.data.ixSubclass == null && List.isVisibleDefaultSearch(li, searchTerm));
		list.update();
	}, 0);
	return promise;
}

const EQUIPMENT_TYPE_LABELS = {
	instrumentMusical: "a musical instrument (your choice)",
	setGaming: "a gaming set (your choice)",
	toolArtisan: "a set of artisan's tools (your choice)",
	weaponMartial: "a martial weapon (your choice)",
	weaponMartialMelee: "a martial melee weapon (your choice)",
	weaponSimple: "a simple weapon (your choice)",
	weaponSimpleMelee: "a simple melee weapon (your choice)",
	focusSpellcastingArcane: "an arcane focus (your choice)",
	focusSpellcastingDruidic: "a druidic focus (your choice)",
	focusSpellcastingHoly: "a holy symbol (your choice)",
};

/** Best-effort human-readable label for one real startingEquipment item entry (or a whole bundled
 * array of them, joined with " + " — see equipItemParts() for the unjoined, one-part-per-item
 * version used to build individually-describable pills). */
function equipItemLabel(it) {
	if (typeof it === "string") return it.split("|")[0];
	if (Array.isArray(it)) return it.map(equipItemLabel).join(" + ");
	if (it && typeof it === "object") {
		if (it.displayName) return it.displayName;
		if (it.equipmentType) return (it.quantity ? `${it.quantity} ` : "") + (EQUIPMENT_TYPE_LABELS[it.equipmentType] || `${it.equipmentType} (your choice)`);
		if (it.special) {
			const worth = it.worthValue != null ? ` (worth ${it.worthValue / 100} gp)` : "";
			return (it.quantity ? `${it.quantity} ` : "") + it.special + worth;
		}
		if (it.containsValue != null) return `pouch containing ${it.containsValue / 100} gp`;
		if (it.item) return (it.quantity ? `${it.quantity} ` : "") + it.item.split("|")[0];
		if (typeof it.value === "number") return `${it.value / 100} gp`;
	}
	return String(it);
}

/** Pulls a {name, source} ref out of one real (non-array) startingEquipment item entry — the
 * `item` field (or the bare string itself) is a "Name|SOURCE" uid pointing at a real catalog
 * item; anything else (an equipmentType choice, gold, flavor-only `special` text) has no single
 * real item behind it, so this returns null. Feeds resolveItemRef() — see equipItemParts(). */
function equipItemRef(it) {
	const uid = typeof it === "string" ? it : (it && typeof it === "object" ? it.item : null);
	if (typeof uid !== "string" || !uid) return null;
	const [name, source] = uid.split("|");
	if (!name) return null;
	return {name, source: source || undefined};
}

/** Whether a resolved item should start equipped by default when its part is first added to
 * char.equipment (see equipItemParts()) — armor, shields, and weapons auto-equip so the Sheet
 * shows correct starting AC immediately; everything else (rope, a tinderbox, a holy symbol)
 * starts unequipped. The player can still toggle either way afterward on the Sheet step. */
function defaultEquipped(ref) {
	const item = ref ? resolveItemRef(ref) : null;
	if (!item) return false;
	const typeCode = (item.type || "").split("|")[0];
	if (["LA", "MA", "HA", "S"].includes(typeCode)) return true;
	if (item.weaponCategory) return true;
	return false;
}

/**
 * Splits one raw startingEquipment entry into its individually-describable parts: a plain entry
 * is one part, but an array entry (multiple items bundled into a single choice-row option, e.g.
 * "a martial weapon (your choice) + a shield") becomes one part per array element, each carrying
 * its own {label, ref, equipped} — so a bundle picked as a single option can still show one
 * expandable, individually-toggleable pill per real item inside it, rather than one pill for the
 * whole bundle. See equipmentChoiceSets() (builds these into char.equipment entries) and the
 * Sheet step's equipment pill list (flattens every entry's parts into the final pill row).
 */
function equipItemParts(it) {
	if (Array.isArray(it)) return it.flatMap(equipItemParts);
	const ref = equipItemRef(it);
	return [{label: equipItemLabel(it), ref, equipped: defaultEquipped(ref)}];
}

/** Renders one char.equipment entry's label safely — normally already a plain string (entry.label),
 * but this guards against anything else ending up there (e.g. a pre-refactor save's bare
 * string/object entries not yet run through migrateEquipment()), so the sheet never shows a raw
 * [object Object]. */
function safeEquipTag(e) {
	if (typeof e === "string") return e;
	if (e && typeof e === "object" && typeof e.label === "string") return e.label;
	return equipItemLabel(e);
}

/**
 * Splits a real "startingEquipment" sets array into unconditional items (an "_" set) and choice
 * rows (sets with lettered options like {a: [...], b: [...]}). Each item — fixed or one option in
 * a choice row — becomes a {label, parts} entry: `label` is the composed display string (also the
 * identity used for selection equality throughout the Equipment step, same role the bare string
 * played before this was refactored to carry real item refs), `parts` is its equipItemParts()
 * breakdown for the Sheet step's per-item expandable pills. Used for both a background's
 * `startingEquipment` and a class's `startingEquipment.defaultData` — both use the same
 * {_, a, b, ...} set-array schema.
 */
function equipmentChoiceSets(sets) {
	const fixed = [];
	const choiceRows = [];
	(sets || []).forEach(set => {
		if (!set || typeof set !== "object") return;
		if (Array.isArray(set._)) fixed.push(...set._.map(it => ({label: equipItemLabel(it), parts: equipItemParts(it)})));
		const optionKeys = Object.keys(set).filter(k => k !== "_");
		if (optionKeys.length) {
			choiceRows.push(optionKeys.map(k => {
				const arr = set[k] || [];
				return {label: arr.map(equipItemLabel).join(" + "), parts: arr.flatMap(equipItemParts)};
			}));
		}
	});
	return {fixed, choiceRows};
}

/**
 * Migrates a loaded save's char.equipment to the current {label, parts} entry shape (see
 * equipmentChoiceSets()) — older saves (pre item-description refactor) stored plain display
 * strings with no recoverable item ref, so those become a single static (ref: null) part; entries
 * already in the new shape pass through unchanged. Called from importJSON().
 *
 * v5: parts gained `equipped` (see equipItemParts()) — a save from before that defaults each part
 * to defaultEquipped()'s own armor/shield/weapon-type heuristic (matching what a fresh pick would
 * get) rather than leaving every previously-saved item unequipped.
 */
function migrateEquipment(equipment) {
	if (!Array.isArray(equipment)) return [];
	return equipment.map(e => {
		if (e && typeof e === "object" && typeof e.label === "string" && Array.isArray(e.parts)) {
			return {...e, parts: e.parts.map(p => p.equipped === undefined ? {...p, equipped: defaultEquipped(p.ref)} : p)};
		}
		const label = typeof e === "string" ? e : equipItemLabel(e);
		return {label, parts: [{label, ref: null, equipped: false}]};
	});
}

/** Upgrades a pre-ASI-slot save (flat char.feats array, no char.levelAsi) to the new per-level-slot
 * shape: assigns each old feat to the earliest empty class ASI slot, in order. Needs the character's
 * class already resolved (loadedChar.cls) to know the slot levels — if that's missing (or there
 * simply aren't enough slots for every old feat), leftover feats are dropped rather than guessed at,
 * since there's no level info in the old save to place them correctly. No-ops if levelAsi is
 * already present (current-format save). */
function migrateLevelAsi(loadedChar) {
	if (loadedChar.levelAsi && typeof loadedChar.levelAsi === "object") return loadedChar.levelAsi;
	const oldFeats = Array.isArray(loadedChar.feats) ? loadedChar.feats : [];
	const slots = classAsiLevels(loadedChar.cls).filter(lvl => lvl <= (loadedChar.level || 1));
	const levelAsi = {};
	oldFeats.slice(0, slots.length).forEach((feat, i) => {
		levelAsi[slots[i]] = {type: "feat", feat: {name: feat.name, source: feat.source}, asi: null};
	});
	return levelAsi;
}

/** Upgrades a pre-play-tracker save (no char.play at all) to carry the current default session
 * state — old saves simply have nothing to track yet, so this is a pure default-fill rather than
 * a data transform. A save that already has a (possibly partial) char.play is merged over the
 * defaults so a save from an older play-tracker version picks up any fields added since. */
function migratePlay(loadedChar) {
	const empty = EMPTY_CHAR().play;
	if (!loadedChar.play || typeof loadedChar.play !== "object") return empty;
	return {
		...empty, ...loadedChar.play,
		slotsUsed: {...loadedChar.play.slotsUsed},
		resourcesUsed: {...loadedChar.play.resourcesUsed},
		itemCharges: {...loadedChar.play.itemCharges},
		deathSaves: {...empty.deathSaves, ...loadedChar.play.deathSaves},
	};
}

function findFeat(name, source) { return FEATS.find(f => f.name === name && f.source === source); }

/** The background's "Feature: X" entry, e.g. {name: "Feature: Shelter of the Faithful", entries: [...]}. */
function backgroundFeature(bg) {
	return namedSubEntries(bg?.entries).find(e => e.data?.isFeature) || null;
}

/**
 * ModalFilter*.pGetUserSelection() resolves to ListItem instances (used for the modal's own
 * list rendering) rather than the raw data objects — they carry `.name` and `.values.sourceJson`
 * but none of the actual schema fields. Look the real entity back up in our already-loaded array,
 * matching statgen's own `selected[0].values.sourceJson` pattern (see statgen-ui-comp-levelone-entitybase.js).
 */
function resolveModalSelection(listItem, dataArray) {
	if (!listItem) return null;
	return dataArray.find(it => it.name === listItem.name && it.source === listItem.values?.sourceJson) || null;
}

function srcBadge(src) {
	let full = src, abv = src;
	try { full = Parser.sourceJsonToFull(src); abv = Parser.sourceJsonToAbv(src); } catch (err) { /* Parser not ready yet — fall back to raw source string */ }
	return `<span class="cb__src-badge" title="${esc(full)}">${esc(abv)}</span>`;
}

// ─── STATE ───────────────────────────────────────────────────────────────────
const EMPTY_CHAR = () => ({
	name: "", level: 1, race: null, cls: null, subclass: null, background: null,
	abilityMode: "standard",
	standardAssign: {str:null,dex:null,con:null,int:null,wis:null,cha:null},
	pointBuy: {str:8,dex:8,con:8,int:8,wis:8,cha:8},
	manual: {str:10,dex:10,con:10,int:10,wis:10,cha:10},
	skills: [], equipment: [], spells: [], racialAsiChoice: [],
	racialAsiVrgr: {mode: "2-1", high: null, low: null, triple: []},
	bgAsi: {mode: "2-1", high: null, low: null, triple: []},
	// Per-level-4/8/12/16/19(+class extras, e.g. Fighter 6/14, Rogue 10) ASI slots — see
	// classAsiLevels(). Keyed by level (string, since object keys are always strings):
	// {type: "feat"|"asi"|null, feat: {name,source}|null, asi: {mode: "plus2"|"plus1x2", ability, abilities}|null}.
	levelAsi: {},
	// Session/play-mode tracking (see renderPlayCard()) — everything needed to run this character
	// at the table without leaving the sheet. hpCurrent: null means "undamaged, follows computed
	// max"; once set it's an absolute number, clamped to computed max on read (see CB.hpCurrent()),
	// so a level-up/re-spec that changes max HP doesn't strand it above the new max. slotsUsed is
	// keyed by spell level (string, e.g. "1".."9") -> number of that level's slots expended.
	// resourcesUsed is keyed by classResourceDefs()'s def.key -> number of uses expended.
	// itemCharges is keyed by "<equipment entry index>:<part index>" (see toggleEquipped()) ->
	// number of that item's charges expended — see chargeItemDefs() for which equipped items get
	// a tracker row and how their max/recharge is read from native charges/recharge/rechargeAmount.
	// rulesOverride: null follows the site's global Classic/Modern switcher (see
	// activeRulesEdition()); "classic"|"one" pins this character to one ruleset regardless.
	play: {
		hpCurrent: null, hpTemp: 0,
		hitDiceUsed: 0,
		slotsUsed: {}, pactSlotsUsed: 0,
		resourcesUsed: {},
		itemCharges: {},
		inspiration: false, exhaustion: 0,
		deathSaves: {success: 0, fail: 0},
		rulesOverride: null,
	},
});

// ─── REAL DATA LOADING ─────────────────────────────────────────────────────
// Mirrors StatGenPage.pInit()/_pLoadRaces()/_pLoadBackgrounds()/_pLoadFeats() in js/statgen.js —
// loads everything (site + prerelease + brew) upfront rather than lazily, per project preference.
let modalFilterRaces = null;
let modalFilterBackgrounds = null;
let modalFilterFeats = null;
let modalFilterClasses = null;
let modalFilterSpells = null;

async function pLoadAllFiltered(page, entityType) {
	const all = [
		...(await DataLoader.pCacheAndGetAllSite(page)),
		...(await DataLoader.pCacheAndGetAllPrerelease(page)),
		...(await DataLoader.pCacheAndGetAllBrew(page)),
	];
	return all.filter(it => {
		const hash = UrlUtil.URL_TO_HASH_BUILDER[page](it);
		return !ExcludeUtil.isExcluded(hash, entityType, it.source);
	});
}

/**
 * Same shape as pLoadAllFiltered(), but for items specifically: uses Renderer.item.isExcluded()
 * rather than a plain ExcludeUtil.isExcluded(hash, "item", source) check, since items need the
 * extra base-item/generic-variant/specific-variant exclusion handling that helper already
 * encapsulates (the same one the site's own Items browse page uses) — see js/render.js.
 */
async function pLoadAllItems() {
	const all = [
		...(await DataLoader.pCacheAndGetAllSite(UrlUtil.PG_ITEMS)),
		...(await DataLoader.pCacheAndGetAllPrerelease(UrlUtil.PG_ITEMS)),
		...(await DataLoader.pCacheAndGetAllBrew(UrlUtil.PG_ITEMS)),
	];
	return all.filter(it => !Renderer.item.isExcluded(it));
}

/**
 * Indexes ITEMS for resolveItemRef(): itemLookupExact is keyed "name|source" (both lowercased)
 * for an exact match; itemLookupByName is keyed by name alone, holding every source that item
 * name appears under, for refs with no source (see equipItemRef()) or whose exact source didn't
 * load (e.g. an older save file's entries migrated without one — see migrateEquipment()).
 */
function buildItemLookup() {
	itemLookupExact = new Map();
	itemLookupByName = new Map();
	ITEMS.forEach(it => {
		if (!it?.name) return;
		const nameKey = it.name.toLowerCase();
		itemLookupExact.set(`${nameKey}|${(it.source || "").toLowerCase()}`, it);
		if (!itemLookupByName.has(nameKey)) itemLookupByName.set(nameKey, []);
		itemLookupByName.get(nameKey).push(it);
	});
}

/**
 * Resolves a {name, source} ref (see equipItemRef()) to a real loaded item: an exact name+source
 * match if we have one, otherwise the name's loaded sources sorted alphabetically and the first
 * taken — a deterministic but fairly arbitrary tie-break, since we don't have a real "preferred
 * source" ranking here. Only matters for refs with no source or whose source isn't loaded (mainly
 * legacy-format equipment migrated by migrateEquipment(), which can't recover a source at all).
 * Returns null if nothing matches.
 */
function resolveItemRef(ref) {
	if (!ref?.name) return null;
	const nameKey = ref.name.toLowerCase();
	if (ref.source) {
		const exact = itemLookupExact.get(`${nameKey}|${ref.source.toLowerCase()}`);
		if (exact) return exact;
	}
	const candidates = itemLookupByName.get(nameKey);
	if (!candidates?.length) return null;
	return candidates.slice().sort((a, b) => (a.source || "").localeCompare(b.source || ""))[0];
}

/**
 * Loads the Tier 2 Foundry-VTT effect overlay files directly (they're plain static JSON, not
 * registered with DataLoader as a page/prop the way class/race/feat/item/spell data is — so this
 * is a bare fetch via the same DataUtil.loadJSON() helper the framework itself uses for its own
 * one-off generated-data files, e.g. SourceUtil's subclass-reprint lookup). Each file indexes by
 * name+source (items/feats) or the same classFeatureKey()/subclassFeatureKey() the native feature
 * lookups already use. Missing/unreachable files degrade to an empty index rather than failing
 * character-creator startup — Tier 2 is a supplement, not a requirement.
 */
async function loadFoundryEffectData() {
	const base = Renderer.get().baseUrl;
	const indexBy = (arr, keyFn) => {
		const m = new Map();
		(arr || []).forEach(it => { const k = keyFn(it); if (k) m.set(k, it); });
		return m;
	};
	const [fItems, fFeats, fClass] = await Promise.all([
		DataUtil.loadJSON(`${base}data/foundry-items.json`).catch(() => ({item: []})),
		DataUtil.loadJSON(`${base}data/foundry-feats.json`).catch(() => ({feat: []})),
		DataUtil.loadJSON(`${base}data/class/foundry.json`).catch(() => ({classFeature: [], subclassFeature: []})),
	]);
	FOUNDRY_ITEMS = indexBy(fItems.item, it => it.name && `${it.name.toLowerCase()}|${(it.source || "").toLowerCase()}`);
	FOUNDRY_FEATS = indexBy(fFeats.feat, it => it.name && `${it.name.toLowerCase()}|${(it.source || "").toLowerCase()}`);
	FOUNDRY_CLASS_FEATURES = indexBy(fClass.classFeature, it => it.name && classFeatureKey(it.name, it.className, it.level, it.source || it.classSource));
	FOUNDRY_SUBCLASS_FEATURES = indexBy(fClass.subclassFeature, it => it.name && subclassFeatureKey(it.name, it.className, it.subclassShortName, it.level, it.source || it.subclassSource));
}

async function loadRuleData() {
	await Promise.all([
		PrereleaseUtil.pInit(),
		BrewUtil2.pInit(),
	]);
	await ExcludeUtil.pInitialise();

	// Note: statgen.js also runs UtilsEntityRace.mutMigrateForVersion/UtilsEntityBackground's
	// equivalent here, which strips legacy ability scores under the 2024-rules site style.
	// Left out for now to keep this pass focused on the ModalFilter wiring itself — races/
	// backgrounds will show their as-published data regardless of the site's style switcher.
	const [rawClasses, rawSubclasses] = await Promise.all([
		pLoadAllFiltered("class", "class"),
		pLoadAllFiltered("subclass", "subclass"),
	]);

	// classFeature/subclassFeature are their own registered DataLoader page/prop (see
	// DataTypeLoaderCustomClassSubclassFeature in js/utils-dataloader/utils-dataloader-dataloader.js)
	// separate from "class"/"subclass" — these carry the full feature entities (entries included),
	// vs. the uid refs embedded in cls.classFeatures/sc.subclassFeatures. Loaded in parallel with
	// everything else below; resolveClassFeature()/resolveSubclassFeature() do the name/level/source
	// lookup from a ref back to one of these once buildFeatureLookups() indexes them.
	[RACES, BACKGROUNDS, FEATS, SPELLS, CLASS_FEATURES, SUBCLASS_FEATURES, ITEMS] = await Promise.all([
		pLoadAllFiltered(UrlUtil.PG_RACES, "race"),
		pLoadAllFiltered(UrlUtil.PG_BACKGROUNDS, "background"),
		pLoadAllFiltered(UrlUtil.PG_FEATS, "feat"),
		pLoadAllFiltered(UrlUtil.PG_SPELLS, "spell"),
		pLoadAllFiltered("classFeature", "classFeature"),
		pLoadAllFiltered("subclassFeature", "subclassFeature"),
		pLoadAllItems(),
	]);
	buildFeatureLookups();
	buildItemLookup();
	buildToolOptions();
	await loadFoundryEffectData();

	// Merge subclasses onto their parent classes (cls.subclasses[]) using the framework's own
	// logic — the same static helper ModalFilterClasses uses internally when it loads its own
	// data, so this stays byte-for-byte consistent with how the rest of the site handles it.
	const mergedClassData = await ModalFilterClasses.pPostLoad({class: rawClasses, subclass: rawSubclasses});
	CLASSES = mergedClassData.class;

	modalFilterRaces = new ModalFilterRaces({namespace: "charactercreator.races", isRadio: true, allData: RACES});
	modalFilterBackgrounds = new ModalFilterBackgrounds({namespace: "charactercreator.backgrounds", isRadio: true, allData: BACKGROUNDS});
	modalFilterFeats = new ModalFilterFeats({namespace: "charactercreator.feats", isRadio: true, allData: FEATS});
	// No isRadio here — ModalFilterClasses handles class+subclass single-select internally,
	// and we call pGetUserSelection() with isClassDisabled/isSubclassDisabled per step (see
	// renderClass()/renderSubclass()) rather than a blanket radio mode.
	modalFilterClasses = new ModalFilterClasses({namespace: "charactercreator.classes", allData: CLASSES});
	// isRadio here too — same one-at-a-time browse-then-toggle pattern as Feats (see
	// renderSpells()'s cb-spell-browse handler), rather than letting the modal's own
	// multi-select checkboxes bypass our cantrips/spells-known cap tracking.
	modalFilterSpells = new ModalFilterSpells({namespace: "charactercreator.spells", isRadio: true, allData: SPELLS});

	await Promise.all([
		modalFilterRaces.pPopulateHiddenWrapper(),
		modalFilterBackgrounds.pPopulateHiddenWrapper(),
		modalFilterFeats.pPopulateHiddenWrapper(),
		modalFilterClasses.pPreloadHidden(),
		modalFilterSpells.pPopulateHiddenWrapper(),
	]);
}

// ─── EFFECTS ENGINE (mechanical modifiers → live Sheet stats) ─────────────────
// Two data-driven tiers, no curated allowlist for the bulk of it (see project notes for the
// full writeup of what was checked in the real data before this was designed):
//   Tier 1 — native 5etools fields authored directly on the entity: item.bonusAc/ability/resist/
//            modifySpeed/etc., feat.ability/resist/skillProficiencies/etc., and (found while
//            grounding this pass) the *same* feat-shaped fields nested under a class/subclass
//            feature's Tier 2 entryData — see nativeStructuredEffects() below, shared by both.
//   Tier 2 — the Foundry-VTT "Active Effect" overlay (FOUNDRY_ITEMS/FOUNDRY_FEATS/
//            FOUNDRY_CLASS_FEATURES/FOUNDRY_SUBCLASS_FEATURES) — covers grants Tier 1 has no
//            field for at all (Tough's +HP/level, Fast Movement, Brutal Critical, save/skill
//            advantage flags). Values are sometimes plain numbers, sometimes small formula
//            strings like "+(2 * @details.level)" — see evalFoundryValue()/FOUNDRY_KEY_MAP below.
// Every effect, from either tier, normalizes to {source: {type, name}, key, mode, value}.
// collectEffects(char) flattens every equipped item + selected feat + unlocked class/subclass
// feature into a list of these; finalScores() folds the ability.* ones in, derivedCombatStats()
// folds in everything else.
//
// Known, deliberate gaps (flagged rather than silently dropped):
//  - Player-choice proficiency grants with no fixed target (e.g. Resilient's "choose one ability
//    you lack save proficiency in") have nothing to auto-apply *to* without a dedicated picker —
//    out of scope this pass (same category as the granted-spells choose-blocks, but those got a
//    picker per your call; this didn't). These show as a "choose a save/skill" note instead.
//  - A handful of narrower Tier 2 keys (system.magicalBonus, system.damage.*, weapon mastery
//    bonus dice, activities[attack].*) aren't mapped — see FOUNDRY_KEY_MAP's comment. They're
//    real but low-frequency (<20 occurrences total across every source) and mostly duplicate what
//    Tier 1's bonusWeapon/dmg1/dmg2 already covers for the same items.
//  - Barbarian/Monk Unarmored Defense is hand-curated (see UNARMORED_DEFENSE by class name) —
//    Foundry's own data deliberately excludes it (`ignoreSrdEffects`) since it's conditional on
//    "wearing no armor," which their engine handles as a special AC-calc mode rather than a
//    stackable effect. We *can* evaluate that condition here (equipped-state is tracked), so it's
//    worth the one hardcoded exception rather than leaving out a rule this common.

/** Foundry key (dot path) -> {key: normalized key template, mode}. Anything not listed here is a
 * real Tier 2 effect we're choosing not to surface yet (see the gaps note above) rather than one
 * we failed to find. */
const FOUNDRY_KEY_MAP = {
	"system.attributes.ac.bonus": {key: "ac", mode: "add"},
	"system.attributes.hp.bonuses.overall": {key: "hpBonus", mode: "add"},
	"system.attributes.hp.bonuses.level": {key: "hpBonus", mode: "addPerLevel"},
	"system.attributes.movement.walk": {key: "speed.walk", mode: "addOrMultiply"},
	"system.attributes.movement.fly": {key: "speed.fly", mode: "add"},
	"system.attributes.movement.swim": {key: "speed.swim", mode: "add"},
	"system.attributes.movement.climb": {key: "speed.climb", mode: "add"},
	"system.attributes.movement.burrow": {key: "speed.burrow", mode: "add"},
	"system.attributes.init.bonus": {key: "initiativeBonus", mode: "add"},
	"system.bonuses.abilities.save": {key: "saveBonusAll", mode: "add"},
	"system.bonuses.abilities.check": {key: "abilityCheckBonusAll", mode: "add"},
	"system.bonuses.mwak.attack": {key: "attackBonus.mw", mode: "add"},
	"system.bonuses.mwak.damage": {key: "damageBonus.mw", mode: "add"},
	"system.bonuses.rwak.attack": {key: "attackBonus.rw", mode: "add"},
	"system.bonuses.rwak.damage": {key: "damageBonus.rw", mode: "add"},
	"system.bonuses.msak.attack": {key: "attackBonus.ms", mode: "add"},
	"system.bonuses.msak.damage": {key: "damageBonus.ms", mode: "add"},
	"system.bonuses.rsak.attack": {key: "attackBonus.rs", mode: "add"},
	"system.bonuses.rsak.damage": {key: "damageBonus.rs", mode: "add"},
	"system.attributes.senses.darkvision": {key: "sense.darkvision", mode: "max"},
	"system.attributes.senses.blindsight": {key: "sense.blindsight", mode: "max"},
	"system.attributes.senses.truesight": {key: "sense.truesight", mode: "max"},
	"flags.dnd5e.jackOfAllTrades": {key: "flag.jackOfAllTrades", mode: "or"},
	"flags.dnd5e.reliableTalent": {key: "flag.reliableTalent", mode: "or"},
	"flags.dnd5e.initiativeAdv": {key: "advantage.initiative", mode: "or"},
};
// system.abilities.<abl>.value (ADD), .save.roll.mode/.check.roll.mode ("advantage"), and
// system.skills.<skl>.bonuses.check/.roll.mode are handled by pattern match in mapFoundryChange()
// below rather than one static entry per ability/skill.

/** Evaluates one Foundry effect change's `value` against the character. Handles: plain numbers/
 * booleans passed through as-is; the "advantage" roll-mode string; and small arithmetic formula
 * strings (`"+(2 * @details.level)"`, `"+(sign(@attributes.movement.walk) * @scale.monk.
 * unarmored-movement)"`) via token substitution + a guarded eval — safe here because this is our
 * own bundled data file, not user input, and the whitelist regex refuses anything that isn't
 * plain arithmetic before it ever reaches Function(). Returns null (effect skipped) if the
 * formula references something we can't resolve, rather than silently mis-computing. */
function evalFoundryValue(raw, char) {
	if (typeof raw === "number" || typeof raw === "boolean") return raw;
	if (typeof raw !== "string") return null;
	const trimmed = raw.trim();
	if (/^advantage$/i.test(trimmed)) return true;
	if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
	let expr = trimmed.replace(/^\+\s*/, "");
	let unresolved = false;
	expr = expr.replace(/@details\.level/g, () => String(char.level || 0));
	expr = expr.replace(/@scale\.([\w-]+)\.([\w-]+)/g, (_, cls, key) => {
		const v = classScaleValue(char, key);
		if (v == null) { unresolved = true; return "0"; }
		return String(v);
	});
	if (/@/.test(expr)) unresolved = true; // any other @-token isn't one we handle — bail rather than guess
	if (unresolved) return null;
	expr = expr.replace(/\bsign\(/g, "Math.sign(").replace(/\bfloor\(/g, "Math.floor(").replace(/\bceil\(/g, "Math.ceil(").replace(/\babs\(/g, "Math.abs(");
	if (!/^[-+*/().,\s\dMathsigflorceabMAX]*$/.test(expr)) return null; // whitelist guard — only arithmetic + the Math.* calls above should remain
	try { return Function(`"use strict"; return (${expr});`)(); } catch (err) { return null; }
}

/** Best-effort lookup for a `@scale.<class>.<key>` token — searches the character's own class/
 * subclass classTableGroups for a column whose label matches `key` (kebab-case -> space), at the
 * current level, same table shape classResourceDefs()/spellSlotInfo() already scan. Returns null
 * (not 0) when nothing matches, so evalFoundryValue() can tell "resolved to zero" apart from
 * "couldn't find this scale at all" and skip the effect rather than silently apply a wrong 0. */
function classScaleValue(char, scaleKey) {
	const label = scaleKey.replace(/-/g, " ").toLowerCase();
	const scan = entity => {
		for (const tg of entity?.classTableGroups || []) {
			const idx = (tg.colLabels || []).findIndex(l => String(l || "").replace(/\{@filter ([^|]+)\|.*?\}/, "$1").toLowerCase().trim() === label);
			if (idx === -1) continue;
			const row = tg.rows?.[Math.min(char.level, tg.rows.length) - 1];
			const cell = row?.[idx];
			if (cell == null || cell === "") return null;
			if (typeof cell === "object" && cell.type === "dice") return cell.toRoll?.[0]?.number ?? null;
			// Other typed cells (e.g. Monk's Unarmored Movement column uses {type:"bonusSpeed",
			// value:N}) — fall back to a numeric .value if present, rather than only recognizing
			// the "dice" shape.
			if (typeof cell === "object" && typeof cell.value === "number") return cell.value;
			const n = Number(cell);
			return Number.isNaN(n) ? null : n;
		}
		return undefined; // this entity has no matching column at all — caller tries the other one
	};
	const fromClass = scan(char.cls);
	if (fromClass !== undefined) return fromClass;
	const fromSubclass = scan(char.subclass);
	return fromSubclass !== undefined ? fromSubclass : null;
}

/** Foundry dnd5e system's fixed 3-letter skill abbreviations -> full skill name (lowercase, no
 * spaces) matching how ALL_SKILLS/skillBonusOf() key everything else in this file. */
const FOUNDRY_SKILL_ABV = {
	acr: "acrobatics", ani: "animalhandling", arc: "arcana", ath: "athletics", dec: "deception",
	his: "history", ins: "insight", itm: "intimidation", inv: "investigation", med: "medicine",
	nat: "nature", prc: "perception", prf: "performance", per: "persuasion", rel: "religion",
	slt: "sleightofhand", ste: "stealth", sur: "survival",
};

/** Normalizes one Tier 2 `effects[].changes[]` entry to {key, mode, value}, or null if this key
 * isn't one we map (see the gaps note above FOUNDRY_KEY_MAP). Handles the per-ability/per-skill
 * key families that would otherwise need one FOUNDRY_KEY_MAP row each. */
function mapFoundryChange(change, char) {
	const k = change.key;
	let abilityMatch = k.match(/^system\.abilities\.(\w+)\.value$/);
	if (abilityMatch) {
		const val = evalFoundryValue(change.value, char);
		if (val == null) return null;
		return {key: `ability.${abilityMatch[1]}`, mode: change.mode === "OVERRIDE" ? "max" : "add", value: val};
	}
	abilityMatch = k.match(/^system\.abilities\.(\w+)\.save\.roll\.mode$/);
	if (abilityMatch && evalFoundryValue(change.value, char) === true) return {key: `saveAdvantage.${abilityMatch[1]}`, mode: "or", value: true};
	abilityMatch = k.match(/^system\.abilities\.(\w+)\.check\.roll\.mode$/);
	if (abilityMatch && evalFoundryValue(change.value, char) === true) return {key: `abilityCheckAdvantage.${abilityMatch[1]}`, mode: "or", value: true};
	let skillMatch = k.match(/^system\.skills\.(\w+)\.bonuses\.check$/);
	if (skillMatch) {
		const skillName = FOUNDRY_SKILL_ABV[skillMatch[1]];
		if (!skillName) return null; // an abbreviation we don't recognize — skip rather than mis-key it
		const val = evalFoundryValue(change.value, char);
		return val == null ? null : {key: `skillBonus.${skillName}`, mode: "add", value: val};
	}
	skillMatch = k.match(/^system\.skills\.(\w+)\.roll\.mode$/);
	if (skillMatch) {
		const skillName = FOUNDRY_SKILL_ABV[skillMatch[1]];
		if (skillName && evalFoundryValue(change.value, char) === true) return {key: `skillAdvantage.${skillName}`, mode: "or", value: true};
		return null;
	}
	let traitMatch = k.match(/^system\.traits\.(dr|di|ci)\.value$/);
	if (traitMatch && typeof change.value === "string") {
		const bucket = {dr: "resist", di: "immune", ci: "conditionImmune"}[traitMatch[1]];
		return {key: `${bucket}.${change.value.toLowerCase()}`, mode: "or", value: true};
	}
	const mapped = FOUNDRY_KEY_MAP[k];
	if (!mapped) return null;
	const val = evalFoundryValue(change.value, char);
	if (val == null) return null;
	if (mapped.mode === "addPerLevel") return {key: mapped.key, mode: "add", value: val * (char.level || 0)};
	if (mapped.mode === "addOrMultiply") return change.mode === "MULTIPLY" ? {key: mapped.key, mode: "multiply", value: val} : {key: mapped.key, mode: "add", value: val};
	if (mapped.mode === "or") return {key: mapped.key, mode: "or", value: !!val};
	return {key: mapped.key, mode: mapped.mode, value: val};
}

/** Tier 1: reads the native feat-shaped structured fields shared by feats.json entries and a
 * class/subclass feature's Tier 2 `entryData` block (same schema in both places). Only the
 * *fixed* (non player-choice) grants are applied automatically; a `{choose: {...}}` block with
 * no fixed target has nothing to auto-apply to (see the "known gaps" note above) and is skipped. */
function nativeStructuredEffects(entity) {
	const out = [];
	if (!entity) return out;
	// Ability-score grants use two *different* shapes depending on entity type, both real:
	//  - items: entity.ability is a plain OBJECT, `{static: {<abl>: N}}` — N is an absolute score
	//    to set TO if higher than current (Amulet of Health -> CON 19, Gauntlets of Ogre Power ->
	//    STR 19), never additive despite the field being named "static".
	//  - feats / entryData: entity.ability is an ARRAY of `{<abl>: N}` (small, genuinely additive,
	//    e.g. Actor's {cha: 1}) or `{choose: {...}}` (player-choice, no fixed target — skipped,
	//    same "known gap" as the other choose-blocks above; feat ability bumps chosen through the
	//    Feats step's own ASI slots are already applied via the pre-existing levelAsi pathway, not
	//    this engine, so this isn't a functional gap for the common case).
	// Getting this wrong isn't just a wrong number: entity.ability.forEach() on the item (object)
	// shape throws, so this distinction was verified against the real data before shipping.
	if (Array.isArray(entity.ability)) {
		entity.ability.forEach(a => {
			if (!a || typeof a !== "object") return;
			ABILITIES.forEach(abl => { if (typeof a[abl] === "number") out.push({key: `ability.${abl}`, mode: "add", value: a[abl]}); });
		});
	} else if (entity.ability && typeof entity.ability === "object" && entity.ability.static) {
		Object.entries(entity.ability.static).forEach(([abl, v]) => out.push({key: `ability.${abl}`, mode: "max", value: v}));
	}
	const boolMap = (list, keyPrefix) => (list || []).forEach(entry => {
		if (!entry || typeof entry !== "object") return;
		Object.keys(entry).forEach(k => { if (k !== "choose" && entry[k] === true) out.push({key: `${keyPrefix}.${k.toLowerCase()}`, mode: "or", value: true}); });
	});
	boolMap(entity.skillProficiencies, "skillProf");
	boolMap(entity.savingThrowProficiencies, "saveProf");
	boolMap(entity.expertise, "skillExpertise");
	boolMap(entity.weaponProficiencies, "weaponProf");
	boolMap(entity.armorProficiencies, "armorProf");
	boolMap(entity.toolProficiencies, "toolProf");
	boolMap(entity.languageProficiencies, "languageProf");
	(Array.isArray(entity.resist) ? entity.resist : []).forEach(r => { if (typeof r === "string") out.push({key: `resist.${r.toLowerCase()}`, mode: "or", value: true}); });
	(Array.isArray(entity.immune) ? entity.immune : []).forEach(r => { if (typeof r === "string") out.push({key: `immune.${r.toLowerCase()}`, mode: "or", value: true}); });
	(Array.isArray(entity.conditionImmune) ? entity.conditionImmune : []).forEach(r => { if (typeof r === "string") out.push({key: `conditionImmune.${r.toLowerCase()}`, mode: "or", value: true}); });
	if (entity.senses && typeof entity.senses === "object") Object.entries(entity.senses).forEach(([k, v]) => { if (typeof v === "number") out.push({key: `sense.${k.toLowerCase()}`, mode: "max", value: v}); });
	if (typeof entity.bonusAc === "string") { const n = parseInt(entity.bonusAc, 10); if (!Number.isNaN(n)) out.push({key: "ac", mode: "add", value: n}); }
	if (typeof entity.bonusSavingThrow === "string") { const n = parseInt(entity.bonusSavingThrow, 10); if (!Number.isNaN(n)) out.push({key: "saveBonusAll", mode: "add", value: n}); }
	if (typeof entity.bonusWeapon === "string") {
		const n = parseInt(entity.bonusWeapon, 10);
		if (!Number.isNaN(n)) ["attackBonus.mw", "damageBonus.mw", "attackBonus.rw", "damageBonus.rw"].forEach(key => out.push({key, mode: "add", value: n}));
	}
	if (typeof entity.bonusSpellAttack === "string") { const n = parseInt(entity.bonusSpellAttack, 10); if (!Number.isNaN(n)) out.push({key: "spellAttackBonus", mode: "add", value: n}); }
	if (typeof entity.bonusSpellSaveDc === "string") { const n = parseInt(entity.bonusSpellSaveDc, 10); if (!Number.isNaN(n)) out.push({key: "spellSaveDcBonus", mode: "add", value: n}); }
	if (entity.modifySpeed && typeof entity.modifySpeed === "object") {
		if (entity.modifySpeed.static) Object.entries(entity.modifySpeed.static).forEach(([k, v]) => out.push({key: `speed.${k}`, mode: "max", value: v}));
		if (entity.modifySpeed.multiply) Object.entries(entity.modifySpeed.multiply).forEach(([k, v]) => out.push({key: `speed.${k}`, mode: "multiply", value: v}));
	}
	return out;
}

/**
 * Reads the player-choice ("choose") side of the same proficiency fields nativeStructuredEffects()
 * reads the fixed side of — Skilled's "any combination of three skills or tools," Resilient's
 * "choose one saving throw," etc. — and normalizes each into a pickable requirement:
 * {id, label, count, options: [{key, label}]}. `key` in each option is already a fully-formed
 * normalized effect key (e.g. "skillProf.stealth", "toolProf.thievestools") — collectEffects()
 * turns a player's stored picks directly into effects with zero further translation, since the
 * option keys already match the vocabulary it understands.
 * Covers skillProficiencies/savingThrowProficiencies/toolProficiencies/languageProficiencies
 * choose-blocks, and the combined skillToolLanguageProficiencies shape (Skilled: "any 3 of skill
 * or tool"). Entity here is the same feat-shaped object nativeStructuredEffects() takes (a feat
 * itself, or a class/subclass feature's entryData).
 */
function featChoiceRequirements(entity) {
	if (!entity) return [];
	const reqs = [];
	const skillOptions = ALL_SKILLS.map(s => ({key: `skillProf.${s.name.toLowerCase()}`, label: s.name}));
	const toolOptionsFor = from => {
		if (!from || from.some(f => /^any/i.test(f))) return TOOL_OPTIONS;
		return from.map(t => ({key: `toolProf.${String(t).toLowerCase().replace(/[^a-z0-9]+/g, "")}`, label: capitalizeWords(t)}));
	};
	(entity.savingThrowProficiencies || []).forEach((entry, i) => {
		if (!entry?.choose?.from) return;
		reqs.push({id: `save${i}`, label: "Saving Throw Proficiency", count: entry.choose.count || entry.choose.amount || 1, options: entry.choose.from.map(a => ({key: `saveProf.${a}`, label: ABILITY_LABELS[a] || a}))});
	});
	(entity.skillProficiencies || []).forEach((entry, i) => {
		if (!entry?.choose) return;
		const from = entry.choose.from;
		const options = (!from || from.some(f => /^any/i.test(f))) ? skillOptions : from.filter(f => !/^any/i.test(f)).map(s => ({key: `skillProf.${String(s).toLowerCase()}`, label: capitalizeWords(s)}));
		reqs.push({id: `skill${i}`, label: "Skill Proficiency", count: entry.choose.count || entry.choose.amount || 1, options});
	});
	(entity.toolProficiencies || []).forEach((entry, i) => {
		if (!entry?.choose) return;
		reqs.push({id: `tool${i}`, label: "Tool Proficiency", count: entry.choose.count || entry.choose.amount || 1, options: toolOptionsFor(entry.choose.from)});
	});
	(entity.languageProficiencies || []).forEach((entry, i) => {
		if (!entry?.choose) return;
		reqs.push({id: `lang${i}`, label: "Language", count: entry.choose.count || entry.choose.amount || 1, options: LANGUAGE_OPTIONS});
	});
	(entity.skillToolLanguageProficiencies || []).forEach((entry, i) => {
		(entry?.choose || []).forEach((sub, j) => {
			const options = [];
			(sub.from || []).forEach(f => {
				if (f === "anySkill") options.push(...skillOptions);
				else if (f === "anyTool") options.push(...TOOL_OPTIONS);
				else if (f === "anyLanguage") options.push(...LANGUAGE_OPTIONS);
			});
			reqs.push({id: `stl${i}_${j}`, label: "Skill or Tool Proficiency", count: sub.count || sub.amount || 1, options});
		});
	});
	return reqs;
}
function capitalizeWords(s) { return String(s).replace(/\b\w/g, c => c.toUpperCase()); }

/** Tier 2: reads one entity's `effects[].changes[]` (already-resolved Foundry record — see
 * FOUNDRY_ITEMS/FOUNDRY_FEATS/FOUNDRY_CLASS_FEATURES/FOUNDRY_SUBCLASS_FEATURES) through
 * mapFoundryChange(), dropping anything unmapped or unresolvable. */
function foundryTierEffects(foundryEntity, char) {
	if (!foundryEntity?.effects) return [];
	return foundryEntity.effects.flatMap(eff => (eff.changes || []).map(ch => mapFoundryChange(ch, char)).filter(Boolean));
}

// Barbarian/Monk Unarmored Defense — see the "known gaps" note above FOUNDRY_KEY_MAP. The two
// classes' rules text genuinely differs on shields: Barbarian's explicitly stacks with one ("You
// can use a shield and still gain this benefit" — PHB/XPHB), Monk's explicitly excludes one
// ("...aren't wearing armor or wielding a shield" — PHB/XPHB). allowShield encodes that per class
// rather than treating both the same.
const UNARMORED_DEFENSE = {Barbarian: {ability: "con", allowShield: true}, Monk: {ability: "wis", allowShield: false}};
/** Returns {label, ability} if the character has an Unarmored Defense feature unlocked from
 * their class AND the shield rule for that class's version of it is satisfied, else null.
 * Doesn't check "is armor equipped" — derivedCombatStats() does that before calling this (it
 * already resolves equipped items for the AC calc anyway). */
function unarmoredDefenseInfo(char, hasShield) {
	const cfg = UNARMORED_DEFENSE[char.cls?.name];
	if (!cfg || (hasShield && !cfg.allowShield) || !char.cls) return null;
	const has = classFeatureRefs(char.cls).some(f => f.ref.level <= char.level && /^unarmored defense$/i.test(f.ref.name));
	return has ? {label: "Unarmored Defense", ability: cfg.ability} : null;
}

/** One equipped item's full effect list (Tier 1 native fields + Tier 2 Foundry overlay). */
function itemEffects(item, char) {
	if (!item) return [];
	const foundry = FOUNDRY_ITEMS.get(`${item.name.toLowerCase()}|${(item.source || "").toLowerCase()}`);
	return [...nativeStructuredEffects(item), ...foundryTierEffects(foundry, char)];
}
/** One feat's full effect list. */
function featEffects(feat, char) {
	if (!feat) return [];
	const foundry = FOUNDRY_FEATS.get(`${feat.name.toLowerCase()}|${(feat.source || "").toLowerCase()}`);
	return [...nativeStructuredEffects(feat), ...foundryTierEffects(foundry, char)];
}
/** One class/subclass feature's full effect list — Tier 1 here means its Tier 2 file's own
 * `entryData` block (same native-field schema as feats, just carried in the overlay file since
 * the base class/*.json has no mechanical fields at all — see the module comment above). */
function classFeatureEffects(foundryEntity, char) {
	if (!foundryEntity) return [];
	return [...nativeStructuredEffects(foundryEntity.entryData), ...foundryTierEffects(foundryEntity, char)];
}

/** Every equipped item, resolved to its real catalog entity — shared by collectEffects() and the
 * AC calc's armor/shield lookup. */
function equippedResolvedItems(char) {
	return (char.equipment || [])
		.flatMap(entry => entry.parts || [])
		.filter(part => part.equipped && part.ref)
		.map(part => resolveItemRef(part.ref))
		.filter(Boolean);
}

/**
 * Flattens every mechanical effect currently in play for this character: equipped items, all
 * selected feats (chosenFeats() — always-on, no toggle), and every class/subclass feature
 * unlocked at the current level (same `.ref.level <= char.level` filter the Sheet's feature pills
 * already use). This is the single list finalScores() and derivedCombatStats() both fold onto the
 * character's base numbers.
 */
function collectEffects(char) {
	const out = [];
	equippedResolvedItems(char).forEach(item => {
		itemEffects(item, char).forEach(e => out.push({source: {type: "item", name: item.name}, ...e}));
	});
	chosenFeats(char).forEach(fRef => {
		const feat = findFeat(fRef.name, fRef.source);
		featEffects(feat, char).forEach(e => out.push({source: {type: "feat", name: fRef.name}, ...e}));
	});
	// Player-choice proficiency picks (Skilled/Resilient-style) — stored per ASI slot alongside
	// the feat itself (see setFeatChoice()/toggleFeatChoiceOption()); each stored option key is
	// already a normalized effect key (see featChoiceRequirements()), so no further translation
	// is needed here.
	Object.entries(char.levelAsi || {}).forEach(([, slot]) => {
		if (slot?.type !== "feat" || !slot.feat || !slot.featChoice) return;
		Object.values(slot.featChoice).forEach(picked => (picked || []).forEach(key => out.push({source: {type: "feat", name: slot.feat.name}, key, mode: "or", value: true})));
	});
	if (char.cls) {
		classFeatureRefs(char.cls).filter(f => f.ref.level <= char.level).forEach(f => {
			const foundry = FOUNDRY_CLASS_FEATURES.get(classFeatureKey(f.ref.name, f.ref.className, f.ref.level, f.ref.source || f.ref.classSource));
			classFeatureEffects(foundry, char).forEach(e => out.push({source: {type: "classFeature", name: f.ref.name}, ...e}));
		});
	}
	if (char.subclass) {
		subclassFeatureRefs(char.subclass).filter(f => f.ref.level <= char.level).forEach(f => {
			const foundry = FOUNDRY_SUBCLASS_FEATURES.get(subclassFeatureKey(f.ref.name, f.ref.className, f.ref.subclassShortName, f.ref.level, f.ref.source || f.ref.subclassSource));
			classFeatureEffects(foundry, char).forEach(e => out.push({source: {type: "subclassFeature", name: f.ref.name}, ...e}));
		});
	}
	return out;
}

/** Parses a rechargeAmount dice string (e.g. `"{@dice 1d6+4}"`, or occasionally a bare number) to
 * its average value, for the Play Tracker's automatic partial-recharge-on-rest calc — rolling for
 * an exact number isn't worth a dice-roll UI for what's meant to be a quick session tracker. */
function diceAverage(rechargeAmount) {
	if (!rechargeAmount) return null;
	const tagMatch = String(rechargeAmount).match(/\{@dice ([^}|]+)/);
	const expr = tagMatch ? tagMatch[1] : String(rechargeAmount);
	const diceMatch = expr.match(/(\d+)d(\d+)/);
	if (!diceMatch) { const n = Number(expr); return Number.isNaN(n) ? null : n; }
	let avg = Number(diceMatch[1]) * (Number(diceMatch[2]) + 1) / 2;
	const bonusMatch = expr.match(/[+-]\s*\d+\s*$/);
	if (bonusMatch) avg += Number(bonusMatch[0].replace(/\s+/g, ""));
	return Math.round(avg);
}

/**
 * Equipped items with native limited-use charges (items.json's charges/recharge/rechargeAmount —
 * present on 275/2428 items) get a row in the Play Tracker alongside hit dice/spell slots/class
 * resources, per your call to keep consumables in the same card rather than a separate one.
 * Returns [{key, label, max, recharge, rechargeAmount}] — key is the same "<entryIdx>:<partIdx>"
 * address toggleEquipped() already uses for that part, so char.play.itemCharges keys off it
 * directly without a second id scheme.
 */
function chargeItemDefs(char) {
	const out = [];
	(char.equipment || []).forEach((entry, entryIdx) => {
		(entry.parts || []).forEach((part, partIdx) => {
			if (!part.equipped || !part.ref) return;
			const item = resolveItemRef(part.ref);
			if (!item || typeof item.charges !== "number") return;
			out.push({key: `${entryIdx}:${partIdx}`, label: item.name, max: item.charges, recharge: item.recharge || null, rechargeAmount: item.rechargeAmount || null});
		});
	});
	return out;
}
const RECHARGE_LABEL = {dawn: "at dawn", dusk: "at dusk", midnight: "at midnight", restLong: "on a long rest", special: "on a special trigger (reset manually)"};

// ─── GRANTED SPELLS (feat additionalSpells) ────────────────────────────────────
// Scope: feat-granted spells only this pass (Magic Initiate, Fey Touched, Ritual Caster, dragon-
// mark feats, etc. — chosen through the same ASI slots feats already use). Item-granted and
// subclass-domain-spell additionalSpells use the identical schema but aren't wired up yet — an
// explicit trim, not a silent gap: see the project notes on this pass.

/** Parses one `choose` filter-query string (e.g. "level=1|class=Wizard|components & miscellaneous=ritual")
 * into {level, className, ritualOnly, schools}. This is the site's own filter-string format (same
 * idea as the `{@filter ...}` tags seen in class tables), just applied here to a spell list. */
function parseSpellChooseQuery(query) {
	const out = {level: null, className: null, ritualOnly: false, schools: null};
	String(query).split("|").forEach(part => {
		const eq = part.indexOf("=");
		if (eq === -1) return;
		const k = part.slice(0, eq).trim(), v = part.slice(eq + 1).trim();
		if (k === "level") out.level = Number(v);
		else if (k === "class") out.className = v;
		else if (/ritual/i.test(k)) out.ritualOnly = /ritual/i.test(v);
		else if (k === "school") out.schools = v.split(";"); // spell.school is already this same single-letter code (V/E/D/etc.) — no translation needed
	});
	return out;
}
/** Filters the real loaded SPELLS list by one parsed choose-query — class membership reuses
 * sp.classes.fromClassList (name match only, same field the Spells step's own class-spell-list
 * filtering already reads — see spellsAvailableFor()-adjacent code above). */
function spellsForChooseQuery(query) {
	const q = parseSpellChooseQuery(query);
	return SPELLS.filter(sp => {
		if (q.level != null && sp.level !== q.level) return false;
		if (q.className && !(sp.classes?.fromClassList || []).some(c => c.name === q.className)) return false;
		if (q.ritualOnly && !sp.meta?.ritual) return false;
		if (q.schools && !q.schools.includes(sp.school)) return false;
		return true;
	});
}
/** Resolves a plain spell UID string ("misty step", "fog cloud|xphb") — the *fixed*, no-choice
 * side of an additionalSpells block — to the real loaded spell entity. */
function resolveSpellUid(uid) {
	const [namePart, sourcePart] = String(uid).split("|");
	const name = namePart.trim().toLowerCase();
	if (sourcePart) return SPELLS.find(sp => sp.name.toLowerCase() === name && sp.source.toLowerCase() === sourcePart.trim().toLowerCase());
	return SPELLS.find(sp => sp.name.toLowerCase() === name);
}
function unitFromSpellEntry(e, id, mode, freqLabel) {
	if (typeof e === "string") return {id, mode, fixed: e, count: 1, freqLabel};
	return {id, mode, query: e.choose, count: e.count || 1, freqLabel};
}
/**
 * Flattens one additionalSpells array entry (one "flavor" — e.g. Magic Initiate's "Wizard
 * Spells") into flat grant units: {id, mode, query|fixed, count, freqLabel}. `query` needs a
 * picker (spellsForChooseQuery()); `fixed` is a direct UID needing no choice at all.
 * mode is "known" (always known, no slot), "prepared" (always prepared, no slot), or "innate"
 * (castable without a slot at the given frequency — freqLabel is the display text for that).
 * A numeric top-level key (Ritual Caster XPHB's "prepared": {"1":[...], "5":[...], ...}) is
 * treated as a character-level gate — only included once char.level reaches it; "_" and any
 * non-numeric key (the rare dragonmark "s1".."s5" stage keys) are always included, since we don't
 * model feat-repetition staging — a small, explicit simplification, not a silent one.
 * `expanded` blocks (adds to a spell LIST rather than granting an actually-castable spell) are
 * skipped entirely — same reasoning.
 */
function flattenAdditionalSpellsBlock(block, char) {
	const units = [];
	const levelGateOk = key => key === "_" || Number.isNaN(Number(key)) || Number(key) <= (char.level || 0);
	const walkFlat = (obj, mode) => {
		Object.entries(obj || {}).forEach(([key, arr]) => {
			if (!levelGateOk(key)) return;
			(arr || []).forEach((e, i) => units.push(unitFromSpellEntry(e, `${mode}_${key}_${i}`, mode, null)));
		});
	};
	if (block.known) walkFlat(block.known, "known");
	if (block.prepared) walkFlat(block.prepared, "prepared");
	if (block.innate) {
		Object.entries(block.innate).forEach(([levelKey, freqObj]) => {
			if (!levelGateOk(levelKey)) return;
			Object.entries(freqObj || {}).forEach(([freqType, val]) => {
				const freqEntries = Array.isArray(val) ? {"1": val} : val; // "will"/"ritual" are sometimes a flat array (no count subdivision)
				Object.entries(freqEntries || {}).forEach(([freqCount, arr]) => {
					const n = freqCount.replace(/\D/g, "") || "1";
					const freqLabel = freqType === "will" ? "at will" : freqType === "ritual" ? "as a ritual only" : `${n}/${freqType === "daily" ? "day" : "rest"}`;
					(arr || []).forEach((e, i) => units.push(unitFromSpellEntry(e, `innate_${levelKey}_${freqType}_${freqCount}_${i}`, "innate", freqLabel)));
				});
			});
		});
	}
	return units;
}
/** The currently-active additionalSpells "flavor" (array entry) for one ASI slot's feat — the
 * single entry if there's only one, or whichever one the player picked via setFeatSpellFlavor()
 * if the feat offers several (Magic Initiate's per-class options). */
function activeSpellFlavor(feat, slot) {
	const blocks = feat?.additionalSpells;
	if (!blocks?.length) return null;
	if (blocks.length === 1) return blocks[0];
	const flavor = slot.featSpellChoice?.flavor;
	return blocks.find(b => b.name === flavor) || null;
}
/**
 * Every feat-granted spell currently in play, across all ASI slots — fixed grants resolved
 * automatically, choice-based ones resolved from the player's stored picks (setFeatSpellPick()).
 * Used both for the Feats step's own "already granted" summary and the Sheet's Granted Spells
 * block, so the two can never disagree about what's actually active.
 */
function grantedSpellsForChar(char) {
	const out = [];
	Object.entries(char.levelAsi || {}).forEach(([, slot]) => {
		if (slot?.type !== "feat" || !slot.feat) return;
		const feat = findFeat(slot.feat.name, slot.feat.source);
		const activeBlock = activeSpellFlavor(feat, slot);
		if (!activeBlock) return;
		flattenAdditionalSpellsBlock(activeBlock, char).forEach(unit => {
			if (unit.fixed) {
				const sp = resolveSpellUid(unit.fixed);
				if (sp) out.push({spell: sp, mode: unit.mode, freqLabel: unit.freqLabel, sourceFeat: slot.feat.name, unitId: unit.id});
			} else {
				((slot.featSpellChoice?.picks || {})[unit.id] || []).forEach(p => {
					const sp = SPELLS.find(s => s.name === p.name && s.source === p.source);
					if (sp) out.push({spell: sp, mode: unit.mode, freqLabel: unit.freqLabel, sourceFeat: slot.feat.name, unitId: unit.id});
				});
			}
		});
	});
	return out;
}

const CB = {
	step: 0,
	char: EMPTY_CHAR(),
	search: "",
	expandedFeat: null,
	activeAsiSlot: null, // which levelAsi slot's inline feat-picker is currently expanded (Feats step)
	expandedSpell: null,
	spellTab: "cantrips",
	hideUnselectedSpells: false,

	isRuleDataReady: false,

	async init() {
		document.getElementById("cb-nav").addEventListener("click", e => {
			const btn = e.target.closest("[data-step]");
			if (btn) this.setStep(+btn.dataset.step);
		});
		document.getElementById("cb-back").addEventListener("click", () => this.handleBack());
		document.getElementById("cb-next").addEventListener("click", () => this.handleNext());
		document.getElementById("cb-export").addEventListener("click", () => this.exportHTML());
		document.getElementById("cb-reset").addEventListener("click", () => this.handleReset());
		document.getElementById("cb-export-json").addEventListener("click", () => this.exportJSON());
		document.getElementById("cb-import-json").addEventListener("click", () => document.getElementById("cb-import-json-file").click());
		document.getElementById("cb-import-json-file").addEventListener("change", e => this.importJSON(e));

		document.getElementById("cb-step-body").innerHTML = `<p class="cb__placeholder">Loading races, backgrounds, feats, and items from the site's data files…</p>`;
		try {
			await loadRuleData();
			this.isRuleDataReady = true;
		} catch (err) {
			console.error("[charactercreator] Failed to load rule data", err);
			document.getElementById("cb-step-body").innerHTML = `<p class="cb__placeholder">Couldn't load race/background/feat data (${esc(err.message)}). Check the console and try reloading the page.</p>`;
			return;
		}
		this.render();
	},

	upd(k, v) { this.char[k] = v; this.render(); },
	setStep(s) { this.step = s; this.search = ""; this.render(); },
	handleNext() { if (this.canProceed()) { this.step++; this.search = ""; this.render(); } },
	handleBack() { this.step--; this.search = ""; this.render(); },
	handleReset() { this.step = 0; this.char = EMPTY_CHAR(); this.search = ""; this.render(); },

	racialASI() {
		// Real race data's `ability` is an array of objects like [{con: 2}] (fixed) and/or
		// [{choose: {from: [...], count: 1, amount: 1}}] (player choice, picked in the
		// Abilities step and stored in this.char.racialAsiChoice). VRGR-lineage races have no
		// `ability` array at all and use the flexible +2/+1 or +1/+1/+1 rule instead, stored in
		// this.char.racialAsiVrgr.
		const r = {};
		(this.char.race?.ability || []).forEach(entry => {
			if (!entry) return;
			Object.entries(entry).forEach(([k, v]) => {
				if (k === "choose" || typeof v !== "number") return;
				r[k] = (r[k] || 0) + v;
			});
		});
		const choice = raceAbilityChoice(this.char.race);
		if (choice) {
			(this.char.racialAsiChoice || []).slice(0, choice.count).forEach(a => {
				if (choice.from.includes(a)) r[a] = (r[a] || 0) + choice.amount;
			});
		}
		if (isFlexibleLineageRace(this.char.race)) {
			const v = this.char.racialAsiVrgr || {};
			if (v.mode === "1-1-1") {
				new Set((v.triple || []).slice(0, 3)).forEach(a => { r[a] = (r[a] || 0) + 1; });
			} else {
				if (v.high) r[v.high] = (r[v.high] || 0) + 2;
				if (v.low && v.low !== v.high) r[v.low] = (r[v.low] || 0) + 1;
			}
		}
		return r;
	},
	/** True only when this background actually has an ability bonus AND the current race doesn't
	 * already grant one — a race's bonus always wins if both are present. */
	canUseBackgroundASI() { return !!bgAbilityChoice(this.char.background) && !raceGrantsAbilityBonus(this.char.race); },
	backgroundASI() {
		const r = {};
		if (!this.canUseBackgroundASI()) return r;
		const v = this.char.bgAsi || {};
		if (v.mode === "1-1-1") {
			new Set((v.triple || []).slice(0, 3)).forEach(a => { r[a] = (r[a] || 0) + 1; });
		} else {
			if (v.high) r[v.high] = (r[v.high] || 0) + 2;
			if (v.low && v.low !== v.high) r[v.low] = (r[v.low] || 0) + 1;
		}
		return r;
	},
	// Pass excludeAsiLevel to leave one levelAsi slot's own bonus out of the total — used by the
	// Feats step to check "would this ability already be at/above 20 without this slot's pick".
	finalScores(excludeAsiLevel = null) {
		const racial = this.racialASI();
		const bgAsi = this.backgroundASI();
		const lvlAsi = levelAsiBonus(this.char, excludeAsiLevel);
		let b;
		if (this.char.abilityMode === "standard") {
			b = {str:10,dex:10,con:10,int:10,wis:10,cha:10};
			ABILITIES.forEach(a => { if (this.char.standardAssign[a] !== null) b[a] = this.char.standardAssign[a]; });
		} else if (this.char.abilityMode === "pointbuy") {
			b = {...this.char.pointBuy};
		} else {
			b = {...this.char.manual};
		}
		ABILITIES.forEach(a => { b[a] = (b[a] || 10) + (racial[a] || 0) + (bgAsi[a] || 0) + (lvlAsi[a] || 0); });
		// Fold in item/feat/class-or-subclass-feature ability-score effects (Amulet of Health's
		// set-to-19 CON, Primal Champion's +4 STR/CON, etc.) — see collectEffects() in the EFFECTS
		// ENGINE section. Doesn't depend on ability scores itself, so it's safe to layer on last.
		const abilityEffects = collectEffects(this.char).filter(e => e.key.startsWith("ability."));
		ABILITIES.forEach(a => {
			const forAbl = abilityEffects.filter(e => e.key === `ability.${a}`);
			const add = forAbl.filter(e => e.mode === "add").reduce((s, e) => s + (Number(e.value) || 0), 0);
			const maxes = forAbl.filter(e => e.mode === "max").map(e => Number(e.value) || 0);
			b[a] += add;
			if (maxes.length) b[a] = Math.max(b[a], ...maxes);
		});
		return b;
	},
	getAsiSlot(level) { return (this.char.levelAsi || {})[level] || {type: null, feat: null, asi: null}; },
	setAsiSlot(level, patch) {
		this.char.levelAsi = {...(this.char.levelAsi || {}), [level]: {...this.getAsiSlot(level), ...patch}};
	},
	/** Player-choice proficiency picks for the feat currently in this ASI slot (Skilled/Resilient-
	 * style — see featChoiceRequirements()). Keyed by requirement id -> array of selected option
	 * keys; a fresh feat pick starts with none, cleared out via setAsiSlot's {featChoice: {}}
	 * whenever the slot's feat itself changes (see the feat-pick handlers in renderFeats()). */
	getFeatChoice(level, reqId) { return (this.getAsiSlot(level).featChoice || {})[reqId] || []; },
	toggleFeatChoiceOption(level, reqId, optKey, maxCount) {
		const cur = this.getFeatChoice(level, reqId);
		const next = cur.includes(optKey) ? cur.filter(k => k !== optKey) : cur.length < maxCount ? [...cur, optKey] : cur;
		const featChoice = {...(this.getAsiSlot(level).featChoice || {}), [reqId]: next};
		this.setAsiSlot(level, {featChoice});
	},
	/** Which additionalSpells "flavor" (Magic Initiate's per-class option) this ASI slot's feat is
	 * using — see activeSpellFlavor(). Switching flavor clears any spells already picked, since a
	 * different class means a different valid spell pool (last-picked spells for the old class
	 * wouldn't even pass spellsForChooseQuery() for the new one). */
	setFeatSpellFlavor(level, flavorName) {
		this.setAsiSlot(level, {featSpellChoice: {flavor: flavorName, picks: {}}});
	},
	toggleFeatSpellPick(level, unitId, name, source, maxCount) {
		const cur = this.getAsiSlot(level).featSpellChoice || {flavor: null, picks: {}};
		const picks = cur.picks || {};
		const list = picks[unitId] || [];
		const exists = list.some(p => p.name === name && p.source === source);
		const next = exists ? list.filter(p => !(p.name === name && p.source === source)) : (list.length < maxCount ? [...list, {name, source}] : list);
		this.setAsiSlot(level, {featSpellChoice: {...cur, picks: {...picks, [unitId]: next}}});
	},
	pb() { return profBonus(this.char.level); },
	bgSkills() { return backgroundSkillNames(this.char.background); },
	allProfSkills() { return new Set([...this.bgSkills(), ...this.char.skills]); },
	clsSkillOpts() {
		return classSkillChoice(this.char.cls).names;
	},
	isCaster() { return !!spellcastingSource(this.char.cls, this.char.subclass); },

	canProceed() {
		const {step, char} = this;
		if (step === 0) return char.name.trim().length > 0;
		if (step === 1) return char.race !== null;
		if (step === 2) return char.cls !== null;
		if (step === 3) return true;
		if (step === 4) return char.background !== null;
		if (step === 5 && char.abilityMode === "standard") return ABILITIES.every(a => char.standardAssign[a] !== null);
		if (step === 6) return char.skills.length === classSkillChoice(char.cls).count;
		return true;
	},

	// ─── RENDER ──────────────────────────────────────────────────────────────
	render() {
		this.renderNav();
		this._replaceStepBody();
		this.renderFooter();
	},

	_replaceStepBody() {
		const body = document.getElementById("cb-step-body");
		// Preserve scroll position of whichever scrollable list/grid the step has (race list,
		// feat list, spell grid, skill grid, etc.) — a full innerHTML replacement otherwise
		// resets it to the top on every click.
		const scrollSelector = ".cb__scroll-list, .cb__spell-grid, .cb__skill-grid";
		const scrollEl = body.querySelector(scrollSelector);
		const scrollTop = scrollEl ? scrollEl.scrollTop : null;
		// Preserve focus + caret position of an active search input, same reason.
		const active = document.activeElement;
		const wasSearch = active && active.hasAttribute("data-search");
		const selStart = wasSearch ? active.selectionStart : null;

		body.innerHTML = this.renderStep();
		this.bindStepEvents();

		if (scrollTop !== null) {
			const newScrollEl = body.querySelector(scrollSelector);
			if (newScrollEl) newScrollEl.scrollTop = scrollTop;
		}
		if (wasSearch) {
			const el = body.querySelector("[data-search]");
			if (el) { el.focus(); if (selStart !== null) el.setSelectionRange(selStart, selStart); }
		}
	},

	renderNav() {
		const html = STEPS.map((s, i) => `
			<button class="cb__nav-btn ${i === this.step ? "cb__nav-btn--active" : ""} ${i < this.step ? "cb__nav-btn--done" : ""}" data-step="${i}">${i + 1}. ${esc(s)}</button>
		`).join("");
		document.getElementById("cb-nav").innerHTML = html;
	},

	renderFooter() {
		const backBtn = document.getElementById("cb-back");
		backBtn.disabled = this.step === 0;
		const nextBtn = document.getElementById("cb-next");
		const exportWrap = document.getElementById("cb-export-wrap");
		if (this.step < STEPS.length - 1) {
			nextBtn.style.display = "";
			nextBtn.disabled = !this.canProceed();
			nextBtn.textContent = this.step === STEPS.length - 2 ? "View Character Sheet →" : "Next →";
			exportWrap.style.display = "none";
		} else {
			nextBtn.style.display = "none";
			exportWrap.style.display = "";
		}
	},

	renderStep() {
		switch (this.step) {
			case 0: return this.renderName();
			case 1: return this.renderRace();
			case 2: return this.renderClass();
			case 3: return this.renderSubclass();
			case 4: return this.renderBackground();
			case 5: return this.renderAbilities();
			case 6: return this.renderSkills();
			case 7: return this.renderEquipment();
			case 8: return this.renderFeats();
			case 9: return this.renderSpells();
			case 10: return this.renderSheet();
			default: return "";
		}
	},

	bindStepEvents() {
		// generic data-action delegation, rebound each render since we replace innerHTML
		const body = document.getElementById("cb-step-body");
		body.querySelectorAll("[data-search]").forEach(inp => {
			inp.addEventListener("input", e => { this.search = e.target.value; this._replaceStepBody(); });
		});
		// Class/Subclass/Sheet steps all render featureListHtml() pills — wire click-to-expand here
		// once, generically, rather than per-step, so the Sheet step (which has no setTimeout wiring
		// block of its own) gets it too.
		wireFeatureToggles();
		if (this.step === 10) {
			this.wirePlayCard();
			body.querySelectorAll("[data-equip-toggle]").forEach(cb => {
				cb.addEventListener("change", () => {
					const [entryIdx, partIdx] = cb.dataset.equipToggle.split(":").map(Number);
					this.toggleEquipped(entryIdx, partIdx);
				});
			});
		}
	},

	// ─── STEP 0: NAME ──────────────────────────────────────────────────────
	renderName() {
		return `
			<p class="cb__hint">Give your adventurer a name and choose their level.</p>
			<div class="form-group">
				<label>Character Name</label>
				<input class="ve-form-control" id="cb-name" value="${esc(this.char.name)}" placeholder="e.g. Aldric Stoneforge">
			</div>
			<div class="form-group">
				<label>Starting Level: <strong>${this.char.level}</strong></label>
				<input type="range" id="cb-level" min="1" max="20" step="1" value="${this.char.level}" class="cb__range">
				<div class="cb__range-labels"><span>1</span><span>5</span><span>10</span><span>15</span><span>20</span></div>
			</div>
			${this.wireName()}
		`;
	},
	wireName() {
		setTimeout(() => {
			const nameEl = document.getElementById("cb-name");
			// Typing into the name field must NOT trigger a full re-render (that replaces the
			// input element and drops focus) — update state + just the footer's Next-button state.
			if (nameEl) nameEl.addEventListener("input", e => { this.char.name = e.target.value; this.renderFooter(); });
			const lvlEl = document.getElementById("cb-level");
			if (lvlEl) {
				// Same issue as the name field above: a full render() on every "input" tick
				// recreates the <input type="range"> mid-drag, which drops the browser's native
				// drag gesture and makes the slider only move one notch per drag. Update the
				// live label directly while dragging, and only re-render (recalculating level-
				// dependent stuff like HP/feat slots elsewhere) once the drag finishes.
				const lvlLabel = lvlEl.closest(".form-group")?.querySelector("strong");
				lvlEl.addEventListener("input", e => {
					this.char.level = +e.target.value;
					if (lvlLabel) lvlLabel.textContent = this.char.level;
				});
				lvlEl.addEventListener("change", () => this.render());
			}
		}, 0);
		return "";
	},

	// ─── STEP 1: RACE ──────────────────────────────────────────────────────
	renderRace() {
		const filtered = RACES.filter(r => r.name.toLowerCase().includes(this.search.toLowerCase()));
		const isSelected = r => this.char.race?.name === r.name && this.char.race?.source === r.source;
		const list = filtered.map(r => `
			<div class="cb__sel-card ${isSelected(r) ? "cb__sel-card--active" : ""}" data-race="${esc(r.name)}" data-race-source="${esc(r.source)}">
				<span class="cb__sel-title">${esc(r.name)}</span>${srcBadge(r.source)}
				<div class="cb__sel-sub">${esc(raceSpeedSizeSummary(r))}</div>
			</div>
		`).join("");

		const detail = this.char.race ? `
			<div class="cb__detail-card">
				<p class="cb__detail-title">${esc(this.char.race.name)}</p>
				<div class="cb__asi-row">${raceAbilityPills(this.char.race)}</div>
				<p class="cb__detail-meta">${esc(raceSpeedSizeSummary(this.char.race))}</p>
				<p class="cb__section-header">Racial Traits</p>
				<div>${pillListHtml(namedSubEntries(this.char.race.entries).map(t => ({name: t.name, body: entriesToHtml(t.entries)})), {idPrefix: "race-traits", colorClass: "cb__pill--teal"})}</div>
			</div>
		` : `<p class="cb__placeholder">Select a race to see details</p>`;

		setTimeout(() => {
			document.getElementById("cb-race-browse")?.addEventListener("click", async () => {
				if (!modalFilterRaces) return;
				const selected = await modalFilterRaces.pGetUserSelection();
				if (!selected?.length) return;
				const match = resolveModalSelection(selected[0], RACES);
				if (!match) return;
				this.char.race = match;
				this.char.racialAsiChoice = [];
				this.char.racialAsiVrgr = {mode: "2-1", high: null, low: null, triple: []};
				this.render();
			});
			document.querySelectorAll("[data-race]").forEach(el => el.addEventListener("click", () => {
				const r = RACES.find(x => x.name === el.dataset.race && x.source === el.dataset.raceSource);
				this.char.race = r;
				this.char.racialAsiChoice = [];
				this.char.racialAsiVrgr = {mode: "2-1", high: null, low: null, triple: []};
				this.render();
			}));
		}, 0);

		return `
			<div class="cb__two-col">
				<div>
					<button id="cb-race-browse" type="button" class="ve-btn ve-btn-default cb__search" title="Open the site's full race filter/search">🔍 Browse &amp; Filter Races</button>
					<input class="ve-form-control cb__search" data-search value="${esc(this.search)}" placeholder="...or quick-filter this list by name">
					<div class="cb__scroll-list">${list}</div>
				</div>
				<div>${detail}</div>
			</div>
		`;
	},

	// ─── STEP 2: CLASS ─────────────────────────────────────────────────────
	renderClass() {
		const filtered = CLASSES.filter(c => c.name.toLowerCase().includes(this.search.toLowerCase()));
		const isSelected = c => this.char.cls?.name === c.name && this.char.cls?.source === c.source;
		const list = filtered.map(c => `
			<div class="cb__sel-card ${isSelected(c) ? "cb__sel-card--active" : ""}" data-cls="${esc(c.name)}" data-cls-source="${esc(c.source)}">
				<span class="cb__sel-title">${esc(c.name)}</span>${srcBadge(c.source)}
				<div class="cb__sel-sub">d${c.hd?.faces || "?"} · ${classPrimaryAbilities(c).map(p => ABILITY_LABELS[p]).join("/") || "—"}</div>
			</div>
		`).join("");

		const cls = this.char.cls;
		const skillChoice = classSkillChoice(cls);
		const allFeatures = classFeatureRefs(cls);
		const detail = cls ? `
			<div class="cb__detail-card">
				<p class="cb__detail-title">${esc(cls.name)}</p>
				<div class="cb__stat-grid">
					${[["Hit Die","d"+(cls.hd?.faces ?? "?")],["Saves",(cls.proficiency||[]).map(s=>ABILITY_LABELS[s].slice(0,3)).join("/")],["HP at 1st",cls.hd?.faces ?? "?"],["Skills",skillChoice.count+" choices"]].map(([l,v]) => `
						<div class="cb__stat-box"><p class="cb__stat-label">${esc(l)}</p><p class="cb__stat-value">${esc(v)}</p></div>
					`).join("")}
				</div>
				<p class="cb__section-header">Class Features <span class="cb__hint-inline">(click to expand)</span></p>
				<div>${featureListHtml(allFeatures, {idPrefix: "cls"})}</div>
				${cls.spellcastingAbility ? `<p class="cb__caster-note">✦ Spellcaster — you'll pick spells later</p>` : ""}
			</div>
		` : `<p class="cb__placeholder">Select a class to see details</p>`;

		setTimeout(() => {
			document.getElementById("cb-cls-browse")?.addEventListener("click", async () => {
				if (!modalFilterClasses) return;
				const selected = await pGetClassOnlySelection();
				if (!selected?.class) return;
				this.char.cls = selected.class;
				this.char.subclass = null;
				this.render();
			});
			document.querySelectorAll("[data-cls]").forEach(el => el.addEventListener("click", () => {
				this.char.cls = CLASSES.find(x => x.name === el.dataset.cls && x.source === el.dataset.clsSource);
				this.char.subclass = null;
				this.render();
			}));
		}, 0);

		return `
			<div class="cb__two-col">
				<div>
					<button id="cb-cls-browse" type="button" class="ve-btn ve-btn-default cb__search" title="Open the site's full class filter/search">🔍 Browse &amp; Filter Classes</button>
					<input class="ve-form-control cb__search" data-search value="${esc(this.search)}" placeholder="...or quick-filter this list by name">
					<div class="cb__scroll-list">${list}</div>
				</div>
				<div>${detail}</div>
			</div>
		`;
	},

	// ─── STEP 3: SUBCLASS ──────────────────────────────────────────────────
	renderSubclass() {
		if (!this.char.cls) return `<p class="cb__placeholder">Select a class first (step 3).</p>`;
		const cls = this.char.cls;
		const options = cls.subclasses || [];
		const isSelected = sc => this.char.subclass?.name === sc.name && this.char.subclass?.source === sc.source;
		const list = options.map(sc => `
			<div class="cb__sel-card ${isSelected(sc) ? "cb__sel-card--active" : ""}" data-subclass="${esc(sc.name)}" data-subclass-source="${esc(sc.source)}">
				<span class="cb__sel-title">${esc(sc.name)}</span>${srcBadge(sc.source)}
			</div>
		`).join("");
		const subclass = this.char.subclass;
		const scFeatures = subclassFeatureRefs(subclass);
		const detail = subclass ? `
			<div class="cb__detail-card">
				<p class="cb__detail-title">${esc(subclass.name)}</p>
				<p class="cb__section-header">Subclass Features <span class="cb__hint-inline">(click to expand)</span></p>
				<div>${featureListHtml(scFeatures, {idPrefix: "sc"})}</div>
			</div>
		` : `<p class="cb__placeholder">Select a subclass to see details</p>`;

		setTimeout(() => {
			document.getElementById("cb-subclass-browse")?.addEventListener("click", async () => {
				if (!modalFilterClasses) return;
				const selected = await modalFilterClasses.pGetUserSelection({selectedClass: cls, selectedSubclass: this.char.subclass, isClassDisabled: true});
				if (!selected?.subclass) return;
				this.char.subclass = selected.subclass;
				this.render();
			});
			document.querySelectorAll("[data-subclass]").forEach(el => el.addEventListener("click", () => {
				this.char.subclass = options.find(x => x.name === el.dataset.subclass && x.source === el.dataset.subclassSource);
				this.render();
			}));
		}, 0);

		return `
			<div class="cb__two-col">
				<div>
					<button id="cb-subclass-browse" type="button" class="ve-btn ve-btn-default cb__search" title="Open the site's full class filter/search, scoped to this class">🔍 Browse &amp; Filter Subclasses</button>
					<p class="cb__hint">${esc(cls.name)} subclasses are typically chosen at level 3 (or 1 for Cleric/Sorcerer/Warlock). Select now to plan ahead.</p>
					<div class="cb__scroll-list">${list}</div>
				</div>
				<div>${detail}</div>
			</div>
		`;
	},

	// ─── STEP 4: BACKGROUND ────────────────────────────────────────────────
	renderBackground() {
		const filtered = BACKGROUNDS.filter(b => b.name.toLowerCase().includes(this.search.toLowerCase()));
		const isSelected = b => this.char.background?.name === b.name && this.char.background?.source === b.source;
		const list = filtered.map(b => `
			<div class="cb__sel-card ${isSelected(b) ? "cb__sel-card--active" : ""}" data-bg="${esc(b.name)}" data-bg-source="${esc(b.source)}">
				<span class="cb__sel-title">${esc(b.name)}</span>${srcBadge(b.source)}
				<div class="cb__sel-sub">${esc(backgroundSkillNames(b).join(", "))}</div>
			</div>
		`).join("");
		const bg = this.char.background;
		const detail = bg ? `
			<div class="cb__detail-card">
				<p class="cb__detail-title">${esc(bg.name)}</p>
				<div class="cb__block">${entriesToHtml(bg.entries)}</div>
			</div>
		` : `<p class="cb__placeholder">Select a background to see details</p>`;

		setTimeout(() => {
			document.getElementById("cb-bg-browse")?.addEventListener("click", async () => {
				if (!modalFilterBackgrounds) return;
				const selected = await modalFilterBackgrounds.pGetUserSelection();
				if (!selected?.length) return;
				const match = resolveModalSelection(selected[0], BACKGROUNDS);
				if (!match) return;
				this.char.background = match;
				this.char.bgAsi = {mode: "2-1", high: null, low: null, triple: []};
				this.render();
			});
			document.querySelectorAll("[data-bg]").forEach(el => el.addEventListener("click", () => {
				this.char.background = BACKGROUNDS.find(x => x.name === el.dataset.bg && x.source === el.dataset.bgSource);
				this.char.bgAsi = {mode: "2-1", high: null, low: null, triple: []};
				this.render();
			}));
		}, 0);

		return `
			<div class="cb__two-col">
				<div>
					<button id="cb-bg-browse" type="button" class="ve-btn ve-btn-default cb__search" title="Open the site's full background filter/search">🔍 Browse &amp; Filter Backgrounds</button>
					<input class="ve-form-control cb__search" data-search value="${esc(this.search)}" placeholder="...or quick-filter this list by name">
					<div class="cb__scroll-list">${list}</div>
				</div>
				<div>${detail}</div>
			</div>
		`;
	},

	// ─── STEP 5: ABILITIES ─────────────────────────────────────────────────
	renderAbilities() {
		const racial = this.racialASI();
		const asiChoice = raceAbilityChoice(this.char.race);
		const chosen = this.char.racialAsiChoice || [];
		const asiChoiceUi = asiChoice ? `
			<div class="cb__detail-card cb__block">
				<p class="cb__section-header">${esc(this.char.race?.name || "Race")} Ability Bonus — choose ${asiChoice.count} (+${asiChoice.amount} each)</p>
				<div>${asiChoice.from.map(a => {
					const picked = chosen.includes(a);
					const atLimit = !picked && chosen.length >= asiChoice.count;
					return `<span class="cb__pill cb__pill--blue" style="cursor:${atLimit ? "not-allowed" : "pointer"};${picked ? "" : atLimit ? "opacity:0.4;" : ""}" data-asi-choice="${a}" data-asi-disabled="${atLimit}">${picked ? "✓ " : ""}${ABILITY_LABELS[a]}</span>`;
				}).join("")}</div>
			</div>
		` : "";
		const vrgr = this.char.racialAsiVrgr || {mode: "2-1", high: null, low: null, triple: []};
		const vrgrUi = isFlexibleLineageRace(this.char.race) ? `
			<div class="cb__detail-card cb__block">
				<p class="cb__section-header">${esc(this.char.race?.name || "Race")} Ability Score Increase</p>
				<div style="margin-bottom:8px;">
					<button class="cb__mode-btn ${vrgr.mode !== "1-1-1" ? "cb__mode-btn--active" : ""}" data-vrgr-mode="2-1">+2 / +1</button>
					<button class="cb__mode-btn ${vrgr.mode === "1-1-1" ? "cb__mode-btn--active" : ""}" data-vrgr-mode="1-1-1">+1 / +1 / +1</button>
				</div>
				${vrgr.mode === "1-1-1" ? `
					<p class="cb__detail-meta">Choose 3 different abilities for +1 each:</p>
					<div>${ABILITIES.map(a => {
						const picked = (vrgr.triple || []).includes(a);
						const atLimit = !picked && (vrgr.triple || []).length >= 3;
						return `<span class="cb__pill cb__pill--blue" style="cursor:${atLimit ? "not-allowed" : "pointer"};${picked ? "" : atLimit ? "opacity:0.4;" : ""}" data-vrgr-triple="${a}">${picked ? "✓ " : ""}${ABILITY_LABELS[a]}</span>`;
					}).join("")}</div>
				` : `
					<p class="cb__detail-meta">+2 to:</p>
					<div>${ABILITIES.map(a => `<span class="cb__pill cb__pill--blue" style="cursor:pointer;" data-vrgr-high="${a}">${vrgr.high === a ? "✓ " : ""}${ABILITY_LABELS[a]}</span>`).join("")}</div>
					<p class="cb__detail-meta" style="margin-top:6px;">+1 to a different ability:</p>
					<div>${ABILITIES.filter(a => a !== vrgr.high).map(a => `<span class="cb__pill cb__pill--blue" style="cursor:pointer;" data-vrgr-low="${a}">${vrgr.low === a ? "✓ " : ""}${ABILITY_LABELS[a]}</span>`).join("")}</div>
				`}
			</div>
		` : "";
		const bgChoice = bgAbilityChoice(this.char.background);
		const bgAsi = this.char.bgAsi || {mode: "2-1", high: null, low: null, triple: []};
		const bgAsiBlocked = bgChoice && !this.canUseBackgroundASI();
		const bgAsiUi = bgChoice ? `
			<div class="cb__detail-card cb__block">
				<p class="cb__section-header">${esc(this.char.background?.name || "Background")} Ability Bonus</p>
				${bgAsiBlocked ? `
					<p class="cb__hint">Not applied — ${esc(this.char.race?.name || "your race")} already grants a racial ability bonus above. A 2014-style race bonus and a 2024-style background bonus don't stack; only the racial one is being used.</p>
				` : `
					<div style="margin-bottom:8px;">
						<button class="cb__mode-btn ${bgAsi.mode !== "1-1-1" ? "cb__mode-btn--active" : ""}" data-bgasi-mode="2-1">+2 / +1</button>
						<button class="cb__mode-btn ${bgAsi.mode === "1-1-1" ? "cb__mode-btn--active" : ""}" data-bgasi-mode="1-1-1">+1 / +1 / +1</button>
					</div>
					${bgAsi.mode === "1-1-1" ? `
						<p class="cb__detail-meta">Choose 3 different abilities for +1 each:</p>
						<div>${bgChoice.from.map(a => {
							const picked = (bgAsi.triple || []).includes(a);
							const atLimit = !picked && (bgAsi.triple || []).length >= 3;
							return `<span class="cb__pill cb__pill--blue" style="cursor:${atLimit ? "not-allowed" : "pointer"};${picked ? "" : atLimit ? "opacity:0.4;" : ""}" data-bgasi-triple="${a}">${picked ? "✓ " : ""}${ABILITY_LABELS[a]}</span>`;
						}).join("")}</div>
					` : `
						<p class="cb__detail-meta">+2 to:</p>
						<div>${bgChoice.from.map(a => `<span class="cb__pill cb__pill--blue" style="cursor:pointer;" data-bgasi-high="${a}">${bgAsi.high === a ? "✓ " : ""}${ABILITY_LABELS[a]}</span>`).join("")}</div>
						<p class="cb__detail-meta" style="margin-top:6px;">+1 to a different ability:</p>
						<div>${bgChoice.from.filter(a => a !== bgAsi.high).map(a => `<span class="cb__pill cb__pill--blue" style="cursor:pointer;" data-bgasi-low="${a}">${bgAsi.low === a ? "✓ " : ""}${ABILITY_LABELS[a]}</span>`).join("")}</div>
					`}
				`}
			</div>
		` : "";
		const modeBtns = [["standard","Standard Array"],["pointbuy","Point Buy"],["manual","Manual Entry"]].map(([k,l]) => `
			<button class="cb__mode-btn ${this.char.abilityMode === k ? "cb__mode-btn--active" : ""}" data-mode="${k}">${l}</button>
		`).join("");

		let body = "";
		if (this.char.abilityMode === "standard") {
			const assigned = Object.values(this.char.standardAssign).filter(v => v !== null);
			const available = STANDARD_ARRAY.filter(v => !assigned.includes(v));
			body = `
				<p class="cb__hint">Remaining: ${available.length ? available.join(", ") : "all assigned"}</p>
				<div class="cb__ability-grid">
					${ABILITIES.map(a => {
						const base = this.char.standardAssign[a], rac = racial[a] || 0, total = base !== null ? base + rac : null;
						const opts = STANDARD_ARRAY.filter(v => v === base || !assigned.includes(v));
						return `
						<div class="cb__ability-box">
							<p class="cb__ability-label">${ABILITY_LABELS[a]}</p>
							<select class="ve-form-control cb__ability-select" data-std="${a}">
								<option value="">—</option>
								${opts.map(v => `<option value="${v}" ${v === base ? "selected" : ""}>${v}</option>`).join("")}
							</select>
							${total !== null ? `<div class="cb__ability-total"><span class="cb__ability-score">${total}</span><span class="cb__ability-mod">${fmtMod(scoreMod(total))}</span></div>` : ""}
							${rac > 0 ? `<p class="cb__racial-note">+${rac} racial</p>` : ""}
						</div>`;
					}).join("")}
				</div>
			`;
		} else if (this.char.abilityMode === "pointbuy") {
			const pbTotal = ABILITIES.reduce((t, a) => t + pbCost(this.char.pointBuy[a]), 0);
			body = `
				<p class="cb__hint">Points: <strong>${27 - pbTotal}</strong>/27 remaining</p>
				<div class="cb__ability-grid">
					${ABILITIES.map(a => {
						const score = this.char.pointBuy[a], rac = racial[a] || 0, total = score + rac;
						return `
						<div class="cb__ability-box">
							<p class="cb__ability-label">${ABILITY_LABELS[a]}</p>
							<div class="cb__pb-row">
								<button class="cb__pb-btn" data-pb-dec="${a}" ${score <= 8 ? "disabled" : ""}>−</button>
								<span class="cb__pb-total">${total}</span>
								<button class="cb__pb-btn" data-pb-inc="${a}" ${score >= 15 || pbTotal >= 27 ? "disabled" : ""}>+</button>
							</div>
							<p class="cb__detail-meta">${fmtMod(scoreMod(total))} · Cost:${pbCost(score)}</p>
							${rac > 0 ? `<p class="cb__racial-note">+${rac} racial</p>` : ""}
						</div>`;
					}).join("")}
				</div>
			`;
		} else {
			body = `
				<p class="cb__hint">Enter scores manually (1–30).</p>
				<div class="cb__ability-grid">
					${ABILITIES.map(a => {
						const base = this.char.manual[a], rac = racial[a] || 0, total = base + rac;
						return `
						<div class="cb__ability-box">
							<p class="cb__ability-label">${ABILITY_LABELS[a]}</p>
							<input type="number" class="ve-form-control cb__manual-input" data-manual="${a}" min="1" max="30" value="${base}">
							<div class="cb__ability-total"><span class="cb__ability-score">${total}</span><span class="cb__ability-mod">${fmtMod(scoreMod(total))}</span></div>
							${rac > 0 ? `<p class="cb__racial-note">+${rac} racial</p>` : ""}
						</div>`;
					}).join("")}
				</div>
			`;
		}

		setTimeout(() => {
			document.querySelectorAll("[data-mode]").forEach(el => el.addEventListener("click", () => this.upd("abilityMode", el.dataset.mode)));
			document.querySelectorAll("[data-std]").forEach(el => el.addEventListener("change", () => {
				const a = el.dataset.std, v = el.value === "" ? null : +el.value;
				this.char.standardAssign = {...this.char.standardAssign, [a]: v};
				this.render();
			}));
			document.querySelectorAll("[data-pb-dec]").forEach(el => el.addEventListener("click", () => {
				const a = el.dataset.pbDec;
				this.char.pointBuy = {...this.char.pointBuy, [a]: this.char.pointBuy[a] - 1};
				this.render();
			}));
			document.querySelectorAll("[data-pb-inc]").forEach(el => el.addEventListener("click", () => {
				const a = el.dataset.pbInc;
				this.char.pointBuy = {...this.char.pointBuy, [a]: this.char.pointBuy[a] + 1};
				this.render();
			}));
			document.querySelectorAll("[data-manual]").forEach(el => el.addEventListener("input", () => {
				const a = el.dataset.manual;
				const v = Math.min(30, Math.max(1, +el.value || 1));
				this.char.manual = {...this.char.manual, [a]: v};
				this.render();
			}));
			document.querySelectorAll("[data-asi-choice]").forEach(el => el.addEventListener("click", () => {
				if (el.dataset.asiDisabled === "true") return;
				const a = el.dataset.asiChoice;
				const cur = this.char.racialAsiChoice || [];
				this.char.racialAsiChoice = cur.includes(a) ? cur.filter(x => x !== a) : [...cur, a];
				this.render();
			}));
			document.querySelectorAll("[data-vrgr-mode]").forEach(el => el.addEventListener("click", () => {
				const mode = el.dataset.vrgrMode;
				const cur = this.char.racialAsiVrgr || {};
				this.char.racialAsiVrgr = mode === "1-1-1"
					? {mode, high: null, low: null, triple: cur.triple || []}
					: {mode, high: cur.high || null, low: cur.low || null, triple: []};
				this.render();
			}));
			document.querySelectorAll("[data-vrgr-high]").forEach(el => el.addEventListener("click", () => {
				const a = el.dataset.vrgrHigh;
				const cur = this.char.racialAsiVrgr || {};
				const high = cur.high === a ? null : a;
				const low = cur.low === high ? null : cur.low;
				this.char.racialAsiVrgr = {...cur, mode: "2-1", high, low};
				this.render();
			}));
			document.querySelectorAll("[data-vrgr-low]").forEach(el => el.addEventListener("click", () => {
				const a = el.dataset.vrgrLow;
				const cur = this.char.racialAsiVrgr || {};
				this.char.racialAsiVrgr = {...cur, mode: "2-1", low: cur.low === a ? null : a};
				this.render();
			}));
			document.querySelectorAll("[data-vrgr-triple]").forEach(el => el.addEventListener("click", () => {
				const a = el.dataset.vrgrTriple;
				const cur = this.char.racialAsiVrgr || {};
				const triple = cur.triple || [];
				const next = triple.includes(a) ? triple.filter(x => x !== a) : (triple.length < 3 ? [...triple, a] : triple);
				this.char.racialAsiVrgr = {...cur, mode: "1-1-1", triple: next};
				this.render();
			}));
			document.querySelectorAll("[data-bgasi-mode]").forEach(el => el.addEventListener("click", () => {
				const mode = el.dataset.bgasiMode;
				const cur = this.char.bgAsi || {};
				this.char.bgAsi = mode === "1-1-1"
					? {mode, high: null, low: null, triple: cur.triple || []}
					: {mode, high: cur.high || null, low: cur.low || null, triple: []};
				this.render();
			}));
			document.querySelectorAll("[data-bgasi-high]").forEach(el => el.addEventListener("click", () => {
				const a = el.dataset.bgasiHigh;
				const cur = this.char.bgAsi || {};
				const high = cur.high === a ? null : a;
				const low = cur.low === high ? null : cur.low;
				this.char.bgAsi = {...cur, mode: "2-1", high, low};
				this.render();
			}));
			document.querySelectorAll("[data-bgasi-low]").forEach(el => el.addEventListener("click", () => {
				const a = el.dataset.bgasiLow;
				const cur = this.char.bgAsi || {};
				this.char.bgAsi = {...cur, mode: "2-1", low: cur.low === a ? null : a};
				this.render();
			}));
			document.querySelectorAll("[data-bgasi-triple]").forEach(el => el.addEventListener("click", () => {
				const a = el.dataset.bgasiTriple;
				const cur = this.char.bgAsi || {};
				const triple = cur.triple || [];
				const next = triple.includes(a) ? triple.filter(x => x !== a) : (triple.length < 3 ? [...triple, a] : triple);
				this.char.bgAsi = {...cur, mode: "1-1-1", triple: next};
				this.render();
			}));
		}, 0);

		return `<div>${asiChoiceUi}${vrgrUi}${bgAsiUi}${modeBtns}${body}</div>`;
	},

	// ─── STEP 6: SKILLS ────────────────────────────────────────────────────
	renderSkills() {
		const numNeeded = classSkillChoice(this.char.cls).count;
		const bgSkills = this.bgSkills();
		const clsOpts = this.clsSkillOpts();
		const finalScores = this.finalScores();
		const pb = this.pb();

		const rows = ALL_SKILLS.map(skill => {
			const fromBg = bgSkills.includes(skill.name), chosen = this.char.skills.includes(skill.name);
			const inList = clsOpts.includes(skill.name), isProf = fromBg || chosen;
			const bonus = scoreMod(finalScores[skill.ability]) + (isProf ? pb : 0);
			return `
				<div class="cb__skill-row ${isProf ? "cb__skill-row--prof" : ""} ${!inList && !fromBg ? "cb__skill-row--dim" : ""}" data-skill="${esc(skill.name)}" data-clickable="${inList && !fromBg}">
					<div class="cb__skill-dot ${isProf ? "cb__skill-dot--on" : ""}"></div>
					<span class="cb__skill-name">${esc(skill.name)}</span>
					<span class="cb__skill-ability">${ABILITY_LABELS[skill.ability].slice(0,3)}</span>
					<span class="cb__skill-bonus">${fmtMod(bonus)}</span>
					${fromBg ? `<span class="cb__skill-tag">bg</span>` : ""}
				</div>
			`;
		}).join("");

		setTimeout(() => {
			document.querySelectorAll("[data-skill]").forEach(el => {
				if (el.dataset.clickable !== "true") return;
				el.addEventListener("click", () => {
					const name = el.dataset.skill;
					if (bgSkills.includes(name)) return;
					if (this.char.skills.includes(name)) this.char.skills = this.char.skills.filter(s => s !== name);
					else if (this.char.skills.length < numNeeded) this.char.skills = [...this.char.skills, name];
					this.render();
				});
			});
		}, 0);

		return `
			<p class="cb__hint">Background grants: <strong>${bgSkills.join(", ") || "none"}</strong>. Choose <strong>${numNeeded}</strong> more (${this.char.skills.length}/${numNeeded}).</p>
			<div class="cb__skill-grid">${rows}</div>
		`;
	},

	// ─── STEP 7: EQUIPMENT ─────────────────────────────────────────────────
	renderEquipment() {
		const {fixed: clsEquip, choiceRows: clsChoiceRows} = equipmentChoiceSets(this.char.cls?.startingEquipment?.defaultData);
		const {fixed: bgEquip, choiceRows: bgChoiceRows} = equipmentChoiceSets(this.char.background?.startingEquipment);

		// Equipment entries are {label, parts} objects (see equipmentChoiceSets()) freshly rebuilt
		// on every render, so "is this chosen" / toggle identity has to compare by .label rather
		// than by reference — same role the bare string played before this carried real item refs.
		const isChosen = label => this.char.equipment.some(e => e.label === label);

		const choiceRows = clsChoiceRows.map((choices, i) => `
			<div class="cb__eq-choice-row" data-row="${i}">
				${choices.map(opt => `<div class="cb__eq-chip ${isChosen(opt.label) ? "cb__eq-chip--active" : ""}" data-eq-choice="${esc(opt.label)}" data-row-i="${i}" title="${esc(equipmentDesc(opt))}">${esc(opt.label)}</div>`).join("")}
			</div>
		`).join("");

		const bgChoiceRowsHtml = bgChoiceRows.map((choices, i) => `
			<div class="cb__eq-choice-row" data-row="${i}">
				${choices.map(opt => `<div class="cb__eq-chip ${isChosen(opt.label) ? "cb__eq-chip--active" : ""}" data-bg-eq-choice="${esc(opt.label)}" data-bg-row-i="${i}" title="${esc(equipmentDesc(opt))}">${esc(opt.label)}</div>`).join("")}
			</div>
		`).join("");

		const simpleRow = entry => `
			<div class="cb__skill-row ${isChosen(entry.label) ? "cb__skill-row--prof" : ""}" data-eq-toggle="${esc(entry.label)}" title="${esc(equipmentDesc(entry))}">
				<div class="cb__skill-dot ${isChosen(entry.label) ? "cb__skill-dot--on" : ""}" style="border-radius:3px;"></div>
				<span class="cb__skill-name">${esc(entry.label)}</span>
			</div>
		`;

		setTimeout(() => {
			document.querySelectorAll("[data-eq-choice]").forEach(el => el.addEventListener("click", () => {
				const label = el.dataset.eqChoice, rowI = +el.dataset.rowI;
				const choices = clsChoiceRows[rowI];
				const opt = choices.find(c => c.label === label);
				const active = isChosen(label);
				const otherLabels = choices.filter(c => c.label !== label).map(c => c.label);
				let next = this.char.equipment.filter(e => !otherLabels.includes(e.label));
				if (active) next = next.filter(e => e.label !== label);
				else next = [...next.filter(e => e.label !== label), opt];
				this.char.equipment = next;
				this.render();
			}));
			document.querySelectorAll("[data-bg-eq-choice]").forEach(el => el.addEventListener("click", () => {
				const label = el.dataset.bgEqChoice, rowI = +el.dataset.bgRowI;
				const choices = bgChoiceRows[rowI];
				const opt = choices.find(c => c.label === label);
				const active = isChosen(label);
				const otherLabels = choices.filter(c => c.label !== label).map(c => c.label);
				let next = this.char.equipment.filter(e => !otherLabels.includes(e.label));
				if (active) next = next.filter(e => e.label !== label);
				else next = [...next.filter(e => e.label !== label), opt];
				this.char.equipment = next;
				this.render();
			}));
			document.querySelectorAll("[data-eq-toggle]").forEach(el => el.addEventListener("click", () => {
				const label = el.dataset.eqToggle;
				const entry = [...clsEquip, ...bgEquip].find(e => e.label === label);
				if (isChosen(label)) this.char.equipment = this.char.equipment.filter(e => e.label !== label);
				else this.char.equipment = [...this.char.equipment, entry];
				this.render();
			}));
		}, 0);

		if (!this.char.cls && !this.char.background) return `<p class="cb__placeholder">Select a class and background first.</p>`;

		return `
			<p class="cb__hint">Review and check off your starting equipment. Choice rows let you pick one option.</p>
			${clsChoiceRows.length ? `<p class="cb__section-header">${esc(this.char.cls?.name || "Class")} Starting Equipment (choose one per row)</p>${choiceRows}` : ""}
			${clsEquip.length ? `<p class="cb__section-header">Additional Class Items</p>${clsEquip.map(simpleRow).join("")}` : ""}
			${bgEquip.length ? `<p class="cb__section-header">${esc(this.char.background?.name || "Background")} Equipment</p>${bgEquip.map(simpleRow).join("")}` : ""}
			${bgChoiceRows.length ? `<p class="cb__section-header">${esc(this.char.background?.name || "Background")} Equipment (choose one per row)</p>${bgChoiceRowsHtml}` : ""}
		`;
	},

	// ─── STEP 8: FEATS / ASI ───────────────────────────────────────────────
	renderFeats() {
		if (!this.char.cls) return `<p class="cb__hint">Select a class first to see its Ability Score Improvement slots.</p>`;

		// Real per-level slots (not a hardcoded floor(level/4)) — see classAsiLevels(): this
		// naturally picks up class-specific extras (Fighter 6 & 14, Rogue 10, etc.) straight
		// from the classFeature data instead of needing them special-cased here.
		const slotLevels = classAsiLevels(this.char.cls).filter(lvl => lvl <= this.char.level);
		const takenFeatKeys = new Set(chosenFeats(this.char).map(f => `${f.name}|${f.source}`));

		const prereqHtml = feat => {
			if (!feat.prerequisite) return "";
			try { return Renderer.utils.prerequisite.getHtml(feat.prerequisite); } catch (err) { return ""; }
		};

		const featPickerHtml = level => {
			const slot = this.getAsiSlot(level);
			const filtered = FEATS.filter(f => f.name.toLowerCase().includes(this.search.toLowerCase()));
			const rows = filtered.map(feat => {
				const key = `${feat.name}|${feat.source}`;
				const isThisSlot = slot.feat && slot.feat.name === feat.name && slot.feat.source === feat.source;
				const takenElsewhere = !feat.repeatable && !isThisSlot && takenFeatKeys.has(key);
				const open = this.expandedFeat === key;
				const prereq = prereqHtml(feat);
				return `
					<div class="cb__feat-card ${isThisSlot ? "cb__feat-card--chosen" : ""}" style="opacity:${takenElsewhere ? 0.5 : 1}">
						<div class="cb__feat-head" data-feat-expand="${esc(feat.name)}" data-feat-expand-source="${esc(feat.source)}">
							<div class="cb__feat-cb ${isThisSlot ? "cb__feat-cb--on" : ""}" data-feat-pick="${esc(feat.name)}" data-feat-pick-source="${esc(feat.source)}" data-feat-pick-level="${level}" data-feat-pick-disabled="${takenElsewhere}"></div>
							<span class="cb__feat-name">${esc(feat.name)}</span>
							${srcBadge(feat.source)}
							${takenElsewhere ? `<span class="cb__feat-req">Already taken at another level</span>` : prereq ? `<span class="cb__feat-req">Req: ${prereq}</span>` : ""}
							<span class="cb__feat-caret">${open ? "▲" : "▼"}</span>
						</div>
						${open ? `<div class="cb__feat-desc">${entriesToHtml(feat.entries)}</div>` : ""}
					</div>
				`;
			}).join("");
			return `
				<button type="button" class="ve-btn ve-btn-default cb__search" data-feat-browse-level="${level}" title="Open the site's full feat filter/search">🔍 Browse &amp; Filter Feats</button>
				<input class="ve-form-control cb__search" data-search value="${esc(this.search)}" placeholder="...or quick-filter this list by name">
				<div class="cb__scroll-list">${rows}</div>
			`;
		};

		const asiPickerHtml = level => {
			const slot = this.getAsiSlot(level);
			const asi = slot.asi || {mode: "plus2", ability: null, abilities: []};
			// Ability totals with THIS slot's own bonus excluded, so the cap check below reflects
			// "would picking this push the ability past 20" rather than double-counting.
			const scoreExcl = this.finalScores(level);
			const canPlus2 = a => scoreExcl[a] + 2 <= 20;
			const canPlus1 = a => scoreExcl[a] + 1 <= 20;
			return `
				<div style="margin-bottom:8px;">
					<button class="cb__mode-btn ${asi.mode !== "plus1x2" ? "cb__mode-btn--active" : ""}" data-asi-mode-level="${level}" data-asi-mode="plus2">+2 to one ability</button>
					<button class="cb__mode-btn ${asi.mode === "plus1x2" ? "cb__mode-btn--active" : ""}" data-asi-mode-level="${level}" data-asi-mode="plus1x2">+1 to two abilities</button>
				</div>
				${asi.mode === "plus1x2" ? `
					<p class="cb__detail-meta">Choose 2 different abilities for +1 each:</p>
					<div>${ABILITIES.map(a => {
						const picked = (asi.abilities || []).includes(a);
						const atLimit = !picked && (asi.abilities || []).length >= 2;
						const capped = !picked && !canPlus1(a);
						const disabled = atLimit || capped;
						return `<span class="cb__pill cb__pill--blue" style="cursor:${disabled ? "not-allowed" : "pointer"};${picked ? "" : disabled ? "opacity:0.4;" : ""}" data-asi-pair-level="${level}" data-asi-pair="${a}" data-asi-pair-disabled="${disabled}" title="${capped ? "Would exceed the ability score cap of 20" : ""}">${picked ? "✓ " : ""}${ABILITY_LABELS[a]}</span>`;
					}).join("")}</div>
				` : `
					<p class="cb__detail-meta">+2 to:</p>
					<div>${ABILITIES.map(a => {
						const capped = asi.ability !== a && !canPlus2(a);
						return `<span class="cb__pill cb__pill--blue" style="cursor:${capped ? "not-allowed" : "pointer"};${asi.ability === a ? "" : capped ? "opacity:0.4;" : ""}" data-asi-single-level="${level}" data-asi-single="${a}" data-asi-single-disabled="${capped}" title="${capped ? "Would exceed the ability score cap of 20" : ""}">${asi.ability === a ? "✓ " : ""}${ABILITY_LABELS[a]}</span>`;
					}).join("")}</div>
				`}
			`;
		};

		const featChoicePickerHtml = level => {
			const slot = this.getAsiSlot(level);
			if (!slot.feat) return "";
			const feat = findFeat(slot.feat.name, slot.feat.source);
			const reqs = featChoiceRequirements(feat);
			if (!reqs.length) return "";
			return `
				<div class="cb__block">
					${reqs.map(req => {
						const picked = this.getFeatChoice(level, req.id);
						return `
							<p class="cb__detail-meta">${esc(req.label)} — choose ${req.count}${picked.length ? ` (${picked.length}/${req.count} picked)` : ""}:</p>
							<div>${req.options.map(opt => {
								const isPicked = picked.includes(opt.key);
								const atLimit = !isPicked && picked.length >= req.count;
								return `<span class="cb__pill cb__pill--blue" style="cursor:${atLimit ? "not-allowed" : "pointer"};${isPicked ? "" : atLimit ? "opacity:0.4;" : ""}" data-feat-choice-level="${level}" data-feat-choice-req="${esc(req.id)}" data-feat-choice-opt="${esc(opt.key)}" data-feat-choice-count="${req.count}">${isPicked ? "✓ " : ""}${esc(opt.label)}</span>`;
							}).join("")}</div>
						`;
					}).join("")}
				</div>
			`;
		};

		const featSpellPickerHtml = level => {
			const slot = this.getAsiSlot(level);
			if (!slot.feat) return "";
			const feat = findFeat(slot.feat.name, slot.feat.source);
			const blocks = feat?.additionalSpells;
			if (!blocks?.length) return "";
			let html = "";
			if (blocks.length > 1) {
				const flavor = slot.featSpellChoice?.flavor;
				html += `<p class="cb__detail-meta">Choose a spell list:</p><div>${blocks.map(b => `<span class="cb__pill cb__pill--blue" style="cursor:pointer;" data-feat-spell-flavor-level="${level}" data-feat-spell-flavor="${esc(b.name)}">${flavor === b.name ? "✓ " : ""}${esc(b.name)}</span>`).join("")}</div>`;
			}
			const activeBlock = activeSpellFlavor(feat, slot);
			if (!activeBlock) return html;
			const units = flattenAdditionalSpellsBlock(activeBlock, this.char);
			const fixedUnits = units.filter(u => u.fixed);
			if (fixedUnits.length) {
				html += `<p class="cb__detail-meta">Automatically granted:</p><div>${fixedUnits.map(u => {
					const sp = resolveSpellUid(u.fixed);
					return `<span class="cb__pill cb__pill--static cb__pill--blue">${esc(sp?.name || u.fixed)}${u.freqLabel ? ` (${esc(u.freqLabel)})` : ""}</span>`;
				}).join("")}</div>`;
			}
			units.filter(u => u.query).forEach(unit => {
				const picked = (slot.featSpellChoice?.picks || {})[unit.id] || [];
				const options = spellsForChooseQuery(unit.query);
				const modeLabel = unit.mode === "known" ? "Spell Known" : unit.mode === "prepared" ? "Always Prepared" : `Innate Spell${unit.freqLabel ? ` (${unit.freqLabel})` : ""}`;
				html += `
					<p class="cb__detail-meta">${esc(modeLabel)} — choose ${unit.count}${picked.length ? ` (${picked.length}/${unit.count} picked)` : ""}${!options.length ? " (no matching spells found)" : ""}:</p>
					<div class="cb__scroll-list">${options.map(sp => {
						const isPicked = picked.some(p => p.name === sp.name && p.source === sp.source);
						const atLimit = !isPicked && picked.length >= unit.count;
						return `<span class="cb__pill cb__pill--blue" style="cursor:${atLimit ? "not-allowed" : "pointer"};${isPicked ? "" : atLimit ? "opacity:0.4;" : ""}" data-feat-spell-level="${level}" data-feat-spell-unit="${esc(unit.id)}" data-feat-spell-name="${esc(sp.name)}" data-feat-spell-source="${esc(sp.source)}" data-feat-spell-count="${unit.count}">${isPicked ? "✓ " : ""}${esc(sp.name)}</span>`;
					}).join("")}</div>
				`;
			});
			return html;
		};

		const slotsHtml = slotLevels.map(level => {
			const slot = this.getAsiSlot(level);
			// this.activeAsiSlot comes from a click handler's el.dataset (always a string); level
			// here is the numeric value from classAsiLevels() — coerce both sides to compare.
			const isActivePicker = String(this.activeAsiSlot) === String(level);
			return `
				<div class="cb__detail-card cb__block">
					<p class="cb__section-header">Level ${level} — Ability Score Improvement</p>
					<div style="margin-bottom:8px;">
						<button class="cb__mode-btn ${slot.type === "feat" ? "cb__mode-btn--active" : ""}" data-slot-type-level="${level}" data-slot-type="feat">Feat</button>
						<button class="cb__mode-btn ${slot.type === "asi" ? "cb__mode-btn--active" : ""}" data-slot-type-level="${level}" data-slot-type="asi">Ability Score Improvement</button>
					</div>
					${slot.type === "feat" ? `
						${slot.feat
							? `<p class="cb__detail-meta">Chosen: <strong>${esc(slot.feat.name)}</strong> ${srcBadge(slot.feat.source)} <button type="button" class="ve-btn ve-btn-default ve-btn-xs" data-slot-toggle-picker-level="${level}" style="margin-left:6px;">${isActivePicker ? "Close" : "Change"}</button></p>`
							: `<p class="cb__hint">No feat chosen yet. <button type="button" class="ve-btn ve-btn-default ve-btn-xs" data-slot-toggle-picker-level="${level}">${isActivePicker ? "Close" : "Choose Feat"}</button></p>`}
						${isActivePicker ? featPickerHtml(level) : ""}
						${!isActivePicker ? featChoicePickerHtml(level) : ""}
						${!isActivePicker ? featSpellPickerHtml(level) : ""}
					` : slot.type === "asi" ? asiPickerHtml(level) : `
						<p class="cb__hint">Choose Feat or Ability Score Improvement above.</p>
					`}
				</div>
			`;
		}).join("");

		setTimeout(() => {
			document.querySelectorAll("[data-slot-type-level]").forEach(el => el.addEventListener("click", () => {
				const level = el.dataset.slotTypeLevel, type = el.dataset.slotType;
				const cur = this.getAsiSlot(level);
				if (type === "feat") this.setAsiSlot(level, {type: "feat", asi: null});
				else this.setAsiSlot(level, {type: "asi", feat: null, asi: cur.asi || {mode: "plus2", ability: null, abilities: []}});
				this.activeAsiSlot = null;
				this.render();
			}));
			document.querySelectorAll("[data-slot-toggle-picker-level]").forEach(el => el.addEventListener("click", () => {
				const level = el.dataset.slotTogglePickerLevel;
				this.activeAsiSlot = this.activeAsiSlot === level ? null : level;
				this.render();
			}));
			document.querySelectorAll("[data-feat-browse-level]").forEach(el => el.addEventListener("click", async () => {
				if (!modalFilterFeats) return;
				const level = el.dataset.featBrowseLevel;
				const selected = await modalFilterFeats.pGetUserSelection();
				if (!selected?.length) return;
				const match = resolveModalSelection(selected[0], FEATS);
				if (!match) return;
				const key = `${match.name}|${match.source}`;
				const curFeat = this.getAsiSlot(level).feat;
				const isSameAsCurrent = curFeat && curFeat.name === match.name && curFeat.source === match.source;
				if (!match.repeatable && !isSameAsCurrent && takenFeatKeys.has(key)) {
					JqueryUtil.doToast({
						type: "danger",
						content: `"${match.name}" is already taken at another level — selection ignored.`,
					});
					return;
				}
				this.setAsiSlot(level, {type: "feat", feat: {name: match.name, source: match.source}, asi: null, featChoice: isSameAsCurrent ? this.getAsiSlot(level).featChoice : {}, featSpellChoice: isSameAsCurrent ? this.getAsiSlot(level).featSpellChoice : {flavor: null, picks: {}}});
				this.activeAsiSlot = null;
				this.render();
			}));
			document.querySelectorAll("[data-feat-expand]").forEach(el => el.addEventListener("click", e => {
				if (e.target.closest("[data-feat-pick]")) return;
				const key = `${el.dataset.featExpand}|${el.dataset.featExpandSource}`;
				this.expandedFeat = this.expandedFeat === key ? null : key;
				this.render();
			}));
			document.querySelectorAll("[data-feat-pick]").forEach(el => el.addEventListener("click", e => {
				e.stopPropagation();
				if (el.dataset.featPickDisabled === "true") return;
				const level = el.dataset.featPickLevel;
				const feat = FEATS.find(f => f.name === el.dataset.featPick && f.source === el.dataset.featPickSource);
				if (!feat) return;
				const curFeat = this.getAsiSlot(level).feat;
				const isSame = curFeat && curFeat.name === feat.name && curFeat.source === feat.source;
				this.setAsiSlot(level, {type: "feat", feat: {name: feat.name, source: feat.source}, asi: null, featChoice: isSame ? this.getAsiSlot(level).featChoice : {}, featSpellChoice: isSame ? this.getAsiSlot(level).featSpellChoice : {flavor: null, picks: {}}});
				this.activeAsiSlot = null;
				this.render();
			}));
			document.querySelectorAll("[data-feat-choice-opt]").forEach(el => el.addEventListener("click", () => {
				this.toggleFeatChoiceOption(el.dataset.featChoiceLevel, el.dataset.featChoiceReq, el.dataset.featChoiceOpt, Number(el.dataset.featChoiceCount));
				this.render();
			}));
			document.querySelectorAll("[data-feat-spell-flavor]").forEach(el => el.addEventListener("click", () => {
				this.setFeatSpellFlavor(el.dataset.featSpellFlavorLevel, el.dataset.featSpellFlavor);
				this.render();
			}));
			document.querySelectorAll("[data-feat-spell-name]").forEach(el => el.addEventListener("click", () => {
				this.toggleFeatSpellPick(el.dataset.featSpellLevel, el.dataset.featSpellUnit, el.dataset.featSpellName, el.dataset.featSpellSource, Number(el.dataset.featSpellCount));
				this.render();
			}));
			document.querySelectorAll("[data-asi-mode-level]").forEach(el => el.addEventListener("click", () => {
				const level = el.dataset.asiModeLevel, mode = el.dataset.asiMode;
				const cur = this.getAsiSlot(level).asi || {};
				const asi = mode === "plus1x2"
					? {mode, ability: null, abilities: cur.abilities || []}
					: {mode, ability: cur.ability || null, abilities: []};
				this.setAsiSlot(level, {asi});
				this.render();
			}));
			document.querySelectorAll("[data-asi-single-level]").forEach(el => el.addEventListener("click", () => {
				if (el.dataset.asiSingleDisabled === "true") return;
				const level = el.dataset.asiSingleLevel, a = el.dataset.asiSingle;
				const cur = this.getAsiSlot(level).asi || {mode: "plus2", ability: null, abilities: []};
				this.setAsiSlot(level, {asi: {...cur, mode: "plus2", ability: cur.ability === a ? null : a}});
				this.render();
			}));
			document.querySelectorAll("[data-asi-pair-level]").forEach(el => el.addEventListener("click", () => {
				if (el.dataset.asiPairDisabled === "true") return;
				const level = el.dataset.asiPairLevel, a = el.dataset.asiPair;
				const cur = this.getAsiSlot(level).asi || {mode: "plus1x2", ability: null, abilities: []};
				const abilities = cur.abilities || [];
				const next = abilities.includes(a) ? abilities.filter(x => x !== a) : [...abilities, a].slice(0, 2);
				this.setAsiSlot(level, {asi: {...cur, mode: "plus1x2", abilities: next}});
				this.render();
			}));
		}, 0);

		return `
			<p class="cb__hint">${slotLevels.length === 0
				? "No Ability Score Improvement slots yet at this level."
				: `${slotLevels.length} slot${slotLevels.length > 1 ? "s" : ""} available (level${slotLevels.length > 1 ? "s" : ""} ${slotLevels.join(", ")}) — each is either a feat or an ability score improvement.`}</p>
			${slotsHtml}
		`;
	},

	// ─── STEP 9: SPELLS ────────────────────────────────────────────────────
	renderSpells() {
		const src = spellcastingSource(this.char.cls, this.char.subclass);
		if (!src) {
			return `
				<div class="cb__no-caster">
					<p class="cb__no-caster-icon">⚔️</p>
					<p class="cb__no-caster-title">${esc(this.char.cls?.name || "Your class")} doesn't cast spells</p>
					<p class="cb__hint">Skip ahead to the character sheet.</p>
				</div>
			`;
		}

		const level = this.char.level;
		const mod = scoreMod(this.finalScores()[src.spellcastingAbility] ?? 10);
		const maxCantrips = cantripsKnownCount(src, level);
		const maxKnown = spellsKnownOrPreparedCount(src, level, mod);
		const maxLvl = maxSpellLevel(src, level);

		const available = spellsAvailable(this.char.cls, this.char.subclass);
		const cantripPool = available.filter(sp => sp.level === 0);
		const leveledPool = available.filter(sp => sp.level >= 1 && sp.level <= maxLvl);

		const isChosen = sp => this.char.spells.some(cs => cs.name === sp.name && cs.source === sp.source);
		const chosenSpellLevel = cs => findSpell(cs.name, cs.source)?.level;
		const chosenCantripCount = this.char.spells.filter(cs => chosenSpellLevel(cs) === 0).length;
		const chosenKnownCount = this.char.spells.filter(cs => { const lvl = chosenSpellLevel(cs); return lvl != null && lvl >= 1; }).length;

		const tabs = [];
		if (cantripPool.length) tabs.push(["cantrips", "Cantrips", cantripPool, maxCantrips, chosenCantripCount]);
		for (let n = 1; n <= maxLvl; n++) {
			const pool = leveledPool.filter(sp => sp.level === n);
			if (pool.length) tabs.push([`L${n}`, Parser.spLevelToFull(n), pool, maxKnown, chosenKnownCount]);
		}
		if (!tabs.length) {
			return `
				<div class="cb__no-caster">
					<p class="cb__no-caster-icon">📖</p>
					<p class="cb__no-caster-title">${esc(this.char.cls.name)} hasn't gained any spells yet at level ${level}</p>
					<p class="cb__hint">Skip ahead to the character sheet, or raise your level.</p>
				</div>
			`;
		}
		const tab = tabs.some(([k]) => k === this.spellTab) ? this.spellTab : tabs[0][0];
		const [, , pool, maxPick, chosenInTab] = tabs.find(([k]) => k === tab);

		const filtered = pool
			.filter(sp => sp.name.toLowerCase().includes(this.search.toLowerCase()))
			.filter(sp => !this.hideUnselectedSpells || isChosen(sp));

		const tabBtns = tabs.map(([k, l]) => `<button class="cb__mode-btn ${tab === k ? "cb__mode-btn--active" : ""}" data-spell-tab="${k}">${l}</button>`).join("");

		const grid = filtered.map(sp => {
			const chosen = isChosen(sp);
			const canPick = chosen || chosenInTab < maxPick;
			return `
				<div class="cb__spell-row ${chosen ? "cb__spell-row--chosen" : ""}" style="cursor:${canPick ? "pointer" : "not-allowed"};opacity:${canPick ? 1 : 0.45}" data-spell="${esc(sp.name)}" data-spell-source="${esc(sp.source)}" data-can-pick="${canPick}" title="${esc(spellDesc(sp))}">
					<div class="cb__skill-dot ${chosen ? "cb__skill-dot--on-blue" : ""}"></div>
					<span class="cb__skill-name">${esc(sp.name)}</span>
					${srcBadge(sp.source)}
				</div>
			`;
		}).join("");

		const toggleSpell = sp => {
			const chosen = isChosen(sp);
			const canPick = chosen || chosenInTab < maxPick;
			if (!canPick && !chosen) return;
			if (chosen) this.char.spells = this.char.spells.filter(cs => !(cs.name === sp.name && cs.source === sp.source));
			else this.char.spells = [...this.char.spells, {name: sp.name, source: sp.source}];
		};

		setTimeout(() => {
			document.querySelectorAll("[data-spell-tab]").forEach(el => el.addEventListener("click", () => { this.spellTab = el.dataset.spellTab; this.render(); }));
			document.getElementById("cb-spell-hide-toggle")?.addEventListener("click", () => { this.hideUnselectedSpells = !this.hideUnselectedSpells; this.render(); });
			document.getElementById("cb-spell-browse")?.addEventListener("click", async () => {
				if (!modalFilterSpells) return;
				// Force the modal's own "Class" and "Level" filters to this character's class and
				// castable range, so the browse list is pre-scoped instead of showing the full
				// compendium (or spells above what this character can actually cast).
				const selected = await modalFilterSpells.pGetUserSelection({filterExpression: `class=${this.char.cls.name}|level=0;${Array.from({ length: maxLvl }, (_, i) => i + 1).join(';')}`});
				if (!selected?.length) return;
				const match = resolveModalSelection(selected[0], SPELLS);
				if (!match) return;
				// Belt-and-suspenders: the filters above are a default, not a lock — the user can still
				// clear/change them inside the modal before confirming. Re-validate against the real
				// class/subclass spell list and castable level range, and reject+flag anything that
				// slips through.
				const isOnList = available.some(sp => sp.name === match.name && sp.source === match.source);
				if (!isOnList) {
					JqueryUtil.doToast({
						type: "danger",
						content: `"${match.name}" isn't on ${this.char.cls.name}'s spell list${this.char.subclass && src === this.char.subclass ? ` (or ${this.char.subclass.name}'s)` : ""} — selection ignored.`,
					});
					return;
				}
				if (match.level > maxLvl) {
					JqueryUtil.doToast({
						type: "danger",
						content: `"${match.name}" is a ${Parser.spLevelToFull(match.level)} spell, but ${this.char.cls.name} can only cast up to ${maxLvl ? Parser.spLevelToFull(maxLvl) : "cantrips"} at level ${level} — selection ignored.`,
					});
					return;
				}
				toggleSpell(match);
				this.render();
			});
			document.querySelectorAll("[data-spell]").forEach(el => el.addEventListener("click", () => {
				if (el.dataset.canPick !== "true") return;
				const sp = SPELLS.find(s => s.name === el.dataset.spell && s.source === el.dataset.spellSource);
				if (!sp) return;
				toggleSpell(sp);
				this.render();
			}));
		}, 0);

		return `
			<p class="cb__hint">Choose your starting spells for <strong>${esc(this.char.cls.name)}</strong>${this.char.subclass && src === this.char.subclass ? ` (${esc(this.char.subclass.name)})` : ""}.</p>
			<button id="cb-spell-browse" type="button" class="ve-btn ve-btn-default cb__search" title="Open the site's full spell filter/search">🔍 Browse &amp; Filter Spells</button>
			<input class="ve-form-control cb__search" data-search value="${esc(this.search)}" placeholder="...or quick-filter this list by name">
			<div class="cb__spell-tabs">
				${tabBtns}
				<span class="cb__spell-count">(${chosenInTab}/${maxPick} chosen)</span>
				<button id="cb-spell-hide-toggle" type="button" class="ve-btn ve-btn-default ve-btn-xs" style="margin-left:auto;">${this.hideUnselectedSpells ? "Show All" : "Hide Unselected"}</button>
			</div>
			<div class="cb__spell-grid">${grid || `<p class="cb__placeholder">No spells match.</p>`}</div>
		`;
	},

	// ─── STEP 10: SHEET ────────────────────────────────────────────────────
	// ─── PLAY TRACKER (Sheet step) ─────────────────────────────────────────
	// State lives in char.play (see EMPTY_CHAR()). Every mutator below ends by calling
	// refreshPlayCard() rather than a full render() — that only replaces the #cb-play-card
	// subtree, so clicking a pip doesn't reset scroll position or collapse expanded feature pills
	// elsewhere on the Sheet step (same reasoning as the name-field/level-slider partial updates
	// on the Name step).
	/**
	 * Single source of truth for every equipped-item/feat/feature-derived combat stat — AC, HP
	 * bonus, speed, initiative, save/skill bonuses and advantage, resistances/immunities/senses,
	 * and attack/damage/spellcasting bonuses. Replaces what used to be two separately-hardcoded
	 * "10 + DEX mod" AC formulas (Sheet render + PDF export) with one real calc that accounts for
	 * equipped armor/shield, Barbarian/Monk Unarmored Defense, and every collectEffects() source.
	 * Stacking: numeric bonuses are additive across sources; ability-score "set" effects (folded
	 * into finalScores() already, not here) take the max; proficiency/advantage/resistance grants
	 * are a plain union (having it from two sources isn't double-counted).
	 */
	derivedCombatStats() {
		const char = this.char;
		const scores = this.finalScores();
		const effects = collectEffects(char);
		const sum = key => effects.filter(e => e.key === key && e.mode === "add").reduce((s, e) => s + (Number(e.value) || 0), 0);
		const setOf = prefix => new Set(effects.filter(e => e.key.startsWith(prefix + ".")).map(e => e.key.slice(prefix.length + 1)));
		const dexMod = scoreMod(scores.dex);

		// ── AC ──────────────────────────────────────────────────────────────
		const equippedItems = equippedResolvedItems(char);
		const armor = equippedItems.find(it => ["LA", "MA", "HA"].includes((it.type || "").split("|")[0]));
		const hasShield = equippedItems.some(it => (it.type || "").split("|")[0] === "S");
		// RAW: Monk's Unarmored Defense excludes wielding a shield entirely (falls back to plain
		// 10+DEX, no ability bonus); Barbarian's explicitly stacks with one — see
		// UNARMORED_DEFENSE/unarmoredDefenseInfo() above for the per-class rule text.
		const unarmoredDef = !armor ? unarmoredDefenseInfo(char, hasShield) : null;
		let baseAc, acSource;
		if (unarmoredDef) { baseAc = 10 + dexMod + scoreMod(scores[unarmoredDef.ability]); acSource = unarmoredDef.label; }
		else if (armor) {
			const armorType = (armor.type || "").split("|")[0];
			const armorDexMod = armorType === "HA" ? 0 : armorType === "MA" ? Math.min(dexMod, 2) : dexMod;
			baseAc = (armor.ac || 10) + armorDexMod; acSource = armor.name;
		} else { baseAc = 10 + dexMod; acSource = "Unarmored"; }
		const ac = baseAc + (hasShield ? 2 : 0) + sum("ac");

		// ── HP / Speed / Initiative ────────────────────────────────────────
		const hpBase = char.cls ? getHP(char.cls, scores.con, char.level) : 0;
		const hpBonus = sum("hpBonus");
		let speed = raceWalkSpeed(char.race) + sum("speed.walk");
		effects.filter(e => e.key === "speed.walk" && e.mode === "multiply").forEach(e => { speed *= Number(e.value) || 1; });
		const initiative = dexMod + sum("initiativeBonus");

		// ── Saves / skills ──────────────────────────────────────────────────
		const skillBonusOf = name => sum(`skillBonus.${name.toLowerCase().replace(/\s+/g, "")}`);

		return {
			ac, acSource, hasShield, armor,
			hpMax: hpBase + hpBonus, hpBonus,
			speed, initiative,
			saveBonusAll: sum("saveBonusAll"), checkBonusAll: sum("abilityCheckBonusAll"),
			saveAdvantage: setOf("saveAdvantage"), skillAdvantage: setOf("skillAdvantage"),
			skillBonusOf,
			extraSaveProf: setOf("saveProf"), extraSkillProf: setOf("skillProf"), extraSkillExpertise: setOf("skillExpertise"),
			toolProf: setOf("toolProf"), languageProf: setOf("languageProf"), weaponProf: setOf("weaponProf"), armorProf: setOf("armorProf"),
			resistances: setOf("resist"), immunities: setOf("immune"), conditionImmunities: setOf("conditionImmune"),
			senses: Object.fromEntries(effects.filter(e => e.key.startsWith("sense.")).map(e => [e.key.slice(6), e.value])),
			attackBonus: {mw: sum("attackBonus.mw"), rw: sum("attackBonus.rw"), ms: sum("attackBonus.ms"), rs: sum("attackBonus.rs")},
			damageBonus: {mw: sum("damageBonus.mw"), rw: sum("damageBonus.rw"), ms: sum("damageBonus.ms"), rs: sum("damageBonus.rs")},
			spellAttackBonus: sum("spellAttackBonus"), spellSaveDcBonus: sum("spellSaveDcBonus"),
			flags: new Set(effects.filter(e => e.key.startsWith("flag.")).map(e => e.key.slice(5))),
			effects,
		};
	},
	hpMax() {
		return this.derivedCombatStats().hpMax;
	},
	hpCurrent() {
		const p = this.char.play, max = this.hpMax();
		return p.hpCurrent == null ? max : Math.max(0, Math.min(p.hpCurrent, max));
	},
	hitDiceTotal() { return this.char.level; },

	applyDamage(amount) {
		if (!(amount > 0)) return;
		const p = this.char.play;
		let remaining = amount;
		const tempUsed = Math.min(p.hpTemp, remaining);
		p.hpTemp -= tempUsed; remaining -= tempUsed;
		p.hpCurrent = Math.max(0, this.hpCurrent() - remaining);
		this.refreshPlayCard();
	},
	applyHeal(amount) {
		if (!(amount > 0)) return;
		const p = this.char.play;
		const newCur = Math.min(this.hpMax(), this.hpCurrent() + amount);
		p.hpCurrent = newCur;
		if (newCur > 0) p.deathSaves = {success: 0, fail: 0};
		this.refreshPlayCard();
	},
	setTempHP(amount) {
		this.char.play.hpTemp = Math.max(0, Math.floor(amount) || 0);
		this.refreshPlayCard();
	},
	spendHitDie() {
		const total = this.hitDiceTotal(), used = Math.min(this.char.play.hitDiceUsed, total);
		if (total - used <= 0) return;
		const faces = this.char.cls?.hd?.faces || 8;
		const conMod = scoreMod(this.finalScores().con);
		const heal = Math.max(0, Math.floor(faces / 2) + 1 + conMod);
		this.char.play.hitDiceUsed = used + 1;
		this.applyHeal(heal); // also refreshes the card
	},
	// Generic handler for every pip row (see pipRowHtml()) — "kind" picks which counter, "key"
	// disambiguates within it (spell level, resource def key; unused for hit dice/pact/death saves).
	setPipUsed(kind, key, idx) {
		const p = this.char.play;
		const read = () => {
			switch (kind) {
				case "hitdice": return p.hitDiceUsed;
				case "pact": return p.pactSlotsUsed;
				case "slot": return p.slotsUsed[key] || 0;
				case "resource": return p.resourcesUsed[key] || 0;
				case "item-charge": return p.itemCharges[key] || 0;
				case "death-success": return p.deathSaves.success;
				case "death-fail": return p.deathSaves.fail;
				default: return 0;
			}
		};
		const used = read();
		const next = idx < used ? idx : idx + 1;
		switch (kind) {
			case "hitdice": p.hitDiceUsed = next; break;
			case "pact": p.pactSlotsUsed = next; break;
			case "slot": p.slotsUsed[key] = next; break;
			case "resource": p.resourcesUsed[key] = next; break;
			case "item-charge": p.itemCharges[key] = next; break;
			case "death-success": p.deathSaves.success = next; break;
			case "death-fail": p.deathSaves.fail = next; break;
		}
		this.refreshPlayCard();
	},
	/** Manual full-recharge for one item's charges — always available regardless of its native
	 * `recharge` field, since `recharge: "special"` and no-recharge-field items (see
	 * chargeItemDefs()) have no rest this engine can hook automatically. */
	resetItemCharge(key) { this.char.play.itemCharges[key] = 0; this.refreshPlayCard(); },
	shortRest() {
		const p = this.char.play, char = this.char;
		classResourceDefs(char).filter(d => d.shortRest).forEach(d => { p.resourcesUsed[d.key] = 0; });
		// Pact Magic (Warlock) is the one spell-slot pool that recharges on a short rest rather
		// than only a long rest — regular spell slots are untouched here.
		const src = spellcastingSource(char.cls, char.subclass);
		if (spellSlotInfo(src, char.level)?.type === "pact") p.pactSlotsUsed = 0;
		this.refreshPlayCard();
	},
	longRest() {
		const p = this.char.play;
		p.hpCurrent = this.hpMax();
		const total = this.hitDiceTotal();
		p.hitDiceUsed = Math.max(0, p.hitDiceUsed - Math.max(1, Math.floor(total / 2)));
		p.slotsUsed = {};
		p.pactSlotsUsed = 0;
		p.resourcesUsed = {};
		p.deathSaves = {success: 0, fail: 0};
		p.exhaustion = Math.max(0, p.exhaustion - 1);
		// Items whose native `recharge` is a time-of-day trigger (dawn/dusk/midnight) or
		// "restLong" all recharge here — we don't track an actual day/night clock, so any of
		// those is treated as "recharges by your next Long Rest." `recharge: "special"` and items
		// with no recharge field at all get no automatic behavior — see the manual per-item Reset
		// button in the Play Tracker instead (chargeItemDefs()/resetItemCharge()).
		chargeItemDefs(this.char).filter(d => ["dawn", "dusk", "midnight", "restLong"].includes(d.recharge)).forEach(d => {
			const avg = diceAverage(d.rechargeAmount);
			const used = p.itemCharges[d.key] || 0;
			p.itemCharges[d.key] = avg == null ? 0 : Math.max(0, used - avg);
		});
		this.refreshPlayCard();
	},
	setRulesOverride(val) { this.char.play.rulesOverride = val || null; this.refreshPlayCard(); },
	adjustExhaustion(delta) { this.char.play.exhaustion = Math.max(0, Math.min(6, this.char.play.exhaustion + delta)); this.refreshPlayCard(); },
	clearDeathSaves() { this.char.play.deathSaves = {success: 0, fail: 0}; this.refreshPlayCard(); },

	renderPlayCard() {
		const char = this.char;
		if (!char.cls) return `<div class="cb__detail-card cb__play-card"><p class="cb__placeholder">Pick a class to unlock session tracking.</p></div>`;
		const maxHP = this.hpMax(), curHP = this.hpCurrent(), tempHP = char.play.hpTemp || 0;
		const faces = char.cls.hd?.faces || 8;
		const hitDiceTotal = this.hitDiceTotal(), hitDiceUsed = Math.min(char.play.hitDiceUsed, hitDiceTotal);
		const conMod = scoreMod(this.finalScores().con);
		const avgHeal = Math.max(0, Math.floor(faces / 2) + 1 + conMod);
		const src = spellcastingSource(char.cls, char.subclass);
		const slotInfo = src ? spellSlotInfo(src, char.level) : null;
		const resourceDefs = classResourceDefs(char);
		let siteDefaultLabel = "Modern (2024)";
		try { if (typeof VetoolsConfig !== "undefined" && VetoolsConfig.get("styleSwitcher", "style") === "classic") siteDefaultLabel = "Classic (2014)"; } catch (err) { /* VetoolsConfig not ready */ }

		return `
		<div class="cb__detail-card cb__play-card">
			<div class="cb__play-hd">
				<p class="cb__section-header cb__play-hd-title">Play Tracker</p>
				<label class="cb__rules-select-wrap">Rest rules
					<select id="cb-rules-select" class="cb__rules-select">
						<option value="" ${!char.play.rulesOverride ? "selected" : ""}>Site default (${esc(siteDefaultLabel)})</option>
						<option value="classic" ${char.play.rulesOverride === "classic" ? "selected" : ""}>Classic (2014)</option>
						<option value="one" ${char.play.rulesOverride === "one" ? "selected" : ""}>Modern (2024)</option>
					</select>
				</label>
			</div>
			<div class="cb__play-grid">
				<div class="cb__play-block">
					<p class="cb__play-block-label">Hit Points</p>
					<div class="cb__hp-display">
						<span class="cb__hp-cur ${curHP === 0 ? "cb__hp-cur--zero" : ""}">${curHP}</span><span class="cb__hp-sep">/</span><span class="cb__hp-max">${maxHP}</span>
						${tempHP > 0 ? `<span class="cb__hp-temp-badge">+${tempHP} temp</span>` : ""}
					</div>
					<div class="cb__hp-controls">
						<input type="number" min="0" id="cb-hp-amount" class="cb__hp-input" placeholder="amount">
						<button type="button" data-hp-dmg class="ve-btn ve-btn-xs ve-btn-danger">− Damage</button>
						<button type="button" data-hp-heal class="ve-btn ve-btn-xs ve-btn-success">+ Heal</button>
					</div>
					<div class="cb__hp-controls">
						<input type="number" min="0" id="cb-hp-temp-amount" class="cb__hp-input" placeholder="temp HP" value="${tempHP || ""}">
						<button type="button" data-hp-temp-set class="ve-btn ve-btn-xs ve-btn-default">Set Temp HP</button>
					</div>
				</div>
				<div class="cb__play-block">
					<p class="cb__play-block-label">Hit Dice (d${faces}) — ${hitDiceTotal - hitDiceUsed}/${hitDiceTotal} left</p>
					${pipRowHtml("hitdice", "", hitDiceTotal, hitDiceUsed)}
					<button type="button" data-spend-hit-die class="ve-btn ve-btn-xs ve-btn-default" ${hitDiceTotal - hitDiceUsed <= 0 ? "disabled" : ""}>Spend Hit Die (~${avgHeal} HP)</button>
				</div>
				${slotInfo?.type === "slots" ? `
				<div class="cb__play-block">
					<p class="cb__play-block-label">Spell Slots</p>
					${slotInfo.slots.map((max, i) => max > 0 ? `<div class="cb__pip-line"><span class="cb__pip-line-label">Lvl ${i + 1}</span>${pipRowHtml("slot", String(i + 1), max, char.play.slotsUsed[String(i + 1)] || 0)}</div>` : "").join("")}
				</div>` : ""}
				${slotInfo?.type === "pact" ? `
				<div class="cb__play-block">
					<p class="cb__play-block-label">Pact Magic (Lvl ${slotInfo.slotLevel} slots)</p>
					${pipRowHtml("pact", "", slotInfo.count, char.play.pactSlotsUsed)}
				</div>` : ""}
				${resourceDefs.map(d => `
				<div class="cb__play-block">
					<p class="cb__play-block-label">${esc(d.label)}${d.dieFaces ? ` (d${d.dieFaces})` : ""}</p>
					${pipRowHtml("resource", d.key, d.max, char.play.resourcesUsed[d.key] || 0)}
				</div>`).join("")}
				${chargeItemDefs(char).map(d => `
				<div class="cb__play-block">
					<p class="cb__play-block-label">${esc(d.label)} — ${d.max - (char.play.itemCharges[d.key] || 0)}/${d.max} charges${d.recharge ? ` (recharges ${esc(RECHARGE_LABEL[d.recharge] || d.recharge)})` : " (no natural recharge)"}</p>
					${pipRowHtml("item-charge", d.key, d.max, char.play.itemCharges[d.key] || 0)}
					<button type="button" data-reset-charge="${esc(d.key)}" class="ve-btn ve-btn-xs ve-btn-default">Reset to Full</button>
				</div>`).join("")}
				<div class="cb__play-block">
					<p class="cb__play-block-label">Inspiration &amp; Exhaustion</p>
					<label class="cb__inspiration-toggle"><input type="checkbox" id="cb-inspiration" ${char.play.inspiration ? "checked" : ""}> Inspiration</label>
					<div class="cb__exhaustion-row">
						<span>Exhaustion</span>
						<button type="button" data-exhaustion-dec class="cb__pb-btn" ${char.play.exhaustion <= 0 ? "disabled" : ""}>−</button>
						<span class="cb__pb-total">${char.play.exhaustion}</span>
						<button type="button" data-exhaustion-inc class="cb__pb-btn" ${char.play.exhaustion >= 6 ? "disabled" : ""}>+</button>
					</div>
				</div>
				${curHP === 0 ? `
				<div class="cb__play-block">
					<p class="cb__play-block-label">Death Saves</p>
					<div class="cb__death-row"><span class="cb__death-label">Successes</span>${pipRowHtml("death-success", "", 3, char.play.deathSaves.success)}</div>
					<div class="cb__death-row"><span class="cb__death-label">Failures</span>${pipRowHtml("death-fail", "", 3, char.play.deathSaves.fail)}</div>
					<button type="button" data-death-clear class="ve-btn ve-btn-xs ve-btn-default">Reset Death Saves</button>
				</div>` : ""}
			</div>
			<div class="cb__rest-row">
				<button type="button" data-short-rest class="ve-btn ve-btn-default">Short Rest</button>
				<button type="button" data-long-rest class="ve-btn ve-btn-primary">Long Rest</button>
			</div>
		</div>`;
	},

	wirePlayCard() {
		const card = document.getElementById("cb-play-card");
		if (!card) return;
		card.querySelectorAll("[data-pip-kind]").forEach(el => el.addEventListener("click", () => {
			this.setPipUsed(el.dataset.pipKind, el.dataset.pipKey, Number(el.dataset.pipIdx));
		}));
		card.querySelector("[data-hp-dmg]")?.addEventListener("click", () => {
			const inp = document.getElementById("cb-hp-amount");
			this.applyDamage(Number(inp?.value) || 0);
			if (inp) inp.value = "";
		});
		card.querySelector("[data-hp-heal]")?.addEventListener("click", () => {
			const inp = document.getElementById("cb-hp-amount");
			this.applyHeal(Number(inp?.value) || 0);
			if (inp) inp.value = "";
		});
		card.querySelector("[data-hp-temp-set]")?.addEventListener("click", () => {
			this.setTempHP(Number(document.getElementById("cb-hp-temp-amount")?.value) || 0);
		});
		card.querySelector("[data-spend-hit-die]")?.addEventListener("click", () => this.spendHitDie());
		card.querySelector("[data-short-rest]")?.addEventListener("click", () => this.shortRest());
		card.querySelector("[data-long-rest]")?.addEventListener("click", () => this.longRest());
		card.querySelector("[data-exhaustion-inc]")?.addEventListener("click", () => this.adjustExhaustion(1));
		card.querySelector("[data-exhaustion-dec]")?.addEventListener("click", () => this.adjustExhaustion(-1));
		card.querySelector("[data-death-clear]")?.addEventListener("click", () => this.clearDeathSaves());
		card.querySelectorAll("[data-reset-charge]").forEach(el => el.addEventListener("click", () => this.resetItemCharge(el.dataset.resetCharge)));
		card.querySelector("#cb-inspiration")?.addEventListener("change", e => { this.char.play.inspiration = e.target.checked; });
		card.querySelector("#cb-rules-select")?.addEventListener("change", e => this.setRulesOverride(e.target.value));
	},
	refreshPlayCard() {
		const card = document.getElementById("cb-play-card");
		if (!card) return;
		card.innerHTML = this.renderPlayCard();
		this.wirePlayCard();
	},

	/** Toggles one equipment part's equipped state (address by entry index + part index within that
	 * entry's `parts` array — stable for the lifetime of a render since equipment isn't reordered
	 * elsewhere). Only equipped items feed derivedCombatStats()/collectEffects() — see
	 * equippedResolvedItems(). Full re-render (not a partial refresh) since this can move AC/HP/
	 * saves/skills/resistances all at once, unlike the Play Tracker's own pip clicks. */
	toggleEquipped(entryIdx, partIdx) {
		const entry = this.char.equipment[entryIdx];
		if (!entry?.parts?.[partIdx]) return;
		const parts = entry.parts.map((p, i) => i === partIdx ? {...p, equipped: !p.equipped} : p);
		this.char.equipment = this.char.equipment.map((e, i) => i === entryIdx ? {...e, parts} : e);
		this.render();
	},

	renderSheet() {
		const finalScores = this.finalScores();
		const allProf = this.allProfSkills();
		const pb = this.pb();
		const char = this.char;
		const ds = this.derivedCombatStats();
		const raceName = char.race?.name || "—";
		const {cantrips, leveled} = chosenSpellsByTier(char);
		const traitLabel = t => t.replace(/^./, c => c.toUpperCase());

		return `
			<div class="cb__sheet-header">
				<div class="cb__sheet-hd-top">
					<div>
						<p class="cb__sheet-name">${esc(char.name || "Unnamed")}</p>
						<p class="cb__sheet-sub">Level ${char.level} ${esc(raceName)} ${esc(char.cls?.name || "—")}${char.subclass ? ` (${esc(char.subclass.name)})` : ""} · ${esc(char.background?.name || "—")}</p>
					</div>
					<div class="cb__sheet-stats">
						${[["HP",ds.hpMax],["AC",ds.ac],["Init",fmtMod(ds.initiative)],["Prof","+"+pb],["Speed",ds.speed + "ft"]].map(([l,v]) => `
							<div class="cb__stat-box"><p class="cb__stat-label">${esc(l)}</p><p class="cb__stat-value">${esc(v)}</p></div>
						`).join("")}
					</div>
				</div>
				<p class="cb__sheet-sub" style="margin-top:6px;">AC from ${esc(ds.acSource)}${ds.hasShield ? " + shield" : ""}${ds.hpBonus ? ` · HP includes +${ds.hpBonus} from items/feats/features` : ""}</p>
			</div>
			<div id="cb-play-card">${this.renderPlayCard()}</div>
			<div class="cb__sheet-grid">
				<div>
					${ABILITIES.map(a => {
						const score = finalScores[a], m = scoreMod(score), isSave = char.cls?.proficiency?.includes(a);
						return `
						<div class="cb__ab-box">
							<p class="cb__ab-label">${ABILITY_LABELS[a].slice(0,3)}</p>
							<p class="cb__ab-score">${score}</p>
							<p class="cb__ab-mod">${fmtMod(m)}</p>
							${isSave ? `<p class="cb__ab-save">save</p>` : ""}
						</div>`;
					}).join("")}
				</div>
				<div>
					<p class="cb__section-header">Saving Throws</p>
					${ABILITIES.map(a => {
						const isProf = char.cls?.proficiency?.includes(a) || ds.extraSaveProf.has(a);
						const bonus = scoreMod(finalScores[a]) + (isProf ? pb : 0) + ds.saveBonusAll;
						const adv = ds.saveAdvantage.has(a);
						return `
						<div class="cb__save-row">
							<div class="cb__skill-dot ${isProf ? "cb__skill-dot--on" : ""}"></div>
							<span class="cb__save-name">${ABILITY_LABELS[a]}${adv ? ` <em title="Advantage on this save">(adv)</em>` : ""}</span>
							<span class="cb__save-bonus">${fmtMod(bonus)}</span>
						</div>`;
					}).join("")}
					${char.cls ? `<div class="cb__block"><p class="cb__section-header">Class Features</p><div>${featureListHtml(classFeatureRefs(char.cls).filter(f => f.ref.level <= char.level), {idPrefix: "sheet-cls", colorClass: "cb__pill--purple", noneLabel: "None yet"})}</div></div>` : ""}
					${char.subclass ? `<div class="cb__block"><p class="cb__section-header">Subclass Features</p><div>${featureListHtml(subclassFeatureRefs(char.subclass).filter(f => f.ref.level <= char.level), {idPrefix: "sheet-sc", colorClass: "cb__pill--indigo", noneLabel: "None yet"})}</div></div>` : ""}
					${char.race ? `<div class="cb__block"><p class="cb__section-header">Racial Traits</p><div>${pillListHtml(namedSubEntries(char.race.entries).map(t => ({name: t.name, body: entriesToHtml(t.entries)})), {idPrefix: "sheet-race-traits", colorClass: "cb__pill--teal"})}</div></div>` : ""}
					${char.background && backgroundFeature(char.background) ? `<div class="cb__block"><p class="cb__section-header">Background Feature</p><div>${entriesToHtml([backgroundFeature(char.background)])}</div></div>` : ""}
					${chosenFeats(char).length ? `<div class="cb__block"><p class="cb__section-header">Feats</p><div>${pillListHtml(chosenFeats(char).map(cf => ({name: cf.name, body: entriesToHtml(findFeat(cf.name, cf.source)?.entries)})), {idPrefix: "sheet-feats", colorClass: "cb__pill--orange"})}</div></div>` : ""}
					${Object.entries(char.levelAsi || {}).some(([, s]) => s?.type === "asi" && s.asi) ? `<div class="cb__block"><p class="cb__section-header">Ability Score Improvements</p><div>${Object.entries(char.levelAsi || {}).filter(([, s]) => s?.type === "asi" && s.asi).sort((a, b) => Number(a[0]) - Number(b[0])).map(([lvl, s]) => {
						const parts = s.asi.mode === "plus1x2"
							? (s.asi.abilities || []).map(a => `+1 ${ABILITY_LABELS[a]}`)
							: s.asi.ability ? [`+2 ${ABILITY_LABELS[s.asi.ability]}`] : [];
						return `<span class="cb__pill cb__pill--static cb__pill--purple">Lvl ${esc(lvl)}: ${esc(parts.join(", ") || "—")}</span>`;
					}).join("")}</div></div>` : ""}
					${(ds.resistances.size || ds.immunities.size || ds.conditionImmunities.size || Object.keys(ds.senses).length) ? `<div class="cb__block">
						<p class="cb__section-header">Resistances / Immunities / Senses</p>
						<div>
							${[...ds.resistances].map(r => `<span class="cb__pill cb__pill--static cb__pill--teal">${esc(traitLabel(r))} resistance</span>`).join("")}
							${[...ds.immunities].map(r => `<span class="cb__pill cb__pill--static cb__pill--indigo">${esc(traitLabel(r))} immunity</span>`).join("")}
							${[...ds.conditionImmunities].map(r => `<span class="cb__pill cb__pill--static cb__pill--indigo">${esc(traitLabel(r))} immune (condition)</span>`).join("")}
							${Object.entries(ds.senses).map(([k, v]) => `<span class="cb__pill cb__pill--static cb__pill--blue">${esc(traitLabel(k))} ${esc(v)}ft</span>`).join("")}
						</div>
					</div>` : ""}
					${(ds.toolProf.size || ds.languageProf.size || ds.weaponProf.size || ds.armorProf.size) ? `<div class="cb__block">
						<p class="cb__section-header">Other Proficiencies</p>
						<div>
							${[...ds.toolProf].map(k => `<span class="cb__pill cb__pill--static cb__pill--green">${esc(capitalizeWords(k.replace(/[_-]+/g, " ")))}</span>`).join("")}
							${[...ds.languageProf].map(k => `<span class="cb__pill cb__pill--static cb__pill--green">${esc(capitalizeWords(k))}</span>`).join("")}
							${[...ds.weaponProf].map(k => `<span class="cb__pill cb__pill--static cb__pill--orange">${esc(capitalizeWords(k))} weapons</span>`).join("")}
							${[...ds.armorProf].map(k => `<span class="cb__pill cb__pill--static cb__pill--orange">${esc(capitalizeWords(k))} armor</span>`).join("")}
						</div>
					</div>` : ""}
				</div>
				<div>
					<p class="cb__section-header">Skills</p>
					${ALL_SKILLS.map(skill => {
						const isProf = allProf.has(skill.name) || ds.extraSkillProf.has(skill.name.toLowerCase());
						const isExpertise = ds.extraSkillExpertise.has(skill.name.toLowerCase());
						const profMult = isExpertise ? 2 : (isProf ? 1 : 0);
						const bonus = scoreMod(finalScores[skill.ability]) + pb * profMult + ds.checkBonusAll + ds.skillBonusOf(skill.name);
						const adv = ds.skillAdvantage.has(skill.name.toLowerCase().replace(/\s+/g, ""));
						return `
						<div class="cb__save-row cb__save-row--sm">
							<div class="cb__skill-dot ${isProf || isExpertise ? "cb__skill-dot--on" : ""}"></div>
							<span class="cb__save-name cb__save-name--sm">${esc(skill.name)}${isExpertise ? ` <em>(exp)</em>` : ""}${adv ? ` <em title="Advantage on this skill">(adv)</em>` : ""}</span>
							<span class="cb__save-ability">${ABILITY_LABELS[skill.ability].slice(0,3)}</span>
							<span class="cb__save-bonus">${fmtMod(bonus)}</span>
						</div>`;
					}).join("")}
				</div>
			</div>
			${(ds.attackBonus.mw || ds.attackBonus.rw || ds.damageBonus.mw || ds.damageBonus.rw || ds.spellAttackBonus || ds.spellSaveDcBonus) ? `<div class="cb__detail-card">
				<p class="cb__section-header">Combat Bonuses (from equipped items/feats/features)</p>
				<div>
					${ds.attackBonus.mw ? `<span class="cb__pill cb__pill--static cb__pill--orange">${fmtMod(ds.attackBonus.mw)} melee weapon attack</span>` : ""}
					${ds.damageBonus.mw ? `<span class="cb__pill cb__pill--static cb__pill--orange">${fmtMod(ds.damageBonus.mw)} melee weapon damage</span>` : ""}
					${ds.attackBonus.rw ? `<span class="cb__pill cb__pill--static cb__pill--orange">${fmtMod(ds.attackBonus.rw)} ranged weapon attack</span>` : ""}
					${ds.damageBonus.rw ? `<span class="cb__pill cb__pill--static cb__pill--orange">${fmtMod(ds.damageBonus.rw)} ranged weapon damage</span>` : ""}
					${ds.spellAttackBonus ? `<span class="cb__pill cb__pill--static cb__pill--blue">${fmtMod(ds.spellAttackBonus)} spell attack</span>` : ""}
					${ds.spellSaveDcBonus ? `<span class="cb__pill cb__pill--static cb__pill--blue">${fmtMod(ds.spellSaveDcBonus)} spell save DC</span>` : ""}
				</div>
			</div>` : ""}
			${char.equipment.length ? `<div class="cb__detail-card"><p class="cb__section-header">Equipment <span class="cb__hint" style="font-weight:normal;">— check to equip (only equipped gear affects stats above)</span></p><div>${char.equipment.map((entry, entryIdx) => entry.parts.map((part, partIdx) => {
				const item = part.ref ? resolveItemRef(part.ref) : null;
				const canEquip = !!item; // no real catalog item behind this part (gold, generic type choice, flavor text) — nothing to equip
				const key = `sheet-equip-${entryIdx}-${partIdx}`;
				const body = item ? equipItemBodyHtml(item) : null;
				return `
					<div class="cb__equip-row">
						${canEquip ? `<input type="checkbox" class="cb__equip-checkbox" data-equip-toggle="${entryIdx}:${partIdx}" ${part.equipped ? "checked" : ""} title="Equipped">` : `<span class="cb__equip-checkbox-spacer" title="No real item behind this entry — not equippable"></span>`}
						${item ? `
							<button type="button" class="cb__pill cb__pill--yellow cb__feature-toggle" data-feature-toggle="${key}" title="Click to expand">${esc(part.label)}</button>
							<div class="cb__feature-body" id="cb-feature-body-${key}" hidden>${body}</div>
						` : `<span class="cb__pill cb__pill--yellow cb__pill--static">${esc(part.label)}</span>`}
					</div>
				`;
			}).join("")).join("")}</div></div>` : ""}
			${char.spells.length ? `<div class="cb__detail-card">
				<p class="cb__section-header">Spells</p>
				${cantrips.length ? `<p class="cb__detail-meta">Cantrips</p><div class="cb__block">${pillListHtml(cantrips.map(sp => ({name: sp.name, body: entriesToHtml(sp.entries)})), {idPrefix: "sheet-cantrips", colorClass: "cb__pill--blue"})}</div>` : ""}
				${[...new Set(leveled.map(sp => sp.level))].map(lvl => `<p class="cb__detail-meta">${esc(Parser.spLevelToFull(lvl))}</p><div class="cb__block">${pillListHtml(leveled.filter(sp => sp.level === lvl).map(sp => ({name: sp.name, body: entriesToHtml(sp.entries)})), {idPrefix: `sheet-spells-lvl${lvl}`, colorClass: "cb__pill--blue"})}</div>`).join("")}
			</div>` : ""}
			${(() => {
				const granted = grantedSpellsForChar(char);
				if (!granted.length) return "";
				const groupLabel = g => g.mode === "known" ? "Known (no slot used)" : g.mode === "prepared" ? "Always Prepared (no slot used)" : `Innate — ${g.freqLabel}`;
				const groups = [...new Set(granted.map(groupLabel))];
				return `<div class="cb__detail-card">
					<p class="cb__section-header">Granted Spells <span class="cb__hint" style="font-weight:normal;">— from feats, doesn't use a spell slot</span></p>
					${groups.map(label => `<p class="cb__detail-meta">${esc(label)}</p><div class="cb__block">${pillListHtml(granted.filter(g => groupLabel(g) === label).map(g => ({name: g.spell.name, body: entriesToHtml(g.spell.entries)})), {idPrefix: `sheet-granted-${label.replace(/\W+/g, "")}`, colorClass: "cb__pill--indigo"})}</div>`).join("")}
				</div>`;
			})()}
		`;
	},

	// ─── JSON SAVE / LOAD ──────────────────────────────────────────────────
	// Simple round-trip of the internal character state — not intended to match any
	// external character-sheet JSON standard, just a way to save/reload progress here.
	exportJSON() {
		const data = {
			_type: "5etools-charactercreator-save",
			// v2: char.equipment entries became {label, parts} objects carrying real item refs
			// (see equipmentChoiceSets()) instead of plain display strings — see migrateEquipment(),
			// called from importJSON() below, for how a v1 (or unversioned) save gets upgraded.
			// v3: flat char.feats array replaced by char.levelAsi (per-class-level feat-or-ASI
			// slots) — see migrateLevelAsi(), also called from importJSON().
			// v4: added char.play (HP/slots/hit dice/rests/resources session tracking) — see
			// migratePlay(), also called from importJSON().
			// v5: equipment parts gained `equipped` (see equipItemParts()/toggleEquipped()) — only
			// equipped items feed the live derivedCombatStats()/collectEffects() engine (AC/HP/
			// speed/saves/skills/resistances/etc. now recalculate from equipped items + selected
			// feats + unlocked class/subclass features) — see migrateEquipment(), also called from
			// importJSON(), for how a pre-v5 save's parts get a sensible default equipped state.
			_version: 5,
			step: this.step,
			char: this.char,
		};
		const blob = new Blob([JSON.stringify(data, null, "\t")], {type: "application/json"});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url; a.download = `${(this.char.name || "character").replace(/\s+/g, "-").toLowerCase()}-dnd5e-save.json`;
		document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
	},

	importJSON(evt) {
		const file = evt.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			try {
				const data = JSON.parse(reader.result);
				const loadedChar = data && data.char ? data.char : data; // tolerate a bare character object too
				if (!loadedChar || typeof loadedChar !== "object") throw new Error("File does not contain character data.");
				loadedChar.equipment = migrateEquipment(loadedChar.equipment);
				loadedChar.levelAsi = migrateLevelAsi(loadedChar);
				loadedChar.play = migratePlay(loadedChar);
				delete loadedChar.feats;
				this.char = {...EMPTY_CHAR(), ...loadedChar};
				this.step = Number.isInteger(data?.step) ? data.step : 0;
				this.search = "";
				this.render();
			} catch (err) {
				alert(`Could not load that file: ${err.message}`);
			} finally {
				evt.target.value = "";
			}
		};
		reader.readAsText(file);
	},

	// ─── EXPORT ────────────────────────────────────────────────────────────
	exportHTML() {
		const char = this.char;
		const s = this.finalScores(), pb_ = this.pb(), raceName = char.race?.name || "—";
		const allProf = this.allProfSkills();
		const {cantrips, leveled} = chosenSpellsByTier(char);
		const ds = this.derivedCombatStats();
		const hp = ds.hpMax;
		const ac = ds.ac;
		const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(char.name || "Character")}</title>
<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Georgia,serif;color:#111;padding:28px;font-size:12px;}
h1{font-size:24px;font-weight:700;margin-bottom:2px;}.sub{font-size:12px;color:#555;margin-bottom:16px;}
.stats{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;}.stat{border:1px solid #ccc;border-radius:6px;padding:6px 10px;text-align:center;min-width:48px;}
.stat .l{font-size:8px;text-transform:uppercase;letter-spacing:.5px;color:#666;}.stat .v{font-size:16px;font-weight:700;}
.grid{display:grid;grid-template-columns:82px 1fr 1fr;gap:16px;margin-bottom:16px;}
.ab{text-align:center;border:1px solid #ccc;border-radius:6px;padding:6px 4px;margin-bottom:6px;}
.ab .an{font-size:8px;text-transform:uppercase;letter-spacing:.5px;color:#666;}.ab .av{font-size:20px;font-weight:700;}.ab .am{font-size:11px;color:#444;}
h3{font-size:9px;text-transform:uppercase;letter-spacing:.6px;color:#555;border-bottom:1px solid #ddd;padding-bottom:2px;margin:10px 0 6px;}
table{width:100%;border-collapse:collapse;}td{padding:2px 6px;font-size:11px;}
.tag{display:inline-block;font-size:10px;border:1px solid #aaa;border-radius:10px;padding:1px 7px;margin:2px 2px 2px 0;}
.section{border:1px solid #ddd;border-radius:6px;padding:10px;margin-bottom:10px;}
.footer{margin-top:20px;font-size:9px;color:#aaa;text-align:center;border-top:1px solid #eee;padding-top:6px;}
@media print{body{padding:12px;}}</style></head><body>
<h1>${esc(char.name || "Unnamed Adventurer")}</h1>
<div class="sub">Level ${char.level} ${esc(raceName)} ${esc(char.cls?.name || "—")}${char.subclass ? ` (${esc(char.subclass.name)})` : ""} · ${esc(char.background?.name || "—")} · Prof +${pb_}</div>
<div class="stats">${[["HP",hp],["AC",ac],["Initiative",fmtMod(ds.initiative)],["Speed",ds.speed + "ft"],["Hit Die","d" + (char.cls?.hd?.faces || "—")]].map(([l,v]) => `<div class="stat"><div class="l">${esc(l)}</div><div class="v">${esc(v)}</div></div>`).join("")}</div>
<div class="grid">
<div>${ABILITIES.map(a => `<div class="ab"><div class="an">${ABILITY_LABELS[a].slice(0,3)}</div><div class="av">${s[a]}</div><div class="am">${fmtMod(scoreMod(s[a]))}</div>${char.cls?.proficiency?.includes(a) ? '<div style="font-size:8px;color:green;">save</div>' : ""}</div>`).join("")}</div>
<div><h3>Saving Throws</h3><table>${ABILITIES.map(a => { const p = char.cls?.proficiency?.includes(a) || ds.extraSaveProf.has(a), b = scoreMod(s[a]) + (p ? pb_ : 0) + ds.saveBonusAll; return `<tr><td>${p ? "●" : "○"}</td><td>${ABILITY_LABELS[a]}${ds.saveAdvantage.has(a) ? " (adv)" : ""}</td><td style="text-align:right;font-weight:600;">${fmtMod(b)}</td></tr>`; }).join("")}</table>
${char.cls ? `<h3>Class Features</h3><div>${classFeatureRefs(char.cls).filter(f => f.ref.level <= char.level).map(f => `<span class="tag">${esc(f.ref.name)}</span>`).join("")}</div>` : ""}
${char.subclass ? `<h3>Subclass: ${esc(char.subclass.name)}</h3><div>${subclassFeatureRefs(char.subclass).filter(f => f.ref.level <= char.level).map(f => `<span class="tag">${esc(f.ref.name)}</span>`).join("")}</div>` : ""}
${char.race ? `<h3>Racial Traits</h3><div>${namedSubEntries(char.race.entries).map(t => `<span class="tag">${esc(t.name)}</span>`).join("")}</div>` : ""}
${char.background && backgroundFeature(char.background) ? `<h3>Background Feature</h3><div>${entriesToHtml([backgroundFeature(char.background)])}</div>` : ""}
${chosenFeats(char).length ? `<h3>Feats</h3><div>${chosenFeats(char).map(cf => `<span class="tag">${esc(cf.name)}</span>`).join("")}</div>` : ""}
${Object.entries(char.levelAsi || {}).some(([, sl]) => sl?.type === "asi" && sl.asi) ? `<h3>Ability Score Improvements</h3><div>${Object.entries(char.levelAsi || {}).filter(([, sl]) => sl?.type === "asi" && sl.asi).sort((a, b) => Number(a[0]) - Number(b[0])).map(([lvl, sl]) => {
	const parts = sl.asi.mode === "plus1x2"
		? (sl.asi.abilities || []).map(a => `+1 ${ABILITY_LABELS[a]}`)
		: sl.asi.ability ? [`+2 ${ABILITY_LABELS[sl.asi.ability]}`] : [];
	return `<span class="tag">Lvl ${esc(lvl)}: ${esc(parts.join(", ") || "—")}</span>`;
}).join("")}</div>` : ""}
</div>
<div><h3>Skills</h3><table>${ALL_SKILLS.map(sk => { const p = allProf.has(sk.name) || ds.extraSkillProf.has(sk.name.toLowerCase()), exp = ds.extraSkillExpertise.has(sk.name.toLowerCase()), b = scoreMod(s[sk.ability]) + pb_ * (exp ? 2 : (p ? 1 : 0)) + ds.checkBonusAll + ds.skillBonusOf(sk.name); return `<tr><td>${exp ? "◉" : (p ? "●" : "○")}</td><td>${esc(sk.name)}${ds.skillAdvantage.has(sk.name.toLowerCase().replace(/\s+/g, "")) ? " (adv)" : ""}</td><td style="color:#888;font-size:10px;">${ABILITY_LABELS[sk.ability].slice(0,3)}</td><td style="text-align:right;font-weight:600;">${fmtMod(b)}</td></tr>`; }).join("")}</table></div>
</div>
${char.equipment.length ? `<div class="section"><h3>Equipment</h3><div>${char.equipment.map(e => `<span class="tag">${esc(safeEquipTag(e))}${(e.parts || []).some(p => p.ref && p.equipped) ? " (equipped)" : ""}</span>`).join("")}</div></div>` : ""}
${char.spells.length ? `<div class="section"><h3>Spells</h3>${cantrips.length ? `<p style="font-size:10px;color:#666;margin-bottom:3px;">Cantrips</p><div>${cantrips.map(sp => `<span class="tag">${esc(sp.name)}</span>`).join("")}</div>` : ""}${[...new Set(leveled.map(sp => sp.level))].map(lvl => `<p style="font-size:10px;color:#666;margin:6px 0 3px;">${esc(Parser.spLevelToFull(lvl))}</p><div>${leveled.filter(sp => sp.level === lvl).map(sp => `<span class="tag">${esc(sp.name)}</span>`).join("")}</div>`).join("")}</div>` : ""}
<div class="footer">D&D 5e Character Builder · ${new Date().toLocaleDateString()}</div>
</body></html>`;
		const blob = new Blob([html], {type: "text/html"});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url; a.download = `${(char.name || "character").replace(/\s+/g, "-").toLowerCase()}-dnd5e.html`;
		document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
	},
};

document.addEventListener("DOMContentLoaded", () => CB.init());
