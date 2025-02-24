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

document.addEventListener("DOMContentLoaded", async function() {
  await loadClasses();
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
  });

  subclassDropdown.addEventListener("change", function() {
    // @ts-ignore
    const selectedSubclass = subclassDropdown.options[subclassDropdown.selectedIndex].value;
    if (selectedSubclass) console.log("Selected subclass:", selectedSubclass);
    else console.log("No subclass selected");
  });
});

// Function to handle class selection
function handleClassSelection(selectedClass) {
  const subclassSelection = document.getElementById("subclassSelection");
  const subclassDropdown = document.getElementById("subclassDropdown");
  subclassDropdown.innerHTML = "<option value=\"\">Select a subclass</option>;" // Clear previous options

  if (selectedClass) {
    console.log("Selected class:", selectedClass);
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
    console.log("No class selected");
    subclassSelection.hidden = true;
  }
}

// End region
