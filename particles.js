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

const particleCount = 60;
const particles = [];
for (let index = 0; index < particleCount; index += 1) {
  particles.push({
    x: Math.random() * particleCanvas.width,
    y: Math.random() * particleCanvas.height,
    velocityX: (Math.random() - 0.5) * 0.5,
    velocityY: (Math.random() - 0.5) * 0.5,
    radius: Math.random() * 2 + 1
  });
}

function updateParticles() {
  particleContext.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
  particleContext.fillStyle = 'rgba(255,255,255,0.3)';
  particles.forEach((particle) => {
    particle.x += particle.velocityX;
    particle.y += particle.velocityY;
    if (particle.x < 0 || particle.x > particleCanvas.width) {
      particle.velocityX *= -1;
    }
    if (particle.y < 0 || particle.y > particleCanvas.height) {
      particle.velocityY *= -1;
    }
    particleContext.beginPath();
    particleContext.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    particleContext.fill();
  });
  requestAnimationFrame(updateParticles);
}

updateParticles();
