"use strict";
/* ============================================================
   D&D 5e Character Creator — vanilla JS port for 5etools mirror
   Ported from a React prototype. Styled with the site's own
   ve-btn / ve-form-control / form-group classes plus a small
   cb__ namespaced stylesheet (css/charactercreator.css).
   ============================================================ */

// ─── DATA ────────────────────────────────────────────────────────────────────

const ABILITY_LABELS = {str:"Strength", dex:"Dexterity", con:"Constitution", int:"Intelligence", wis:"Wisdom", cha:"Charisma"};
const ABILITIES = ["str","dex","con","int","wis","cha"];
const STANDARD_ARRAY = [15,14,13,12,10,8];
const STEPS = ["Name","Race","Class","Subclass","Background","Abilities","Skills","Equipment","Feats","Spells","Sheet"];
const CASTER_CLASSES = ["Bard","Cleric","Druid","Paladin","Ranger","Sorcerer","Warlock","Wizard","Artificer"];

// Populated at startup by loadRuleData() from the site's own races.json (+ prerelease/brew),
// via DataLoader.pCacheAndGetAllSite/pCacheAndGetAllPrerelease/pCacheAndGetAllBrew — see below.
let RACES = [];

const CLASSES = [
	{name:"Barbarian", source:"PHB", hd:12, primary:["str"], saves:["str","con"], armorProf:["light","medium","shields"], skillChoices:["Animal Handling","Athletics","Intimidation","Nature","Perception","Survival"], numSkills:2, features:["Rage","Unarmored Defense"],
		equipment:[["Greataxe","Two handaxes + 4 more handaxes","Any martial melee weapon"],["Explorer's Pack","Dungeoneer's Pack"]], bgEquip:["4 javelins"]},
	{name:"Bard", source:"PHB", hd:8, primary:["cha"], saves:["dex","cha"], armorProf:["light"], skillChoices:"any", numSkills:3, features:["Bardic Inspiration","Spellcasting","Jack of All Trades"],
		equipment:[["Rapier","Longsword","Any simple weapon"],["Diplomat's Pack","Entertainer's Pack"],["Lute","Any musical instrument"]], bgEquip:["Leather armor","Dagger"]},
	{name:"Cleric", source:"PHB", hd:8, primary:["wis"], saves:["wis","cha"], armorProf:["light","medium","shields"], skillChoices:["History","Insight","Medicine","Persuasion","Religion"], numSkills:2, features:["Spellcasting","Divine Domain"],
		equipment:[["Mace","Warhammer (if proficient)"],["Scale mail","Leather armor","Chain mail (if proficient)"],["Light crossbow + 20 bolts","Any simple weapon"],["Priest's Pack","Explorer's Pack"]], bgEquip:["Shield","Holy symbol"]},
	{name:"Druid", source:"PHB", hd:8, primary:["wis"], saves:["int","wis"], armorProf:["light","medium","shields (non-metal)"], skillChoices:["Arcana","Animal Handling","Insight","Medicine","Nature","Perception","Religion","Survival"], numSkills:2, features:["Druidic","Spellcasting","Wild Shape"],
		equipment:[["Wooden shield","Any simple weapon"],["Scimitar","Any simple melee weapon"]], bgEquip:["Leather armor","Explorer's Pack","Druidic focus"]},
	{name:"Fighter", source:"PHB", hd:10, primary:["str","dex"], saves:["str","con"], armorProf:["all armor","shields"], skillChoices:["Acrobatics","Animal Handling","Athletics","History","Insight","Intimidation","Perception","Survival"], numSkills:2, features:["Fighting Style","Second Wind","Action Surge"],
		equipment:[["Chain mail","Leather armor + longbow + 20 arrows"],["Martial weapon + shield","Two martial weapons"],["Light crossbow + 20 bolts","Two handaxes"],["Dungeoneer's Pack","Explorer's Pack"]], bgEquip:[]},
	{name:"Monk", source:"PHB", hd:8, primary:["dex","wis"], saves:["str","dex"], armorProf:[], skillChoices:["Acrobatics","Athletics","History","Insight","Religion","Stealth"], numSkills:2, features:["Unarmored Defense","Martial Arts","Ki"],
		equipment:[["Shortsword","Any simple weapon"],["Dungeoneer's Pack","Explorer's Pack"]], bgEquip:["10 darts"]},
	{name:"Paladin", source:"PHB", hd:10, primary:["str","cha"], saves:["wis","cha"], armorProf:["all armor","shields"], skillChoices:["Athletics","Insight","Intimidation","Medicine","Persuasion","Religion"], numSkills:2, features:["Divine Sense","Lay on Hands","Divine Smite"],
		equipment:[["Martial weapon + shield","Two martial weapons"],["Five javelins","Any simple melee weapon"],["Priest's Pack","Explorer's Pack"]], bgEquip:["Chain mail","Holy symbol"]},
	{name:"Ranger", source:"PHB", hd:10, primary:["dex","wis"], saves:["str","dex"], armorProf:["light","medium","shields"], skillChoices:["Animal Handling","Athletics","Insight","Investigation","Nature","Perception","Stealth","Survival"], numSkills:3, features:["Favored Enemy","Natural Explorer","Spellcasting"],
		equipment:[["Scale mail","Leather armor"],["Two shortswords","Two simple melee weapons"],["Dungeoneer's Pack","Explorer's Pack"]], bgEquip:["Longbow + 20 arrows"]},
	{name:"Rogue", source:"PHB", hd:8, primary:["dex"], saves:["dex","int"], armorProf:["light"], skillChoices:["Acrobatics","Athletics","Deception","Insight","Intimidation","Investigation","Perception","Performance","Persuasion","Sleight of Hand","Stealth"], numSkills:4, features:["Expertise","Sneak Attack","Thieves' Cant"],
		equipment:[["Rapier","Shortsword"],["Shortbow + quiver of 20 arrows","Shortsword"],["Burglar's Pack","Dungeoneer's Pack","Explorer's Pack"]], bgEquip:["Leather armor","Two daggers","Thieves' tools"]},
	{name:"Sorcerer", source:"PHB", hd:6, primary:["cha"], saves:["con","cha"], armorProf:[], skillChoices:["Arcana","Deception","Insight","Intimidation","Persuasion","Religion"], numSkills:2, features:["Spellcasting","Sorcerous Origin","Font of Magic"],
		equipment:[["Light crossbow + 20 bolts","Any simple weapon"],["Component pouch","Arcane focus"],["Dungeoneer's Pack","Explorer's Pack"]], bgEquip:["Two daggers"]},
	{name:"Warlock", source:"PHB", hd:8, primary:["cha"], saves:["wis","cha"], armorProf:["light"], skillChoices:["Arcana","Deception","History","Intimidation","Investigation","Nature","Religion"], numSkills:2, features:["Otherworldly Patron","Pact Magic","Eldritch Invocations"],
		equipment:[["Light crossbow + 20 bolts","Any simple weapon"],["Component pouch","Arcane focus"],["Scholar's Pack","Dungeoneer's Pack"]], bgEquip:["Leather armor","Any simple weapon","Two daggers"]},
	{name:"Wizard", source:"PHB", hd:6, primary:["int"], saves:["int","wis"], armorProf:[], skillChoices:["Arcana","History","Insight","Investigation","Medicine","Religion"], numSkills:2, features:["Spellcasting","Arcane Recovery","Arcane Tradition"],
		equipment:[["Quarterstaff","Dagger"],["Component pouch","Arcane focus"],["Scholar's Pack","Explorer's Pack"]], bgEquip:["Spellbook"]},
	{name:"Artificer", source:"TCE", hd:8, primary:["int"], saves:["con","int"], armorProf:["light","medium","shields"], skillChoices:["Arcana","History","Investigation","Medicine","Nature","Perception","Sleight of Hand"], numSkills:2, features:["Magical Tinkering","Spellcasting","Infuse Item"],
		equipment:[["Two daggers"],["Thieves' tools","Any artisan's tools"],["Light crossbow + 20 bolts"]], bgEquip:["Leather armor","Scholar's Pack"]},
];

