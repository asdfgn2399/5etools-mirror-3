document.addEventListener("DOMContentLoaded", function() {
  document.querySelectorAll("input:not([data-readonly='false'])").forEach(input => {
    input.setAttribute("readonly", "true");
  });

  const data = JSON.parse(localStorage.getItem("characterBuilderData"));
  if (!data) return;

  // Update character name - TODO
  // @ts-ignore
  document.querySelector("input[name='charname']").value = data.charname || "";

  // Update class and level
  // @ts-ignore
  document.querySelector("input[name='classlevel']").value = data.classDropdown || "";

  // Update subclass
  // @ts-ignore
  document.querySelector("input[name='subclass']").value = data.subclassDropdown || "";

  // Update background
  // @ts-ignore
  document.querySelector("input[name='background']").value = data.backgroundDropdown || "";

  // Update race
  // @ts-ignore
  document.querySelector("input[name='race']").value = data.speciesDropdown || "";

  // Update alignment - TODO
  // @ts-ignore
  document.querySelector("input[name='alignment']").value = data.alignment || "";

  // Update experience points - TODO
  // @ts-ignore
  document.querySelector("input[name='experiencepoints']").value = data.experiencepoints || "";

  // Update ability scores and modifiers
  const abilityScores = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
  abilityScores.forEach(score => {
    // @ts-ignore
    document.querySelector(`input[name='${score}score']`).value = data.abilityValues[score] || "";
    const modifier = Math.floor((data.abilityValues[score] - 10) / 2);
    // @ts-ignore
    document.querySelector(`input[name='${score}mod']`).value = modifier >= 0 ? `+${modifier}` : `${modifier}`;
  });

  // Update other fields as needed
  // ...
});