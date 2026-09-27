(() => {
  // Cards with data-dialog explain a project in place instead of linking out.
  document.querySelectorAll('.project[data-dialog]').forEach(card => {
    const dialog = document.getElementById(card.dataset.dialog);
    const trigger = card.querySelector('button');
    card.addEventListener('click', () => {
      if (dialog.open) return;
      dialog.showModal();
      // Start on the dialog itself so a mouse click does not leave a focus ring on the close button.
      dialog.focus();
    });
    dialog.addEventListener('click', event => {
      const rect = dialog.getBoundingClientRect();
      const backdrop = event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom);
      if (backdrop || event.target.closest('[data-close]')) dialog.close();
    });
    dialog.addEventListener('close', () => trigger.focus());
  });
})();
