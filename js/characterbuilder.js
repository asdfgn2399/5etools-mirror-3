// Class loading and rendering

let availableClasses = [];
let availableSubclasses = [];

async function loadClasses() {
  const officialData = await DataUtil.class.loadJSON();
  const homebrewSources = await BrewUtil2.pGetBrew("class");
  let homebrewClassData = []
  let homebrewSubclassData = []
  homebrewSources.forEach(src => {
    if (src?.body?.class?.length > 0) homebrewClassData.push(...src.body.class);
    if (src?.body?.subclass?.length > 0) homebrewSubclassData.push(...src.body.subclass);
  });
  let allClassData = officialData.class.concat(homebrewClassData)
  let allSubclassData = officialData.subclass.concat(homebrewSubclassData)
  renderClasses(allClassData);
  availableSubclasses = allSubclassData;
}

function renderClasses(classes) {
  let loadedClasses = []
  classes.forEach(cls => {
    loadedClasses.push({name: `${cls.name} - ${cls.source}`, value:`${cls.name} - ${cls.source}`}); // Load all subclasses to value?
  });
  availableClasses = loadedClasses;
}

function displayClasses() {
  const dropdown = document.getElementById("classDropdown");
  const subclassDropdown = document.getElementById("subclassDropdown");

  availableClasses.forEach(cls => {
    const option = document.createElement("option");
    option.value = cls.value;
    option.textContent = cls.name;
    dropdown.appendChild(option);
  });

  // Add event listener for change event
  dropdown.addEventListener("change", function() {
    // @ts-ignore
    const selectedClass = dropdown.options[dropdown.selectedIndex].value;
    handleClassSelection(selectedClass);
    saveInputs();
  });

  subclassDropdown.addEventListener("change", function() {
    // @ts-ignore
    const selectedSubclass = subclassDropdown.options[subclassDropdown.selectedIndex].value;
    if (selectedSubclass) console.log("Selected subclass:", selectedSubclass);
    else console.log("No subclass selected");
    saveInputs();
  });
}

// Function to handle class selection
function handleClassSelection(selectedClass, quiet) {
  const subclassSelection = document.getElementById("subclassSelection");
  const subclassDropdown = document.getElementById("subclassDropdown");
  subclassDropdown.innerHTML = "<option value=\"\">Select a subclass</option>;" // Clear previous options

  if (selectedClass) {
    if (!quiet) console.log("Selected class:", selectedClass);
    let [name, source] = selectedClass.split(" - ");
    subclassSelection.hidden = false;

    let matchingSubclasses = availableSubclasses.filter(subclass => {
      return subclass.className === name && subclass.classSource === source;
    });

    matchingSubclasses.forEach(cls => {
      const option = document.createElement("option");
      option.value = `${cls.name} - ${cls.source}`;
      option.textContent = `${cls.name} - ${cls.source}`;
      subclassDropdown.appendChild(option);
    });
  } else {
    if (!quiet) console.log("No class selected");
    subclassSelection.hidden = true;
  }
}

// End region

// Background loading and rendering

let availableBackgrounds = [];

async function loadBackgrounds() {
  const officialData = await DataUtil.background.loadJSON();
  const homebrewSources = await BrewUtil2.pGetBrew("background");
  let homebrewBackgroundData = []
  homebrewSources.forEach(src => {
    if (src?.body?.background?.length > 0) homebrewBackgroundData.push(...src.body.background);
  });
  let allBackgroundData = officialData.background.concat(homebrewBackgroundData)
  let loadedBackgrounds = []
  allBackgroundData.forEach(bg => {
    loadedBackgrounds.push({name: `${bg.name} - ${bg.source}`, value:`${bg.name} - ${bg.source}`});
  });
  availableBackgrounds = loadedBackgrounds;
}

function renderBackgrounds(allBackgroundData) {
  // Add options from background data if necessary
}

