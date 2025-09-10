const clockElement = document.querySelector('.analog-clock');
const hourHand = document.querySelector('.hour-hand');
const minuteHand = document.querySelector('.minute-hand');
const secondHand = document.querySelector('.second-hand');

const CLOCK_NUMBER_COUNT = 12;
const CLOCK_NUMBER_RADIUS_RATIO = 0.85;

function createClockNumbers() {
  const radius = clockElement.offsetWidth / 2;
  const distanceFromCenter = radius * CLOCK_NUMBER_RADIUS_RATIO;
  for (let number = 1; number <= CLOCK_NUMBER_COUNT; number++) {
    const numberElement = document.createElement('div');
    numberElement.classList.add('clock-number');
    numberElement.textContent = String(number);
    const angleRadian = (number / CLOCK_NUMBER_COUNT) * 2 * Math.PI;
    const positionX = radius + distanceFromCenter * Math.sin(angleRadian);
    const positionY = radius - distanceFromCenter * Math.cos(angleRadian);
    numberElement.style.left = `${positionX}px`;
    numberElement.style.top = `${positionY}px`;
    clockElement.appendChild(numberElement);
  }
}

function setRotation(handElement, rotationRatio) {
  handElement.style.setProperty('--rotation', rotationRatio * 360);
}

function updateClock() {
  const currentTime = new Date();
  const secondsRatio = currentTime.getSeconds() / 60;
  const minutesRatio = (currentTime.getMinutes() + secondsRatio) / 60;
  const hoursRatio = (currentTime.getHours() % 12 + minutesRatio) / 12;
  setRotation(secondHand, secondsRatio);
  setRotation(minuteHand, minutesRatio);
  setRotation(hourHand, hoursRatio);
  requestAnimationFrame(updateClock);
}

createClockNumbers();
requestAnimationFrame(updateClock);

