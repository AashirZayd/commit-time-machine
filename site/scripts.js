// commit-time-machine — Landing Page Scripts
(function () {
  'use strict';

  // Copy to clipboard for install command
  const copyBtn = document.getElementById('copy-install-btn');
  const installCmd = document.getElementById('install-cmd');

  if (copyBtn && installCmd) {
    copyBtn.addEventListener('click', async () => {
      const textToCopy = installCmd.innerText.trim();
      const originalText = copyBtn.querySelector('.copy-text')?.innerText || 'Copy';

      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(textToCopy);
        } else {
          // Fallback for non-https / older browsers
          const textArea = document.createElement('textarea');
          textArea.value = textToCopy;
          textArea.style.position = 'fixed';
          textArea.style.left = '-999999px';
          textArea.style.top = '-999999px';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          document.execCommand('copy');
          textArea.remove();
        }

        const copyTextEl = copyBtn.querySelector('.copy-text');
        if (copyTextEl) {
          copyTextEl.innerText = 'Copied!';
        }
        copyBtn.style.borderColor = '#10b981';
        copyBtn.style.color = '#10b981';

        setTimeout(() => {
          if (copyTextEl) {
            copyTextEl.innerText = originalText;
          }
          copyBtn.style.borderColor = '';
          copyBtn.style.color = '';
        }, 2000);
      } catch (err) {
        console.error('Failed to copy to clipboard:', err);
      }
    });
  }
})();