function displayBackgrounds() {
  const dropdown = document.getElementById("backgroundDropdown");

  availableBackgrounds.forEach(bg => {
    const option = document.createElement("option");
    option.value = bg.value;
    option.textContent = bg.name;
    dropdown.appendChild(option);
  });

  dropdown.addEventListener("change", function() {
    // @ts-ignore
    const selectedBackground = dropdown.options[dropdown.selectedIndex].value;
    if (selectedBackground) console.log("Selected background:", selectedBackground);
    else console.log("No background selected");
    saveInputs();
  });
}

document.getElementById("alignmentDropdown").addEventListener("change", function() {
  // @ts-ignore
  const selectedAlignment = Parser.alignmentListToFull(document.getElementById("alignmentDropdown").value.split('')).toTitleCase();
  if (selectedAlignment) console.log("Selected size:", selectedAlignment);
  else console.log("No size selected");

  saveInputs();
});

// End region

// Species loading and rendering

let availableSpecies = [];
let allLoadedSpecies = [];
var speciesChoiceData = {};

async function loadSpecies() {
  const officialData = await DataUtil.race.loadJSON();
  const homebrewSources = await BrewUtil2.pGetBrew("race");
  let homebrewSpeciesData = []
  homebrewSources.forEach(src => {
    if (src?.body?.race?.length > 0) homebrewSpeciesData.push(...src.body.race);
  })
  let allSpeciesData = officialData.race.concat(homebrewSpeciesData)
  let loadedSpecies = []
  allSpeciesData.forEach(species => {
    loadedSpecies.push({name: `${species.name} - ${species.source}`, value:`${species.name} - ${species.source}`});
  });
  availableSpecies = loadedSpecies;
  allLoadedSpecies = allSpeciesData;
}