const SUBCLASSES = {
	Barbarian:[
		{name:"Berserker", source:"PHB", desc:"Tap into a vicious fury to rampage through combat.", features:["Frenzy","Mindless Rage","Intimidating Presence"]},
		{name:"Totem Warrior", source:"PHB", desc:"Channel a primal spirit to gain bestial powers.", features:["Spirit Seeker","Totem Spirit"]},
		{name:"Ancestral Guardian", source:"XGE", desc:"Honor your ancestors by calling on them to defend allies.", features:["Ancestral Protectors","Spirit Shield"]},
		{name:"Storm Herald", source:"XGE", desc:"Wield a storm aura tied to sea, desert, or tundra.", features:["Storm Aura","Storm Soul"]},
		{name:"Zealot", source:"XGE", desc:"Fueled by divine power, you fight with divine fury.", features:["Divine Fury","Warrior of the Gods"]},
		{name:"Beast", source:"TCE", desc:"Your rage manifests as bestial appendages.", features:["Form of the Beast","Bestial Soul"]},
		{name:"Wild Magic", source:"TCE", desc:"A wild surge of magic amplifies your rage.", features:["Magic Awareness","Wild Surge"]},
	],
	Bard:[
		{name:"Lore", source:"PHB", desc:"Gather knowledge and cut enemies with Cutting Words.", features:["Bonus Proficiencies","Cutting Words","Additional Magical Secrets"]},
		{name:"Valor", source:"PHB", desc:"A bold skald who inspires allies in combat.", features:["Bonus Proficiencies","Combat Inspiration","Extra Attack"]},
		{name:"Glamour", source:"XGE", desc:"Draw on the Feywild to charm and enthrall.", features:["Mantle of Inspiration","Enthralling Performance"]},
		{name:"Swords", source:"XGE", desc:"Entertain with displays of weapon prowess.", features:["Bonus Proficiencies","Fighting Style","Blade Flourish"]},
		{name:"Whispers", source:"XGE", desc:"Exploit secrets and fear to manipulate foes.", features:["Psychic Blades","Words of Terror"]},
		{name:"Creation", source:"TCE", desc:"Weave music and magic to create matter.", features:["Note of Potential","Performance of Creation"]},
		{name:"Eloquence", source:"TCE", desc:"Master the art of oratory and persuasion.", features:["Silver Tongue","Unsettling Words"]},
	],
	Cleric:[
		{name:"Life", source:"PHB", desc:"Channel divine energy to heal the wounded.", features:["Bonus Proficiency","Disciple of Life","Preserve Life"]},
		{name:"Light", source:"PHB", desc:"Wield fire and radiance to repel darkness.", features:["Bonus Cantrip","Warding Flare","Radiance of the Dawn"]},
		{name:"Trickery", source:"PHB", desc:"Use deception and illusion to serve your deity.", features:["Blessing of the Trickster","Invoke Duplicity"]},
		{name:"Knowledge", source:"PHB", desc:"Learn the secrets of history and magic.", features:["Blessings of Knowledge","Knowledge of the Ages"]},
		{name:"Nature", source:"PHB", desc:"Harness the power of the natural world.", features:["Acolyte of Nature","Dampen Elements"]},
		{name:"Tempest", source:"PHB", desc:"Wield storms and lightning.", features:["Bonus Proficiencies","Wrath of the Storm","Thunderbolt Strike"]},
		{name:"War", source:"PHB", desc:"Inspire warriors and smite enemies.", features:["Bonus Proficiencies","War Priest","Guided Strike"]},
		{name:"Arcana", source:"SCAG", desc:"Blend divine and arcane power.", features:["Arcane Initiate","Spell Breaker"]},
		{name:"Death", source:"DMG", desc:"Channel necrotic energy and the power of death.", features:["Bonus Proficiency","Reaper","Touch of Death"]},
		{name:"Forge", source:"XGE", desc:"Bless the works of artisans and smiths.", features:["Bonus Proficiency","Blessing of the Forge","Artisan's Blessing"]},
		{name:"Grave", source:"XGE", desc:"Stand between life and death.", features:["Circle of Mortality","Eyes of the Grave"]},
		{name:"Order", source:"TCE", desc:"Impose structure and law on the world.", features:["Bonus Proficiencies","Voice of Authority","Order's Demand"]},
		{name:"Peace", source:"TCE", desc:"Unite allies with bonds of harmony.", features:["Emboldening Bond","Balm of Peace"]},
		{name:"Twilight", source:"TCE", desc:"Guard against the terrors of the night.", features:["Eyes of Night","Vigilant Blessing"]},
	],
	Druid:[
		{name:"Land", source:"PHB", desc:"Draw power from the natural terrain around you.", features:["Bonus Cantrip","Natural Recovery","Circle Spells"]},
		{name:"Moon", source:"PHB", desc:"Wild Shape into powerful beasts.", features:["Combat Wild Shape","Circle Forms","Elemental Wild Shape"]},
		{name:"Dreams", source:"XGE", desc:"Channel the magic of the Feywild.", features:["Balm of the Summer Court","Hearth of Moonlight and Shadow"]},
		{name:"Shepherd", source:"XGE", desc:"Speak with beasts and summon spirit totems.", features:["Speech of the Woods","Spirit Totem"]},
		{name:"Spores", source:"TCE", desc:"Spread life-giving and death-dealing spores.", features:["Halo of Spores","Symbiotic Entity"]},
		{name:"Stars", source:"TCE", desc:"Chart the heavens and draw on starlight.", features:["Star Map","Starry Form"]},
		{name:"Wildfire", source:"TCE", desc:"Kindle fire to purge and regrow.", features:["Wildfire Spirit","Enhanced Bond"]},
	],
	Fighter:[
		{name:"Champion", source:"PHB", desc:"Pursue physical excellence with expanded critical hits.", features:["Improved Critical","Remarkable Athlete","Additional Fighting Style"]},
		{name:"Battle Master", source:"PHB", desc:"Use combat maneuvers to control the battlefield.", features:["Combat Superiority","Student of War","Know Your Enemy"]},
		{name:"Eldritch Knight", source:"PHB", desc:"Blend weapon mastery with arcane magic.", features:["Spellcasting","Weapon Bond","War Magic"]},
		{name:"Arcane Archer", source:"XGE", desc:"Infuse arrows with magical power.", features:["Arcane Archer Lore","Arcane Shot"]},
		{name:"Cavalier", source:"XGE", desc:"Specialize in mounted combat.", features:["Bonus Proficiency","Born to the Saddle","Unwavering Mark"]},
		{name:"Samurai", source:"XGE", desc:"Draw on indomitable fighting spirit.", features:["Bonus Proficiency","Fighting Spirit","Elegant Courtier"]},
		{name:"Psi Warrior", source:"TCE", desc:"Augment your attacks with psionic power.", features:["Psionic Power","Telekinetic Adept"]},
		{name:"Rune Knight", source:"TCE", desc:"Learn to carve magical runes.", features:["Bonus Proficiencies","Rune Carver","Giant's Might"]},
	],
	Monk:[
		{name:"Open Hand", source:"PHB", desc:"Master unarmed combat with fluid techniques.", features:["Open Hand Technique","Wholeness of Body","Tranquility"]},
		{name:"Shadow", source:"PHB", desc:"Use ki to manipulate darkness and shadow.", features:["Shadow Arts","Shadow Step","Cloak of Shadows"]},
		{name:"Four Elements", source:"PHB", desc:"Bend the elements to your will.", features:["Disciple of the Elements","Elemental Attunement"]},
		{name:"Drunken Master", source:"XGE", desc:"Confuse foes with an unpredictable style.", features:["Bonus Proficiencies","Drunken Technique","Tipsy Sway"]},
		{name:"Kensei", source:"XGE", desc:"Become one with your chosen weapons.", features:["Path of the Kensei","One with the Blade"]},
		{name:"Sun Soul", source:"XGE", desc:"Channel ki into bolts of radiant energy.", features:["Radiant Sun Bolt","Searing Arc Strike"]},
		{name:"Mercy", source:"TCE", desc:"Heal allies and sap the life of foes.", features:["Implements of Mercy","Hand of Healing","Hand of Harm"]},
		{name:"Astral Self", source:"TCE", desc:"Summon an astral projection of your body.", features:["Arms of the Astral Self","Visage of the Astral Self"]},
	],
	Paladin:[
		{name:"Devotion", source:"PHB", desc:"Embody the ideal of the just knight.", features:["Sacred Weapon","Turn the Unholy","Aura of Devotion"]},
		{name:"Ancients", source:"PHB", desc:"Protect the light of life and nature.", features:["Nature's Wrath","Turn the Faithless","Aura of Warding"]},
		{name:"Vengeance", source:"PHB", desc:"Hunt down the wicked with relentless fury.", features:["Abjure Enemy","Vow of Enmity","Relentless Avenger"]},
		{name:"Conquest", source:"XGE", desc:"Crush your enemies and inspire terror.", features:["Conquering Presence","Guided Strike","Aura of Conquest"]},
		{name:"Redemption", source:"XGE", desc:"Offer a chance at redemption to the fallen.", features:["Emissary of Peace","Rebuke the Violent","Aura of the Guardian"]},
		{name:"Glory", source:"TCE", desc:"Inspire others through acts of heroism.", features:["Peerless Athlete","Inspiring Smite","Aura of Alacrity"]},
		{name:"Watchers", source:"TCE", desc:"Guard against extraplanar threats.", features:["Watcher's Will","Abjure the Extraplanar"]},
	],
	Ranger:[
		{name:"Hunter", source:"PHB", desc:"Learn specialized techniques to hunt your quarry.", features:["Hunter's Prey","Defensive Tactics","Multiattack"]},
		{name:"Beast Master", source:"PHB", desc:"Form a powerful bond with a beast companion.", features:["Ranger's Companion","Exceptional Training","Bestial Fury"]},
		{name:"Gloom Stalker", source:"XGE", desc:"Lurk in darkness, striking with deadly precision.", features:["Dread Ambusher","Umbral Sight","Iron Mind"]},
		{name:"Horizon Walker", source:"XGE", desc:"Guard against threats from other planes.", features:["Detect Portal","Planar Warrior","Ethereal Step"]},
		{name:"Monster Slayer", source:"XGE", desc:"Hunt deadly supernatural creatures.", features:["Hunter's Sense","Slayer's Prey","Supernatural Defense"]},
		{name:"Fey Wanderer", source:"TCE", desc:"Carry a fey blessing into the world.", features:["Dreadful Strikes","Fey Wanderer Magic","Otherworldly Glamour"]},
		{name:"Swarmkeeper", source:"TCE", desc:"Gather a swarm of spirits to your side.", features:["Gathered Swarm","Swarmkeeper Magic"]},
	],
	Rogue:[
		{name:"Thief", source:"PHB", desc:"Hone your skills in stealth and larceny.", features:["Fast Hands","Second-Story Work","Supreme Sneak"]},
		{name:"Assassin", source:"PHB", desc:"Specialize in ambush and disguise.", features:["Bonus Proficiencies","Assassinate","Infiltration Expertise"]},
		{name:"Arcane Trickster", source:"PHB", desc:"Blend magic with your roguish talents.", features:["Spellcasting","Mage Hand Legerdemain","Magical Ambush"]},
		{name:"Inquisitive", source:"XGE", desc:"Root out secrets and lies.", features:["Ear for Deceit","Eye for Detail","Insightful Fighting"]},
		{name:"Mastermind", source:"XGE", desc:"Excel at intrigue and manipulation.", features:["Master of Intrigue","Master of Tactics"]},
		{name:"Scout", source:"XGE", desc:"Specialize in exploration and survival.", features:["Skirmisher","Survivalist","Superior Mobility"]},
		{name:"Swashbuckler", source:"XGE", desc:"Combine speed and style in melee combat.", features:["Fancy Footwork","Rakish Audacity"]},
		{name:"Phantom", source:"TCE", desc:"Channel the power of death into your work.", features:["Whispers of the Dead","Wails from the Grave"]},
		{name:"Soulknife", source:"TCE", desc:"Manifest blades of psychic energy.", features:["Psionic Power","Psychic Blades"]},
	],
	Sorcerer:[
		{name:"Draconic Bloodline", source:"PHB", desc:"Your magic flows from draconic heritage.", features:["Dragon Ancestor","Draconic Resilience","Elemental Affinity"]},
		{name:"Wild Magic", source:"PHB", desc:"Your magic comes from a wild surge of chaos.", features:["Wild Magic Surge","Tides of Chaos","Bend Luck"]},
		{name:"Divine Soul", source:"XGE", desc:"Divine magic flows through your veins.", features:["Divine Magic","Favored by the Gods"]},
		{name:"Shadow Magic", source:"XGE", desc:"Draw on the darkness of the Shadowfell.", features:["Eyes of the Dark","Strength of the Grave"]},
		{name:"Storm Sorcery", source:"XGE", desc:"Your power is tied to wind and lightning.", features:["Wind Speaker","Tempestuous Magic"]},
		{name:"Aberrant Mind", source:"TCE", desc:"Psionic power warps your spellcasting.", features:["Telepathic Speech","Psionic Spells"]},
		{name:"Clockwork Soul", source:"TCE", desc:"Channel the orderly power of Mechanus.", features:["Clockwork Magic","Restore Balance"]},
	],
	Warlock:[
		{name:"Archfey", source:"PHB", desc:"Your patron is a lord of the Feywild.", features:["Fey Presence","Misty Escape","Beguiling Defenses"]},
		{name:"Fiend", source:"PHB", desc:"Your patron is a powerful devil or demon.", features:["Dark One's Blessing","Dark One's Own Luck","Fiendish Resilience"]},
		{name:"Great Old One", source:"PHB", desc:"Your patron is an incomprehensible ancient being.", features:["Awakened Mind","Entropic Ward","Thought Shield"]},
		{name:"Celestial", source:"XGE", desc:"Your patron is a powerful celestial being.", features:["Bonus Cantrips","Healing Light","Radiant Soul"]},
		{name:"Hexblade", source:"XGE", desc:"Forge a pact with a weapon from the Shadowfell.", features:["Hexblade's Curse","Hex Warrior","Accursed Specter"]},
		{name:"Fathomless", source:"TCE", desc:"Your patron lurks in the ocean depths.", features:["Tentacle of the Deeps","Gift of the Sea"]},
		{name:"Genie", source:"TCE", desc:"Strike a bargain with a noble genie.", features:["Genie's Vessel","Elemental Gift"]},
	],
	Wizard:[
		{name:"Abjuration", source:"PHB", desc:"Specialize in protective and warding magic.", features:["Abjuration Savant","Arcane Ward","Projected Ward"]},
		{name:"Conjuration", source:"PHB", desc:"Master the art of summoning and teleportation.", features:["Conjuration Savant","Minor Conjuration","Benign Transposition"]},
		{name:"Divination", source:"PHB", desc:"Pierce the veil of the future with Portent.", features:["Divination Savant","Portent","Expert Divination"]},
		{name:"Enchantment", source:"PHB", desc:"Bend the minds of others to your will.", features:["Enchantment Savant","Hypnotic Gaze","Instinctive Charm"]},
		{name:"Evocation", source:"PHB", desc:"Specialize in destructive magical energy.", features:["Evocation Savant","Sculpt Spells","Potent Cantrip"]},
		{name:"Illusion", source:"PHB", desc:"Weave illusions to deceive and confound.", features:["Illusion Savant","Improved Minor Illusion","Malleable Illusions"]},
		{name:"Necromancy", source:"PHB", desc:"Manipulate the forces of life and death.", features:["Necromancy Savant","Grim Harvest","Undead Thralls"]},
		{name:"Transmutation", source:"PHB", desc:"Alter the physical properties of objects.", features:["Transmutation Savant","Minor Alchemy","Transmuter's Stone"]},
		{name:"Bladesinging", source:"SCAG", desc:"Blend swordplay and spellcasting.", features:["Training in War and Song","Bladesong","Extra Attack"]},
		{name:"Order of Scribes", source:"TCE", desc:"Awaken your spellbook as a magical companion.", features:["Awakened Spellbook","Manifest Mind"]},
		{name:"Chronurgy", source:"EGW", desc:"Bend time and manipulate fate.", features:["Chronal Shift","Temporal Awareness"]},
		{name:"Graviturgy", source:"EGW", desc:"Control the forces of gravity.", features:["Adjust Density","Gravity Well"]},
	],
	Artificer:[
		{name:"Alchemist", source:"TCE", desc:"Craft experimental elixirs to aid allies.", features:["Tool Proficiency","Alchemist Spells","Experimental Elixir"]},
		{name:"Armorer", source:"TCE", desc:"Craft and wear a suit of magical armor.", features:["Tool Proficiency","Armorer Spells","Power Armor"]},
		{name:"Artillerist", source:"TCE", desc:"Create magical cannons to blast enemies.", features:["Tool Proficiency","Artillerist Spells","Eldritch Cannon"]},
		{name:"Battle Smith", source:"TCE", desc:"Craft a steel defender to aid in combat.", features:["Tool Proficiency","Battle Smith Spells","Steel Defender"]},
	],
};

