const hourHand = document.querySelector('.hour-hand');
const minuteHand = document.querySelector('.minute-hand');
const secondHand = document.querySelector('.second-hand');

function setRotation(handElement, rotationRatio) {
  handElement.style.setProperty('--rotation', rotationRatio * 360);
}

function updateClock() {
  const currentTime = new Date();
  const secondsRatio = currentTime.getSeconds() / 60;
  const minutesRatio = (currentTime.getMinutes() + secondsRatio) / 60;
  const hoursRatio = (currentTime.getHours() % 12 + minutesRatio) / 12;
  setRotation(secondHand, secondsRatio); // move second hand
  setRotation(minuteHand, minutesRatio); // move minute hand
  setRotation(hourHand, hoursRatio);     // move hour hand
  requestAnimationFrame(updateClock);
}

requestAnimationFrame(updateClock);