function renderSpecies(selectedSpecies, loadedSCD) {
  const speciesID = selectedSpecies.split(" - ");
  const speciesData = allLoadedSpecies.find(species => species.name === speciesID[0] && species.source === speciesID[1]);
  console.log("Species data:", speciesData);

  let detailsDiv = document.getElementById("speciesDetails");
  detailsDiv.innerHTML = "";
  
  // Check for and display lineage choices
  if (speciesData._versions?.length > 0) {
    detailsDiv.innerHTML += `     <br>
        <p>Choose Lineage <i>(May be optional)</i></p>
				<select id="lineageDropdown">
					<option value="">Select a lineage</option>
				</select><br>`;

    // TODO Last: Check for sneaky cases where there are additional choices (e.g. "Elf - XPHB" needs to pick a spellcasting ability)

    speciesData._versions.forEach(version => {
      const option = document.createElement("option");
      option.value = version.name + ' - ' + version.source;
      option.textContent = version.name + ' - ' + version.source;
      document.getElementById("lineageDropdown").appendChild(option);
    });

    // Ensure the event listener is set after the element is fully added to the DOM
    setTimeout(() => {
      document.getElementById("lineageDropdown").addEventListener("change", function() {
        // @ts-ignore
        const selectedLineage = document.getElementById("lineageDropdown").value;
        if (selectedLineage) console.log("Selected lineage:", selectedLineage);
        else console.log("No lineage selected");

        speciesChoiceData.lineage = selectedLineage;
        saveInputs();
      });
      
      // @ts-ignore
      document.getElementById("lineageDropdown").value = loadedSCD?.lineage ?? "";
    }, 0);
  }

  // Check for and display size choices
  if (speciesData.size.length > 1) {
    detailsDiv.innerHTML += `     <br>
        <p>Choose Size</p>
				<select id="sizeDropdown">
					<option value="">Select a size</option>
				</select><br>`;
    speciesData.size.forEach(size => {
      const option = document.createElement("option");
      option.value = size;
      option.textContent = ([size]).map(sz => Parser.sizeAbvToFull(sz)).join("/");
      document.getElementById("sizeDropdown").appendChild(option);
    });

    // Ensure the event listener is set after the element is fully added to the DOM
    setTimeout(() => {
      document.getElementById("sizeDropdown").addEventListener("change", function() {
        // @ts-ignore
        const selectedSize = [document.getElementById("sizeDropdown").value].map(sz => Parser.sizeAbvToFull(sz)).join("/");
        if (selectedSize) console.log("Selected size:", selectedSize);
        else console.log("No size selected");

        // @ts-ignore
        speciesChoiceData.size = document.getElementById("sizeDropdown").value;
        saveInputs();
      });

      // @ts-ignore
      document.getElementById("sizeDropdown").value = loadedSCD?.size ?? "";
    }, 0);
  }

  // Check for and display skill choices
  if (speciesData.skillProficiencies?.length > 0) {
    detailsDiv.innerHTML += `     <br>
        <p>Skill Proficiencies (${Parser.skillProficienciesToFull(speciesData.skillProficiencies)})</p>`;
    
    speciesData.skillProficiencies.forEach(skillOption => {
      // Following code is taken and modified from parser.js line 1145
      if (skillOption.any) {
        skillOption = MiscUtil.copyFast(skillOption);
				skillOption.choose = {"from": Object.keys(Parser.SKILL_TO_ATB_ABV), "count": skillOption.any};
				delete skillOption.any; 
      }

      const keys = Object.keys(skillOption).sort(SortUtil.ascSortLower);

      const ixChoose = keys.indexOf("choose");
			if (~ixChoose) keys.splice(ixChoose, 1);

      if (~ixChoose) {
				const chObj = skillOption.choose;
        chObj.from = chObj.from.sort(SortUtil.ascSortLower);
				const count = chObj.count ?? 1;
        
        let skillChoiceIDs = [];
        for (let i = 0; i < count; i++) {
          let selectID = "skillDropdown" + String(i)
          detailsDiv.innerHTML += `     ${i == 0 ? "" : "<br>"}
          <select id="${selectID}">
            <option value="">Select a skill</option>
          </select><br>`

          chObj.from.forEach(sk => {
            const option = document.createElement("option");
            option.value = sk;
            option.textContent = String(sk).charAt(0).toUpperCase() + String(sk).slice(1);
            document.getElementById(selectID).appendChild(option);
          });

          skillChoiceIDs.push(selectID);
        }

        setTimeout(() => {
          for (let i = 0; i < skillChoiceIDs.length; i++) {
            let selectID = skillChoiceIDs[i];
            document.getElementById(selectID).addEventListener("change", function() {
              // @ts-ignore
              const selectedSkill = document.getElementById(selectID).value;
              saveSkill(selectedSkill, i);
            });

            // @ts-ignore
            if (loadedSCD?.skill) document.getElementById(selectID).value = loadedSCD.skill[i] ?? "";
          }
        }, 0);
      }

      // End modified code
      
    });
  }

  // Check for and display feat choices
  if (speciesData.feats?.length > 0) {
    detailsDiv.innerHTML += `     <br>
    <p>Choose Feat</p>
    <select id="featDropdown">
      <option value="">Select a feat</option>
    </select><br>`;

    let availableFeats = []
    speciesData.feats.forEach(featInfo => {
      if (featInfo.anyFromCategory) {
        availableFeats = allFeats.filter(feat => featInfo.anyFromCategory.category.find(c => c === feat.category));
        if (featInfo.anyFromCategory.count > 1) console.error("No case logic for this yet! (Select multiple feats)");
      } else if (featInfo.any) {
        availableFeats = allFeats;
        if (featInfo.any > 1) console.error("No case logic for this yet! (Select multiple feats)");
      } else console.error("No case logic for this yet! (Is not anyFromCategory)")
    });

    availableFeats.forEach(feat => {
      const option = document.createElement("option");
      option.value = feat.name + ' - ' + feat.source;
      option.textContent = feat.name + ' - ' + feat.source;
      document.getElementById("featDropdown").appendChild(option);
    });

    document.getElementById("featDropdown").addEventListener("change", function() {
      // @ts-ignore
      const selectedFeat = document.getElementById("featDropdown").value;
      if (selectedFeat) console.log("Selected feat:", selectedFeat);
      else console.log("No feat selected");

      speciesChoiceData.feat = selectedFeat;
      saveInputs();
    });

    // @ts-ignore
    document.getElementById("featDropdown").value = loadedSCD?.feat ?? "";
  }

  // Check for and display non-standard language choices
  if (speciesData.languageProficiencies?.length > 0) {
    // TODO Last: Overwrite language dropdowns with given languages
    console.error("No case logic for this yet! (Non-standard language proficiencies (Pre-2024))");
  }
}

