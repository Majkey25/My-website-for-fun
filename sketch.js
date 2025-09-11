const sketchCanvas = document.getElementById('sketch-canvas');
const sketchContext = sketchCanvas.getContext('2d');
const accentColor = getComputedStyle(document.documentElement)
  .getPropertyValue('--ACCENT').trim();

function resizeCanvas() {
  const heightValue = getComputedStyle(document.documentElement)
    .getPropertyValue('--SKETCH_HEIGHT');
  sketchCanvas.width = sketchCanvas.clientWidth;
  sketchCanvas.height = parseInt(heightValue, 10);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

let isDrawing = false;

function startDrawing(event) {
  isDrawing = true;
  sketchContext.beginPath();
  sketchContext.moveTo(event.offsetX, event.offsetY);
}

function drawLine(event) {
  if (!isDrawing) return;
  sketchContext.lineTo(event.offsetX, event.offsetY);
  sketchContext.strokeStyle = accentColor;
  sketchContext.lineWidth = SKETCH_LINE_WIDTH;
  sketchContext.lineCap = 'round';
  sketchContext.stroke();
}

function endDrawing() {
  isDrawing = false;
}

sketchCanvas.addEventListener('pointerdown', startDrawing);
sketchCanvas.addEventListener('pointermove', drawLine);
window.addEventListener('pointerup', endDrawing);
sketchCanvas.addEventListener('pointerleave', endDrawing);

document.getElementById('clear-canvas').addEventListener('click', () => {
  sketchContext.clearRect(0, 0, sketchCanvas.width, sketchCanvas.height);
});