// Populated at startup by loadRuleData() from the site's own backgrounds.json (+ prerelease/brew).
let BACKGROUNDS = [];

const ALL_SKILLS = [
	{name:"Acrobatics", ability:"dex"}, {name:"Animal Handling", ability:"wis"},
	{name:"Arcana", ability:"int"}, {name:"Athletics", ability:"str"},
	{name:"Deception", ability:"cha"}, {name:"History", ability:"int"},
	{name:"Insight", ability:"wis"}, {name:"Intimidation", ability:"cha"},
	{name:"Investigation", ability:"int"}, {name:"Medicine", ability:"wis"},
	{name:"Nature", ability:"int"}, {name:"Perception", ability:"wis"},
	{name:"Performance", ability:"cha"}, {name:"Persuasion", ability:"cha"},
	{name:"Religion", ability:"int"}, {name:"Sleight of Hand", ability:"dex"},
	{name:"Stealth", ability:"dex"}, {name:"Survival", ability:"wis"},
];

// Populated at startup by loadRuleData() from the site's own feats.json (+ prerelease/brew).
let FEATS = [];

const SPELLS = {
	Bard: {cantrips:["Blade Ward","Dancing Lights","Friends","Light","Mage Hand","Mending","Message","Minor Illusion","Prestidigitation","Thunderclap","True Strike","Vicious Mockery"],
		level1:["Animal Friendship","Bane","Charm Person","Color Spray","Command","Comprehend Languages","Cure Wounds","Detect Magic","Disguise Self","Dissonant Whispers","Earth Tremor","Faerie Fire","Feather Fall","Healing Word","Heroism","Hideous Laughter","Identify","Illusory Script","Longstrider","Silent Image","Sleep","Speak with Animals","Thunderwave","Unseen Servant","Wild Cunning","Zephyr Strike"]},
	Cleric: {cantrips:["Guidance","Light","Mending","Resistance","Sacred Flame","Spare the Dying","Thaumaturgy","Toll the Dead","Word of Radiance"],
		level1:["Bane","Bless","Ceremony","Command","Create or Destroy Water","Cure Wounds","Detect Evil and Good","Detect Magic","Detect Poison and Disease","Guiding Bolt","Healing Word","Inflict Wounds","Protection from Evil and Good","Purify Food and Drink","Sanctuary","Shield of Faith"]},
	Druid: {cantrips:["Control Flames","Create Bonfire","Druidcraft","Frostbite","Guidance","Gust","Infestation","Mending","Poison Spray","Produce Flame","Resistance","Shape Water","Shillelagh","Thunderclap"],
		level1:["Absorb Elements","Animal Friendship","Beast Bond","Charm Person","Create or Destroy Water","Cure Wounds","Detect Magic","Detect Poison and Disease","Earth Tremor","Entangle","Faerie Fire","Fog Cloud","Goodberry","Healing Word","Ice Knife","Jump","Longstrider","Protection from Evil and Good","Purify Food and Drink","Speak with Animals","Thunderwave","Wild Cunning"]},
	Paladin: {cantrips:[], level1:["Bless","Command","Ceremony","Compelled Duel","Cure Wounds","Detect Evil and Good","Detect Magic","Detect Poison and Disease","Divine Favor","Heroism","Protection from Evil and Good","Purify Food and Drink","Sanctuary","Shield of Faith","Wrathful Smite","Zephyr Strike"]},
	Ranger: {cantrips:[], level1:["Absorb Elements","Animal Friendship","Beast Bond","Cure Wounds","Detect Magic","Detect Poison and Disease","Ensnaring Strike","Fog Cloud","Goodberry","Hail of Thorns","Hunter's Mark","Jump","Longstrider","Speak with Animals","Wild Cunning","Zephyr Strike"]},
	Sorcerer: {cantrips:["Acid Splash","Blade Ward","Booming Blade","Chill Touch","Control Flames","Create Bonfire","Dancing Lights","Fire Bolt","Friends","Frostbite","Green-Flame Blade","Gust","Infestation","Light","Lightning Lure","Mage Hand","Mending","Message","Minor Illusion","Poison Spray","Prestidigitation","Ray of Frost","Shape Water","Shocking Grasp","Sword Burst","Thunderclap","True Strike"],
		level1:["Burning Hands","Catapult","Charm Person","Chromatic Orb","Color Spray","Comprehend Languages","Detect Magic","Disguise Self","Earth Tremor","Expeditious Retreat","False Life","Feather Fall","Fog Cloud","Ice Knife","Jump","Mage Armor","Magic Missile","Ray of Sickness","Shield","Silent Image","Sleep","Thunderwave","Witch Bolt"]},
	Warlock: {cantrips:["Blade Ward","Booming Blade","Chill Touch","Create Bonfire","Eldritch Blast","Friends","Green-Flame Blade","Infestation","Lightning Lure","Mage Hand","Minor Illusion","Poison Spray","Prestidigitation","Sword Burst","Thunderclap","True Strike"],
		level1:["Armor of Agathys","Arms of Hadar","Cause Fear","Charm Person","Comprehend Languages","Expeditious Retreat","Hellish Rebuke","Hex","Hunger of Hadar","Illusory Script","Protection from Evil and Good","Unseen Servant","Witch Bolt"]},
	Wizard: {cantrips:["Acid Splash","Blade Ward","Booming Blade","Chill Touch","Control Flames","Create Bonfire","Dancing Lights","Fire Bolt","Friends","Frostbite","Green-Flame Blade","Gust","Infestation","Light","Lightning Lure","Mage Hand","Mending","Message","Minor Illusion","Poison Spray","Prestidigitation","Ray of Frost","Shape Water","Shocking Grasp","Sword Burst","Thunderclap","Toll the Dead","True Strike"],
		level1:["Absorb Elements","Alarm","Burning Hands","Catapult","Cause Fear","Charm Person","Chromatic Orb","Color Spray","Comprehend Languages","Detect Magic","Disguise Self","Earth Tremor","Expeditious Retreat","False Life","Feather Fall","Find Familiar","Fog Cloud","Grease","Ice Knife","Identify","Illusory Script","Jump","Longstrider","Mage Armor","Magic Missile","Protection from Evil and Good","Ray of Sickness","Shield","Silent Image","Sleep","Tasha's Hideous Laughter","Tenser's Floating Disk","Thunderwave","Unseen Servant","Witch Bolt"]},
	Artificer: {cantrips:["Acid Splash","Booming Blade","Create Bonfire","Dancing Lights","Fire Bolt","Frostbite","Green-Flame Blade","Guidance","Light","Mage Hand","Magic Stone","Mending","Message","Poison Spray","Prestidigitation","Ray of Frost","Resistance","Shocking Grasp","Spare the Dying","Sword Burst","Thorn Whip","Thunderclap"],
		level1:["Absorb Elements","Alarm","Catapult","Cure Wounds","Detect Magic","Disguise Self","Expeditious Retreat","Faerie Fire","False Life","Feather Fall","Grease","Identify","Jump","Longstrider","Purify Food and Drink","Sanctuary","Snare","Tasha's Caustic Brew"]},
};