function saveSkill(selectedSkill, i) {
  // @ts-ignore
  if (selectedSkill) console.log("Selected skill proficiency:", selectedSkill.uppercaseFirst());
  else console.log("No skill proficiency selected");

  if (!speciesChoiceData.skill) speciesChoiceData.skill = {};
  speciesChoiceData.skill[i] = selectedSkill;
  saveInputs();
}

function displaySpecies() {
  const dropdown = document.getElementById("speciesDropdown");

  availableSpecies.forEach(species => {
    const option = document.createElement("option");
    option.value = species.value;
    option.textContent = species.name;
    dropdown.appendChild(option);
  });

  dropdown.addEventListener("change", function() {
    // @ts-ignore
    const selectedSpecies = dropdown.options[dropdown.selectedIndex].value;
    if (selectedSpecies) {
      console.log("Selected species:", selectedSpecies);
    }
    else console.log("No species selected");

    // Reset species choice data
    speciesChoiceData = {}

    saveInputs();
    renderSpecies(selectedSpecies);
  });
}

// End region

// Language loading and rendering

let allLanguageData = []
async function loadLanguages() {
  const officialData = await DataUtil.language.loadJSON();
  const homebrewSources = await BrewUtil2.pGetBrew("language");
  let homebrewLanguageData = []
  homebrewSources.forEach(src => {
    if (src?.body?.language?.length > 0) homebrewLanguageData.push(...src.body.language);
  })
  allLanguageData = officialData.language.concat(homebrewLanguageData)
}

function displayLanguages() {
  let standardLanguages = allLanguageData.filter(lang => lang.type === "standard");
  let exoticLanguages = allLanguageData.filter(lang => lang.type === "exotic");
  let secretLanguages = allLanguageData.filter(lang => lang.type === "secret");

  const dropdown0 = document.getElementById("languagesDropdown0");
  const dropdown1 = document.getElementById("languagesDropdown1");

  function createOptGroup(label, languages) {
    const optGroup = document.createElement("optgroup");
    optGroup.label = label;

    languages.forEach(lang => {
      const option = document.createElement("option");
      option.value = lang.name + ' - ' + lang.source;
      option.textContent = lang.name + ' - ' + lang.source;
      optGroup.appendChild(option);
    });

    return optGroup;
  }

  dropdown0.appendChild(createOptGroup("Standard Languages", standardLanguages));
  dropdown1.appendChild(createOptGroup("Standard Languages", standardLanguages));

  dropdown0.appendChild(createOptGroup("Exotic Languages", exoticLanguages));
  dropdown1.appendChild(createOptGroup("Exotic Languages", exoticLanguages));

  dropdown0.appendChild(createOptGroup("Secret Languages", secretLanguages));
  dropdown1.appendChild(createOptGroup("Secret Languages", secretLanguages));

  dropdown0.addEventListener("change", function() {
    // @ts-ignore
    const selectedLanguage = dropdown0.options[dropdown0.selectedIndex].value;
    if (selectedLanguage) console.log("Selected language:", selectedLanguage);
    else console.log("No language selected");
    saveInputs();
  });

  dropdown1.addEventListener("change", function() {
    // @ts-ignore
    const selectedLanguage = dropdown1.options[dropdown1.selectedIndex].value;
    if (selectedLanguage) console.log("Selected language:", selectedLanguage);
    else console.log("No language selected");
    saveInputs();
  });
}

