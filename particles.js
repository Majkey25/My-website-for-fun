const particleCanvas = document.createElement('canvas');
particleCanvas.id = 'particles';
document.body.prepend(particleCanvas);

const particleContext = particleCanvas.getContext('2d');

function resizeCanvas() {
  particleCanvas.width = window.innerWidth;
  particleCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const COLOR_CHOICES = ['#7cf0c9', '#6ea8ff', '#f6b9ff', '#9be5ff'];
const BACKGROUND_PARTICLE_COUNT = 90;
const BURST_PARTICLE_COUNT = 14;
const BURST_LIFE = 70;

function randomColor() {
  const index = Math.floor(Math.random() * COLOR_CHOICES.length);
  return COLOR_CHOICES[index];
}

const backgroundParticles = [];
for (let index = 0; index < BACKGROUND_PARTICLE_COUNT; index += 1) {
  backgroundParticles.push({
    x: Math.random() * particleCanvas.width,
    y: Math.random() * particleCanvas.height,
    velocityX: (Math.random() - 0.5) * 0.6,
    velocityY: (Math.random() - 0.5) * 0.6,
    radius: Math.random() * 2.2 + 1,
    color: randomColor()
  });
}

const burstParticles = [];

function createBurst(x, y) {
  for (let index = 0; index < BURST_PARTICLE_COUNT; index += 1) {
    burstParticles.push({
      x,
      y,
      velocityX: (Math.random() - 0.5) * 2,
      velocityY: (Math.random() - 0.5) * 2,
      radius: Math.random() * 2 + 1,
      life: BURST_LIFE,
      color: randomColor()
    });
  }
}

document.querySelectorAll('.social-button, .project-link').forEach((element) => {
  element.addEventListener('mouseenter', (event) => {
    const rectangle = event.currentTarget.getBoundingClientRect();
    createBurst(rectangle.left + rectangle.width / 2, rectangle.top);
  });
});

function updateParticles() {
  particleContext.clearRect(0, 0, particleCanvas.width, particleCanvas.height);

  backgroundParticles.forEach((particle) => {
    particle.x += particle.velocityX;
    particle.y += particle.velocityY;
    if (particle.x < 0 || particle.x > particleCanvas.width) {
      particle.velocityX *= -1;
    }
    if (particle.y < 0 || particle.y > particleCanvas.height) {
      particle.velocityY *= -1;
    }
    particleContext.fillStyle = particle.color;
    particleContext.beginPath();
    particleContext.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    particleContext.fill();
  });

  for (let index = burstParticles.length - 1; index >= 0; index -= 1) {
    const particle = burstParticles[index];
    particle.x += particle.velocityX;
    particle.y += particle.velocityY;
    particle.life -= 1;
    particleContext.globalAlpha = particle.life / BURST_LIFE;
    particleContext.fillStyle = particle.color;
    particleContext.beginPath();
    particleContext.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    particleContext.fill();
    particleContext.globalAlpha = 1;
    if (particle.life <= 0) {
      burstParticles.splice(index, 1);
    }
  }

  requestAnimationFrame(updateParticles);
}

updateParticles();