const CANTRIP_MAX = {Bard:2, Cleric:3, Druid:2, Sorcerer:4, Warlock:2, Wizard:3, Artificer:2};
const L1_MAX = {Bard:2, Cleric:2, Druid:2, Paladin:2, Ranger:2, Sorcerer:2, Warlock:2, Wizard:6, Artificer:2};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function scoreMod(s) { return Math.floor((s - 10) / 2); }
function fmtMod(m) { return (m >= 0 ? "+" : "") + m; }
function profBonus(lvl) { return Math.ceil(lvl / 4) + 1; }
function getHP(cls, conScore, lvl) { return cls.hd + scoreMod(conScore) + (lvl - 1) * (Math.floor(cls.hd / 2) + 1 + scoreMod(conScore)); }
function pbCost(s) { return s <= 13 ? s - 8 : (s - 8) + (s - 13); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
// Class/subclass features aren't backed by real per-feature entry data (only the class/subclass
// as a whole is), so this stays a placeholder for those. Races and feats use the real-data
// helpers below (entriesToHtml/entriesToPlainText) instead, since we have full `entries` for them.
function featureDesc(_name) { return "Full description coming soon."; }
function equipmentDesc(_name) { return "Full item description coming soon."; }
function spellDesc(_name) { return "Full spell description coming soon."; }

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
 * Races tagged lineage:"VRGR" (Aasimar MPMM, Aarakocra MPMM, etc.) carry NO race.ability array
 * at all — the "flexible ability scores" rule (+2/+1 to two different abilities, or +1/+1/+1 to
 * three) is a global rule implied by the tag, not per-race data, so it's hardcoded here.
 */
function isVrgrLineage(race) { return race?.lineage === "VRGR"; }

/** A race's player-choice ability bonus, e.g. {from: ["str","dex",...], count: 1, amount: 1}, or null if fixed-only. */
function raceAbilityChoice(race) {
	const entry = (race?.ability || []).find(e => e && e.choose);
	if (!entry) return null;
	const {from, count = 1, amount = 1} = entry.choose;
	return {from: from && from.length ? from : ABILITIES, count, amount};
}

function raceWalkSpeed(r) {
	if (!r) return 30;
	return (typeof r.speed === "number" ? r.speed : r.speed?.walk) ?? 30;
}

/** "Speed 30ft · Fly 30ft · Medium" style summary line from real race.speed/race.size. */
function raceSpeedSizeSummary(r) {
	if (!r) return "";
	const bits = [];
	const walk = typeof r.speed === "number" ? r.speed : r.speed?.walk;
	if (walk != null) bits.push(`Speed ${walk}ft`);
	if (r.speed?.fly) bits.push(`Fly ${r.speed.fly === true ? "(=walk)" : r.speed.fly + "ft"}`);
	if (r.speed?.swim) bits.push(`Swim ${r.speed.swim === true ? "(=walk)" : r.speed.swim + "ft"}`);
	if (r.speed?.climb) bits.push(`Climb ${r.speed.climb === true ? "(=walk)" : r.speed.climb + "ft"}`);
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
			const from = (entry.choose.from || []).map(a => ABILITY_LABELS[a] || a.toUpperCase()).join("/");
			out.push(`<span class="cb__asi">Choose ${entry.choose.count || 1} of ${from || "any"} <strong>+${entry.choose.amount || 1}</strong></span>`);
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

const EQUIPMENT_TYPE_LABELS = {
	instrumentMusical: "a musical instrument (your choice)",
	setGaming: "a gaming set (your choice)",
	toolArtisan: "a set of artisan's tools (your choice)",
};

/** Best-effort human-readable label for one real startingEquipment item entry. */
function equipItemLabel(it) {
	if (typeof it === "string") return it.split("|")[0];
	if (Array.isArray(it)) return it.map(equipItemLabel).join(" + ");
	if (it && typeof it === "object") {
		if (it.displayName) return it.displayName;
		if (it.equipmentType) return EQUIPMENT_TYPE_LABELS[it.equipmentType] || `${it.equipmentType} (your choice)`;
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
 * Splits a real background's startingEquipment into unconditional items (an "_" set) and
 * choice rows (sets with lettered options like {a: [...], b: [...]}), each option bundled
 * into one display string so it can reuse the same single-toggle chip UI as class equipment.
 */
function backgroundEquipmentSets(bg) {
	const fixed = [];
	const choiceRows = [];
	(bg?.startingEquipment || []).forEach(set => {
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
});

// ─── REAL DATA LOADING ─────────────────────────────────────────────────────
// Mirrors StatGenPage.pInit()/_pLoadRaces()/_pLoadBackgrounds()/_pLoadFeats() in js/statgen.js —
// loads everything (site + prerelease + brew) upfront rather than lazily, per project preference.
let modalFilterRaces = null;
let modalFilterBackgrounds = null;
let modalFilterFeats = null;

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
	[RACES, BACKGROUNDS, FEATS] = await Promise.all([
		pLoadAllFiltered(UrlUtil.PG_RACES, "race"),
		pLoadAllFiltered(UrlUtil.PG_BACKGROUNDS, "background"),
		pLoadAllFiltered(UrlUtil.PG_FEATS, "feat"),
	]);

	modalFilterRaces = new ModalFilterRaces({namespace: "charactercreator.races", isRadio: true, allData: RACES});
	modalFilterBackgrounds = new ModalFilterBackgrounds({namespace: "charactercreator.backgrounds", isRadio: true, allData: BACKGROUNDS});
	modalFilterFeats = new ModalFilterFeats({namespace: "charactercreator.feats", isRadio: true, allData: FEATS});

	await Promise.all([
		modalFilterRaces.pPopulateHiddenWrapper(),
		modalFilterBackgrounds.pPopulateHiddenWrapper(),
		modalFilterFeats.pPopulateHiddenWrapper(),
	]);
}

const CB = {
	step: 0,
	char: EMPTY_CHAR(),
	search: "",
	expandedFeat: null,
	spellTab: "cantrips",

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
		if (isVrgrLineage(this.char.race)) {
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
	finalScores() {
		const racial = this.racialASI();
		let b;
		if (this.char.abilityMode === "standard") {
			b = {str:10,dex:10,con:10,int:10,wis:10,cha:10};
			ABILITIES.forEach(a => { if (this.char.standardAssign[a] !== null) b[a] = this.char.standardAssign[a]; });
		} else if (this.char.abilityMode === "pointbuy") {
			b = {...this.char.pointBuy};
		} else {
			b = {...this.char.manual};
		}
		ABILITIES.forEach(a => { b[a] = (b[a] || 10) + (racial[a] || 0); });
		return b;
	},
	pb() { return profBonus(this.char.level); },
	bgSkills() { return backgroundSkillNames(this.char.background); },
	allProfSkills() { return new Set([...this.bgSkills(), ...this.char.skills]); },
	clsSkillOpts() {
		if (!this.char.cls) return [];
		return this.char.cls.skillChoices === "any" ? ALL_SKILLS.map(s => s.name) : this.char.cls.skillChoices;
	},
	isCaster() { return CASTER_CLASSES.includes(this.char.cls?.name); },

	canProceed() {
		const {step, char} = this;
		if (step === 0) return char.name.trim().length > 0;
		if (step === 1) return char.race !== null;
		if (step === 2) return char.cls !== null;
		if (step === 3) return true;
		if (step === 4) return char.background !== null;
		if (step === 5 && char.abilityMode === "standard") return ABILITIES.every(a => char.standardAssign[a] !== null);
		if (step === 6) return char.skills.length === (char.cls?.numSkills || 2);
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
		const list = CLASSES.map(c => `
			<div class="cb__sel-card ${this.char.cls?.name === c.name ? "cb__sel-card--active" : ""}" data-cls="${esc(c.name)}">
				<span class="cb__sel-title">${esc(c.name)}</span>${srcBadge(c.source)}
				<div class="cb__sel-sub">d${c.hd} · ${c.primary.map(p => ABILITY_LABELS[p]).join("/")}</div>
			</div>
		`).join("");

		const detail = this.char.cls ? `
			<div class="cb__detail-card">
				<p class="cb__detail-title">${esc(this.char.cls.name)}</p>
				<div class="cb__stat-grid">
					${[["Hit Die","d"+this.char.cls.hd],["Saves",this.char.cls.saves.map(s=>ABILITY_LABELS[s].slice(0,3)).join("/")],["HP at 1st",this.char.cls.hd],["Skills",this.char.cls.numSkills+" choices"]].map(([l,v]) => `
						<div class="cb__stat-box"><p class="cb__stat-label">${esc(l)}</p><p class="cb__stat-value">${esc(v)}</p></div>
					`).join("")}
				</div>
				<p class="cb__section-header">1st Level Features</p>
				<div>${this.char.cls.features.map(f => `<span class="cb__pill cb__pill--purple" title="${esc(featureDesc(f))}">${esc(f)}</span>`).join("")}</div>
				${CASTER_CLASSES.includes(this.char.cls.name) ? `<p class="cb__caster-note">✦ Spellcaster — you'll pick spells later</p>` : ""}
			</div>
		` : `<p class="cb__placeholder">Select a class to see details</p>`;

		setTimeout(() => {
			document.querySelectorAll("[data-cls]").forEach(el => el.addEventListener("click", () => {
				this.char.cls = CLASSES.find(x => x.name === el.dataset.cls);
				this.char.subclass = null;
				this.render();
			}));
		}, 0);

		return `<div class="cb__two-col"><div class="cb__scroll-list">${list}</div><div>${detail}</div></div>`;
	},

	// ─── STEP 3: SUBCLASS ──────────────────────────────────────────────────
	renderSubclass() {
		if (!this.char.cls) return `<p class="cb__placeholder">Select a class first (step 3).</p>`;
		const options = SUBCLASSES[this.char.cls.name] || [];
		const list = options.map(sc => `
			<div class="cb__sel-card ${this.char.subclass?.name === sc.name ? "cb__sel-card--active" : ""}" data-subclass="${esc(sc.name)}">
				<span class="cb__sel-title">${esc(sc.name)}</span>${srcBadge(sc.source)}
				<div class="cb__sel-sub">${esc(sc.desc)}</div>
			</div>
		`).join("");
		const detail = this.char.subclass ? `
			<div class="cb__detail-card">
				<p class="cb__detail-title">${esc(this.char.subclass.name)}</p>
				<p class="cb__detail-sub cb__detail-sub--italic">${esc(this.char.subclass.desc)}</p>
				<p class="cb__section-header">Subclass Features</p>
				<div>${this.char.subclass.features.map(f => `<span class="cb__pill cb__pill--purple" title="${esc(featureDesc(f))}">${esc(f)}</span>`).join("")}</div>
			</div>
		` : `<p class="cb__placeholder">Select a subclass to see details</p>`;

		setTimeout(() => {
			document.querySelectorAll("[data-subclass]").forEach(el => el.addEventListener("click", () => {
				this.char.subclass = options.find(x => x.name === el.dataset.subclass);
				this.render();
			}));
		}, 0);

		return `
			<div class="cb__two-col">
				<div class="cb__scroll-list">
					<p class="cb__hint">${esc(this.char.cls.name)} subclasses are typically chosen at level 3 (or 1 for Cleric/Sorcerer/Warlock). Select now to plan ahead.</p>
					${list}
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
				this.render();
			});
			document.querySelectorAll("[data-bg]").forEach(el => el.addEventListener("click", () => {
				this.char.background = BACKGROUNDS.find(x => x.name === el.dataset.bg && x.source === el.dataset.bgSource);
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
		const vrgrUi = isVrgrLineage(this.char.race) ? `
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
		}, 0);

		return `<div>${asiChoiceUi}${vrgrUi}${modeBtns}${body}</div>`;
	},

	// ─── STEP 6: SKILLS ────────────────────────────────────────────────────
	renderSkills() {
		const numNeeded = this.char.cls?.numSkills || 2;
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
		const clsEquip = this.char.cls ? [...(this.char.cls.bgEquip || [])] : [];
		const {fixed: bgEquip, choiceRows: bgChoiceRows} = backgroundEquipmentSets(this.char.background);
		const clsChoices = this.char.cls?.equipment || [];

		const choiceRows = clsChoices.map((choices, i) => `
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
				const choices = clsChoices[rowI];
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
			${clsChoices.length ? `<p class="cb__section-header">${esc(this.char.cls?.name || "Class")} Starting Equipment (choose one per row)</p>${choiceRows}` : ""}
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
		if (!this.isCaster()) {
			return `
				<div class="cb__no-caster">
					<p class="cb__no-caster-icon">⚔️</p>
					<p class="cb__no-caster-title">${esc(this.char.cls?.name || "Your class")} doesn't cast spells</p>
					<p class="cb__hint">Skip ahead to the character sheet.</p>
				</div>
			`;
		}
		const spellData = SPELLS[this.char.cls.name];
		const tab = this.spellTab;
		const maxCantrips = tab === "cantrips" ? (CANTRIP_MAX[this.char.cls.name] || 2) : 0;
		const maxL1 = tab === "level1" ? (L1_MAX[this.char.cls.name] || 2) : 0;
		const currentList = tab === "cantrips" ? spellData.cantrips : spellData.level1;
		const maxPick = tab === "cantrips" ? maxCantrips : maxL1;
		const chosenInTab = this.char.spells.filter(s => currentList.includes(s));

		const tabs = [];
		if (spellData.cantrips.length) tabs.push(["cantrips", "Cantrips"]);
		if (spellData.level1.length) tabs.push(["level1", "1st Level"]);

		const tabBtns = tabs.map(([k, l]) => `<button class="cb__mode-btn ${tab === k ? "cb__mode-btn--active" : ""}" data-spell-tab="${k}">${l}</button>`).join("");

		const grid = currentList.map(spell => {
			const chosen = this.char.spells.includes(spell);
			const canPick = chosen || chosenInTab.length < maxPick;
			return `
				<div class="cb__spell-row ${chosen ? "cb__spell-row--chosen" : ""}" style="cursor:${canPick ? "pointer" : "not-allowed"};opacity:${canPick ? 1 : 0.45}" data-spell="${esc(spell)}" data-can-pick="${canPick}" title="${esc(spellDesc(spell))}">
					<div class="cb__skill-dot ${chosen ? "cb__skill-dot--on-blue" : ""}"></div>
					<span class="cb__skill-name">${esc(spell)}</span>
				</div>
			`;
		}).join("");

		setTimeout(() => {
			document.querySelectorAll("[data-spell-tab]").forEach(el => el.addEventListener("click", () => { this.spellTab = el.dataset.spellTab; this.render(); }));
			document.querySelectorAll("[data-spell]").forEach(el => el.addEventListener("click", () => {
				if (el.dataset.canPick !== "true") return;
				const spell = el.dataset.spell;
				if (this.char.spells.includes(spell)) this.char.spells = this.char.spells.filter(s => s !== spell);
				else this.char.spells = [...this.char.spells, spell];
				this.render();
			}));
		}, 0);

		return `
			<p class="cb__hint">Choose your starting spells for <strong>${esc(this.char.cls.name)}</strong>.</p>
			<div class="cb__spell-tabs">${tabBtns}<span class="cb__spell-count">(${chosenInTab.length}/${maxPick} chosen)</span></div>
			<div class="cb__spell-grid">${grid}</div>
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
		const cantrips = char.spells.filter(s => SPELLS[char.cls?.name]?.cantrips?.includes(s));
		const level1 = char.spells.filter(s => SPELLS[char.cls?.name]?.level1?.includes(s));

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
						const score = finalScores[a], m = scoreMod(score), isSave = char.cls?.saves.includes(a);
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
						const isProf = char.cls?.saves.includes(a), bonus = scoreMod(finalScores[a]) + (isProf ? pb : 0);
						return `
						<div class="cb__save-row">
							<div class="cb__skill-dot ${isProf ? "cb__skill-dot--on" : ""}"></div>
							<span class="cb__save-name">${ABILITY_LABELS[a]}</span>
							<span class="cb__save-bonus">${fmtMod(bonus)}</span>
						</div>`;
					}).join("")}
					${char.cls ? `<div class="cb__block"><p class="cb__section-header">Class Features</p><div>${char.cls.features.map(f => `<span class="cb__pill cb__pill--purple" title="${esc(featureDesc(f))}">${esc(f)}</span>`).join("")}</div></div>` : ""}
					${char.subclass ? `<div class="cb__block"><p class="cb__section-header">Subclass Features</p><div>${char.subclass.features.map(f => `<span class="cb__pill cb__pill--indigo" title="${esc(featureDesc(f))}">${esc(f)}</span>`).join("")}</div></div>` : ""}
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
				${cantrips.length ? `<p class="cb__detail-meta">Cantrips</p><div class="cb__block">${cantrips.map(s => `<span class="cb__pill cb__pill--blue" title="${esc(spellDesc(s))}">${esc(s)}</span>`).join("")}</div>` : ""}
				${level1.length ? `<p class="cb__detail-meta">1st Level</p><div>${level1.map(s => `<span class="cb__pill cb__pill--blue" title="${esc(spellDesc(s))}">${esc(s)}</span>`).join("")}</div>` : ""}
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
		const cantrips = char.spells.filter(sp => SPELLS[char.cls?.name]?.cantrips?.includes(sp));
		const level1 = char.spells.filter(sp => SPELLS[char.cls?.name]?.level1?.includes(sp));
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
<div class="stats">${[["HP",hp],["AC",ac],["Initiative",fmtMod(scoreMod(s.dex))],["Speed",raceWalkSpeed(char.race) + "ft"],["Hit Die","d" + (char.cls?.hd || "—")]].map(([l,v]) => `<div class="stat"><div class="l">${esc(l)}</div><div class="v">${esc(v)}</div></div>`).join("")}</div>
<div class="grid">
<div>${ABILITIES.map(a => `<div class="ab"><div class="an">${ABILITY_LABELS[a].slice(0,3)}</div><div class="av">${s[a]}</div><div class="am">${fmtMod(scoreMod(s[a]))}</div>${char.cls?.saves.includes(a) ? '<div style="font-size:8px;color:green;">save</div>' : ""}</div>`).join("")}</div>
<div><h3>Saving Throws</h3><table>${ABILITIES.map(a => { const p = char.cls?.saves.includes(a), b = scoreMod(s[a]) + (p ? pb_ : 0); return `<tr><td>${p ? "●" : "○"}</td><td>${ABILITY_LABELS[a]}</td><td style="text-align:right;font-weight:600;">${fmtMod(b)}</td></tr>`; }).join("")}</table>
${char.cls ? `<h3>Class Features</h3><div>${char.cls.features.map(f => `<span class="tag">${esc(f)}</span>`).join("")}</div>` : ""}
${char.subclass ? `<h3>Subclass: ${esc(char.subclass.name)}</h3><div>${char.subclass.features.map(f => `<span class="tag">${esc(f)}</span>`).join("")}</div>` : ""}
${char.race ? `<h3>Racial Traits</h3><div>${namedSubEntries(char.race.entries).map(t => `<span class="tag">${esc(t.name)}</span>`).join("")}</div>` : ""}
${char.background && backgroundFeature(char.background) ? `<h3>Background Feature</h3><div>${entriesToHtml([backgroundFeature(char.background)])}</div>` : ""}
${char.feats.length ? `<h3>Feats</h3><div>${char.feats.map(cf => `<span class="tag">${esc(cf.name)}</span>`).join("")}</div>` : ""}
</div>
<div><h3>Skills</h3><table>${ALL_SKILLS.map(sk => { const p = allProf.has(sk.name), b = scoreMod(s[sk.ability]) + (p ? pb_ : 0); return `<tr><td>${p ? "●" : "○"}</td><td>${esc(sk.name)}</td><td style="color:#888;font-size:10px;">${ABILITY_LABELS[sk.ability].slice(0,3)}</td><td style="text-align:right;font-weight:600;">${fmtMod(b)}</td></tr>`; }).join("")}</table></div>
</div>
${char.equipment.length ? `<div class="section"><h3>Equipment</h3><div>${char.equipment.map(e => `<span class="tag">${esc(safeEquipTag(e))}</span>`).join("")}</div></div>` : ""}
${char.spells.length ? `<div class="section"><h3>Spells</h3>${cantrips.length ? `<p style="font-size:10px;color:#666;margin-bottom:3px;">Cantrips</p><div>${cantrips.map(sp => `<span class="tag">${esc(sp)}</span>`).join("")}</div>` : ""}${level1.length ? `<p style="font-size:10px;color:#666;margin:6px 0 3px;">1st Level</p><div>${level1.map(sp => `<span class="tag">${esc(sp)}</span>`).join("")}</div>` : ""}</div>` : ""}
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