// End region

// Ability score handling

function updateModifier(ability, isFinal = false) {
  const prefix = isFinal ? "base" : "chosen";
  // @ts-ignore
  const score = document.getElementById(`${prefix}-${ability}`).value;
  const modifier = Math.floor((score - 10) / 2);
  const modifierText = modifier >= 0 ? `+${modifier}` : `${modifier}`;
  document.getElementById(`${prefix}-${ability}-modifier`).textContent = modifierText;
  document.getElementById(`${prefix}-${ability}-modifier`).dataset.mod = String(modifier);
}

function displayAbilityScores() {
  const abilityScores = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
  abilityScores.forEach(score => {
    // Update modifiers for base scores
    updateModifier(score, true);

    // Add event listener for chosen scores
    document.getElementById(`chosen-${score}`).addEventListener("input", function () {
      updateModifier(score);
      saveInputs();
    });
  });
}

function handleAbilityScoreMethodChange() {
  // @ts-ignore
  const method = document.getElementById("abilityScoreMethod").value;
  const pointBuySection = document.getElementById("pointBuySection");
  const abilityScoresContainer = document.getElementById("abilityScoresContainer");

  if (method === "pointBuy") {
    pointBuySection.classList.remove("hidden");
    abilityScoresContainer.querySelectorAll("input").forEach(input => {
      input.disabled = false;
      input.addEventListener("input", handlePointBuyChange);
    });
    handlePointBuyChange();
  } else if (method === "standardArray") {
    pointBuySection.classList.add("hidden");
    applyStandardArray();
  } else if (method === "rolledArray") {
    pointBuySection.classList.add("hidden");
    applyRolledArray();
  } else if (method === "custom") {
    pointBuySection.classList.add("hidden");
    abilityScoresContainer.querySelectorAll("input").forEach(input => {
      input.disabled = false;
      input.removeEventListener("input", handlePointBuyChange);
    });
  }
}

function applyPointBuy() {
  // Add button for this
  const pointsRemaining = document.getElementById("pointsRemaining");
  pointsRemaining.textContent = "27";
  document.querySelectorAll(".stat-input").forEach(input => {
    // @ts-ignore
    input.value = 8;
    // @ts-ignore
    updateModifier(input.name.replaceAll("chosen-", ""));
  });
}

function handlePointBuyChange() {
  const costs = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
  let totalCost = 0;

  document.querySelectorAll(".stat-input").forEach(input => {
    // @ts-ignore
    const value = parseInt(input.value, 10);
    totalCost += costs[value] || 0;
  });

  const pointsRemaining = 27 - totalCost;
  document.getElementById("pointsRemaining").textContent = String(pointsRemaining);

  if (pointsRemaining < 0) {
    alert("You have exceeded the point buy limit!");
  }
}

function applyStandardArray() {
  const standardArray = [15, 14, 13, 12, 10, 8];
  document.querySelectorAll(".stat-input:not(.locked-input)").forEach((input, index) => {
    // @ts-ignore
    input.value = standardArray[index];
    // @ts-ignore
    updateModifier(input.name.replaceAll("chosen-", ""));
    // @ts-ignore
    input.disabled = true;
  });
}

function applyRolledArray() {
  const rolledArray = Array.from({ length: 6 }, () =>
    [1, 2, 3, 4].map(() => Math.floor(Math.random() * 6) + 1).sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0)
  );
  document.querySelectorAll(".stat-input").forEach((input, index) => {
    // @ts-ignore
    input.value = rolledArray[index];
    // @ts-ignore
    updateModifier(input.name.replaceAll("chosen-", ""));
    // @ts-ignore
    input.disabled = true;
  });
}

