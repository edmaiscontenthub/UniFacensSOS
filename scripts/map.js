const params = new URLSearchParams(window.location.search);
const lat = params.get("lat");
const lon = params.get("lon");

if(!lat || !lon){
  document.querySelector("p").innerHTML = "Localização inválida.";
  throw new Error("Latitude ou longitude ausente.");
}

const mapUrl = `https://www.google.com/maps?q=${lat},${lon}&z=17&t=k&output=embed`;

setTimeout(()=>{
  document.getElementById("map-container").innerHTML =
    `<iframe src="${mapUrl}" allowfullscreen loading="lazy"></iframe>`;
  document.getElementById("loader").style.display = "none";
  document.getElementById("map-container").style.display = "block";
},2000);
console.log("ss")