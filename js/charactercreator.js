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

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function scoreMod(s) { return Math.floor((s - 10) / 2); }
function fmtMod(m) { return (m >= 0 ? "+" : "") + m; }
function profBonus(lvl) { return Math.ceil(lvl / 4) + 1; }
function getHP(cls, conScore, lvl) { const faces = cls.hd?.faces || 8; return faces + scoreMod(conScore) + (lvl - 1) * (Math.floor(faces / 2) + 1 + scoreMod(conScore)); }
function pbCost(s) { return s <= 13 ? s - 8 : (s - 8) + (s - 13); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
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

function equipmentDesc(_name) { return "Full item description coming soon."; }
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
				<button type="button" class="cb__pill ${colorClass} cb__feature-toggle" data-feature-toggle="${key}">${label}</button>
				<div class="cb__feature-body" id="cb-feature-body-${key}" hidden>${body}</div>
			</div>
		`;
	}).join("");
}

/** Wires click-to-expand for every featureListHtml() pill currently in the DOM. Safe to call
 * after every render() — addEventListener on freshly-created elements only, no duplicate binding. */
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

/** Real classFeatures entries are uid refs ("Name|Class||Level|Source") or {classFeature: uid, ...} —
 * unpack down to full ref objects {name, className, classSource, level, source}. The feature's
 * *entries* (description text) live separately in CLASS_FEATURES — see resolveClassFeature(). */
function classFeatureRefs(cls) {
	return (cls?.classFeatures || []).map(ref => {
		const uid = typeof ref === "string" ? ref : ref?.classFeature;
		if (!uid) return null;
		const unpacked = DataUtil.class.unpackUidClassFeature(uid);
		return unpacked.name ? unpacked : null;
	}).filter(Boolean);
}

/** Same idea as classFeatureRefs, for a subclass's subclassFeatures array. */
function subclassFeatureRefs(sc) {
	return (sc?.subclassFeatures || []).map(ref => {
		const uid = typeof ref === "string" ? ref : ref?.subclassFeature;
		if (!uid) return null;
		const unpacked = DataUtil.class.unpackUidSubclassFeature(uid);
		return unpacked.name ? unpacked : null;
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

/** Best-effort human-readable label for one real startingEquipment item entry. */
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

/** Renders one char.equipment entry safely — it's normally already a resolved string, but this
 * guards against anything non-string that might end up there (e.g. an older save/import made
 * before equipItemLabel handled a given shape), so the sheet never shows a raw [object Object]. */
function safeEquipTag(e) { return typeof e === "string" ? e : equipItemLabel(e); }

/**
 * Splits a real "startingEquipment" sets array into unconditional items (an "_" set) and
 * choice rows (sets with lettered options like {a: [...], b: [...]}), each option bundled
 * into one display string so it can reuse the same single-toggle chip UI everywhere.
 * Used for both a background's `startingEquipment` and a class's `startingEquipment.defaultData`
 * — both use the same {_, a, b, ...} set-array schema.
 */
function equipmentChoiceSets(sets) {
	const fixed = [];
	const choiceRows = [];
	(sets || []).forEach(set => {
		if (!set || typeof set !== "object") return;
		if (Array.isArray(set._)) fixed.push(...set._.map(equipItemLabel));
		const optionKeys = Object.keys(set).filter(k => k !== "_");
		if (optionKeys.length) choiceRows.push(optionKeys.map(k => (set[k] || []).map(equipItemLabel).join(" + ")));
	});
	return {fixed, choiceRows};
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
	skills: [], equipment: [], feats: [], spells: [], racialAsiChoice: [],
	racialAsiVrgr: {mode: "2-1", high: null, low: null, triple: []},
	bgAsi: {mode: "2-1", high: null, low: null, triple: []},
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
	[RACES, BACKGROUNDS, FEATS, SPELLS, CLASS_FEATURES, SUBCLASS_FEATURES] = await Promise.all([
		pLoadAllFiltered(UrlUtil.PG_RACES, "race"),
		pLoadAllFiltered(UrlUtil.PG_BACKGROUNDS, "background"),
		pLoadAllFiltered(UrlUtil.PG_FEATS, "feat"),
		pLoadAllFiltered(UrlUtil.PG_SPELLS, "spell"),
		pLoadAllFiltered("classFeature", "classFeature"),
		pLoadAllFiltered("subclassFeature", "subclassFeature"),
	]);
	buildFeatureLookups();

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

const CB = {
	step: 0,
	char: EMPTY_CHAR(),
	search: "",
	expandedFeat: null,
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

		document.getElementById("cb-step-body").innerHTML = `<p class="cb__placeholder">Loading races, backgrounds, and feats from the site's data files…</p>`;
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
	finalScores() {
		const racial = this.racialASI();
		const bgAsi = this.backgroundASI();
		let b;
		if (this.char.abilityMode === "standard") {
			b = {str:10,dex:10,con:10,int:10,wis:10,cha:10};
			ABILITIES.forEach(a => { if (this.char.standardAssign[a] !== null) b[a] = this.char.standardAssign[a]; });
		} else if (this.char.abilityMode === "pointbuy") {
			b = {...this.char.pointBuy};
		} else {
			b = {...this.char.manual};
		}
		ABILITIES.forEach(a => { b[a] = (b[a] || 10) + (racial[a] || 0) + (bgAsi[a] || 0); });
		return b;
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
				<div>${namedSubEntries(this.char.race.entries).map(t => `<span class="cb__pill cb__pill--teal" title="${esc(entriesToPlainText(t.entries))}">${esc(t.name)}</span>`).join("")}</div>
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
		const lvl1Features = classFeatureRefs(cls).filter(f => f.level === 1).map(ref => ({ref, feature: resolveClassFeature(ref)}));
		const detail = cls ? `
			<div class="cb__detail-card">
				<p class="cb__detail-title">${esc(cls.name)}</p>
				<div class="cb__stat-grid">
					${[["Hit Die","d"+(cls.hd?.faces ?? "?")],["Saves",(cls.proficiency||[]).map(s=>ABILITY_LABELS[s].slice(0,3)).join("/")],["HP at 1st",cls.hd?.faces ?? "?"],["Skills",skillChoice.count+" choices"]].map(([l,v]) => `
						<div class="cb__stat-box"><p class="cb__stat-label">${esc(l)}</p><p class="cb__stat-value">${esc(v)}</p></div>
					`).join("")}
				</div>
				<p class="cb__section-header">1st Level Features</p>
				<div>${featureListHtml(lvl1Features, {idPrefix: "cls", showLevel: false})}</div>
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
		const scFeatures = subclassFeatureRefs(subclass).map(ref => ({ref, feature: resolveSubclassFeature(ref)}));
		const detail = subclass ? `
			<div class="cb__detail-card">
				<p class="cb__detail-title">${esc(subclass.name)}</p>
				<p class="cb__section-header">Subclass Features</p>
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

		const choiceRows = clsChoiceRows.map((choices, i) => `
			<div class="cb__eq-choice-row" data-row="${i}">
				${choices.map(opt => `<div class="cb__eq-chip ${this.char.equipment.includes(opt) ? "cb__eq-chip--active" : ""}" data-eq-choice="${esc(opt)}" data-row-i="${i}" title="${esc(equipmentDesc(opt))}">${esc(opt)}</div>`).join("")}
			</div>
		`).join("");

		const bgChoiceRowsHtml = bgChoiceRows.map((choices, i) => `
			<div class="cb__eq-choice-row" data-row="${i}">
				${choices.map(opt => `<div class="cb__eq-chip ${this.char.equipment.includes(opt) ? "cb__eq-chip--active" : ""}" data-bg-eq-choice="${esc(opt)}" data-bg-row-i="${i}" title="${esc(equipmentDesc(opt))}">${esc(opt)}</div>`).join("")}
			</div>
		`).join("");

		const simpleRow = item => `
			<div class="cb__skill-row ${this.char.equipment.includes(item) ? "cb__skill-row--prof" : ""}" data-eq-toggle="${esc(item)}" title="${esc(equipmentDesc(item))}">
				<div class="cb__skill-dot ${this.char.equipment.includes(item) ? "cb__skill-dot--on" : ""}" style="border-radius:3px;"></div>
				<span class="cb__skill-name">${esc(item)}</span>
			</div>
		`;

		setTimeout(() => {
			document.querySelectorAll("[data-eq-choice]").forEach(el => el.addEventListener("click", () => {
				const opt = el.dataset.eqChoice, rowI = +el.dataset.rowI;
				const choices = clsChoiceRows[rowI];
				const active = this.char.equipment.includes(opt);
				const others = choices.filter(o => o !== opt);
				let next = this.char.equipment.filter(e => !others.includes(e));
				if (active) next = next.filter(e => e !== opt);
				else next = [...next.filter(e => e !== opt), opt];
				this.char.equipment = next;
				this.render();
			}));
			document.querySelectorAll("[data-bg-eq-choice]").forEach(el => el.addEventListener("click", () => {
				const opt = el.dataset.bgEqChoice, rowI = +el.dataset.bgRowI;
				const choices = bgChoiceRows[rowI];
				const active = this.char.equipment.includes(opt);
				const others = choices.filter(o => o !== opt);
				let next = this.char.equipment.filter(e => !others.includes(e));
				if (active) next = next.filter(e => e !== opt);
				else next = [...next.filter(e => e !== opt), opt];
				this.char.equipment = next;
				this.render();
			}));
			document.querySelectorAll("[data-eq-toggle]").forEach(el => el.addEventListener("click", () => {
				const item = el.dataset.eqToggle;
				if (this.char.equipment.includes(item)) this.char.equipment = this.char.equipment.filter(e => e !== item);
				else this.char.equipment = [...this.char.equipment, item];
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

	// ─── STEP 8: FEATS ─────────────────────────────────────────────────────
	renderFeats() {
		// Some races (e.g. a "Variant Human"-style option) grant a bonus 1st-level feat in the
		// standalone dataset this used to run on; the real race data here doesn't include that
		// as a separate selectable entry, so feat slots are level-based only for now.
		const MAX_FEATS = this.char.level >= 4 ? Math.floor(this.char.level / 4) : 0;
		const filtered = FEATS.filter(f => f.name.toLowerCase().includes(this.search.toLowerCase()));
		const isChosen = feat => this.char.feats.some(cf => cf.name === feat.name && cf.source === feat.source);
		const toggleFeat = feat => {
			const chosen = isChosen(feat);
			const canSelect = chosen || this.char.feats.length < MAX_FEATS;
			if (!canSelect && !chosen) return;
			if (chosen) this.char.feats = this.char.feats.filter(cf => !(cf.name === feat.name && cf.source === feat.source));
			else this.char.feats = [...this.char.feats, {name: feat.name, source: feat.source}];
		};

		const prereqHtml = feat => {
			if (!feat.prerequisite) return "";
			try { return Renderer.utils.prerequisite.getHtml(feat.prerequisite); } catch (err) { return ""; }
		};

		const rows = filtered.map(feat => {
			const chosen = isChosen(feat);
			const canSelect = chosen || this.char.feats.length < MAX_FEATS;
			const open = this.expandedFeat === `${feat.name}|${feat.source}`;
			const prereq = prereqHtml(feat);
			return `
				<div class="cb__feat-card ${chosen ? "cb__feat-card--chosen" : ""}" style="opacity:${canSelect ? 1 : 0.5}">
					<div class="cb__feat-head" data-feat-expand="${esc(feat.name)}" data-feat-expand-source="${esc(feat.source)}">
						<div class="cb__feat-cb ${chosen ? "cb__feat-cb--on" : ""}" data-feat-toggle="${esc(feat.name)}" data-feat-toggle-source="${esc(feat.source)}"></div>
						<span class="cb__feat-name">${esc(feat.name)}</span>
						${srcBadge(feat.source)}
						${prereq ? `<span class="cb__feat-req">Req: ${prereq}</span>` : ""}
						<span class="cb__feat-caret">${open ? "▲" : "▼"}</span>
					</div>
					${open ? `<div class="cb__feat-desc">${entriesToHtml(feat.entries)}</div>` : ""}
				</div>
			`;
		}).join("");

		setTimeout(() => {
			document.getElementById("cb-feat-browse")?.addEventListener("click", async () => {
				if (!modalFilterFeats) return;
				const selected = await modalFilterFeats.pGetUserSelection();
				if (!selected?.length) return;
				const match = resolveModalSelection(selected[0], FEATS);
				if (!match) return;
				toggleFeat(match);
				this.render();
			});
			document.querySelectorAll("[data-feat-expand]").forEach(el => el.addEventListener("click", e => {
				if (e.target.closest("[data-feat-toggle]")) return;
				const key = `${el.dataset.featExpand}|${el.dataset.featExpandSource}`;
				this.expandedFeat = this.expandedFeat === key ? null : key;
				this.render();
			}));
			document.querySelectorAll("[data-feat-toggle]").forEach(el => el.addEventListener("click", e => {
				e.stopPropagation();
				const feat = FEATS.find(f => f.name === el.dataset.featToggle && f.source === el.dataset.featToggleSource);
				if (!feat) return;
				toggleFeat(feat);
				this.render();
			}));
		}, 0);

		return `
			<p class="cb__hint">${MAX_FEATS === 0 ? "No feat slots at this level (feats replace ASI at levels 4, 8, 12, 16, 19)." : `Select up to ${MAX_FEATS} feat${MAX_FEATS > 1 ? "s" : ""} (${this.char.feats.length}/${MAX_FEATS} chosen).`}</p>
			<button id="cb-feat-browse" type="button" class="ve-btn ve-btn-default cb__search" title="Open the site's full feat filter/search">🔍 Browse &amp; Filter Feats</button>
			<input class="ve-form-control cb__search" data-search value="${esc(this.search)}" placeholder="...or quick-filter this list by name">
			<div class="cb__scroll-list">${rows}</div>
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
	renderSheet() {
		const finalScores = this.finalScores();
		const allProf = this.allProfSkills();
		const pb = this.pb();
		const char = this.char;
		const hp = char.cls ? getHP(char.cls, finalScores.con, char.level) : 0;
		const ac = 10 + scoreMod(finalScores.dex), ini = scoreMod(finalScores.dex);
		const raceName = char.race?.name || "—";
		const {cantrips, leveled} = chosenSpellsByTier(char);

		return `
			<div class="cb__sheet-header">
				<div class="cb__sheet-hd-top">
					<div>
						<p class="cb__sheet-name">${esc(char.name || "Unnamed")}</p>
						<p class="cb__sheet-sub">Level ${char.level} ${esc(raceName)} ${esc(char.cls?.name || "—")}${char.subclass ? ` (${esc(char.subclass.name)})` : ""} · ${esc(char.background?.name || "—")}</p>
					</div>
					<div class="cb__sheet-stats">
						${[["HP",hp],["AC",ac],["Init",fmtMod(ini)],["Prof","+"+pb],["Speed",raceWalkSpeed(char.race) + "ft"]].map(([l,v]) => `
							<div class="cb__stat-box"><p class="cb__stat-label">${esc(l)}</p><p class="cb__stat-value">${esc(v)}</p></div>
						`).join("")}
					</div>
				</div>
			</div>
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
						const isProf = char.cls?.proficiency?.includes(a), bonus = scoreMod(finalScores[a]) + (isProf ? pb : 0);
						return `
						<div class="cb__save-row">
							<div class="cb__skill-dot ${isProf ? "cb__skill-dot--on" : ""}"></div>
							<span class="cb__save-name">${ABILITY_LABELS[a]}</span>
							<span class="cb__save-bonus">${fmtMod(bonus)}</span>
						</div>`;
					}).join("")}
					${char.cls ? `<div class="cb__block"><p class="cb__section-header">Class Features</p><div>${featureListHtml(classFeatureRefs(char.cls).filter(f => f.level <= char.level).map(ref => ({ref, feature: resolveClassFeature(ref)})), {idPrefix: "sheet-cls", colorClass: "cb__pill--purple", noneLabel: "None yet"})}</div></div>` : ""}
					${char.subclass ? `<div class="cb__block"><p class="cb__section-header">Subclass Features</p><div>${featureListHtml(subclassFeatureRefs(char.subclass).filter(f => f.level <= char.level).map(ref => ({ref, feature: resolveSubclassFeature(ref)})), {idPrefix: "sheet-sc", colorClass: "cb__pill--indigo", noneLabel: "None yet"})}</div></div>` : ""}
					${char.race ? `<div class="cb__block"><p class="cb__section-header">Racial Traits</p><div>${namedSubEntries(char.race.entries).map(t => `<span class="cb__pill cb__pill--teal" title="${esc(entriesToPlainText(t.entries))}">${esc(t.name)}</span>`).join("")}</div></div>` : ""}
					${char.background && backgroundFeature(char.background) ? `<div class="cb__block"><p class="cb__section-header">Background Feature</p><div>${entriesToHtml([backgroundFeature(char.background)])}</div></div>` : ""}
					${char.feats.length ? `<div class="cb__block"><p class="cb__section-header">Feats</p><div>${char.feats.map(cf => `<span class="cb__pill cb__pill--orange" title="${esc(entriesToPlainText(findFeat(cf.name, cf.source)?.entries))}">${esc(cf.name)}</span>`).join("")}</div></div>` : ""}
				</div>
				<div>
					<p class="cb__section-header">Skills</p>
					${ALL_SKILLS.map(skill => {
						const isProf = allProf.has(skill.name), bonus = scoreMod(finalScores[skill.ability]) + (isProf ? pb : 0);
						return `
						<div class="cb__save-row cb__save-row--sm">
							<div class="cb__skill-dot ${isProf ? "cb__skill-dot--on" : ""}"></div>
							<span class="cb__save-name cb__save-name--sm">${esc(skill.name)}</span>
							<span class="cb__save-ability">${ABILITY_LABELS[skill.ability].slice(0,3)}</span>
							<span class="cb__save-bonus">${fmtMod(bonus)}</span>
						</div>`;
					}).join("")}
				</div>
			</div>
			${char.equipment.length ? `<div class="cb__detail-card"><p class="cb__section-header">Equipment</p><div>${char.equipment.map(e => `<span class="cb__pill cb__pill--yellow" title="${esc(equipmentDesc(e))}">${esc(safeEquipTag(e))}</span>`).join("")}</div></div>` : ""}
			${char.spells.length ? `<div class="cb__detail-card">
				<p class="cb__section-header">Spells</p>
				${cantrips.length ? `<p class="cb__detail-meta">Cantrips</p><div class="cb__block">${cantrips.map(sp => `<span class="cb__pill cb__pill--blue" title="${esc(spellDesc(sp))}">${esc(sp.name)}</span>`).join("")}</div>` : ""}
				${[...new Set(leveled.map(sp => sp.level))].map(lvl => `<p class="cb__detail-meta">${esc(Parser.spLevelToFull(lvl))}</p><div class="cb__block">${leveled.filter(sp => sp.level === lvl).map(sp => `<span class="cb__pill cb__pill--blue" title="${esc(spellDesc(sp))}">${esc(sp.name)}</span>`).join("")}</div>`).join("")}
			</div>` : ""}
		`;
	},

	// ─── JSON SAVE / LOAD ──────────────────────────────────────────────────
	// Simple round-trip of the internal character state — not intended to match any
	// external character-sheet JSON standard, just a way to save/reload progress here.
	exportJSON() {
		const data = {
			_type: "5etools-charactercreator-save",
			_version: 1,
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
		const hp = char.cls ? getHP(char.cls, s.con, char.level) : 0;
		const ac = 10 + scoreMod(s.dex);
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
<div class="stats">${[["HP",hp],["AC",ac],["Initiative",fmtMod(scoreMod(s.dex))],["Speed",raceWalkSpeed(char.race) + "ft"],["Hit Die","d" + (char.cls?.hd?.faces || "—")]].map(([l,v]) => `<div class="stat"><div class="l">${esc(l)}</div><div class="v">${esc(v)}</div></div>`).join("")}</div>
<div class="grid">
<div>${ABILITIES.map(a => `<div class="ab"><div class="an">${ABILITY_LABELS[a].slice(0,3)}</div><div class="av">${s[a]}</div><div class="am">${fmtMod(scoreMod(s[a]))}</div>${char.cls?.proficiency?.includes(a) ? '<div style="font-size:8px;color:green;">save</div>' : ""}</div>`).join("")}</div>
<div><h3>Saving Throws</h3><table>${ABILITIES.map(a => { const p = char.cls?.proficiency?.includes(a), b = scoreMod(s[a]) + (p ? pb_ : 0); return `<tr><td>${p ? "●" : "○"}</td><td>${ABILITY_LABELS[a]}</td><td style="text-align:right;font-weight:600;">${fmtMod(b)}</td></tr>`; }).join("")}</table>
${char.cls ? `<h3>Class Features</h3><div>${classFeatureRefs(char.cls).filter(f => f.level <= char.level).map(f => `<span class="tag">${esc(f.name)}</span>`).join("")}</div>` : ""}
${char.subclass ? `<h3>Subclass: ${esc(char.subclass.name)}</h3><div>${subclassFeatureRefs(char.subclass).filter(f => f.level <= char.level).map(f => `<span class="tag">${esc(f.name)}</span>`).join("")}</div>` : ""}
${char.race ? `<h3>Racial Traits</h3><div>${namedSubEntries(char.race.entries).map(t => `<span class="tag">${esc(t.name)}</span>`).join("")}</div>` : ""}
${char.background && backgroundFeature(char.background) ? `<h3>Background Feature</h3><div>${entriesToHtml([backgroundFeature(char.background)])}</div>` : ""}
${char.feats.length ? `<h3>Feats</h3><div>${char.feats.map(cf => `<span class="tag">${esc(cf.name)}</span>`).join("")}</div>` : ""}
</div>
<div><h3>Skills</h3><table>${ALL_SKILLS.map(sk => { const p = allProf.has(sk.name), b = scoreMod(s[sk.ability]) + (p ? pb_ : 0); return `<tr><td>${p ? "●" : "○"}</td><td>${esc(sk.name)}</td><td style="color:#888;font-size:10px;">${ABILITY_LABELS[sk.ability].slice(0,3)}</td><td style="text-align:right;font-weight:600;">${fmtMod(b)}</td></tr>`; }).join("")}</table></div>
</div>
${char.equipment.length ? `<div class="section"><h3>Equipment</h3><div>${char.equipment.map(e => `<span class="tag">${esc(safeEquipTag(e))}</span>`).join("")}</div></div>` : ""}
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