// Add event listener for ability score method change
document.getElementById("abilityScoreMethod").addEventListener("change", handleAbilityScoreMethodChange);

// End region

// Equipment loading and rendering (TODO)

// End region

// Feats loading

let allFeats = [];

async function loadFeats() {
  const officialData = await DataUtil.feat.loadJSON();
  const homebrewSources = await BrewUtil2.pGetBrew("feat");
  let homebrewFeatData = [];
  homebrewSources.forEach(src => {
    if (src?.body?.feat?.length > 0) homebrewFeatData.push(...src.body.feat);
  });
  allFeats = officialData.feat.concat(homebrewFeatData);
}

// End region

// Viewing Character Sheet

document.getElementById("viewCharacterSheetButton").addEventListener("click", function() {
  window.location.href = "characterviewer.html";
});

// End region

// Saving and loading inputs

function saveInputs() {
  // @ts-ignore
  const classDropdown = document.getElementById("classDropdown").value;
  // @ts-ignore
  const subclassDropdown = document.getElementById("subclassDropdown").value;
  // @ts-ignore
  const backgroundDropdown = document.getElementById("backgroundDropdown").value;
  // @ts-ignore
  const alignmentDropdown = document.getElementById("alignmentDropdown").value;
  // @ts-ignore
  const speciesDropdown = document.getElementById("speciesDropdown").value;
  // @ts-ignore
  const languageDropdowns = [document.getElementById("languagesDropdown0").value, document.getElementById("languagesDropdown1").value];

  const abilityScores = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
  const abilityValues = abilityScores.reduce((acc, score) => {
    // @ts-ignore
    acc[score] = document.getElementById(`chosen-${score}`).value;
    return acc;
  }, {});
  //@ts-ignore
  const abilityMethod = document.getElementById("abilityScoreMethod").value;

  const data = {
    classDropdown,
    subclassDropdown,
    backgroundDropdown,
    alignmentDropdown,
    speciesDropdown,
    speciesChoiceData,
    languageDropdowns,
    abilityValues,
    abilityMethod,
  };

  localStorage.setItem("characterBuilderData", JSON.stringify(data));
}

function loadSavedInputs() {
  const data = JSON.parse(localStorage.getItem("characterBuilderData"));
  if (!data) return;

  // @ts-ignore
  document.getElementById("classDropdown").value = data.classDropdown;
  handleClassSelection(data.classDropdown, true);
  // @ts-ignore
  document.getElementById("subclassDropdown").value = data.subclassDropdown;
  // @ts-ignore
  document.getElementById("backgroundDropdown").value = data.backgroundDropdown;
  // @ts-ignore
  document.getElementById("alignmentDropdown").value = data.alignmentDropdown;
  // @ts-ignore
  document.getElementById("speciesDropdown").value = data.speciesDropdown;
  
  speciesChoiceData = data.speciesChoiceData ?? {};
  renderSpecies(data.speciesDropdown, speciesChoiceData);

  // @ts-ignore
  document.getElementById("languagesDropdown0").value = data.languageDropdowns[0] ?? []
  // @ts-ignore
  document.getElementById("languagesDropdown1").value = data.languageDropdowns[1] ?? []

  // @ts-ignore
  document.getElementById("abilityScoreMethod").value = data.abilityMethod ?? "pointBuy";
  const abilityScores = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
  abilityScores.forEach(score => {
    // @ts-ignore
    document.getElementById(`chosen-${score}`).value = data.abilityValues[score];
    updateModifier(score);
  });
  handleAbilityScoreMethodChange();
}

// End region

// Run on DOMContentLoaded

document.addEventListener("DOMContentLoaded", async function() {
  await loadClasses();
  await loadBackgrounds();
  await loadSpecies();
  await loadLanguages();
  await loadFeats();

  displayClasses()
  displayBackgrounds()
  displaySpecies()
  displayLanguages()
  displayAbilityScores()

  loadSavedInputs();
});

// End region