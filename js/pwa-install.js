(function() {
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    const heroBtn = document.getElementById('heroInstallBtn');
    if (heroBtn) heroBtn.style.display = 'inline-flex';
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    const heroBtn = document.getElementById('heroInstallBtn');
    if (heroBtn) heroBtn.style.display = 'none';
  });

  document.addEventListener('DOMContentLoaded', () => {
    const heroBtn = document.getElementById('heroInstallBtn');
    if (heroBtn) {
      heroBtn.addEventListener('click', async () => {
        if (!deferredPrompt) {
          alert('브라우저 주소창의 설치 아이콘을 눌러 홈 화면에 추가할 수 있습니다.');
          return;
        }
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
        heroBtn.style.display = 'none';
      });
    }
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
})();
