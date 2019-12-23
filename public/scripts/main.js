console.log("working");

function getDark() {
  getComputedStyle(document.documentElement).getPropertyValue("--main-blue"); // #999999

  document.documentElement.style.setProperty("--main-blue", "black");
}
